import { Logger } from 'winston';
import { Callout } from '../generated/graphql';
import { Document } from 'langchain/document';
import { baseHandler } from './base';
import { linkCollectionHandler } from './link.collection';
import { AlkemioCliClient } from '../graphql.client/AlkemioCliClient';
import { CalloutContributionType } from '@alkemio/client-lib';

type CalloutType = CalloutContributionType | 'NONE';

const handlersMap: Record<
  CalloutType,
  (
    callout: Partial<Callout>,
    logger: Logger,
    alkemioClient: AlkemioCliClient | null
  ) => Promise<Document[]>
> = {
  [CalloutContributionType.Link]: linkCollectionHandler,
  [CalloutContributionType.Post]: baseHandler,
  [CalloutContributionType.Whiteboard]: baseHandler,
  ['NONE']: baseHandler,
};

export const handleCallout = async (
  callout: Partial<Callout>,
  logger: Logger,
  alkemioClient: AlkemioCliClient | null = null
): Promise<Document[]> => {
  const calloutContributionTypes = callout.settings?.contribution.allowedTypes ?? []

  const handler = handlersMap[calloutContributionTypes[0]];
  return handler(callout, logger, alkemioClient);
};
