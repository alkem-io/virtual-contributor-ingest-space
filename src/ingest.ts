import { SpaceIngestionPurpose } from './space.ingestion.purpose';
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
  spaceNameID: string,
  docs: Document[],
  purpose: SpaceIngestionPurpose
) => {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_API_KEY;
  const depolyment = process.env.EMBEDDINGS_DEPLOYMENT_NAME;

  if (!endpoint || !key || !depolyment) {
    throw new Error('AI configuration missing from ENV.');
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  const name = `${spaceNameID}-${purpose}`;
  const ids: string[] = [];
  const documents: string[] = [];
  const metadatas: Array<Metadata> = [];

  logger.info(`Splitting documents for space: ${spaceNameID}`);
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
      }) of type ${doc.metadata.type}, # of chunks: ${splitted.length}`
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
  const docBatches = batch(documents, BATCH_SIZE);
  const metadataBatches = batch(metadatas, BATCH_SIZE);
  const idsBatches = batch(ids, BATCH_SIZE);

  for (let i = 0; i < docBatches.length; i++) {
    try {
      const batch = docBatches[i];
      const response = await openAi.getEmbeddings(depolyment, batch);
      data = [...data, ...response.data];
      logger.info(
        `Embedding generated for batch ${i}; Batch size is: ${batch.length}`
      );
    } catch (e) {
      logger.error('Embeeddings error.', e);
      logger.error(`Metadatas for batch are: ${metadataBatches[i]}`);
    }
  }

  logger.info('Embedding generated');
  logger.info(`Total number of generated embeddings: ${data.length}`);

  try {
    logger.info(`Deleting old collection: ${name}`);
    await client.deleteCollection({ name });
  } catch (e) {
    logger.info(`Collection '${name}' doesn't exist.`);
  }

  const embeddingsBatches = batch(data, BATCH_SIZE);

  for (let i = 0; i < embeddingsBatches.length; i++) {
    try {
      logger.info(`Creating collection: ${name}`);
      const collection = await client.getOrCreateCollection({
        name,
        metadata: { createdAt: new Date().getTime() },
      });

      logger.info(`Adding to collection collection: ${name}`);
      await collection.upsert({
        ids: idsBatches[i],
        documents: docBatches[i],
        metadatas: metadataBatches[i],
        embeddings: embeddingsBatches[i].map(({ embedding }) => embedding),
      });
      logger.info(
        `Batch ${i} of size ${embeddingsBatches[i].length} added to collection ${name}`
      );
    } catch (e) {
      logger.error(`Error adding to collection: ${name}`, e);
      logger.error(`Metadatas for batch are: ${metadataBatches[i]}`);
      return false;
    }
  }
  return true;
};
