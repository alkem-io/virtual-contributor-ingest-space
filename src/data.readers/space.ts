import type { Document } from '@langchain/core/documents';
import type { IngestBodyOfKnowledge } from 'src/event.bus/events/ingest.body.of.knowledge';
import type { Space } from '../generated/graphql';
import type { AlkemioCliClient } from '../graphql.client/AlkemioCliClient';
import { processSpaceTree } from './process.space.tree';
import type { ReadResult } from './types';

export const embedSpace = async (
  event: IngestBodyOfKnowledge,
  alkemioClient: AlkemioCliClient
): Promise<ReadResult> => {
  const spaceId = event.bodyOfKnowledgeId;
  // make sure the service user has sufficient priviliges
  const space = await alkemioClient.ingestSpace(spaceId);
  const documents: Document[] = await processSpaceTree(
    [space as Partial<Space>],
    alkemioClient
  );

  return { bodyOfKnowledge: space, documents };
};
