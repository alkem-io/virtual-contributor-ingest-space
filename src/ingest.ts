import { SpaceIngestionPurpose } from './generated/graphql';
import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIClient, AzureKeyCredential, EmbeddingItem } from '@azure/openai';
import logger from './logger';
import { dbConnect } from './db.connect';
import { Metadata } from 'chromadb';
import { DocumentType } from './document.type';

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

  const chunkSize = parseInt(process.env.CHUNK_SIZE || '1000');
  const chunkOverlap = parseInt(process.env.CHUNK_OVERLAP || '100');

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });

  const name = `${spaceNameID}-${purpose}`;
  const ids: string[] = [];
  const documents: string[] = [];
  const metadatas: Array<Metadata> = [];

  logger.info(`Splitting documents for space: ${spaceNameID}`);
  for (let docIndex = 0; docIndex < docs.length; docIndex++) {
    const doc = docs[docIndex];

    let splitted;
    console.log(doc.metadata.type);
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
  try {
    const response = await openAi.getEmbeddings(depolyment, documents);
    data = response.data;
  } catch (e) {
    logger.error('Embeeddings error.', e);
    return false;
  }
  logger.info('Embedding generated');

  try {
    logger.info(`Deleting old collection: ${name}`);
    await client.deleteCollection({ name });
  } catch (e) {
    logger.info(`Collection '${name}' doesn't exist.`);
  }

  try {
    logger.info(`Creating collection: ${name}`);
    const collection = await client.getOrCreateCollection({
      name,
      metadata: { createdAt: new Date().getTime() },
    });

    logger.info(`Adding to collection collection: ${name}`);
    await collection.upsert({
      ids,
      documents,
      metadatas,
      embeddings: data.map(({ embedding }) => embedding),
    });
    logger.info(`Added to collection collection: ${name}`);
  } catch (e) {
    logger.error(`Error adding to collection: ${name}`, e);
  }
  return true;
};
