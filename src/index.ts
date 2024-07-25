import amqplib from 'amqplib';
import { Document } from 'langchain/document';

import { SpaceIngestionPurpose } from './space.ingestion.purpose';
import { CalloutVisibility, Callout, Space } from './generated/graphql';

import logger from './logger';
import ingest from './ingest';
import generateDocument from './generate.document';
import { handleCallout } from './callout.handlers';
import { AlkemioCliClient } from './graphql-client/AlkemioCliClient';

// recursive function
// first invocation is with [rootSpace]
// second invocation is with rootSpace.subspaces
// third is with the subspaces of each subspace and so on
const processSpaceTree = async (
  spaces: Partial<Space>[],
  alkemioClient: AlkemioCliClient
) => {
  const documents: Document[] = [];
  for (let i = 0; i < spaces.length; i++) {
    const subspace = spaces[i];
    const { documentId, source, pageContent, type, title } =
      generateDocument(subspace);
    documents.push(
      new Document({
        pageContent,
        metadata: {
          documentId,
          source,
          type,
          title,
        },
      })
    );

    for (let j = 0; j < (subspace.collaboration?.callouts || []).length; j++) {
      const callout = (subspace.collaboration?.callouts || [])[j];
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

    // incoke recursively for the subspaces of the rootSpace
    const subspacesDocs = await processSpaceTree(
      (subspace.subspaces || []) as Partial<Space>[],
      alkemioClient
    );
    documents.push(...subspacesDocs);
  }

  return documents;
};

export const main = async (spaceId: string, purpose: SpaceIngestionPurpose) => {
  logger.defaultMeta.spaceId = spaceId;

  logger.info(`Ingestion started for space: ${spaceId}`);
  const alkemioClient = new AlkemioCliClient();

  // make sure the service user has valid credentials
  try {
    await alkemioClient.initialise();
  } catch (error) {
    logger.error(error);
    return;
  }

  // make sure the service user has sufficient priviliges
  let space;
  try {
    space = await alkemioClient.ingestSpace(spaceId);
  } catch (error) {
    logger.error(error);
    return;
  }

  if (!space) {
    logger.error(`Space ${spaceId} not found.`);
    return;
  }

  const documents: Document[] = await processSpaceTree(
    [space as Partial<Space>],
    alkemioClient
  );

  const ingestionResult = await ingest(space.id, documents, purpose);

  if (ingestionResult) {
    logger.info('Space embedded.');
  } else {
    logger.error('Embedding error.');
  }

  return true;
};

(async () => {
  const {
    RABBITMQ_HOST,
    RABBITMQ_USER,
    RABBITMQ_PASSWORD,
    RABBITMQ_PORT,
    RABBITMQ_QUEUE,
  } = process.env;
  const connectionString = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST}:${RABBITMQ_PORT}`;

  const conn = await amqplib.connect(connectionString);
  const queue = RABBITMQ_QUEUE ?? 'ingest-space';

  const channel = await conn.createChannel();
  await channel.assertQueue(queue);

  // important! handle message in a sequemce instead of paralell; for some reason
  // _spamming_ the queue with messages results in all sorts of random exceptions;
  //
  // being able to bomb the queue with messages is important for a collection name migration
  // we need to do
  channel.prefetch(1);

  logger.info('Ingest Space ready. Waiting for RPC messages...');
  await channel.consume(
    queue,
    async msg => {
      if (msg !== null) {
        //TODO create event class matching the one from Server
        //maybe share them in a package
        //publish a confifrmation
        const decoded = JSON.parse(JSON.parse(msg.content.toString()));
        logger.info(`Ingest invoked for space: ${decoded.spaceId}`);
        const result = await main(decoded.spaceId, decoded.purpose);
        // add rety mechanism as well
        // do auto ack of the messages in order to be able to scale the service
        // channel.ack(msg);
        if (result) {
          logger.info('Ingestion completed successfully.');
        } else {
          logger.error('Ingestion failed.');
        }
      } else {
        logger.error('Consumer cancelled by server');
      }
    },
    {
      // acknowledge messages as they are read and not manually
      //
      // running a cluster of this service might cause issues
      // for example we receive ingest for for space A and space B in that order; each message is picked by a
      // different instance; space B is smaller and is ingested first; when the message is acknowledged it results
      // in an error as messages should be acknoledged in the order of receival
      noAck: true,
    }
  );
})();
