import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from 'winston';
import { Document } from '@langchain/core/documents';
import { CalloutContributionType } from '../../../src/generated/graphql';

vi.mock('../../../src/callout.handlers/base', () => ({
  baseHandler: vi.fn(),
}));

vi.mock('../../../src/callout.handlers/link.collection', () => ({
  linkCollectionHandler: vi.fn(),
}));

import { handleCallout } from '../../../src/callout.handlers';
import { baseHandler } from '../../../src/callout.handlers/base';
import { linkCollectionHandler } from '../../../src/callout.handlers/link.collection';

const mockBaseHandler = baseHandler as ReturnType<typeof vi.fn>;
const mockLinkCollectionHandler = linkCollectionHandler as ReturnType<typeof vi.fn>;

const createLogger = (): Logger =>
  ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  } as unknown as Logger);

describe('handleCallout', () => {
  let logger: Logger;
  const mockDocs = [new Document({ pageContent: 'test' })];

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createLogger();
    mockBaseHandler.mockResolvedValue(mockDocs);
    mockLinkCollectionHandler.mockResolvedValue(mockDocs);
  });

  it('should dispatch Link type to linkCollectionHandler', async () => {
    const callout = {
      settings: {
        contribution: {
          allowedTypes: [CalloutContributionType.Link],
        },
      },
    };

    const result = await handleCallout(callout as any, logger, null);

    expect(mockLinkCollectionHandler).toHaveBeenCalledWith(callout, logger, null);
    expect(result).toEqual(mockDocs);
  });

  it('should dispatch Post type to baseHandler', async () => {
    const callout = {
      settings: {
        contribution: {
          allowedTypes: [CalloutContributionType.Post],
        },
      },
    };

    const result = await handleCallout(callout as any, logger, null);

    expect(mockBaseHandler).toHaveBeenCalledWith(callout, logger, null);
    expect(result).toEqual(mockDocs);
  });

  it('should dispatch Whiteboard type to baseHandler', async () => {
    const callout = {
      settings: {
        contribution: {
          allowedTypes: [CalloutContributionType.Whiteboard],
        },
      },
    };

    const result = await handleCallout(callout as any, logger, null);

    expect(mockBaseHandler).toHaveBeenCalledWith(callout, logger, null);
    expect(result).toEqual(mockDocs);
  });

  it('should dispatch Memo type to baseHandler', async () => {
    const callout = {
      settings: {
        contribution: {
          allowedTypes: [CalloutContributionType.Memo],
        },
      },
    };

    const result = await handleCallout(callout as any, logger, null);

    expect(mockBaseHandler).toHaveBeenCalledWith(callout, logger, null);
    expect(result).toEqual(mockDocs);
  });

  it('should fallback to NONE (baseHandler) when no contribution types', async () => {
    const callout = {
      settings: {
        contribution: {
          allowedTypes: [],
        },
      },
    };

    const result = await handleCallout(callout as any, logger, null);

    expect(mockBaseHandler).toHaveBeenCalledWith(callout, logger, null);
    expect(result).toEqual(mockDocs);
  });

  it('should fallback to NONE when settings is missing', async () => {
    const callout = {};

    const result = await handleCallout(callout as any, logger, null);

    expect(mockBaseHandler).toHaveBeenCalledWith(callout, logger, null);
    expect(result).toEqual(mockDocs);
  });

  it('should use first contribution type when multiple are specified', async () => {
    const callout = {
      settings: {
        contribution: {
          allowedTypes: [
            CalloutContributionType.Link,
            CalloutContributionType.Post,
          ],
        },
      },
    };

    const result = await handleCallout(callout as any, logger, null);

    expect(mockLinkCollectionHandler).toHaveBeenCalled();
    expect(mockBaseHandler).not.toHaveBeenCalled();
  });

  it('should pass alkemioClient to the handler', async () => {
    const mockClient = { apiToken: 'token' } as any;
    const callout = {
      settings: {
        contribution: {
          allowedTypes: [CalloutContributionType.Post],
        },
      },
    };

    await handleCallout(callout as any, logger, mockClient);

    expect(mockBaseHandler).toHaveBeenCalledWith(callout, logger, mockClient);
  });

  it('should default alkemioClient to null', async () => {
    const callout = {};

    await handleCallout(callout as any, logger);

    expect(mockBaseHandler).toHaveBeenCalledWith(callout, logger, null);
  });
});
