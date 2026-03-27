/**
 * Shared mock factories for unit tests.
 * All external dependencies are mocked here to avoid duplication.
 */
import { vi } from 'vitest';

// --- ChromaDB ---
export const mockCollection = {
  add: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue({ ids: [], documents: [], metadatas: [] }),
  count: vi.fn().mockResolvedValue(0),
};

export const mockChromaClient = {
  getOrCreateCollection: vi.fn().mockResolvedValue(mockCollection),
  deleteCollection: vi.fn().mockResolvedValue(undefined),
};

export function createMockChromaClient() {
  return { ...mockChromaClient };
}

// --- amqplib (RabbitMQ) ---
export const mockChannel = {
  assertQueue: vi.fn().mockResolvedValue({ queue: 'test-queue' }),
  assertExchange: vi.fn().mockResolvedValue({}),
  bindQueue: vi.fn().mockResolvedValue({}),
  consume: vi.fn().mockResolvedValue({ consumerTag: 'test-tag' }),
  sendToQueue: vi.fn().mockReturnValue(true),
  ack: vi.fn(),
  nack: vi.fn(),
  prefetch: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
};

export const mockAmqpConnection = {
  createChannel: vi.fn().mockResolvedValue(mockChannel),
  close: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
};

export function createMockAmqplib() {
  return {
    connect: vi.fn().mockResolvedValue(mockAmqpConnection),
  };
}

// --- ChatMistralAI (summarization) ---
export const mockChatModel = {
  invoke: vi.fn().mockResolvedValue({ content: 'Mock summary content' }),
  pipe: vi.fn().mockReturnThis(),
};

export function createMockChatMistralAI() {
  return mockChatModel;
}

// --- OpenAI embeddings (Scaleway) ---
export const mockOpenAIClient = {
  embeddings: {
    create: vi.fn().mockResolvedValue({
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
  initialise: vi.fn().mockResolvedValue(undefined),
  logUser: vi.fn().mockResolvedValue(undefined),
  validateConnection: vi.fn().mockResolvedValue(true),
  ingestSpace: vi.fn().mockResolvedValue({ data: {} }),
  ingestKnowledgeBase: vi.fn().mockResolvedValue({ data: {} }),
  document: vi.fn().mockResolvedValue({ data: {} }),
  sdkClient: {
    me: vi.fn().mockResolvedValue({
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
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
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
