import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import logger from './logger';
import { dbConnect } from './db.connect';
import { Metadata } from 'chromadb';
import { DocumentType } from './document.type';
import { BATCH_SIZE, CHUNK_OVERLAP, CHUNK_SIZE } from './constants';
import { OpenAIEmbeddingFunction } from '@chroma-core/openai';
import { summarizeDocument } from './summarize/document';
import { summariseBodyOfKnowledge } from './summarize/body.of.knowledge';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { IngestionPurpose } from './event.bus/events/ingest.body.of.knowledge';
import { BodyOfKnowledgeReadResult } from './data.readers/types';

const batch = <T>(arr: T[], size: number): Array<Array<T>> =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

export const embedDocuments = async (
  bodyOfKnowledge: BodyOfKnowledgeReadResult,
  docs: Document[],
  purpose: IngestionPurpose,
  model: BaseChatModel
) => {
  const bokID = bodyOfKnowledge.id;
  logger.defaultMeta.bodyOfKnowledgeId = bokID;

  const endpoint = process.env.EMBEDDINGS_ENDPOINT;
  const key = process.env.EMBEDDINGS_API_KEY;
  const embeddingsModel = process.env.EMBEDDINGS_MODEL_NAME;

  if (!endpoint || !key || !embeddingsModel) {
    logger.error({
      error:
        'AI configuration missing from ENV or incomplete. Config presence is',
      EMBEDDINGS_ENDPOINT: !!endpoint,
      EMBEDDINGS_API_KEY: key ? '[REDACTED]' : 'MISSING',
      EMBEDDINGS_MODEL_NAME: !!embeddingsModel,
    });
    return false;
  }

  const embeddingFunction = new OpenAIEmbeddingFunction({
    apiBase: endpoint,
    apiKey: key,
    modelName: embeddingsModel,
  });

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
      const rawChunks = await splitter.splitDocuments([doc]);
      // Merge short chunks into the next chunk to avoid tiny fragments
      const MIN_CHUNK_LENGTH = 200;
      splitted = [];
      let carry = '';
      for (const chunk of rawChunks) {
        if (carry) {
          chunk.pageContent = `${carry}\n${chunk.pageContent}`;
          carry = '';
        }
        if (chunk.pageContent.length < MIN_CHUNK_LENGTH && splitted.length === 0) {
          // Short first chunk — carry forward to merge with next
          carry = chunk.pageContent;
        } else {
          splitted.push(chunk);
        }
      }
      // If carry is left (all chunks were short, or only one short chunk), push it
      if (carry) {
        if (splitted.length > 0) {
          splitted[splitted.length - 1].pageContent += `\n${carry}`;
        } else {
          splitted = [new Document({ pageContent: carry, metadata: doc.metadata })];
        }
      }
    }

    logger.info(
      `Document ${docIndex + 1}/${docs.length} [${doc.metadata.documentId}] ` +
        `type=${doc.metadata.type}, length=${doc.pageContent.length} chars, ` +
        `chunks=${splitted.length} [${splitted.map((c, i) => `${i}:${c.pageContent.length}`).join(', ')}]`
    );

    splitted.forEach((chunk, chunkIndex) => {
      ids.push(
        `${chunk.metadata.documentId}-${chunk.metadata.type}-chunk${chunkIndex}`
      );
      documents.push(chunk.pageContent);
      // Strip non-primitive metadata values (e.g. LangChain's `loc` object)
      // ChromaDB only accepts string, number, boolean, or null
      const cleanMeta: Record<string, string | number | boolean | null> = {};
      for (const [k, v] of Object.entries({ ...chunk.metadata, embeddingType: 'chunk', chunkIndex })) {
        if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          cleanMeta[k] = v;
        }
      }
      metadatas.push(cleanMeta);
    });

    if (splitted.length > 3) {
      // Document was fragmented into many chunks — summarize to preserve coherence
      logger.info(
        `Document ${docIndex + 1}/${docs.length} requires summarization: ` +
          `${splitted.length} chunks (>3 threshold)`
      );
      const summaryStartTime = Date.now();

      try {
        const documentSummary = await summarizeDocument(splitted, model);

        const summaryDuration = (
          (Date.now() - summaryStartTime) /
          1000
        ).toFixed(2);
        logger.info(
          `Document ${docIndex + 1}/${docs.length} summary complete: ` +
            `generated ${documentSummary.length} chars in ${summaryDuration}s`
        );

        ids.push(`${doc.metadata.documentId}-${doc.metadata.type}-summary`);
        documents.push(documentSummary);
        const summaryMeta: Record<string, string | number | boolean | null> = {};
        for (const [k, v] of Object.entries({ ...doc.metadata, embeddingType: 'summary' })) {
          if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            summaryMeta[k] = v;
          }
        }
        metadatas.push(summaryMeta);

        summaries.push(documentSummary);
      } catch (err) {
        logger.error(
          `Failed to summarize document ${docIndex + 1}/${docs.length} ` +
            `(ID: ${doc.metadata.documentId}):`,
          err
        );
      }
    } else {
      // Few chunks — push each chunk separately to summaries for BoK input
      logger.info(
        `Document ${docIndex + 1}/${docs.length}: ${splitted.length} chunks, using chunks directly`
      );
      for (const chunk of splitted) {
        summaries.push(chunk.pageContent);
      }
    }
  }

  const totalInputChars = docs.reduce((sum, doc) => sum + doc.pageContent.length, 0);
  const totalChunkChars = documents.reduce((sum, doc) => sum + doc.length, 0);
  logger.info(
    `Character processing complete: ${totalInputChars} input chars processed into ${documents.length} chunks (${totalChunkChars} total chunk chars)`
  );

  logger.info(
    `Creating body of knowledge summary from ${summaries.length} document(s); ` +
      `combined content: ${summaries.join('\n').length} chars`
  );

  const bokDescriptions = new Document({ pageContent: summaries.join('\n') });
  const bokChunks = await splitter.splitDocuments([bokDescriptions]);

  logger.info(
    `Body of knowledge content split into ${bokChunks.length} chunks for summarization`
  );

  const bokStartTime = Date.now();
  const bokSummary = await summariseBodyOfKnowledge(bokChunks, model);
  const bokDuration = ((Date.now() - bokStartTime) / 1000).toFixed(2);

  logger.info(
    `Body of knowledge summary complete: ${bokSummary.length} chars generated in ${bokDuration}s`
  );

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
    } catch (error: any) {
      logger.error(`Chroma add batch ${i} failed`, {
        error: {
          message: error?.message,
          stack: error?.stack,
          status: error?.status,
          statusText: error?.statusText,
          body: error?.body,
          cause: error?.cause,
        },
        collection: name,
        batchIndex: i,
        batchSize: docBatches[i].length,
      });
      throw error;
    }
  }
  return true;
};
