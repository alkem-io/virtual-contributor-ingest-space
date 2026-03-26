import { Document } from '@langchain/core/documents';
import { CalloutVisibility } from '../../src/generated/graphql';

jest.mock('../../src/callout.handlers', () => ({
  handleCallout: jest.fn(),
}));

jest.mock('../../src/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { processCallouts } from '../../src/process.callouts';
import { handleCallout } from '../../src/callout.handlers';

const mockHandleCallout = handleCallout as jest.Mock;

describe('processCallouts', () => {
  const mockAlkemioClient = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should process published callouts and return documents', async () => {
    const doc = new Document({ pageContent: 'Test doc' });
    mockHandleCallout.mockResolvedValue([doc]);

    const callouts = [
      {
        settings: { visibility: CalloutVisibility.Published, contribution: { allowedTypes: [] } },
        id: 'c1',
      },
    ];

    const result = await processCallouts(callouts as any, mockAlkemioClient);

    expect(mockHandleCallout).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(doc);
  });

  it('should skip draft callouts', async () => {
    const callouts = [
      {
        settings: { visibility: CalloutVisibility.Draft, contribution: { allowedTypes: [] } },
        id: 'c2',
      },
    ];

    const result = await processCallouts(callouts as any, mockAlkemioClient);

    expect(mockHandleCallout).not.toHaveBeenCalled();
    expect(result).toHaveLength(0);
  });

  it('should handle multiple callouts', async () => {
    const doc1 = new Document({ pageContent: 'Doc 1' });
    const doc2 = new Document({ pageContent: 'Doc 2' });
    mockHandleCallout
      .mockResolvedValueOnce([doc1])
      .mockResolvedValueOnce([doc2]);

    const callouts = [
      {
        settings: { visibility: CalloutVisibility.Published, contribution: { allowedTypes: [] } },
        id: 'c3',
      },
      {
        settings: { visibility: CalloutVisibility.Published, contribution: { allowedTypes: [] } },
        id: 'c4',
      },
    ];

    const result = await processCallouts(callouts as any, mockAlkemioClient);

    expect(result).toHaveLength(2);
  });

  it('should handle empty callouts array', async () => {
    const result = await processCallouts([], mockAlkemioClient);
    expect(result).toHaveLength(0);
  });

  it('should handle null returned from handleCallout', async () => {
    mockHandleCallout.mockResolvedValue(null);

    const callouts = [
      {
        settings: { visibility: CalloutVisibility.Published, contribution: { allowedTypes: [] } },
        id: 'c5',
      },
    ];

    const result = await processCallouts(callouts as any, mockAlkemioClient);

    expect(result).toHaveLength(0);
  });

  it('should spread multiple documents from a single callout', async () => {
    const docs = [
      new Document({ pageContent: 'Page 1' }),
      new Document({ pageContent: 'Page 2' }),
    ];
    mockHandleCallout.mockResolvedValue(docs);

    const callouts = [
      {
        settings: { visibility: CalloutVisibility.Published, contribution: { allowedTypes: [] } },
        id: 'c6',
      },
    ];

    const result = await processCallouts(callouts as any, mockAlkemioClient);

    expect(result).toHaveLength(2);
  });
});
