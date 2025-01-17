import { Document } from 'langchain/document';

import { Space } from '../generated/graphql';

import logger from '../logger';
import { AlkemioCliClient } from '../graphql.client/AlkemioCliClient';
import { processSpaceTree } from './process.space.tree';
import { IngestBodyOfKnowledge } from 'src/event.bus/events/ingest.body.of.knowledge';
import { ReadResult } from './types';

export const embedSpace = async (
  event: IngestBodyOfKnowledge,
  alkemioClient: AlkemioCliClient
): Promise<ReadResult> => {
  const spaceId = event.bodyOfKnowledgeId;
  // make sure the service user has sufficient priviliges
  let space;
  try {
    space = await alkemioClient.ingestSpace(spaceId);
  } catch (error) {
    logger.error(error);
    throw new Error('GraphQL connection failed.');
  }

  if (!space) {
    logger.error(`Space ${spaceId} not found.`);
    throw new Error(`Space ${spaceId} not found.`);
  }

  const documents: Document[] = await processSpaceTree(
    [space as Partial<Space>],
    alkemioClient
  );

  return { bodyOfKnowledge: space, documents };
};
