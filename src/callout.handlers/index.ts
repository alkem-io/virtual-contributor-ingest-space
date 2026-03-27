import type { Document } from '@langchain/core/documents';
import type { Logger } from 'winston';
import { type Callout, CalloutContributionType } from '../generated/graphql';
import type { AlkemioCliClient } from '../graphql.client/AlkemioCliClient';
import { baseHandler } from './base';
import { linkCollectionHandler } from './link.collection';

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
  [CalloutContributionType.Memo]: baseHandler,
  NONE: baseHandler,
};

export const handleCallout = async (
  callout: Partial<Callout>,
  logger: Logger,
  alkemioClient: AlkemioCliClient | null = null
): Promise<Document[]> => {
  const calloutContributionTypes =
    callout.settings?.contribution.allowedTypes ?? [];

  const handler = handlersMap[calloutContributionTypes[0] ?? 'NONE'];
  const res = await handler(callout, logger, alkemioClient);
  return res;
};
