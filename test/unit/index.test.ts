import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockConsume = vi.fn();
const mockSend = vi.fn();
const mockConnectionGet = vi.fn().mockResolvedValue({
  consume: mockConsume,
  send: mockSend,
});

vi.mock('../../src/event.bus/connection', () => ({
  Connection: {
    get: mockConnectionGet,
  },
}));

const mockEmbedBodyOfKnowledge = vi.fn();
vi.mock('../../src/embed.body.of.knowledge', () => ({
  embedBodyOfKnowledge: mockEmbedBodyOfKnowledge,
}));

vi.mock('../../src/logger', () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    defaultMeta: {},
  },
}));

describe('index (main entry)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set up connection and register consumer', async () => {
    // Require the module to trigger the IIFE
    // We need to isolate modules to re-run the IIFE each time
    vi.resetModules();
    // Re-setup mocks after resetModules
    vi.doMock('../../src/event.bus/connection', () => ({
      Connection: {
        get: mockConnectionGet,
      },
    }));
    vi.doMock('../../src/embed.body.of.knowledge', () => ({
      embedBodyOfKnowledge: mockEmbedBodyOfKnowledge,
    }));
    vi.doMock('../../src/logger', () => ({
      __esModule: true,
      default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        defaultMeta: {},
      },
    }));

    await import('../../src/index');

    // Allow the async IIFE to settle
    await new Promise(resolve => setImmediate(resolve));

    expect(mockConnectionGet).toHaveBeenCalled();
    expect(mockConsume).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should log readiness message', async () => {
    vi.resetModules();
    vi.doMock('../../src/event.bus/connection', () => ({
      Connection: {
        get: mockConnectionGet,
      },
    }));
    vi.doMock('../../src/embed.body.of.knowledge', () => ({
      embedBodyOfKnowledge: mockEmbedBodyOfKnowledge,
    }));
    const mockLoggerModule = {
      __esModule: true,
      default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        defaultMeta: {},
      },
    };
    vi.doMock('../../src/logger', () => mockLoggerModule);

    await import('../../src/index');

    await new Promise(resolve => setImmediate(resolve));

    expect(mockLoggerModule.default.info).toHaveBeenCalledWith(
      expect.stringContaining('Waiting for RPC messages')
    );
  });

  describe('consume callback behavior', () => {
    let consumeCallback: Function;

    beforeEach(async () => {
      vi.clearAllMocks();
      mockConsume.mockImplementation((cb: Function) => {
        consumeCallback = cb;
      });

      vi.resetModules();
      vi.doMock('../../src/event.bus/connection', () => ({
        Connection: {
          get: mockConnectionGet,
        },
      }));
      vi.doMock('../../src/embed.body.of.knowledge', () => ({
        embedBodyOfKnowledge: mockEmbedBodyOfKnowledge,
      }));
      vi.doMock('../../src/logger', () => ({
        __esModule: true,
        default: {
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          defaultMeta: {},
        },
      }));

      await import('../../src/index');

      await new Promise(resolve => setImmediate(resolve));
    });

    it('should call embedBodyOfKnowledge and send result on success', async () => {
      const mockEvent = { bodyOfKnowledgeId: 'bok-123' };
      const mockResult = { result: 'success', bodyOfKnowledgeId: 'bok-123' };
      mockEmbedBodyOfKnowledge.mockResolvedValue(mockResult);

      await consumeCallback(mockEvent);

      expect(mockEmbedBodyOfKnowledge).toHaveBeenCalledWith(mockEvent);
      expect(mockSend).toHaveBeenCalledWith(mockResult);
    });

    it('should log success when resultEvent has no error', async () => {
      const loggerMod = await import('../../src/logger');
      const logger = loggerMod.default;
      const mockEvent = { bodyOfKnowledgeId: 'bok-456' };
      const mockResult = { result: 'success', bodyOfKnowledgeId: 'bok-456' };
      mockEmbedBodyOfKnowledge.mockResolvedValue(mockResult);

      await consumeCallback(mockEvent);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('bok-456')
      );
    });

    it('should log error when resultEvent has an error', async () => {
      const loggerMod = await import('../../src/logger');
      const logger = loggerMod.default;
      const mockEvent = { bodyOfKnowledgeId: 'bok-789' };
      const mockResult = {
        result: 'failure',
        bodyOfKnowledgeId: 'bok-789',
        error: { code: 'ERR_TEST', message: 'Something went wrong' },
      };
      mockEmbedBodyOfKnowledge.mockResolvedValue(mockResult);

      await consumeCallback(mockEvent);

      expect(mockSend).toHaveBeenCalledWith(mockResult);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('bok-789'),
        expect.objectContaining({ errorCode: 'ERR_TEST' })
      );
    });
  });
});
