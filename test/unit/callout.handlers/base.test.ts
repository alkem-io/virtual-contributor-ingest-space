import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Document } from '@langchain/core/documents';
import { Logger } from 'winston';
import { baseHandler } from '../../../src/callout.handlers/base';
import { DocumentType } from '../../../src/document.type';

vi.mock('../../../src/generate.document', () => ({
  generateDocument: vi.fn(),
}));

import { generateDocument } from '../../../src/generate.document';

const mockGenerateDocument = generateDocument as ReturnType<typeof vi.fn>;

const createLogger = (): Logger =>
  ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  } as unknown as Logger);

describe('baseHandler', () => {
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createLogger();
    mockGenerateDocument.mockReturnValue({
      documentId: 'doc-1',
      source: 'http://example.com',
      pageContent: 'Test content',
      type: DocumentType.POST,
      title: 'Test Title',
    });
  });

  it('should generate a document from callout framing', async () => {
    const callout = {
      id: 'callout-1',
      framing: { profile: { displayName: 'Framing' } },
      comments: { messages: [] },
      contributions: [],
    };

    const result = await baseHandler(callout as any, logger);

    expect(mockGenerateDocument).toHaveBeenCalledWith(callout.framing);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Document);
    expect(result[0].metadata.type).toBe(DocumentType.POST);
    expect(result[0].metadata.documentId).toBe('callout-1');
  });

  it('should set type to COLLECTION when contribution types are present', async () => {
    const callout = {
      id: 'callout-2',
      settings: { contribution: { allowedTypes: ['POST'] } },
      framing: {},
      comments: { messages: [] },
      contributions: [],
    };

    const result = await baseHandler(callout as any, logger);

    expect(result[0].metadata.type).toBe(DocumentType.COLLECTION);
  });

  it('should process messages with sender profile', async () => {
    const callout = {
      id: 'callout-3',
      framing: {},
      comments: {
        messages: [
          {
            sender: {
              profile: {
                displayName: 'Alice',
                url: 'http://alice.example.com',
              },
            },
            message: 'Hello world',
            timestamp: '2024-01-15T10:00:00Z',
          },
        ],
      },
      contributions: [],
    };

    const result = await baseHandler(callout as any, logger);

    expect(result[0].pageContent).toContain('Messages:');
    expect(result[0].pageContent).toContain('Alice');
    expect(result[0].pageContent).toContain('http://alice.example.com');
    expect(result[0].pageContent).toContain('Hello world');
  });

  it('should handle missing sender profile with defaults', async () => {
    const callout = {
      id: 'callout-4',
      framing: {},
      comments: {
        messages: [
          {
            sender: {
              profile: undefined,
            },
            message: 'Anonymous message',
            timestamp: '2024-01-15T10:00:00Z',
          },
        ],
      },
      contributions: [],
    };

    const result = await baseHandler(callout as any, logger);

    expect(result[0].pageContent).toContain('Unknown');
  });

  it('should skip messages with no sender', async () => {
    const callout = {
      id: 'callout-5',
      framing: {},
      comments: {
        messages: [
          {
            sender: null,
            message: 'Orphan message',
            timestamp: '2024-01-15T10:00:00Z',
          },
        ],
      },
      contributions: [],
    };

    const result = await baseHandler(callout as any, logger);

    expect(result[0].pageContent).not.toContain('Messages:');
    expect(result[0].pageContent).not.toContain('Orphan message');
  });

  it('should skip empty messages array without appending Messages section', async () => {
    const callout = {
      id: 'callout-6',
      framing: {},
      comments: { messages: [] },
      contributions: [],
    };

    const result = await baseHandler(callout as any, logger);

    expect(result[0].pageContent).not.toContain('Messages:');
  });

  it('should format date using toLocaleString en-US', async () => {
    const toLocaleStringSpy = vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('6/15/2024, 2:30:00 PM');

    const callout = {
      id: 'callout-7',
      framing: {},
      comments: {
        messages: [
          {
            sender: { profile: { displayName: 'Bob', url: '' } },
            message: 'Test',
            timestamp: '2024-06-15T14:30:00Z',
          },
        ],
      },
      contributions: [],
    };

    const result = await baseHandler(callout as any, logger);
    expect(result[0].pageContent).toContain('6/15/2024, 2:30:00 PM');

    toLocaleStringSpy.mockRestore();
  });

  it('should process link contributions', async () => {
    mockGenerateDocument.mockReturnValueOnce({
      documentId: 'callout-doc',
      source: 'http://example.com',
      pageContent: 'Callout content',
      type: DocumentType.POST,
      title: 'Callout',
    });
    mockGenerateDocument.mockReturnValueOnce({
      documentId: 'link-doc',
      source: 'http://link.example.com',
      pageContent: 'Link content',
      type: DocumentType.LINK,
      title: 'A Link',
    });

    const callout = {
      id: 'callout-8',
      framing: {},
      comments: { messages: [] },
      contributions: [
        { link: { profile: { displayName: 'A Link' } } },
      ],
    };

    const result = await baseHandler(callout as any, logger);

    expect(result).toHaveLength(2);
    expect(result[1].metadata.documentId).toBe('link-doc');
  });

  it('should process post contributions', async () => {
    mockGenerateDocument.mockReturnValueOnce({
      documentId: 'callout-doc',
      source: 'http://example.com',
      pageContent: 'Callout content',
      type: DocumentType.POST,
      title: 'Callout',
    });
    mockGenerateDocument.mockReturnValueOnce({
      documentId: 'post-doc',
      source: 'http://post.example.com',
      pageContent: 'Post content',
      type: DocumentType.POST,
      title: 'A Post',
    });

    const callout = {
      id: 'callout-9',
      framing: {},
      comments: { messages: [] },
      contributions: [
        { post: { profile: { displayName: 'A Post' } } },
      ],
    };

    const result = await baseHandler(callout as any, logger);

    expect(result).toHaveLength(2);
  });

  it('should skip contributions with neither link nor post', async () => {
    const callout = {
      id: 'callout-10',
      framing: {},
      comments: { messages: [] },
      contributions: [{ whiteboard: {} }],
    };

    const result = await baseHandler(callout as any, logger);

    expect(result).toHaveLength(1);
    expect(mockGenerateDocument).toHaveBeenCalledTimes(1);
  });

  it('should handle missing comments gracefully', async () => {
    const callout = {
      id: 'callout-11',
      framing: {},
      contributions: [],
    };

    const result = await baseHandler(callout as any, logger);

    expect(result).toHaveLength(1);
    expect(result[0].pageContent).not.toContain('Messages:');
  });

  it('should handle missing contributions gracefully', async () => {
    const callout = {
      id: 'callout-12',
      framing: {},
      comments: { messages: [] },
    };

    const result = await baseHandler(callout as any, logger);

    expect(result).toHaveLength(1);
  });
});
