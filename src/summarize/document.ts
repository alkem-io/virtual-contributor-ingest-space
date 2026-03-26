import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
} from '@langchain/core/prompts';
import { Document } from '@langchain/core/documents';
import { buildGraph } from './graph';
import logger from '../logger';
const systemMessage = SystemMessagePromptTemplate.fromTemplate(
  `Expert at creating structured, information-dense summaries for semantic search and vector retrieval.

FORMAT:
- Use markdown headers (### or **bold**) to organize content by theme
- Use bullet points for lists of related facts
- Each bullet must contain specific facts with dates, names, or numbers

REQUIREMENTS:
- Preserve ALL key entities: names, titles, dates, numbers, technical terms, URLs, references
- Use concrete, factual language - no vague descriptions
- Include domain-specific terminology and searchable keywords
- Maximize information density - every sentence must convey specific facts

FORBIDDEN:
- No repetitive sentence patterns ("He is a member of...", "He has also been involved in...")
- No generic filler statements without specific details
- No vague phrases like "various things" or "several aspects"
- No interpretations or opinions not in source
- Never repeat the same information twice`
);

const summarizePrompt = ChatPromptTemplate.fromMessages([
  systemMessage,
  HumanMessagePromptTemplate.fromTemplate(
    `Create a structured summary of the following content using markdown headers and bullet points.
Include only essential facts and entities - no filler or repetition.
Target length: around {maxSummaryLength} characters. You may exceed this if needed to preserve important information.

Content:
{context}

Summary:`
  ),
]);
const refinePrompt = ChatPromptTemplate.fromMessages([
  systemMessage,
  HumanMessagePromptTemplate.fromTemplate(
    `Refine this summary by integrating new information.
Maintain markdown structure with headers and bullet points.
Target length: around {maxSummaryLength} characters. You may exceed this if needed to preserve important information.

Current summary:
{currentSummary}

New content to integrate:
{context}

Instructions:
1. Merge new facts into existing sections or create new sections as needed
2. Remove any redundancy - never repeat the same fact twice
3. Preserve ALL specific entities, dates, and details from both sources
4. Keep bullet points factual and specific - no generic statements

Refined summary:`
  ),
]);

export const summarizeDocument = async (chunks: Document[]) => {
  logger.info(`Starting document summarization with ${chunks.length} chunks`);
  const graph = buildGraph(summarizePrompt, refinePrompt);
  const final = await graph.invoke(
    { chunks },
    { recursionLimit: chunks.length * 2 + 10 }
  );
  logger.info('Finished document summarization');
  return final.summary;
};
