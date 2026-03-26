/**
 * Shared mock factories for unit tests.
 * All external dependencies are mocked here to avoid duplication.
 */

// --- ChromaDB ---
export const mockCollection = {
  add: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue({ ids: [], documents: [], metadatas: [] }),
  count: jest.fn().mockResolvedValue(0),
};

export const mockChromaClient = {
  getOrCreateCollection: jest.fn().mockResolvedValue(mockCollection),
  deleteCollection: jest.fn().mockResolvedValue(undefined),
};

export function createMockChromaClient() {
  return { ...mockChromaClient };
}

// --- amqplib (RabbitMQ) ---
export const mockChannel = {
  assertQueue: jest.fn().mockResolvedValue({ queue: 'test-queue' }),
  assertExchange: jest.fn().mockResolvedValue({}),
  bindQueue: jest.fn().mockResolvedValue({}),
  consume: jest.fn().mockResolvedValue({ consumerTag: 'test-tag' }),
  sendToQueue: jest.fn().mockReturnValue(true),
  ack: jest.fn(),
  nack: jest.fn(),
  prefetch: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};

export const mockAmqpConnection = {
  createChannel: jest.fn().mockResolvedValue(mockChannel),
  close: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

export function createMockAmqplib() {
  return {
    connect: jest.fn().mockResolvedValue(mockAmqpConnection),
  };
}

// --- ChatMistralAI (summarization) ---
export const mockChatModel = {
  invoke: jest.fn().mockResolvedValue({ content: 'Mock summary content' }),
  pipe: jest.fn().mockReturnThis(),
};

export function createMockChatMistralAI() {
  return mockChatModel;
}

// --- OpenAI embeddings (Scaleway) ---
export const mockOpenAIClient = {
  embeddings: {
    create: jest.fn().mockResolvedValue({
      data: [
        { embedding: [0.1, 0.2, 0.3], index: 0 },
      ],
    }),
  },
};

export function createMockOpenAI() {
  return mockOpenAIClient;
}

// --- AlkemioCliClient ---
export const mockAlkemioClient = {
  initialise: jest.fn().mockResolvedValue(undefined),
  logUser: jest.fn().mockResolvedValue(undefined),
  validateConnection: jest.fn().mockResolvedValue(true),
  ingestSpace: jest.fn().mockResolvedValue({ data: {} }),
  ingestKnowledgeBase: jest.fn().mockResolvedValue({ data: {} }),
  document: jest.fn().mockResolvedValue({ data: {} }),
  sdkClient: {
    me: jest.fn().mockResolvedValue({
      data: { me: { user: { profile: { displayName: 'Test User' } } } },
    }),
  },
  alkemioLibClient: {},
  config: {},
  apiToken: 'mock-token',
  logger: createMockLogger(),
};

export function createMockAlkemioClient() {
  return { ...mockAlkemioClient };
}

// --- Winston logger ---
export function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    defaultMeta: {} as Record<string, unknown>,
  };
}

// --- Utility: reset all mocks ---
export function resetAllMocks() {
  mockCollection.add.mockClear();
  mockCollection.delete.mockClear();
  mockCollection.get.mockClear();
  mockCollection.count.mockClear();
  mockChromaClient.getOrCreateCollection.mockClear();
  mockChromaClient.deleteCollection.mockClear();
  mockChannel.consume.mockClear();
  mockChannel.sendToQueue.mockClear();
  mockChannel.ack.mockClear();
  mockAmqpConnection.createChannel.mockClear();
  mockChatModel.invoke.mockClear();
  mockOpenAIClient.embeddings.create.mockClear();
  mockAlkemioClient.initialise.mockClear();
  mockAlkemioClient.logUser.mockClear();
}
