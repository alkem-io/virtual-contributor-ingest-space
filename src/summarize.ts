import { ChatMistralAI, MistralAI } from '@langchain/mistralai';
import { Document } from 'langchain/document';

export const summarize = async (_doc: Document, _chunks: Document[]) => {
  const model = new ChatMistralAI({
    apiKey: 'TaecSvOH6awhFBJ5vjg0kSYiZ11f2dhN',
    endpoint:
      'https://mistral-small-alkemio-serverless.swedencentral.inference.ai.azure.com',
    maxRetries: 1,
  });
  const resp = await model.invoke('tell me about Levski Sofia');
  console.log(resp);
};
