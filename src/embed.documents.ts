import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import logger from './logger';
import { dbConnect } from './db.connect';
import { Metadata } from 'chromadb';
import { DocumentType } from './document.type';
import { BATCH_SIZE, CHUNK_OVERLAP, CHUNK_SIZE } from './constants';
import { AzureOpenAIEmbeddingFunction } from './azure.embedding.function';
import { summarizeDocument } from './summarize/document';
import { summariseBodyOfKnowledge } from './summarize/body.of.knowledge';
import { summaryLength } from './summarize/graph';
import { IngestionPurpose } from './event.bus/events/ingest.body.of.knowledge';
import { BodyOfKnowledgeReadResult } from './data.readers/types';

const batch = <T>(arr: T[], size: number): Array<Array<T>> =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

export const embedDocuments = async (
  bodyOfKnowledge: BodyOfKnowledgeReadResult,
  docs: Document[],
  purpose: IngestionPurpose
) => {
  const bokID = bodyOfKnowledge.id;
  logger.defaultMeta.bodyOfKnowledgeId = bokID;

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.EMBEDDINGS_DEPLOYMENT_NAME;

  if (!endpoint || !key || !deployment) {
    logger.error({
      error:
        'AI configuration missing from ENV or incomplete. Config presence is',
      AZURE_OPENAI_ENDPOINT: !!endpoint,
      AZURE_OPENAI_API_KEY: key ? '[REDACTED]' : 'MISSING',
      EMBEDDINGS_DEPLOYMENT_NAME1: !!deployment,
    });
    return false;
  }

  const embeddingFunction = new AzureOpenAIEmbeddingFunction(
    endpoint,
    key,
    deployment
  );

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  const name = `${bokID}-${purpose}`;
  logger.info(name);
  const ids: string[] = [];
  const documents: string[] = [];
  const metadatas: Array<Metadata> = [];

  const summaries: string[] = [];

  logger.info(`Splitting documents for body of knowledge: ${bokID}`);

  for (let docIndex = 0; docIndex < docs.length; docIndex++) {
    const doc = docs[docIndex];
    let splitted;
    // do not split spreadhseets to prevent data loss
    if (doc.metadata.type === DocumentType.SPREADSHEET) {
      splitted = [doc];
    } else {
      splitted = await splitter.splitDocuments([doc]);
    }

    logger.info(
      `Splitted document ${docIndex + 1} / ${docs.length}; ID: (${
        doc.metadata.documentId
      }) of type ${doc.metadata.type}; # of chunks: ${splitted.length}`
    );

    splitted.forEach((chunk, chunkIndex) => {
      ids.push(
        `${chunk.metadata.documentId}-${chunk.metadata.type}-chunk${chunkIndex}`
      );
      documents.push(chunk.pageContent);
      metadatas.push({
        ...chunk.metadata,
        embeddingType: 'chunk',
        chunkIndex,
      });
    });

    if (doc.pageContent.length > summaryLength) {
      try {
        logger.info(
          `Starting summarization for document ${docIndex + 1} (ID: ${
            doc.metadata.documentId
          })`
        );
        const documentSummary = await summarizeDocument(splitted);
        logger.info(
          `Finished summarization for document ${docIndex + 1} (ID: ${
            doc.metadata.documentId
          })`
        );
        ids.push(`${doc.metadata.documentId}-${doc.metadata.type}-summary`);
        documents.push(documentSummary);
        metadatas.push({ ...doc.metadata, embeddingType: 'summary' });

        summaries.push(documentSummary);
      } catch (err) {
        logger.error(err);
      }
    } else {
      summaries.push(doc.pageContent);
    }
  }

  const bokDescriptions = new Document({ pageContent: summaries.join('\n') });
  const bokChunks = await splitter.splitDocuments([bokDescriptions]);
  logger.info('Starting body of knowledge summarization');
  const bokSummary = await summariseBodyOfKnowledge(bokChunks);
  logger.info('Finished body of knowledge summarization');
  ids.push('body-of-knowledge-summary');
  documents.push(bokSummary);

  metadatas.push({
    documentId: bokID,
    source:
      bodyOfKnowledge.profile?.url || bodyOfKnowledge.about?.profile.url || '',
    type: 'bodyOfKnowledgeSummary',
    title:
      bodyOfKnowledge.profile?.displayName ||
      bodyOfKnowledge.about?.profile.displayName ||
      '',
  });

  logger.info('Connecting to Chroma...');
  const client = dbConnect();
  const heartbeat = await client.heartbeat();
  logger.info(`Chroma heartbeat ${heartbeat}`);

  try {
    logger.info(`Deleting old collection: ${name}`);
    await client.deleteCollection({ name });
    logger.info(`Collection: ${name} deleted.`);
  } catch (error) {
    logger.info(`Collection '${name}' doesn't exist. First time ingestion.`);
  }

  logger.info(`Creating collection: ${name}`);
  const collection = await client.getOrCreateCollection({
    name,
    metadata: { createdAt: new Date().getTime() },
    embeddingFunction,
  });

  logger.info(`Total number of chunks: ${documents.length}`);
  logger.info('Batching documents...');
  const docBatches = batch(documents, BATCH_SIZE);
  logger.info(`Batch size is ${BATCH_SIZE}; # of batches ${docBatches.length}`);

  const metadataBatches = batch(metadatas, BATCH_SIZE);
  const idsBatches = batch(ids, BATCH_SIZE);

  for (let i = 0; i < docBatches.length; i++) {
    try {
      logger.info(
        `Adding batch ${i} to collection: ${name}; Batch size: ${docBatches[i].length}`
      );
      await collection.add({
        ids: idsBatches[i],
        documents: docBatches[i],
        metadatas: metadataBatches[i],
      });
      logger.info(
        `Batch ${i} of size ${docBatches[i].length} added to collection ${name}`
      );
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
  return true;
};
