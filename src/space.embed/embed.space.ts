import { Document } from 'langchain/document';

import { Space } from '../generated/graphql';

import logger from '../logger';
import embed from '../embed';
import { AlkemioCliClient } from '../graphql.client/AlkemioCliClient';
import { IngestSpace } from '../event.bus/events/ingest.space';
import { processSpaceTree } from './process.space.tree';
import {
  ErrorCode,
  IngestSpaceResult,
  SpaceIngestionResult,
} from '../event.bus/events/ingest.space.result';

const setResultError = (
  result: IngestSpaceResult,
  message: string,
  code?: ErrorCode
) => {
  result.error = { code, message };
  result.result = SpaceIngestionResult.FAILURE;
  // this shenanigan is here to ensure the Timestamp is in UTC timezone
  result.timestamp = new Date(
    new Date().toLocaleString('en', { timeZone: 'UTC' })
  ).getTime();
  return result;
};
export const embedSpace = async (event: IngestSpace) => {
  const resultEvent = new IngestSpaceResult(
    event.spaceId,
    event.purpose,
    event.personaServiceId
  );

  const spaceId = event.spaceId;
  const purpose = event.purpose;

  logger.defaultMeta.spaceId = spaceId;

  logger.info(`Ingestion started for space: ${spaceId}`);
  const alkemioClient = new AlkemioCliClient();

  // make sure the service user has valid credentials
  try {
    await alkemioClient.initialise();
  } catch (error) {
    logger.error(error);
    return setResultError(resultEvent, 'AlkemioClient can not be initialised.');
  }

  // make sure the service user has sufficient priviliges
  let space;
  try {
    space = await alkemioClient.ingestSpace(spaceId);
  } catch (error) {
    logger.error(error);
    return setResultError(resultEvent, 'GraphQL connection failed.');
  }

  if (!space) {
    logger.error(`Space ${spaceId} not found.`);
    return setResultError(resultEvent, 'Space not found.');
  }

  const documents: Document[] = await processSpaceTree(
    [space as Partial<Space>],
    alkemioClient
  );
  let embeddingResult = false;
  try {
    embeddingResult = await embed(space.id, documents, purpose);
  } catch (error) {
    console.log(error);
    return setResultError(
      resultEvent,
      'Failed to insert embeddings.',
      ErrorCode.VECTOR_INSERT
    );
  }

  if (embeddingResult) {
    resultEvent.result = SpaceIngestionResult.SUCCESS;
    logger.info('Ingestion completed successfully.');
  } else {
    logger.error('Ingestion failed.');
    resultEvent.result = SpaceIngestionResult.FAILURE;
    resultEvent.error = {
      message: 'An error occured while embedding.',
    };
  }
  // this shenanigan is here to ensure the Timestamp is in UTC timezone
  resultEvent.timestamp = new Date(
    new Date().toLocaleString('en', { timeZone: 'UTC' })
  ).getTime();
  return resultEvent;
};
