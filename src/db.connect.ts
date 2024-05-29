import { ChromaClient } from 'chromadb';

export const dbConnect = () => {
  const client = new ChromaClient({
    path: `http://${process.env.VECTOR_DB_HOST}:${process.env.VECTOR_DB_PORT}`,
  });

  return client;
};
