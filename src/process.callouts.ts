import { Callout, CalloutVisibility } from './generated/graphql';
import { AlkemioCliClient } from './graphql.client/AlkemioCliClient';
import { Document } from 'langchain/document';
import { handleCallout } from './callout.handlers';
import logger from './logger';

export const processCallouts = async (
  callouts: Partial<Callout>[],
  alkemioClient: AlkemioCliClient
): Promise<Document[]> => {
  const documents: Document[] = [];

  for (const callout of callouts) {
    if (callout.visibility === CalloutVisibility.Published) {
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
