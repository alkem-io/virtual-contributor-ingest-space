import { embedBodyOfKnowledge } from './embed.body.of.knowledge';
import { Connection } from './event.bus/connection';
import type { IngestBodyOfKnowledge } from './event.bus/events/ingest.body.of.knowledge';
import logger from './logger';

(async () => {
  logger.info('Ingest Space ready. Waiting for RPC messages...');

  const connection = await Connection.get();

  connection.consume(async (event: IngestBodyOfKnowledge) => {
    const resultEvent = await embedBodyOfKnowledge(event);

    connection.send(resultEvent);
    if (resultEvent.error) {
      logger.error(
        `Ingest ${resultEvent.result} for: ${event.bodyOfKnowledgeId} — ${resultEvent.error.message}`,
        { errorCode: resultEvent.error.code }
      );
    } else {
      logger.info(
        `Ingest ${resultEvent.result} for: ${event.bodyOfKnowledgeId}`
      );
    }
    return resultEvent;
  });
})();
