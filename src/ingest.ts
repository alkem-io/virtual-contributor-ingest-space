import { ChromaClient } from 'chromadb';
import Documents from './documents';
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';

export default async (space: string, docs: Documents) => {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_API_KEY;
  const depolyment = process.env.EMBEDDINGS_DEPLOYMENT_NAME;

  if (!endpoint || !key || !depolyment) {
    throw new Error('AI configuration missing from ENV.');
  }

  console.log({
    path: `http://${process.env.VECTOR_DB_HOST}:${process.env.VECTOR_DB_PORT}`,
  });

  const client = new ChromaClient({
    path: `http://${process.env.VECTOR_DB_HOST}:${process.env.VECTOR_DB_PORT}`,
  });

  const heartbeat = await client.heartbeat();
  console.log(heartbeat);

  const forEmbed = docs.forEmbed();

  const openAi = new OpenAIClient(endpoint, new AzureKeyCredential(key));
  const { data } = await openAi.getEmbeddings(depolyment, forEmbed.documents);

  const collection = await client.getOrCreateCollection({ name: space });

  await collection.upsert({
    ...forEmbed,
    embeddings: data.map(({ embedding }) => embedding),
  });
};
