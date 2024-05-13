import { ChromaClient } from 'chromadb';
import Documents from './documents';
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';
import { logger } from '@alkemio/client-lib';

export enum SpaceIngestionPurpose {
  Knowledge = 'kwnowledge',
  Context = 'context',
}

export default async (
  spaceNameID: string,
  docs: Documents,
  purpose: SpaceIngestionPurpose
) => {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_API_KEY;
  const depolyment = process.env.EMBEDDINGS_DEPLOYMENT_NAME;

  if (!endpoint || !key || !depolyment) {
    throw new Error('AI configuration missing from ENV.');
  }

  const client = new ChromaClient({
    path: `http://${process.env.VECTOR_DB_HOST}:${process.env.VECTOR_DB_PORT}`,
  });

  const heartbeat = await client.heartbeat();
  console.log(heartbeat);

  const forEmbed = docs.forEmbed();

  const openAi = new OpenAIClient(endpoint, new AzureKeyCredential(key));
  const { data } = await openAi.getEmbeddings(depolyment, forEmbed.documents);

  const name = `${spaceNameID}-${purpose}`;
  logger.info(`Adding to collection ${name}`);
  const collection = await client.getOrCreateCollection({
    name,
  });

  await collection.upsert({
    ...forEmbed,
    embeddings: data.map(({ embedding }) => embedding),
  });
};
