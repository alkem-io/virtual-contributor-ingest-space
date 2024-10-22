import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Document } from 'langchain/document';
import { buildGraph } from './graph';

const summarizePrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are tasked with concising summaries send by a user based entierly on the user input. While doing so
     preserve as much information as possible like names, references titles, dates, etc.`,
  ],
  [
    'human',
    'Write a detailed summary, no more than {summaryLength} characters of the following: {context}',
  ],
]);
const refinePrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are tasked with concising summaries send by a user based entierly on the user input. While doing so
     preserve as much information as possible like names, references titles, dates, etc.`,
  ],
  [
    'human',
    `Produce a final detailed summary, no more than {summaryLength} characters.
     Existing summary up to this point:

     {currentSummary}

     New context: {context}

     Given the new context, refine the original summary.`,
  ],
]);

export const summariseBodyOfKnowledge = async (chunks: Document[]) => {
  const graph = buildGraph(summarizePrompt, refinePrompt);
  const final = await graph.invoke({ chunks });
  return final.summary;
};
