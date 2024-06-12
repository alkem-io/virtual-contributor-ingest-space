import amqplib from 'amqplib';
import { Document } from 'langchain/document';

import {
  AlkemioClient,
  Callout,
  Space,
  createConfigUsingEnvVars,
} from '@alkemio/client-lib';

import logger from './logger';
import ingest, { SpaceIngestionPurpose } from './ingest';
import generateDocument from './generate.document';
import { handleCallout } from './callout.handlers';

// recursive function
// first invocation is with [rootSpace]
// second invocation is with rootSpace.subspaces
// third is with the subspaces of each subspace and so on
const processSpaceTree = async (
  spaces: Partial<Space>[],
  alkemioClient: AlkemioClient
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
      if (callout) {
        const document = await handleCallout(
          callout as Partial<Callout>,
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
  logger.info(`Ingest invoked for space ${spaceId}`);
  const config = createConfigUsingEnvVars();
  const alkemioClient = new AlkemioClient(config);
  await alkemioClient.enableAuthentication();

  const space = await alkemioClient.ingestSpace(spaceId); // UUID

  process.env.TOKEN = alkemioClient.apiToken;

  if (!space) {
    logger.error(`Space ${spaceId} not found.`);
    return;
  }
  const documents: Document[] = await processSpaceTree(
    [space as Partial<Space>],
    alkemioClient
  );

  // UUID -> nameID
  const ingestionResult = await ingest(space.nameID, documents, purpose);

  if (ingestionResult) {
    logger.info('Space ingested.');
  } else {
    logger.info('Ingestion error.');
  }
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

  logger.info('Ingest Space ready. Waiting for RPC messages...');
  channel.consume(queue, async msg => {
    if (msg !== null) {
      //TODO create event class matching the one from Server
      //maybe share them in a package
      //publish a confifrmation
      const decoded = JSON.parse(JSON.parse(msg.content.toString()));
      await main(decoded.spaceId, decoded.purpose);
      // add rety mechanism as well
      channel.ack(msg);
    } else {
      logger.error('Consumer cancelled by server');
    }
  });
})();
