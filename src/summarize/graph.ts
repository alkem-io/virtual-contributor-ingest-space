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

const calculateProgressiveLength = (
  currentChunk: number,
  totalChunks: number,
  targetLength: number
): number => {
  const minRatio = 0.4;
  const progressRatio = currentChunk / totalChunks;
  return Math.round(targetLength * Math.max(minRatio, progressRatio));
};

const apiKey = process.env.AZURE_MISTRAL_API_KEY;
const endpoint = process.env.AZURE_MISTRAL_ENDPOINT;
const fallbackDeploymentName = process.env.AZURE_MISTRAL_DEPLOYMENT_NAME;
const mediumDeploymentName =
  process.env.AZURE_MISTRAL_MEDIUM_DEPLOYMENT_NAME || fallbackDeploymentName;
const largeDeploymentName =
  process.env.AZURE_MISTRAL_LARGE_DEPLOYMENT_NAME || fallbackDeploymentName;
const apiVersion = process.env.AZURE_MISTRAL_API_VERSION;

if (!apiKey) {
  throw new Error('AZURE_MISTRAL_API_KEY environment variable is not set.');
}
if (!endpoint) {
  throw new Error('AZURE_MISTRAL_ENDPOINT environment variable is not set.');
}
if (!mediumDeploymentName) {
  throw new Error(
    'AZURE_MISTRAL_MEDIUM_DEPLOYMENT_NAME or AZURE_MISTRAL_DEPLOYMENT_NAME environment variable is not set.'
  );
}
if (!largeDeploymentName) {
  throw new Error(
    'AZURE_MISTRAL_LARGE_DEPLOYMENT_NAME or AZURE_MISTRAL_DEPLOYMENT_NAME environment variable is not set.'
  );
}
if (!apiVersion) {
  throw new Error('AZURE_MISTRAL_API_VERSION environment variable is not set.');
}

logger.debug(`Initializing Azure Mistral AI with endpoint: ${endpoint}`);
logger.debug(
  `Medium: ${mediumDeploymentName}, Large: ${largeDeploymentName}, API Version: ${apiVersion}`
);

export const modelMedium = new AzureChatOpenAI({
  azureOpenAIApiKey: apiKey,
  azureOpenAIEndpoint: endpoint,
  azureOpenAIApiDeploymentName: mediumDeploymentName,
  azureOpenAIApiVersion: apiVersion,
  maxRetries: 1,
  temperature: 0,
  maxTokens: 1500,
  timeout: 60000,
});

export const modelLarge = new AzureChatOpenAI({
  azureOpenAIApiKey: apiKey,
  azureOpenAIEndpoint: endpoint,
  azureOpenAIApiDeploymentName: largeDeploymentName,
  azureOpenAIApiVersion: apiVersion,
  maxRetries: 1,
  temperature: 0,
  maxTokens: 1500,
  timeout: 60000,
});

export const buildGraph = (
  summarizePrompt: ChatPromptTemplate,
  refinePrompt: ChatPromptTemplate,
  model: typeof modelMedium = modelMedium
) => {
  const summaryChain = summarizePrompt.pipe(model);
  const refineChain = refinePrompt.pipe(model);

  const SummarizeAnnotation = Annotation.Root({
    chunks: Annotation<Document[]>(),
    index: Annotation<number>(),
    summary: Annotation<string>(),
  });

  const initialSummary = async (input: typeof SummarizeAnnotation.State) => {
    const startTime = Date.now();
    const maxSummaryLength = calculateProgressiveLength(
      1,
      input.chunks.length,
      summaryLength
    );
    logger.info(
      `Starting initial summary: processing chunk 1 of ${input.chunks.length} (max length: ${maxSummaryLength})`
    );

    const context = input.chunks[0].pageContent;
    const summary = await summaryChain.invoke({ context, maxSummaryLength });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      `Initial summary complete: ${summary.content.length} chars in ${duration}s`
    );

    return { summary: summary.content, index: 1 };
  };

  const refineSummary = async (input: typeof SummarizeAnnotation.State) => {
    const startTime = Date.now();
    const maxSummaryLength = calculateProgressiveLength(
      input.index + 1,
      input.chunks.length,
      summaryLength
    );
    const progressPercent = Math.round(
      ((input.index + 1) / input.chunks.length) * 100
    );
    logger.info(
      `Refining summary: chunk ${input.index + 1} of ${input.chunks.length} (${progressPercent}%, max length: ${maxSummaryLength})`
    );

    const context = input.chunks[input.index].pageContent;
    const currentSummary = input.summary;
    const summary = await refineChain.invoke({
      currentSummary,
      context,
      maxSummaryLength,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      `Refinement complete: ${summary.content.length} chars in ${duration}s`
    );

    return {
      summary: summary.content,
      index: input.index + 1,
    };
  };

  const shouldRefine = (input: typeof SummarizeAnnotation.State) => {
    if (input.index >= input.chunks.length) {
      logger.info(
        `Summary complete: processed all ${input.chunks.length} chunks`
      );
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
