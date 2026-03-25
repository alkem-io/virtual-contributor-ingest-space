import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
} from '@langchain/core/prompts';
import { Document } from '@langchain/core/documents';
import { buildGraph } from './graph';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import logger from '../logger';

const systemMessage = SystemMessagePromptTemplate.fromTemplate(
  `Create a structured high-level overview of an entire body of knowledge for semantic search retrieval.

This summary helps determine if this body of knowledge is relevant to user queries.

FORMAT:
- Use markdown headers (### or **bold**) to organize by theme
- Use bullet points for lists of entities, dates, and connections
- Each section should contain specific, searchable facts

REQUIREMENTS:
- Capture overall scope, themes, and domains covered
- Preserve key cross-cutting entities: participant names, organizations, major initiatives
- Include temporal scope (date ranges, time periods)
- Identify main topic areas and their relationships
- Use searchable terminology

FORBIDDEN:
- No repetitive sentence patterns
- No generic filler statements
- No redundant information - each fact appears only once`
);

const summarizePrompt = ChatPromptTemplate.fromMessages([
  systemMessage,
  HumanMessagePromptTemplate.fromTemplate(
    `Create a structured overview of this body of knowledge using markdown headers and bullet points.
Include only essential themes, entities, and connections - no filler or repetition.
Target length: around {maxSummaryLength} characters. You may exceed this if needed to preserve important information.

This is a collection of summaries from individual documents:
{context}

Overview summary:`
  ),
]);
const refinePrompt = ChatPromptTemplate.fromMessages([
  systemMessage,
  HumanMessagePromptTemplate.fromTemplate(
    `Refine this body of knowledge overview by integrating additional information.
Maintain markdown structure with headers and bullet points.
Target length: around {maxSummaryLength} characters. You may exceed this if needed to preserve important information.

Current overview:
{currentSummary}

Additional document summaries:
{context}

Instructions:
1. Merge new themes into existing sections or create new sections as needed
2. Remove any redundancy - never repeat the same fact or entity twice
3. Add newly discovered entities, dates, or connections
4. Keep all content specific and factual - no generic statements

Refined overview:`
  ),
]);

export const summariseBodyOfKnowledge = async (
  chunks: Document[],
  model: BaseChatModel
) => {
  logger.info(
    `Starting body of knowledge summarization with ${chunks.length} chunks`
  );
  const graph = buildGraph(summarizePrompt, refinePrompt, model);
  const final = await graph.invoke(
    { chunks },
    { recursionLimit: chunks.length * 2 + 10 }
  );
  logger.info('Finished body of knowledge summarization');
  return final.summary;
};
