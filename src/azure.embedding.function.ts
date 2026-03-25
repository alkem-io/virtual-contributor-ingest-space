import { EmbeddingFunction } from 'chromadb';
import OpenAI from 'openai';
import logger from './logger';

export class OpenAICompatibleEmbeddingFunction implements EmbeddingFunction {
  private client: OpenAI;
  private model: string;

  constructor(baseURL: string, apiKey: string, model: string) {
    this.client = new OpenAI({ baseURL, apiKey });
    this.model = model;
  }

  async generate(texts: string[]): Promise<number[][]> {
    logger.debug(`Embedding ${texts.length} texts with model ${this.model}`);
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts,
      });
      const embeddings = response.data.map(item => item.embedding);
      logger.debug(
        `Embeddings generated: ${embeddings.length} vectors, dimension: ${embeddings[0]?.length}`
      );
      return embeddings;
    } catch (error: any) {
      logger.error('Embedding generation failed', {
        error: { message: error?.message, stack: error?.stack, status: error?.status },
        textCount: texts.length,
        firstTextLength: texts[0]?.length,
      });
      throw error;
    }
  }
}
