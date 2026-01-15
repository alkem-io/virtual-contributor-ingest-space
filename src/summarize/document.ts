import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
} from '@langchain/core/prompts';
import { Document } from '@langchain/core/documents';
import { buildGraph } from './graph';
import logger from '../logger';
const systemMessage = SystemMessagePromptTemplate.fromTemplate(
  `In your summary preserve as much information as possible, including:
   - References and connections between documents
   - Names of participants and their roles
   - Titles, dates, and temporal relationships
   - Key concepts and their relationships within the body of knowledge
   Focus on maintaining the coherence of information across document boundaries.`
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
  logger.info(`Starting document summarization with ${chunks.length} chunks`);
  const graph = buildGraph(summarizePrompt, refinePrompt);
  const final = await graph.invoke({ chunks });
  logger.info('Finished document summarization');
  return final.summary;
};
