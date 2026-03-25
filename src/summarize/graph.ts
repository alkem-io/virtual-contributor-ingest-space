import { ChatMistralAI } from '@langchain/mistralai';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { Document } from '@langchain/core/documents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

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

const mistralApiKey = process.env.MISTRAL_API_KEY;
const mistralSmallModelName = process.env.MISTRAL_SMALL_MODEL_NAME;

if (!mistralApiKey) {
  throw new Error('MISTRAL_API_KEY environment variable is not set.');
}
if (!mistralSmallModelName) {
  throw new Error('MISTRAL_SMALL_MODEL_NAME environment variable is not set.');
}

export const modelMistralSmall = new ChatMistralAI({
  apiKey: mistralApiKey,
  model: mistralSmallModelName,
  maxRetries: 1,
  temperature: 0,
  maxTokens: 4096,
});

logger.debug(`Initialized Mistral Small model: ${mistralSmallModelName}`);

export const buildGraph = (
  summarizePrompt: ChatPromptTemplate,
  refinePrompt: ChatPromptTemplate,
  model: BaseChatModel = modelMistralSmall
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
