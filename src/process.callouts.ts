import type { Document } from '@langchain/core/documents';
import { handleCallout } from './callout.handlers';
import { type Callout, CalloutVisibility } from './generated/graphql';
import type { AlkemioCliClient } from './graphql.client/AlkemioCliClient';
import logger from './logger';

export const processCallouts = async (
  callouts: Partial<Callout>[],
  alkemioClient: AlkemioCliClient
): Promise<Document[]> => {
  const documents: Document[] = [];

  for (const callout of callouts) {
    if (callout.settings?.visibility === CalloutVisibility.Published) {
      const document = await handleCallout(
        callout as Partial<Callout>,
        logger,
        alkemioClient
      );
      // empty doc - nothing to do here
      if (document) {
        documents.push(...document);
      }
    }
  }
  return documents;
};
