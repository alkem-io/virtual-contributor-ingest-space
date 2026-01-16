import { AzureChatOpenAI } from '@langchain/openai';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { Document } from '@langchain/core/documents';
import { ChatPromptTemplate } from '@langchain/core/prompts';

import { wrapSDK } from 'langsmith/wrappers';
import logger from '../logger';

export const summaryLength = parseInt(
  process.env.SUMMARY_LENGTH || '10000',
  10
);

const apiKey = process.env.AZURE_MISTRAL_API_KEY;
const endpoint = process.env.AZURE_MISTRAL_ENDPOINT;
const deploymentName = process.env.AZURE_MISTRAL_DEPLOYMENT_NAME;
const apiVersion = process.env.AZURE_MISTRAL_API_VERSION;

if (!apiKey) {
  throw new Error('AZURE_MISTRAL_API_KEY environment variable is not set.');
}
if (!endpoint) {
  throw new Error('AZURE_MISTRAL_ENDPOINT environment variable is not set.');
}
if (!deploymentName) {
  throw new Error(
    'AZURE_MISTRAL_DEPLOYMENT_NAME environment variable is not set.'
  );
}
if (!apiVersion) {
  throw new Error('AZURE_MISTRAL_API_VERSION environment variable is not set.');
}

const model = wrapSDK(
  new AzureChatOpenAI({
    azureOpenAIApiKey: apiKey,
    azureOpenAIEndpoint: endpoint,
    azureOpenAIApiDeploymentName: deploymentName,
    azureOpenAIApiVersion: apiVersion,
    maxRetries: 1,
  })
);

export const buildGraph = (
  summarizePrompt: ChatPromptTemplate,
  refinePrompt: ChatPromptTemplate
) => {
  const summaryChain = summarizePrompt.pipe(model);
  const refineChain = refinePrompt.pipe(model);

  const SummarizeAnnotation = Annotation.Root({
    chunks: Annotation<Document[]>(),
    index: Annotation<number>(),
    summary: Annotation<string>(),
  });

  const initialSummary = async (input: typeof SummarizeAnnotation.State) => {
    logger.info('Starting initial summary generation');
    const context = input.chunks[0].pageContent;
    const summary = await summaryChain.invoke({ context, summaryLength });
    logger.info('Finished initial summary generation');
    return { summary: summary.content, index: 1 };
  };

  const refineSummary = async (input: typeof SummarizeAnnotation.State) => {
    logger.info(
      `Starting summary refinement step (chunk ${input.index + 1}/${
        input.chunks.length
      })`
    );
    const context = input.chunks[input.index].pageContent;
    const currentSummary = input.summary;
    const summary = await refineChain.invoke({
      currentSummary,
      context,
      summaryLength,
    });
    logger.info(
      `Finished summary refinement step (chunk ${input.index + 1}/${
        input.chunks.length
      })`
    );

    return {
      summary: summary.content,
      index: input.index + 1,
    };
  };

  const shouldRefine = (input: typeof SummarizeAnnotation.State) => {
    if (input.index >= input.chunks.length) {
      return END;
    }
    return 'refineSummary';
  };

  const graph = new StateGraph(SummarizeAnnotation)
    .addNode('initialSummary', initialSummary)
    .addNode('refineSummary', refineSummary)
    .addEdge(START, 'initialSummary')
    .addConditionalEdges('initialSummary', shouldRefine, ['refineSummary', END])
    .addConditionalEdges('refineSummary', shouldRefine, ['refineSummary', END])
    .compile();

  return graph;
};
