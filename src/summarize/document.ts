import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
} from '@langchain/core/prompts';
import { Document } from 'langchain/document';
import { buildGraph } from './graph';
const systemMessage = SystemMessagePromptTemplate.fromTemplate(
  `You are tasked with summarizing text documents that might include conversation transcripts, articles, novels and other.
   In your summary preserve as much information as possible, including references, names of the participants, titles, dates, etc.`
);

const summarizePrompt = ChatPromptTemplate.fromMessages([
  systemMessage,
  HumanMessagePromptTemplate.fromTemplate(
    'Write a detailed summary, no more than {summaryLength} characters of the following: {context}'
  ),
]);
const refinePrompt = ChatPromptTemplate.fromMessages([
  systemMessage,
  HumanMessagePromptTemplate.fromTemplate(
    `Produce a final detailed summary, no more than {summaryLength} characters.
     Existing summary up to this point:
     {currentSummary}

     New context: {context}

     Given the new context, refine the original summary.`
  ),
]);

export const summarizeDocument = async (chunks: Document[]) => {
  const graph = buildGraph(summarizePrompt, refinePrompt);
  const final = await graph.invoke({ chunks });
  return final.summary;
};
