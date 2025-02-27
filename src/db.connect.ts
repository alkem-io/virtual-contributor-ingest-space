import { ChromaClient } from 'chromadb';

export const dbConnect = () => {
  const credentials = process.env.VECTOR_DB_CREDENTIALS;

  if (!credentials) {
    throw new Error('No ChromaDB credentials provided');
  }

  const client = new ChromaClient({
    path: `http://${process.env.VECTOR_DB_HOST}:${process.env.VECTOR_DB_PORT}`,
    auth: {
      credentials,
      provider: 'basic',
    },
  });

  return client;
};
