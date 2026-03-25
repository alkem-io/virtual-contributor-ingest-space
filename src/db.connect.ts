import { ChromaClient } from 'chromadb';

export const dbConnect = () => {
  const credentials = process.env.VECTOR_DB_CREDENTIALS;

  if (!credentials) {
    throw new Error('No ChromaDB credentials provided');
  }

  const host = process.env.VECTOR_DB_HOST;
  const port = process.env.VECTOR_DB_PORT;

  if (!host || !port) {
    throw new Error('VECTOR_DB_HOST and VECTOR_DB_PORT must be provided');
  }

  const client = new ChromaClient({
    host,
    port: Number(port),
    headers: {
      Authorization: `Bearer ${credentials}`,
    },
  });

  return client;
};
