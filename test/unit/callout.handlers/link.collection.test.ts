import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from 'winston';
import { Document } from '@langchain/core/documents';
import { MimeType } from '../../../src/generated/graphql';
import { DocumentType } from '../../../src/document.type';

vi.mock('node:fs', () => {
  const mod = {
    createWriteStream: vi.fn(),
    readFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
  return { default: mod, ...mod };
});

vi.mock('node:https', () => {
  const mod = { get: vi.fn() };
  return { default: mod, ...mod };
});

vi.mock('node:http', () => {
  const mod = { get: vi.fn() };
  return { default: mod, ...mod };
});

vi.mock('@langchain/community/document_loaders/fs/pdf', () => ({
  PDFLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue([new Document({ pageContent: 'pdf content' })]),
  })),
}));

vi.mock('@langchain/community/document_loaders/fs/docx', () => ({
  DocxLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue([new Document({ pageContent: 'docx content' })]),
  })),
}));

vi.mock('../../../src/loaders', () => ({
  SpreadSheetLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue([new Document({ pageContent: 'sheet content' })]),
  })),
  DocLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue([new Document({ pageContent: 'doc content' })]),
  })),
}));

vi.mock('../../../src/logger', () => ({
  serializeError: vi.fn((e: any) => e),
}));

import { linkCollectionHandler } from '../../../src/callout.handlers/link.collection';

const createLogger = (): Logger =>
  ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  } as unknown as Logger);

const createAlkemioClient = (docInfo: any = null) => ({
  apiToken: 'test-token',
  document: vi.fn().mockResolvedValue(docInfo),
});

describe('linkCollectionHandler', () => {
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createLogger();
  });

  it('should return empty array when contributions are empty', async () => {
    const callout = {
      contributions: [],
      framing: { profile: { displayName: 'Test' } },
    };

    const result = await linkCollectionHandler(
      callout as any,
      logger,
      createAlkemioClient() as any
    );

    expect(result).toEqual([]);
  });

  it('should return empty array when alkemioClient is null', async () => {
    const callout = {
      contributions: [{ link: { uri: 'http://example.com/abc' } }],
      framing: { profile: { displayName: 'Test' } },
    };

    const result = await linkCollectionHandler(callout as any, logger, null);

    expect(result).toEqual([]);
  });

  it('should return empty array when framing profile is missing', async () => {
    const callout = {
      contributions: [{ link: { uri: 'http://example.com/abc' } }],
      framing: {},
    };

    const result = await linkCollectionHandler(
      callout as any,
      logger,
      createAlkemioClient() as any
    );

    expect(result).toEqual([]);
  });

  it('should skip contributions without a link', async () => {
    const callout = {
      contributions: [{ post: {} }],
      framing: { profile: { displayName: 'Test' } },
    };

    const client = createAlkemioClient();
    const result = await linkCollectionHandler(
      callout as any,
      logger,
      client as any
    );

    expect(result).toEqual([]);
    expect(client.document).not.toHaveBeenCalled();
  });

  it('should skip links without a UUID in the URI', async () => {
    const callout = {
      contributions: [
        {
          link: {
            uri: 'http://example.com/no-uuid-here',
            profile: { displayName: 'No UUID' },
          },
        },
      ],
      framing: { profile: { displayName: 'Test' } },
    };

    const client = createAlkemioClient();
    const result = await linkCollectionHandler(
      callout as any,
      logger,
      client as any
    );

    expect(result).toEqual([]);
    expect(client.document).not.toHaveBeenCalled();
  });

  it('should skip when document info is not found', async () => {
    const uuid = '12345678-1234-1234-1234-123456789abc';
    const callout = {
      contributions: [
        {
          link: {
            uri: `http://example.com/${uuid}`,
            profile: { displayName: 'Doc Link' },
          },
        },
      ],
      framing: { profile: { displayName: 'Test' } },
    };

    const client = createAlkemioClient(null);
    const result = await linkCollectionHandler(
      callout as any,
      logger,
      client as any
    );

    expect(result).toEqual([]);
  });

  it('should skip when no loader factory exists for the mime type', async () => {
    const uuid = '12345678-1234-1234-1234-123456789abc';
    const callout = {
      contributions: [
        {
          link: {
            uri: `http://example.com/${uuid}`,
            profile: { displayName: 'Image Doc' },
          },
        },
      ],
      framing: { profile: { displayName: 'Test' } },
    };

    const client = createAlkemioClient({ mimeType: MimeType.Png });
    const result = await linkCollectionHandler(
      callout as any,
      logger,
      client as any
    );

    expect(result).toEqual([]);
  });

  it('should handle document fetch errors gracefully', async () => {
    const uuid = '12345678-1234-1234-1234-123456789abc';
    const callout = {
      contributions: [
        {
          link: {
            uri: `http://example.com/${uuid}`,
            profile: { displayName: 'Error Doc' },
          },
        },
      ],
      framing: { profile: { displayName: 'Test' } },
    };

    const client = createAlkemioClient();
    client.document.mockRejectedValue(new Error('fetch failed'));
    const result = await linkCollectionHandler(
      callout as any,
      logger,
      client as any
    );

    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalled();
  });

  it('should return empty when contributions is undefined', async () => {
    const callout = {
      framing: { profile: { displayName: 'Test' } },
    };

    const result = await linkCollectionHandler(
      callout as any,
      logger,
      createAlkemioClient() as any
    );

    expect(result).toEqual([]);
  });

  describe('downloadDocument and full document loading flow', () => {
    const uuid = '12345678-1234-1234-1234-123456789abc';

    const createCalloutWithLink = (uri: string) => ({
      contributions: [
        {
          link: {
            uri,
            profile: { displayName: 'Test Document' },
          },
        },
      ],
      framing: { profile: { displayName: 'Test Callout' } },
    });

    it('should download and load a PDF document via https', async () => {
      const fs = await import('node:fs');
      const https = await import('node:https');

      // Mock fs.createWriteStream to return an object with pipe/on/close
      const mockWriteStream = {
        on: vi.fn().mockImplementation((event: string, cb: Function) => {
          if (event === 'finish') {
            // Simulate finish event immediately
            cb();
          }
          return mockWriteStream;
        }),
        close: vi.fn(),
      };
      (fs.createWriteStream as ReturnType<typeof vi.fn>).mockReturnValue(mockWriteStream);
      (fs.unlinkSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      // Mock https.get to simulate a successful response
      const mockResponse = {
        statusCode: 200,
        pipe: vi.fn(),
      };
      (https.get as ReturnType<typeof vi.fn>).mockImplementation(
        (_uri: string, _opts: any, callback: Function) => {
          callback(mockResponse);
          return { on: vi.fn() };
        }
      );

      const client = createAlkemioClient({ mimeType: MimeType.Pdf });
      const callout = createCalloutWithLink(`https://example.com/files/${uuid}`);

      const result = await linkCollectionHandler(
        callout as any,
        logger,
        client as any
      );

      expect(https.get).toHaveBeenCalled();
      expect(fs.createWriteStream).toHaveBeenCalledWith(`/tmp/${uuid}`);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].metadata).toEqual(
        expect.objectContaining({
          documentId: `${uuid}-page0`,
          title: 'Test Document',
        })
      );
      expect(fs.unlinkSync).toHaveBeenCalledWith(`/tmp/${uuid}`);
    });

    it('should download via http for non-https URIs', async () => {
      const fs = await import('node:fs');
      const http = await import('node:http');

      const mockWriteStream = {
        on: vi.fn().mockImplementation((event: string, cb: Function) => {
          if (event === 'finish') cb();
          return mockWriteStream;
        }),
        close: vi.fn(),
      };
      (fs.createWriteStream as ReturnType<typeof vi.fn>).mockReturnValue(mockWriteStream);
      (fs.unlinkSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      const mockResponse = {
        statusCode: 200,
        pipe: vi.fn(),
      };
      (http.get as ReturnType<typeof vi.fn>).mockImplementation(
        (_uri: string, _opts: any, callback: Function) => {
          callback(mockResponse);
          return { on: vi.fn() };
        }
      );

      const client = createAlkemioClient({ mimeType: MimeType.Pdf });
      const callout = createCalloutWithLink(`http://example.com/files/${uuid}`);

      const result = await linkCollectionHandler(
        callout as any,
        logger,
        client as any
      );

      expect(http.get).toHaveBeenCalled();
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle download failure (non-200 status) and log error', async () => {
      const fs = await import('node:fs');
      const https = await import('node:https');

      const mockWriteStream = {
        on: vi.fn().mockImplementation((event: string, cb: Function) => {
          if (event === 'finish') cb();
          return mockWriteStream;
        }),
        close: vi.fn(),
      };
      (fs.createWriteStream as ReturnType<typeof vi.fn>).mockReturnValue(mockWriteStream);
      (fs.unlinkSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      const mockResponse = {
        statusCode: 404,
        pipe: vi.fn(),
      };
      (https.get as ReturnType<typeof vi.fn>).mockImplementation(
        (_uri: string, _opts: any, callback: Function) => {
          callback(mockResponse);
          return { on: vi.fn() };
        }
      );

      const client = createAlkemioClient({ mimeType: MimeType.Pdf });
      const callout = createCalloutWithLink(`https://example.com/files/${uuid}`);

      const result = await linkCollectionHandler(
        callout as any,
        logger,
        client as any
      );

      // Download rejected means download = false, so no docs loaded
      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle network error during download', async () => {
      const fs = await import('node:fs');
      const https = await import('node:https');

      (fs.createWriteStream as ReturnType<typeof vi.fn>).mockReturnValue({
        on: vi.fn(),
        close: vi.fn(),
      });

      (https.get as ReturnType<typeof vi.fn>).mockImplementation(
        (_uri: string, _opts: any, _callback: Function) => {
          return {
            on: vi.fn().mockImplementation((event: string, cb: Function) => {
              if (event === 'error') cb(new Error('Network error'));
            }),
          };
        }
      );

      const client = createAlkemioClient({ mimeType: MimeType.Pdf });
      const callout = createCalloutWithLink(`https://example.com/files/${uuid}`);

      const result = await linkCollectionHandler(
        callout as any,
        logger,
        client as any
      );

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle loader.load() failure and log error', async () => {
      const fs = await import('node:fs');
      const https = await import('node:https');
      const { PDFLoader } = await import('@langchain/community/document_loaders/fs/pdf');

      const mockWriteStream = {
        on: vi.fn().mockImplementation((event: string, cb: Function) => {
          if (event === 'finish') cb();
          return mockWriteStream;
        }),
        close: vi.fn(),
      };
      (fs.createWriteStream as ReturnType<typeof vi.fn>).mockReturnValue(mockWriteStream);
      (fs.unlinkSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      const mockResponse = {
        statusCode: 200,
        pipe: vi.fn(),
      };
      (https.get as ReturnType<typeof vi.fn>).mockImplementation(
        (_uri: string, _opts: any, callback: Function) => {
          callback(mockResponse);
          return { on: vi.fn() };
        }
      );

      // Make the loader throw
      (PDFLoader as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        load: vi.fn().mockRejectedValue(new Error('Corrupt PDF')),
      }));

      const client = createAlkemioClient({ mimeType: MimeType.Pdf });
      const callout = createCalloutWithLink(`https://example.com/files/${uuid}`);

      const result = await linkCollectionHandler(
        callout as any,
        logger,
        client as any
      );

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'File failed to load' })
      );
      expect(fs.unlinkSync).toHaveBeenCalledWith(`/tmp/${uuid}`);
    });

    it('should use correct loader for XLSX documents', async () => {
      const fs = await import('node:fs');
      const https = await import('node:https');

      const mockWriteStream = {
        on: vi.fn().mockImplementation((event: string, cb: Function) => {
          if (event === 'finish') cb();
          return mockWriteStream;
        }),
        close: vi.fn(),
      };
      (fs.createWriteStream as ReturnType<typeof vi.fn>).mockReturnValue(mockWriteStream);
      (fs.unlinkSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      const mockResponse = {
        statusCode: 200,
        pipe: vi.fn(),
      };
      (https.get as ReturnType<typeof vi.fn>).mockImplementation(
        (_uri: string, _opts: any, callback: Function) => {
          callback(mockResponse);
          return { on: vi.fn() };
        }
      );

      const client = createAlkemioClient({ mimeType: MimeType.Xlsx });
      const callout = createCalloutWithLink(`https://example.com/files/${uuid}`);

      const result = await linkCollectionHandler(
        callout as any,
        logger,
        client as any
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].metadata).toEqual(
        expect.objectContaining({
          type: DocumentType.SPREADSHEET,
        })
      );
    });

    it('should use DocxLoader for DOCX documents', async () => {
      const fs = await import('node:fs');
      const https = await import('node:https');

      const mockWriteStream = {
        on: vi.fn().mockImplementation((event: string, cb: Function) => {
          if (event === 'finish') cb();
          return mockWriteStream;
        }),
        close: vi.fn(),
      };
      (fs.createWriteStream as ReturnType<typeof vi.fn>).mockReturnValue(mockWriteStream);
      (fs.unlinkSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      const mockResponse = {
        statusCode: 200,
        pipe: vi.fn(),
      };
      (https.get as ReturnType<typeof vi.fn>).mockImplementation(
        (_uri: string, _opts: any, callback: Function) => {
          callback(mockResponse);
          return { on: vi.fn() };
        }
      );

      const client = createAlkemioClient({ mimeType: MimeType.Docx });
      const callout = createCalloutWithLink(`https://example.com/files/${uuid}`);

      const result = await linkCollectionHandler(
        callout as any,
        logger,
        client as any
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].metadata).toEqual(
        expect.objectContaining({
          type: DocumentType.DOCUMENT,
        })
      );
    });
  });
});
