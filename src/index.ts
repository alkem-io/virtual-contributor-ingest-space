import amqplib from 'amqplib'
import { AlkemioClient, createConfigUsingEnvVars, } from '@alkemio/client-lib'

import Documents, { DocumentType } from './documents'
import logger from './logger'
import ingest from './ingest'
import generateDocument from './generate-document'

export const main = async (spaceId: string) => {
  logger.info(`Ingest invoked for space ${spaceId}`);
  const config = createConfigUsingEnvVars();
  const alkemioCliClient = new AlkemioClient(config);
  await alkemioCliClient.enableAuthentication();
  const space = await alkemioCliClient.ingestSpace(spaceId)

  logger.info(`Space ${space.nameID} loaded.`);

  const documents = new Documents();
  const { id, source, document, type } = generateDocument(space)
  documents.add(
    id,
    document,
    source,
    type
  )

  for (let i = 0; i < (space.subspaces || []).length; i++) {
    const challenge = (space.subspaces || [])[i]
    const { id, source, document, type } = generateDocument(challenge)
    documents.add(
      id,
      document,
      source,
      type
    )

    for (let j = 0; j < (challenge.collaboration?.callouts || []).length; j++) {
      const callout = (challenge.collaboration?.callouts || [])[j]
      const { id, type } = callout;
      let { source, document } = generateDocument(callout.framing)

      // extra loop but will do for now
      const contributions = callout.contributions?.filter(
        (article: any) => !!article.link
      ).map((contribution: any) => {
        const { document: contribArticle } = generateDocument(contribution.link);
        return contribArticle
      }).join('\n')

      if (contributions) document = `${document}\nContributions:\n${contributions}`

      const messages = callout.comments?.messages || []
      const processedMessages = messages.map((message: any) => {
        let { profile: { displayName: senderName, url: senderUrl } } = message.sender!
        const postedOn = new Date(message.timestamp).toLocaleString("en-US")
        return `\t${senderName} with profile link ${senderUrl} said '${message.message}' on ${postedOn}`
      }).join('\n')

      if (processedMessages) document = `${document}\nMessages:\n${processedMessages}`

      documents.add(
        id,
        document,
        source,
        type as unknown as DocumentType
      )
    }
  }
  ingest(space.nameID, documents)
  logger.info(`Space ingested.`);
};

(async () => {
  const conn = await amqplib.connect('amqp://alkemio-admin:alkemio!@localhost:5672');
  const queue = 'virtual-contributor-added-to-space';

  const channel = await conn.createChannel();
  await channel.assertQueue(queue);

  channel.consume(queue, async (msg) => {
    if (msg !== null) {
      //TODO create event class matching the one from Server
      //maybe share them in a package
      //publish a confifrmation
      const decoded = JSON.parse(JSON.parse(msg.content.toString()));
      await main(decoded.spaceId)
      channel.ack(msg);
    } else {
      console.log('Consumer cancelled by server');
    }
  });
})();
