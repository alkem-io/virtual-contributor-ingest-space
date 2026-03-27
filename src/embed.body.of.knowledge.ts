import { embedKnowledgeBase } from './data.readers/knowledge.base';
import { embedSpace } from './data.readers/space';
import type { ReadResult } from './data.readers/types';
import { embedDocuments } from './embed.documents';
import {
  BodyOfKnowledgeType,
  type IngestBodyOfKnowledge,
} from './event.bus/events/ingest.body.of.knowledge';
import {
  ErrorCode,
  IngestBodyOfKnowledgeResult,
  IngestionResult,
} from './event.bus/events/ingest.body.of.knowledge.result';
import { AlkemioCliClient } from './graphql.client/AlkemioCliClient';
import logger, { getErrorMessage } from './logger';

export const setResultError = (
  result: IngestBodyOfKnowledgeResult,
  message: string,
  code?: ErrorCode
) => {
  logger.error(`setResultError: ${message}`, {
    errorCode: code,
    bodyOfKnowledgeId: result.bodyOfKnowledgeId,
  });
  result.error = { code, message };
  result.result = IngestionResult.FAILURE;
  // this shenanigan is here to ensure the Timestamp is in UTC timezone
  result.timestamp = new Date(
    new Date().toLocaleString('en', { timeZone: 'UTC' })
  ).getTime();
  return result;
};

export const embedBodyOfKnowledge = async (event: IngestBodyOfKnowledge) => {
  const resultEvent = new IngestBodyOfKnowledgeResult(
    event.bodyOfKnowledgeId,
    event.type,
    event.purpose,
    event.personaId
  );

  const purpose = event.purpose;

  logger.defaultMeta.bodyOfKnowledgeId = event.bodyOfKnowledgeId;
  logger.defaultMeta.type = event.type;

  const ingestionStartTime = Date.now();
  logger.info(
    `Ingestion started for ${event.type}: ${event.bodyOfKnowledgeId}`
  );
  const alkemioClient = new AlkemioCliClient();

  // make sure the service user has valid credentials
  try {
    await alkemioClient.initialise();
  } catch (error) {
    logger.error('AlkemioClient initialisation failed', {
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error,
    });
    return setResultError(resultEvent, 'AlkemioClient can not be initialised.');
  }

  let result: ReadResult = {};
  try {
    if (event.type === BodyOfKnowledgeType.ALKEMIO_SPACE) {
      logger.info(`Ingest invoked for Space: ${event.bodyOfKnowledgeId}`);
      result = await embedSpace(event, alkemioClient);
    } else {
      logger.info(
        `Ingest invoked for KnowledgeBase: ${event.bodyOfKnowledgeId}`
      );
      result = await embedKnowledgeBase(event, alkemioClient);
    }
  } catch (error) {
    logger.error('Failed to read body of knowledge', {
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error,
    });
    return setResultError(resultEvent, getErrorMessage(error));
  }
  if (!result.documents || !result.bodyOfKnowledge) {
    logger.error(
      'Body Of Knowledge could not be processed: no documents or bodyOfKnowledge returned'
    );
    return setResultError(
      resultEvent,
      'Body Of Knowledge could not be processed.'
    );
  }

  let embeddingResult = false;
  try {
    embeddingResult = await embedDocuments(
      result.bodyOfKnowledge,
      result.documents,
      purpose
    );
  } catch (error) {
    logger.error('Failed to insert embeddings', {
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              cause: (error as any).cause,
            }
          : error,
    });
    return setResultError(
      resultEvent,
      `Failed to insert embeddings: ${
        error instanceof Error ? error.message : String(error)
      }`,
      ErrorCode.VECTOR_INSERT
    );
  }

  if (embeddingResult) {
    resultEvent.result = IngestionResult.SUCCESS;
    logger.info('Ingestion completed successfully.');
  } else {
    logger.error('Ingestion failed.');
    resultEvent.result = IngestionResult.FAILURE;
    resultEvent.error = {
      message: 'An error occured while embedding.',
    };
  }
  // this shenanigan is here to ensure the Timestamp is in UTC timezone
  resultEvent.timestamp = new Date(
    new Date().toLocaleString('en', { timeZone: 'UTC' })
  ).getTime();

  const totalDuration = ((Date.now() - ingestionStartTime) / 1000).toFixed(2);
  logger.info(`Total ingestion time: ${totalDuration}s`);

  return resultEvent;
};
