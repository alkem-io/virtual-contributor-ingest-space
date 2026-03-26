const mockConsume = jest.fn();
const mockSend = jest.fn();
const mockConnectionGet = jest.fn().mockResolvedValue({
  consume: mockConsume,
  send: mockSend,
});

jest.mock('../../src/event.bus/connection', () => ({
  Connection: {
    get: mockConnectionGet,
  },
}));

const mockEmbedBodyOfKnowledge = jest.fn();
jest.mock('../../src/embed.body.of.knowledge', () => ({
  embedBodyOfKnowledge: mockEmbedBodyOfKnowledge,
}));

jest.mock('../../src/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    defaultMeta: {},
  },
}));

describe('index (main entry)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should set up connection and register consumer', async () => {
    // Require the module to trigger the IIFE
    // We need to isolate modules to re-run the IIFE each time
    jest.isolateModules(() => {
      require('../../src/index');
    });

    // Allow the async IIFE to settle
    await new Promise(resolve => setImmediate(resolve));

    expect(mockConnectionGet).toHaveBeenCalled();
    expect(mockConsume).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should log readiness message', async () => {
    const logger = require('../../src/logger').default;

    jest.isolateModules(() => {
      require('../../src/index');
    });

    await new Promise(resolve => setImmediate(resolve));

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Waiting for RPC messages')
    );
  });

  describe('consume callback behavior', () => {
    let consumeCallback: Function;

    beforeEach(async () => {
      jest.clearAllMocks();
      mockConsume.mockImplementation((cb: Function) => {
        consumeCallback = cb;
      });

      jest.isolateModules(() => {
        require('../../src/index');
      });

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
      const logger = require('../../src/logger').default;
      const mockEvent = { bodyOfKnowledgeId: 'bok-456' };
      const mockResult = { result: 'success', bodyOfKnowledgeId: 'bok-456' };
      mockEmbedBodyOfKnowledge.mockResolvedValue(mockResult);

      await consumeCallback(mockEvent);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('bok-456')
      );
    });

    it('should log error when resultEvent has an error', async () => {
      const logger = require('../../src/logger').default;
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
