import logger from './logger';
import { Connection } from './event.bus/connection';
import { IngestBodyOfKnowledge } from './event.bus/events/ingest.body.of.knowledge';
import { embedBodyOfKnowledge } from './embed.body.of.knowledge';

(async () => {
  logger.info('Ingest Space ready. Waiting for RPC messages...');

  const connection = await Connection.get();

  connection.consume(async (event: IngestBodyOfKnowledge) => {
    const resultEvent = await embedBodyOfKnowledge(event);

    connection.send(resultEvent);
    logger.info(`Ingest completed for space: ${event.bodyOfKnowledgeId}`);
  });
})();
