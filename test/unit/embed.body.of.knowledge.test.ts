import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockLogger,
  mockAlkemioInstance,
  mockEmbedSpace,
  mockEmbedKnowledgeBase,
  mockEmbedDocuments,
} = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    defaultMeta: {} as Record<string, unknown>,
  },
  mockAlkemioInstance: {
    initialise: vi.fn().mockResolvedValue(undefined),
    logUser: vi.fn().mockResolvedValue(undefined),
    validateConnection: vi.fn().mockResolvedValue(true),
    ingestSpace: vi.fn().mockResolvedValue({ data: {} }),
    ingestKnowledgeBase: vi.fn().mockResolvedValue({ data: {} }),
    document: vi.fn().mockResolvedValue({ data: {} }),
    sdkClient: { me: vi.fn() },
    alkemioLibClient: {},
    config: {},
    apiToken: 'mock-token',
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), defaultMeta: {} },
  },
  mockEmbedSpace: vi.fn(),
  mockEmbedKnowledgeBase: vi.fn(),
  mockEmbedDocuments: vi.fn(),
}));

vi.mock('../../src/logger', () => ({
  __esModule: true,
  default: mockLogger,
  getErrorMessage: vi.fn((err: unknown) => {
    if (err instanceof Error) return err.message;
    return String(err);
  }),
}));

vi.mock('../../src/graphql.client/AlkemioCliClient', () => ({
  AlkemioCliClient: vi.fn(() => mockAlkemioInstance),
}));

vi.mock('../../src/data.readers/space', () => ({
  embedSpace: mockEmbedSpace,
}));

vi.mock('../../src/data.readers/knowledge.base', () => ({
  embedKnowledgeBase: mockEmbedKnowledgeBase,
}));

vi.mock('../../src/embed.documents', () => ({
  embedDocuments: mockEmbedDocuments,
}));

import {
  setResultError,
  embedBodyOfKnowledge,
} from '../../src/embed.body.of.knowledge';
import {
  IngestBodyOfKnowledgeResult,
  IngestionResult,
  ErrorCode,
} from '../../src/event.bus/events/ingest.body.of.knowledge.result';
import {
  IngestBodyOfKnowledge,
  BodyOfKnowledgeType,
  IngestionPurpose,
} from '../../src/event.bus/events/ingest.body.of.knowledge';

describe('embed.body.of.knowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAlkemioInstance.initialise.mockResolvedValue(undefined);
  });

  describe('setResultError', () => {
    it('sets error fields on the result', () => {
      const result = new IngestBodyOfKnowledgeResult(
        'bok-1',
        BodyOfKnowledgeType.ALKEMIO_SPACE,
        IngestionPurpose.KNOWLEDGE,
        'persona-1'
      );

      const returned = setResultError(result, 'something went wrong', ErrorCode.VECTOR_INSERT);

      expect(returned).toBe(result);
      expect(result.result).toBe(IngestionResult.FAILURE);
      expect(result.error).toEqual({
        code: ErrorCode.VECTOR_INSERT,
        message: 'something went wrong',
      });
    });

    it('sets error without code when code is omitted', () => {
      const result = new IngestBodyOfKnowledgeResult(
        'bok-2',
        BodyOfKnowledgeType.ALKEMIO_SPACE,
        IngestionPurpose.KNOWLEDGE,
        'persona-2'
      );

      setResultError(result, 'no code error');

      expect(result.error).toEqual({
        code: undefined,
        message: 'no code error',
      });
    });

    it('sets a UTC timestamp', () => {
      const result = new IngestBodyOfKnowledgeResult(
        'bok-3',
        BodyOfKnowledgeType.ALKEMIO_SPACE,
        IngestionPurpose.KNOWLEDGE,
        'persona-3'
      );

      const before = Date.now();
      setResultError(result, 'ts test');
      const after = Date.now();

      // Timestamp should be a number close to now (within a few seconds tolerance)
      expect(typeof result.timestamp).toBe('number');
      // The UTC conversion via toLocaleString can shift by the local timezone offset,
      // so allow tolerance equal to the max timezone offset (14 hours = 50400s)
      expect(result.timestamp).toBeGreaterThan(before - 50400000);
      expect(result.timestamp).toBeLessThan(after + 50400000);
    });

    it('logs an error message', () => {
      const result = new IngestBodyOfKnowledgeResult(
        'bok-4',
        BodyOfKnowledgeType.ALKEMIO_SPACE,
        IngestionPurpose.KNOWLEDGE,
        'persona-4'
      );

      setResultError(result, 'log check', ErrorCode.VECTOR_INSERT);

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('embedBodyOfKnowledge', () => {
    const makeEvent = (
      type: BodyOfKnowledgeType = BodyOfKnowledgeType.ALKEMIO_SPACE
    ) =>
      new IngestBodyOfKnowledge(
        'bok-id',
        type,
        IngestionPurpose.KNOWLEDGE,
        'persona-id'
      );

    it('returns success result on happy path (ALKEMIO_SPACE)', async () => {
      const docs = [{ pageContent: 'doc1', metadata: {} }];
      const bodyOfKnowledge = { id: 'bok-id', profile: { displayName: 'Test', url: 'http://test' } };

      mockEmbedSpace.mockResolvedValue({ documents: docs, bodyOfKnowledge });
      mockEmbedDocuments.mockResolvedValue(true);

      const result = await embedBodyOfKnowledge(makeEvent());

      expect(result.result).toBe(IngestionResult.SUCCESS);
      expect(result.bodyOfKnowledgeId).toBe('bok-id');
      expect(typeof result.timestamp).toBe('number');
      expect(mockEmbedSpace).toHaveBeenCalled();
      expect(mockEmbedDocuments).toHaveBeenCalledWith(
        bodyOfKnowledge,
        docs,
        IngestionPurpose.KNOWLEDGE
      );
    });

    it('returns success result on happy path (ALKEMIO_KNOWLEDGE_BASE)', async () => {
      const docs = [{ pageContent: 'doc1', metadata: {} }];
      const bodyOfKnowledge = { id: 'kb-id' };

      mockEmbedKnowledgeBase.mockResolvedValue({ documents: docs, bodyOfKnowledge });
      mockEmbedDocuments.mockResolvedValue(true);

      const result = await embedBodyOfKnowledge(
        makeEvent(BodyOfKnowledgeType.ALKEMIO_KNOWLEDGE_BASE)
      );

      expect(result.result).toBe(IngestionResult.SUCCESS);
      expect(mockEmbedKnowledgeBase).toHaveBeenCalled();
    });

    it('returns error result when AlkemioClient init fails', async () => {
      mockAlkemioInstance.initialise.mockRejectedValue(
        new Error('auth failed')
      );

      const result = await embedBodyOfKnowledge(makeEvent());

      expect(result.result).toBe(IngestionResult.FAILURE);
      expect(result.error?.message).toBe(
        'AlkemioClient can not be initialised.'
      );
    });

    it('returns error result when document read throws', async () => {
      mockEmbedSpace.mockRejectedValue(new Error('read failure'));

      const result = await embedBodyOfKnowledge(makeEvent());

      expect(result.result).toBe(IngestionResult.FAILURE);
      expect(result.error?.message).toBe('read failure');
    });

    it('returns error result when document read returns empty', async () => {
      mockEmbedSpace.mockResolvedValue({});

      const result = await embedBodyOfKnowledge(makeEvent());

      expect(result.result).toBe(IngestionResult.FAILURE);
      expect(result.error?.message).toBe(
        'Body Of Knowledge could not be processed.'
      );
    });

    it('returns error with VECTOR_INSERT code when embedding fails', async () => {
      const docs = [{ pageContent: 'doc1', metadata: {} }];
      const bodyOfKnowledge = { id: 'bok-id' };

      mockEmbedSpace.mockResolvedValue({ documents: docs, bodyOfKnowledge });
      mockEmbedDocuments.mockRejectedValue(new Error('insert failed'));

      const result = await embedBodyOfKnowledge(makeEvent());

      expect(result.result).toBe(IngestionResult.FAILURE);
      expect(result.error?.code).toBe(ErrorCode.VECTOR_INSERT);
      expect(result.error?.message).toContain('insert failed');
    });

    it('returns failure result when embedDocuments returns false', async () => {
      const docs = [{ pageContent: 'doc1', metadata: {} }];
      const bodyOfKnowledge = { id: 'bok-id' };

      mockEmbedSpace.mockResolvedValue({ documents: docs, bodyOfKnowledge });
      mockEmbedDocuments.mockResolvedValue(false);

      const result = await embedBodyOfKnowledge(makeEvent());

      expect(result.result).toBe(IngestionResult.FAILURE);
      expect(result.error?.message).toBe(
        'An error occured while embedding.'
      );
    });
  });
});
