import { ChatMistralAI } from '@langchain/mistralai';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { Document } from 'langchain/document';
import { ChatPromptTemplate } from '@langchain/core/prompts';

export const summaryLength = parseInt(process.env.SUMMARY_LENGTH || '10000');

const apiKey = process.env.AZURE_MISTRAL_API_KEY;
const endpoint = process.env.AZURE_MISTRAL_ENDPOINT;

const model = new ChatMistralAI({
  apiKey,
  endpoint,
  maxRetries: 1,
});

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
    const context = input.chunks[0].pageContent;
    const summary = await summaryChain.invoke({ context, summaryLength });
    return { summary: summary.content, index: 1 };
  };

  const refineSummary = async (input: typeof SummarizeAnnotation.State) => {
    const context = input.chunks[input.index].pageContent;
    const currentSummary = input.summary;
    const summary = await refineChain.invoke({
      currentSummary,
      context,
      summaryLength,
    });

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
