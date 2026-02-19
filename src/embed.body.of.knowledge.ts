import logger, { getErrorMessage } from './logger';
import { AlkemioCliClient } from './graphql.client/AlkemioCliClient';
import {
  ErrorCode,
  IngestBodyOfKnowledgeResult,
  IngestionResult,
} from './event.bus/events/ingest.body.of.knowledge.result';
import { embedSpace } from './data.readers/space';
import { embedKnowledgeBase } from './data.readers/knowledge.base';
import {
  IngestBodyOfKnowledge,
  BodyOfKnowledgeType,
  SummarizationModel,
} from './event.bus/events/ingest.body.of.knowledge';
import { ReadResult } from './data.readers/types';
import { embedDocuments } from './embed.documents';
import { modelMedium, modelLarge } from './summarize/graph';

export const setResultError = (
  result: IngestBodyOfKnowledgeResult,
  message: string,
  code?: ErrorCode
) => {
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
  const model =
    event.summarizationModel === SummarizationModel.MISTRAL_LARGE
      ? modelLarge
      : modelMedium;

  logger.defaultMeta.bodyOfKnowledgeId = event.bodyOfKnowledgeId;
  logger.defaultMeta.type = event.type;

  const ingestionStartTime = Date.now();
  logger.info(
    `Ingestion started for ${event.type}: ${event.bodyOfKnowledgeId}`
  );
  logger.info(
    `Using summarization model: ${event.summarizationModel || SummarizationModel.MISTRAL_MEDIUM}`
  );
  const alkemioClient = new AlkemioCliClient();

  // make sure the service user has valid credentials
  try {
    await alkemioClient.initialise();
  } catch (error) {
    logger.error(error);
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
    logger.error(error);
    return setResultError(resultEvent, getErrorMessage(error));
  }
  if (!result.documents || !result.bodyOfKnowledge) {
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
      purpose,
      model
    );
  } catch (error) {
    logger.error(error);
    return setResultError(
      resultEvent,
      'Failed to insert embeddings.',
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
