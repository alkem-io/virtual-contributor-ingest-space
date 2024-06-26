import { Callout, CalloutType } from '@alkemio/client-lib';
import { Document } from 'langchain/document';
import { baseHandler } from './base';
import { linkCollectionHandler } from './link.collection';
import { AlkemioCliClient } from 'src/graphql-client/AlkemioCliClient';

const handlersMap: Record<
  CalloutType,
  (
    callout: Partial<Callout>,
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
  alkemioClient: AlkemioCliClient | null = null
): Promise<Document[]> => {
  if (!callout.type) {
    throw new Error('Callout type is not part of query.');
  }
  const handler = handlersMap[callout.type];
  return handler(callout, alkemioClient);
};
