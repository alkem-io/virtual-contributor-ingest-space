import { IEmbeddingFunction } from 'chromadb';
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';

export class AzureOpenAIEmbeddingFunction implements IEmbeddingFunction {
  private client: OpenAIClient;
  private deployment: string;

  constructor(endpoint: string, apiKey: string, deployment: string) {
    this.client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
    this.deployment = deployment;
  }

  async generate(texts: string[]): Promise<number[][]> {
    const response = await this.client.getEmbeddings(this.deployment, texts);
    return response.data.map(item => item.embedding);
  }
}
