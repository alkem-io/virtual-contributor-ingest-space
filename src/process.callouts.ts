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

  for (let j = 0; j < (callouts || []).length; j++) {
    const callout = (callouts || [])[j];
    if (callout && callout.visibility === CalloutVisibility.Published) {
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
