import {
  createMockLogger,
  mockChannel,
  mockAmqpConnection,
} from '../../helpers/mocks';

const mockLogger = createMockLogger();
jest.mock('../../../src/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

jest.mock('amqplib', () => ({
  __esModule: true,
  default: {
    connect: jest.fn().mockResolvedValue(mockAmqpConnection),
  },
}));

// RabbitMQ env vars required by Connection.loadConfigFromEnv
const RABBIT_ENV = {
  RABBITMQ_HOST: 'localhost',
  RABBITMQ_USER: 'guest',
  RABBITMQ_PASSWORD: 'guest',
  RABBITMQ_PORT: '5672',
  RABBITMQ_INGEST_BODY_OF_KNOWLEDGE_QUEUE: 'incoming-q',
  RABBITMQ_INGEST_BODY_OF_KNOWLEDGE_RESULT_QUEUE: 'outgoing-q',
  RABBITMQ_EVENT_BUS_EXCHANGE: 'test-exchange',
};

// We need to re-import the module per test group to reset the private #instance singleton.
// Use jest.resetModules() + dynamic require where singleton isolation matters.

import {
  IngestBodyOfKnowledge,
  BodyOfKnowledgeType,
  IngestionPurpose,
} from '../../../src/event.bus/events/ingest.body.of.knowledge';

// For most tests we can share one import since we only call get() once per describe block.
import { Connection } from '../../../src/event.bus/connection';

describe('Connection', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, ...RABBIT_ENV };
    mockAmqpConnection.createChannel.mockResolvedValue(mockChannel);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Connection.get()', () => {
    it('creates a connection and returns an instance', async () => {
      const conn = await Connection.get();

      expect(conn).toBeInstanceOf(Connection);
      expect(mockAmqpConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertQueue).toHaveBeenCalledTimes(2);
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'test-exchange',
        'direct'
      );
      expect(mockChannel.bindQueue).toHaveBeenCalled();
      expect(mockChannel.prefetch).toHaveBeenCalledWith(1);
    });

    it('returns the same singleton on subsequent calls', async () => {
      // Since we already called get() above, calling again should return same instance
      const first = await Connection.get();
      const second = await Connection.get();

      expect(first).toBe(second);
      // createChannel should NOT have been called again for second call
      // (it was called once in the previous test, the singleton is reused)
    });
  });

  describe('consume()', () => {
    let conn: Connection;

    beforeAll(async () => {
      process.env = { ...originalEnv, ...RABBIT_ENV };
      mockAmqpConnection.createChannel.mockResolvedValue(mockChannel);
      conn = await Connection.get();
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('parses messages and calls the handler', async () => {
      const handler = jest.fn();

      await conn.consume(handler);

      expect(mockChannel.consume).toHaveBeenCalled();
      const consumeCallback = mockChannel.consume.mock.calls[0][1];

      const msgPayload = {
        bodyOfKnowledgeId: 'space-1',
        type: BodyOfKnowledgeType.ALKEMIO_SPACE,
        purpose: IngestionPurpose.KNOWLEDGE,
        personaId: 'persona-1',
      };
      const fakeMsg = {
        content: Buffer.from(JSON.stringify(msgPayload)),
      };

      await consumeCallback(fakeMsg);

      expect(handler).toHaveBeenCalledTimes(1);
      const eventArg = handler.mock.calls[0][0];
      expect(eventArg).toBeInstanceOf(IngestBodyOfKnowledge);
      expect(eventArg.bodyOfKnowledgeId).toBe('space-1');
      expect(eventArg.type).toBe(BodyOfKnowledgeType.ALKEMIO_SPACE);
    });

    it('logs error when message is null', async () => {
      const handler = jest.fn();

      await conn.consume(handler);
      const consumeCallback = mockChannel.consume.mock.calls[0][1];

      await consumeCallback(null);

      expect(handler).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('Invalid incoming message');
    });

    it('logs error on invalid JSON message', async () => {
      const handler = jest.fn();

      await conn.consume(handler);
      const consumeCallback = mockChannel.consume.mock.calls[0][1];

      const fakeMsg = {
        content: Buffer.from('not valid json{{{'),
      };

      await consumeCallback(fakeMsg);

      expect(handler).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('uses noAck: true', async () => {
      await conn.consume(jest.fn());

      const options = mockChannel.consume.mock.calls[0][2];
      expect(options).toEqual({ noAck: true });
    });
  });

  describe('send()', () => {
    let conn: Connection;

    beforeAll(async () => {
      process.env = { ...originalEnv, ...RABBIT_ENV };
      mockAmqpConnection.createChannel.mockResolvedValue(mockChannel);
      conn = await Connection.get();
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('publishes a message to the outgoing queue', async () => {
      const message = {
        bodyOfKnowledgeId: 'bok-1',
        type: BodyOfKnowledgeType.ALKEMIO_SPACE,
        purpose: IngestionPurpose.KNOWLEDGE,
        personaId: 'persona-1',
        timestamp: Date.now(),
        result: 'success' as const,
      } as any;

      await conn.send(message);

      expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
        'outgoing-q',
        expect.any(Buffer)
      );

      const sentBuffer = mockChannel.sendToQueue.mock.calls[0][1];
      const parsed = JSON.parse(sentBuffer.toString());
      expect(parsed.bodyOfKnowledgeId).toBe('bok-1');
    });

    it('throws when send fails', async () => {
      mockChannel.sendToQueue.mockImplementationOnce(() => {
        throw new Error('send failed');
      });

      await expect(conn.send({} as any)).rejects.toThrow('send failed');
    });
  });
});
