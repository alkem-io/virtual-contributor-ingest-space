import { SpaceIngestionPurpose } from './event.bus/events/ingest.space';
import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIClient, AzureKeyCredential, EmbeddingItem } from '@azure/openai';
import logger from './logger';
import { dbConnect } from './db.connect';
import { Metadata } from 'chromadb';
import { DocumentType } from './document.type';
import { BATCH_SIZE, CHUNK_OVERLAP, CHUNK_SIZE } from './constants';

const batch = <T>(arr: T[], size: number): Array<Array<T>> =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

export default async (
  spaceID: string,
  docs: Document[],
  purpose: SpaceIngestionPurpose
) => {
  logger.defaultMeta.spaceId = spaceID;

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

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  const name = `${spaceID}-${purpose}`;
  logger.info(name);
  const ids: string[] = [];
  const documents: string[] = [];
  const metadatas: Array<Metadata> = [];

  logger.info(`Splitting documents for space: ${spaceID}`);

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
      metadatas.push({ ...chunk.metadata, chunkIndex });
    });
  }

  logger.info('Connecting to Chroma...');
  const client = dbConnect();
  const heartbeat = await client.heartbeat();
  logger.info(`Chroma heartbeat ${heartbeat}`);

  logger.info('Generating embeddings...');
  const openAi = new OpenAIClient(endpoint, new AzureKeyCredential(key));

  let data: EmbeddingItem[] = [];

  logger.info(`Total number of chunks: ${documents.length}`);
  logger.info('Batching documents...');
  const docBatches = batch(documents, BATCH_SIZE);
  logger.info(`Batch size is ${BATCH_SIZE}; # of batches ${docBatches.length}`);

  const metadataBatches = batch(metadatas, BATCH_SIZE);
  const idsBatches = batch(ids, BATCH_SIZE);

  for (let i = 0; i < docBatches.length; i++) {
    try {
      const batch = docBatches[i];
      logger.info(
        `Generating embeddings for batch ${i}; Batch size is: ${batch.length}`
      );
      const response = await openAi.getEmbeddings(deployment, batch);
      data = [...data, ...response.data];
      logger.info('Embeddings generates');
    } catch (error) {
      logger.error({
        ...(error as Error),
        error: 'Embeddings generation error',
        metadata: JSON.stringify(metadataBatches[i]),
      });
    }
  }

  if (data.length !== documents.length) {
    logger.error(
      `Embeddings generation failed for ${
        data.length
      } documents. Missing embeddings for ${
        documents.length - data.length
      } documents.`
    );
    return false;
  }

  logger.info('Embedding generated');
  logger.info(`Total number of generated embeddings: ${data.length}`);

  try {
    logger.info(`Deleting old collection: ${name}`);
    await client.deleteCollection({ name });
    logger.info(`Collection: ${name} deleted.`);
  } catch (error) {
    logger.info(`Collection '${name}' doesn't exist. First time ingestion.`);
  }

  const embeddingsBatches = batch(data, BATCH_SIZE);

  for (let i = 0; i < embeddingsBatches.length; i++) {
    try {
      logger.info(`Creating collection: ${name}`);
      const collection = await client.getOrCreateCollection({
        name,
        metadata: { createdAt: new Date().getTime() },
      });

      logger.info(`Adding to collection : ${name}`);
      await collection.upsert({
        ids: idsBatches[i],
        documents: docBatches[i],
        metadatas: metadataBatches[i],
        embeddings: embeddingsBatches[i].map(({ embedding }) => embedding),
      });
      logger.info(
        `Batch ${i} of size ${embeddingsBatches[i].length} added to collection ${name}`
      );
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
  return true;
};
