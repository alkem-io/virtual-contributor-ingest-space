import { OpenAIClient, AzureKeyCredential, EmbeddingItem } from '@azure/openai';
import logger from './logger';
import { dbConnect } from './db.connect';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document, Metadata } from 'chromadb';
import { DocumentType } from './document.type';
import { SpaceIngestionPurpose } from './generated/graphql';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import CircuitBreaker from 'opossum';

// Configure axios retry
axiosRetry(axios, {
  retries: 3, // Number of retries
  retryDelay: (retryCount) => {
    return axiosRetry.exponentialDelay(retryCount);
  },
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error);
  },
});

// Circuit breaker options
const circuitBreakerOptions = {
  timeout: 30000, // If function takes longer than 30 seconds, it fails
  errorThresholdPercentage: 50, // When 50% of requests fail, the circuit opens
  resetTimeout: 30000, // After 30 seconds, try again.
};

const breaker = new CircuitBreaker(async (documents) => {
  const response = await openAi.getEmbeddings(deployment, documents);
  return response.data;
}, circuitBreakerOptions);

breaker.fallback(() => {
  logger.error('OpenAI service is unavailable. Using fallback mechanism.');
  // Implement your fallback mechanism here, e.g., return cached data or default response
  return [];
});

breaker.on('open', () => logger.warn('Circuit breaker opened'));
breaker.on('halfOpen', () => logger.info('Circuit breaker half-open: next request will test the circuit'));
breaker.on('close', () => logger.info('Circuit breaker closed: requests are allowed'));


const httpClient = axios.create({
  timeout: 60000, // 60 seconds timeout
});

const openAi = new OpenAIClient(endpoint, new AzureKeyCredential(key), {
  httpClient,
});

async function generateEmbeddings(documents: string[]): Promise<EmbeddingItem[]> {
  logger.info('Starting embedding generation process');
  logger.info(`Number of documents to process: ${documents.length}`);

  documents.forEach((doc, index) => {
    logger.debug(`Document ${index + 1}: ${doc.substring(0, 100)}...`); // Log the first 100 characters for context
  });

  try {
    logger.info('Requesting embeddings from OpenAI');
    const data = await breaker.fire(documents);
    logger.info('Embeddings generated successfully');

    data.forEach((item, index) => {
      logger.debug(`Embedding ${index + 1} length: ${item.embedding.length}`);
    });

    return data;
  } catch (e) {
    logger.error('Failed to generate embeddings', e);
    throw new Error('Failed to generate embeddings');
  }
}


export default async (
  spaceNameID: string,
  docs: Document[],
  purpose: SpaceIngestionPurpose
) => {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.EMBEDDINGS_DEPLOYMENT_NAME;

  if (!endpoint || !key || !deployment) {
    logger.error('AI configuration missing from ENV.');
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

  logger.info(`Starting document processing for space: ${spaceNameID} with purpose: ${purpose}`);

  for (let docIndex = 0; docIndex < docs.length; docIndex++) {
    const doc = docs[docIndex];

    let splitted;
    logger.info(`Processing document ${docIndex + 1} / ${docs.length} with ID: ${doc.metadata.documentId} of type ${doc.metadata.type}`);

    // Do not split spreadsheets to prevent data loss
    if (doc.metadata.type === DocumentType.SPREADSHEET) {
      logger.info('Skipping split for spreadsheet document.');
      splitted = [doc];
    } else {
      try {
        splitted = await splitter.splitDocuments([doc]);
        logger.info(`Document split into ${splitted.length} chunks.`);
      } catch (e) {
        logger.error(`Error splitting document ID: ${doc.metadata.documentId}`, e);
        throw e;
      }
    }

    splitted.forEach((chunk, chunkIndex) => {
      ids.push(`${chunk.metadata.documentId}-${chunk.metadata.type}-chunk${chunkIndex}`);
      documents.push(chunk.pageContent);
      metadatas.push({ ...chunk.metadata, chunkIndex });
    });
  }

  logger.info('Connecting to Chroma...');
  let client;
  try {
    client = dbConnect();
    const heartbeat = await client.heartbeat();
    logger.info(`Chroma heartbeat: ${heartbeat}`);
  } catch (e) {
    logger.error('Error connecting to Chroma:', e);
    throw e;
  }

  let data: EmbeddingItem[] = [];
  try {
    data = await generateEmbeddings(documents);
  } catch (e) {
    logger.error('Failed to generate embeddings. Exiting process.', e);
    return false;
  }

  try {
    logger.info(`Deleting old collection: ${name}`);
    await client.deleteCollection({ name });
  } catch (e) {
    logger.warn(`Collection '${name}' doesn't exist or couldn't be deleted. Proceeding to create new collection.`, e);
  }

  try {
    logger.info(`Creating collection: ${name}`);
    const collection = await client.getOrCreateCollection({
      name,
      metadata: { createdAt: new Date().getTime() },
    });

    logger.info(`Adding documents to collection: ${name}`);
    await collection.upsert({
      ids,
      documents,
      metadatas,
      embeddings: data.map(({ embedding }) => embedding),
    });
    logger.info(`Documents successfully added to collection: ${name}`);
  } catch (e) {
    logger.error(`Error adding to collection: ${name}`, e);
  }
  return true;
};
