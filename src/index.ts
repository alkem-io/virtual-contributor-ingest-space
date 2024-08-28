import logger from './logger';
import { Connection } from './event.bus/connection';
import { IngestSpace } from './event.bus/events/ingest.space';
import { embedSpace } from './space.embed/embed.space';

(async () => {
  logger.info('Ingest Space ready. Waiting for RPC messages...');

  const connection = await Connection.get();

  connection.consume(async (event: IngestSpace) => {
    //TODO create event class matching the one from Server
    //maybe share them in a package
    //publish a confifrmation
    logger.info(`Ingest invoked for space: ${event.spaceId}`);
    const resultEvent = await embedSpace(event);
    // add rety mechanism as well
    // do auto ack of the messages in order to be able to scale the service
    // channel.ack(msg);

    connection.send(resultEvent);
    logger.info(`Ingest completed for space: ${event.spaceId}`);
  });
})();
