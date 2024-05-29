import amqplib from 'amqplib';
import { Document } from 'langchain/document';

import { AlkemioClient, createConfigUsingEnvVars } from '@alkemio/client-lib';

import logger from './logger';
import ingest, { SpaceIngestionPurpose } from './ingest';
import generateDocument from './generate.document';

export const main = async (spaceId: string, purpose: SpaceIngestionPurpose) => {
  logger.info(`Ingest invoked for space ${spaceId}`);
  const config = createConfigUsingEnvVars();
  const alkemioCliClient = new AlkemioClient(config);
  await alkemioCliClient.enableAuthentication();
  const space = await alkemioCliClient.ingestSpace(spaceId);

  logger.info(`Space ${space.nameID} loaded.`);

  const documents: Document[] = [];
  // const documents = new Documents();
  const { documentId, source, pageContent, type, title } =
    generateDocument(space);
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

  for (let i = 0; i < (space.subspaces || []).length; i++) {
    const challenge = (space.subspaces || [])[i];
    const { documentId, source, pageContent, type, title } =
      generateDocument(challenge);
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

    for (let j = 0; j < (challenge.collaboration?.callouts || []).length; j++) {
      const callout = (challenge.collaboration?.callouts || [])[j];
      const { id: documentId, type } = callout;
      const generated = generateDocument(callout.framing);
      const { title, source } = generated;
      let pageContent = generated.pageContent;

      // extra loop but will do for now
      const contributions = callout.contributions
        ?.filter((article: any) => !!article.link)
        .map((contribution: any) => {
          const { pageContent: contribArticle } = generateDocument(
            contribution.link
          );
          return contribArticle;
        })
        .join('\n');

      if (contributions)
        pageContent = `${pageContent}\nContributions:\n${contributions}`;

      const messages = callout.comments?.messages || [];
      const processedMessages = messages
        .map((message: any) => {
          const {
            profile: { displayName: senderName, url: senderUrl },
          } = message.sender!;
          const postedOn = new Date(message.timestamp).toLocaleString('en-US');
          return `\t${senderName} with profile link ${senderUrl} said '${message.message}' on ${postedOn}`;
        })
        .join('\n');

      if (processedMessages)
        pageContent = `${pageContent}\nMessages:\n${processedMessages}`;

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
    }
  }
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
      console.log('Consumer cancelled by server');
    }
  });
})();
