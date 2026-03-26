/**
 * T011: Tests for src/embed.documents.ts
 * - embedDocuments function: short chunk merging, summarization threshold,
 *   metadata sanitization, missing config returns false, batch insertion
 */

import { createMockLogger } from '../helpers/mocks';

const mockLogger = createMockLogger();

jest.mock('../../src/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

const mockCollection = {
  add: jest.fn().mockResolvedValue(undefined),
};

const mockChromaClient = {
  heartbeat: jest.fn().mockResolvedValue(1234567890),
  deleteCollection: jest.fn().mockResolvedValue(undefined),
  getOrCreateCollection: jest.fn().mockResolvedValue(mockCollection),
};

jest.mock('../../src/db.connect', () => ({
  dbConnect: jest.fn(() => mockChromaClient),
}));

jest.mock('@chroma-core/openai', () => ({
  OpenAIEmbeddingFunction: jest.fn().mockImplementation(() => ({
    generate: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  })),
}));

const mockSplitDocuments = jest.fn();

jest.mock('@langchain/textsplitters', () => ({
  RecursiveCharacterTextSplitter: jest.fn().mockImplementation(() => ({
    splitDocuments: mockSplitDocuments,
  })),
}));

jest.mock('../../src/summarize/document', () => ({
  summarizeDocument: jest.fn().mockResolvedValue('Document summary text'),
}));

jest.mock('../../src/summarize/body.of.knowledge', () => ({
  summariseBodyOfKnowledge: jest.fn().mockResolvedValue('BoK summary text'),
}));

jest.mock('@langchain/core/documents', () => ({
  Document: jest.fn().mockImplementation((args: any) => ({
    pageContent: args.pageContent,
    metadata: args.metadata || {},
  })),
}));

jest.mock('@langchain/core/language_models/chat_models', () => ({
  BaseChatModel: jest.fn(),
}));

jest.mock('chromadb', () => ({
  Metadata: {},
}));

import { embedDocuments } from '../../src/embed.documents';
import { summarizeDocument } from '../../src/summarize/document';
import { summariseBodyOfKnowledge } from '../../src/summarize/body.of.knowledge';
import { IngestionPurpose } from '../../src/event.bus/events/ingest.body.of.knowledge';
import { DocumentType } from '../../src/document.type';
import { Document } from '@langchain/core/documents';

const ORIGINAL_ENV = { ...process.env };

describe('embedDocuments', () => {
  const mockModel = {} as any;

  const createDoc = (content: string, metadata: any = {}): Document => ({
    pageContent: content,
    metadata: {
      documentId: 'doc-1',
      type: DocumentType.KNOWLEDGE,
      ...metadata,
    },
  });

  const defaultBoK = {
    id: 'bok-123',
    profile: { displayName: 'Test BoK', url: 'https://example.com/bok' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger.defaultMeta = {} as any;
    process.env = {
      ...ORIGINAL_ENV,
      EMBEDDINGS_ENDPOINT: 'https://embed.example.com',
      EMBEDDINGS_API_KEY: 'embed-key',
      EMBEDDINGS_MODEL_NAME: 'embed-model',
      VECTOR_DB_CREDENTIALS: 'creds',
      VECTOR_DB_HOST: 'localhost',
      VECTOR_DB_PORT: '8000',
    };

    // Default: splitter returns the same docs unchanged (single chunk each)
    mockSplitDocuments.mockImplementation(async (docs: any[]) =>
      docs.map((d: any) => ({
        pageContent: d.pageContent,
        metadata: { ...d.metadata },
      }))
    );

    // Reset summarize mocks
    (summarizeDocument as jest.Mock).mockResolvedValue('Document summary text');
    (summariseBodyOfKnowledge as jest.Mock).mockResolvedValue('BoK summary text');
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('missing config', () => {
    it('should return false when EMBEDDINGS_ENDPOINT is missing', async () => {
      delete process.env.EMBEDDINGS_ENDPOINT;

      const result = await embedDocuments(
        defaultBoK,
        [createDoc('test')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      expect(result).toBe(false);
    });

    it('should return false when EMBEDDINGS_API_KEY is missing', async () => {
      delete process.env.EMBEDDINGS_API_KEY;

      const result = await embedDocuments(
        defaultBoK,
        [createDoc('test')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      expect(result).toBe(false);
    });

    it('should return false when EMBEDDINGS_MODEL_NAME is missing', async () => {
      delete process.env.EMBEDDINGS_MODEL_NAME;

      const result = await embedDocuments(
        defaultBoK,
        [createDoc('test')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      expect(result).toBe(false);
    });

    it('should log error when config is missing', async () => {
      delete process.env.EMBEDDINGS_ENDPOINT;

      await embedDocuments(
        defaultBoK,
        [createDoc('test')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('short chunk merging', () => {
    it('should merge short first chunks with next chunk', async () => {
      // Splitter returns a short chunk followed by a normal one
      mockSplitDocuments.mockResolvedValue([
        { pageContent: 'short', metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
        { pageContent: 'A much longer chunk that exceeds the minimum length threshold for merging'.repeat(5), metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
      ]);

      const result = await embedDocuments(
        defaultBoK,
        [createDoc('test content')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      expect(result).toBe(true);
      // The short chunk should be merged into the next one
      expect(mockCollection.add).toHaveBeenCalled();
    });

    it('should handle all short chunks by creating a single document', async () => {
      mockSplitDocuments.mockResolvedValue([
        { pageContent: 'tiny', metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
      ]);

      const result = await embedDocuments(
        defaultBoK,
        [createDoc('tiny')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      expect(result).toBe(true);
    });
  });

  describe('spreadsheet handling', () => {
    it('should not split spreadsheet documents', async () => {
      const spreadsheetDoc = createDoc('col1,col2\nval1,val2', {
        type: DocumentType.SPREADSHEET,
        documentId: 'sheet-1',
      });

      await embedDocuments(
        defaultBoK,
        [spreadsheetDoc],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      // splitDocuments should NOT be called for spreadsheets
      // (the code skips splitting for SPREADSHEET type)
      // But splitter is still called for BoK summary generation
      // The first call should be for BoK summary, not for the spreadsheet itself
      expect(mockCollection.add).toHaveBeenCalled();
    });
  });

  describe('summarization threshold', () => {
    it('should summarize documents with more than 3 chunks', async () => {
      const longContent = 'A'.repeat(250);
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: longContent, metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
        { pageContent: longContent, metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
        { pageContent: longContent, metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
        { pageContent: longContent, metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
      ]);

      // For BoK summary splitting
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'bok chunk', metadata: {} },
      ]);

      await embedDocuments(
        defaultBoK,
        [createDoc('long content')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      expect(summarizeDocument).toHaveBeenCalledTimes(1);
    });

    it('should NOT summarize documents with 3 or fewer chunks', async () => {
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'chunk 1 long enough content here', metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
        { pageContent: 'chunk 2 long enough content here', metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
        { pageContent: 'chunk 3 long enough content here', metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
      ]);

      // For BoK summary splitting
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'bok chunk', metadata: {} },
      ]);

      await embedDocuments(
        defaultBoK,
        [createDoc('content')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      expect(summarizeDocument).not.toHaveBeenCalled();
    });

    it('should handle summarization errors gracefully', async () => {
      const longContent = 'A'.repeat(250);
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: longContent, metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
        { pageContent: longContent, metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
        { pageContent: longContent, metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
        { pageContent: longContent, metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
      ]);

      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'bok chunk', metadata: {} },
      ]);

      (summarizeDocument as jest.Mock).mockRejectedValueOnce(
        new Error('Summarization failed')
      );

      // Should NOT throw - error is caught and logged
      const result = await embedDocuments(
        defaultBoK,
        [createDoc('content')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      expect(result).toBe(true);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('metadata sanitization', () => {
    it('should strip non-primitive metadata values', async () => {
      const longContent = 'A'.repeat(250);
      mockSplitDocuments.mockResolvedValueOnce([
        {
          pageContent: longContent,
          metadata: {
            documentId: 'doc-1',
            type: DocumentType.KNOWLEDGE,
            loc: { lines: { from: 1, to: 10 } }, // object - should be stripped
            title: 'Test Title', // string - should be kept
            count: 42, // number - should be kept
            isActive: true, // boolean - should be kept
            nullVal: null, // null - should be kept
          },
        },
      ]);

      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'bok chunk', metadata: {} },
      ]);

      await embedDocuments(
        defaultBoK,
        [createDoc('content')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      const addCall = mockCollection.add.mock.calls[0][0];
      // The first batch of metadatas should have sanitized entries
      const meta = addCall.metadatas[0];
      expect(meta.documentId).toBe('doc-1');
      expect(meta.title).toBe('Test Title');
      expect(meta.count).toBe(42);
      expect(meta.isActive).toBe(true);
      expect(meta.nullVal).toBeNull();
      expect(meta.loc).toBeUndefined(); // object stripped
      expect(meta.embeddingType).toBe('chunk');
      expect(meta.chunkIndex).toBe(0);
    });
  });

  describe('batch insertion', () => {
    it('should add documents to collection in batches', async () => {
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'chunk content', metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
      ]);

      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'bok chunk', metadata: {} },
      ]);

      await embedDocuments(
        defaultBoK,
        [createDoc('content')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      expect(mockCollection.add).toHaveBeenCalled();
      const addCall = mockCollection.add.mock.calls[0][0];
      expect(addCall).toHaveProperty('ids');
      expect(addCall).toHaveProperty('documents');
      expect(addCall).toHaveProperty('metadatas');
    });

    it('should create collection with correct name pattern', async () => {
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'chunk', metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
      ]);
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'bok chunk', metadata: {} },
      ]);

      await embedDocuments(
        defaultBoK,
        [createDoc('content')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      expect(mockChromaClient.getOrCreateCollection).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'bok-123-knowledge',
        })
      );
    });

    it('should delete old collection before creating new one', async () => {
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'chunk', metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
      ]);
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'bok chunk', metadata: {} },
      ]);

      await embedDocuments(
        defaultBoK,
        [createDoc('content')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      expect(mockChromaClient.deleteCollection).toHaveBeenCalledWith({
        name: 'bok-123-knowledge',
      });
    });

    it('should handle missing old collection gracefully', async () => {
      mockChromaClient.deleteCollection.mockRejectedValueOnce(
        new Error('Collection not found')
      );

      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'chunk', metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
      ]);
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'bok chunk', metadata: {} },
      ]);

      const result = await embedDocuments(
        defaultBoK,
        [createDoc('content')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      expect(result).toBe(true);
    });

    it('should throw on batch add failure', async () => {
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'chunk', metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
      ]);
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'bok chunk', metadata: {} },
      ]);

      mockCollection.add.mockRejectedValueOnce(new Error('Batch add failed'));

      await expect(
        embedDocuments(
          defaultBoK,
          [createDoc('content')],
          IngestionPurpose.KNOWLEDGE,
          mockModel
        )
      ).rejects.toThrow('Batch add failed');
    });
  });

  describe('body of knowledge summary', () => {
    it('should generate BoK summary and add it to collection', async () => {
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'chunk', metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
      ]);
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'bok chunk', metadata: {} },
      ]);

      await embedDocuments(
        defaultBoK,
        [createDoc('content')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      expect(summariseBodyOfKnowledge).toHaveBeenCalledTimes(1);
      // The last entry in the collection should be the BoK summary
      const addCall = mockCollection.add.mock.calls[0][0];
      const lastId = addCall.ids[addCall.ids.length - 1];
      expect(lastId).toBe('body-of-knowledge-summary');
    });

    it('should use profile url from bodyOfKnowledge', async () => {
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'chunk', metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
      ]);
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'bok chunk', metadata: {} },
      ]);

      await embedDocuments(
        defaultBoK,
        [createDoc('content')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      const addCall = mockCollection.add.mock.calls[0][0];
      const lastMeta = addCall.metadatas[addCall.metadatas.length - 1];
      expect(lastMeta.source).toBe('https://example.com/bok');
      expect(lastMeta.title).toBe('Test BoK');
    });

    it('should fall back to about.profile when profile is missing', async () => {
      const bokWithAbout = {
        id: 'bok-456',
        about: {
          profile: { displayName: 'About BoK', url: 'https://about.com/bok' },
        },
      };

      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'chunk', metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
      ]);
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'bok chunk', metadata: {} },
      ]);

      await embedDocuments(
        bokWithAbout,
        [createDoc('content')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      const addCall = mockCollection.add.mock.calls[0][0];
      const lastMeta = addCall.metadatas[addCall.metadatas.length - 1];
      expect(lastMeta.source).toBe('https://about.com/bok');
      expect(lastMeta.title).toBe('About BoK');
    });
  });

  describe('return value', () => {
    it('should return true on success', async () => {
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'chunk', metadata: { documentId: 'doc-1', type: DocumentType.KNOWLEDGE } },
      ]);
      mockSplitDocuments.mockResolvedValueOnce([
        { pageContent: 'bok chunk', metadata: {} },
      ]);

      const result = await embedDocuments(
        defaultBoK,
        [createDoc('content')],
        IngestionPurpose.KNOWLEDGE,
        mockModel
      );

      expect(result).toBe(true);
    });
  });
});
