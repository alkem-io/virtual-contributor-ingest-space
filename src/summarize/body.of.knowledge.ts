import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
} from '@langchain/core/prompts';
import { Document } from 'langchain/document';
import { buildGraph } from './graph';

const systemMessage = SystemMessagePromptTemplate.fromTemplate(
  'You are tasked with concising summaries based entirely on the user input. While doing so preserve as much information as possible like names, references titles, dates, etc.'
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

export const summariseBodyOfKnowledge = async (chunks: Document[]) => {
  const graph = buildGraph(summarizePrompt, refinePrompt);
  const final = await graph.invoke({ chunks });
  return final.summary;
};
