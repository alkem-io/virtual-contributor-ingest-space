import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Document } from 'langchain/document';
import { buildGraph } from './graph';

const summarizePrompt = ChatPromptTemplate.fromMessages([
  // the system message is the same for both prompts but putting it into a variable and typing it is too hard...
  [
    'system',
    `You are tasked with summarizing text documents that might include conversation transcripts, articles, novels and other.
     In your summary preserve as much information as possible, including refereces, names of the participants, titles, dates, etc.`,
  ],
  [
    'human',
    'Write a detailed summary, no more than {summaryLength} characters of the following: {context}',
  ],
]);
const refinePrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are tasked with summarizing text documents that might include conversation transcripts, articles, novels and other.
     In your summary preserve as much information as possible, including refereces, names of the participants, titles, etc.`,
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

export const summarizeDocument = async (chunks: Document[]) => {
  const graph = buildGraph(summarizePrompt, refinePrompt);
  const final = await graph.invoke({ chunks });
  return final.summary;
};
