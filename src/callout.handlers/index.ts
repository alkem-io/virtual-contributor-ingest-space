import { Logger } from 'winston';
import { Callout, CalloutType } from '../generated/graphql';
import { Document } from 'langchain/document';
import { baseHandler } from './base';
import { linkCollectionHandler } from './link.collection';
import { AlkemioCliClient } from 'src/graphql.client/AlkemioCliClient';

const handlersMap: Record<
  CalloutType,
  (
    callout: Partial<Callout>,
    logger: Logger,
    alkemioClient: AlkemioCliClient | null
  ) => Promise<Document[]>
> = {
  [CalloutType.LinkCollection]: linkCollectionHandler,
  [CalloutType.Post]: baseHandler,
  [CalloutType.Whiteboard]: baseHandler,
  [CalloutType.PostCollection]: baseHandler,
  [CalloutType.WhiteboardCollection]: baseHandler,
};

export const handleCallout = async (
  callout: Partial<Callout>,
  logger: Logger,
  alkemioClient: AlkemioCliClient | null = null
): Promise<Document[]> => {
  if (!callout.type) {
    throw new Error('Callout type is not part of query.');
  }
  const handler = handlersMap[callout.type];
  return handler(callout, logger, alkemioClient);
};
