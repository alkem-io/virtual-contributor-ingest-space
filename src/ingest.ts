import { ChromaClient } from 'chromadb'
import Documents from './documents'
import { OpenAIClient, AzureKeyCredential } from '@azure/openai'


export default async (space: string, docs: Documents) => {
  const chroma = new ChromaClient({ path: process.env.CHROMA_PATH })

  const forEmbed = docs.forEmbed()

  const openAi = new OpenAIClient(process.env.AZURE_OPENAI_ENDPOINT!, new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY!));
  const { data } = await openAi.getEmbeddings(process.env.EMBEDDINGS_DEPLOYMENT_NAME!, forEmbed.documents);

  const collection = await chroma.getOrCreateCollection({name: space})

  await collection.add({
    ...forEmbed,
    embeddings: data.map(({embedding}) => embedding)

  })
}
