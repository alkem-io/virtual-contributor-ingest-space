import { Document } from '@langchain/core/documents';
import { DocumentType } from '../../../src/document.type';

jest.mock('../../../src/generate.document', () => ({
  generateDocument: jest.fn(),
}));

jest.mock('../../../src/process.callouts', () => ({
  processCallouts: jest.fn(),
}));

import { processSpaceTree } from '../../../src/data.readers/process.space.tree';
import { generateDocument } from '../../../src/generate.document';
import { processCallouts } from '../../../src/process.callouts';

const mockGenerateDocument = generateDocument as jest.Mock;
const mockProcessCallouts = processCallouts as jest.Mock;

describe('processSpaceTree', () => {
  const mockAlkemioClient = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProcessCallouts.mockResolvedValue([]);
  });

  it('should process a single space with no subspaces', async () => {
    mockGenerateDocument.mockReturnValue({
      documentId: 'space-1',
      source: 'http://space.test',
      pageContent: 'Space content',
      type: DocumentType.SPACE,
      title: 'Root Space',
    });

    const spaces = [
      {
        id: 'space-1',
        profile: { displayName: 'Root Space' },
        collaboration: { calloutsSet: { callouts: [] } },
        subspaces: [],
      },
    ];

    const result = await processSpaceTree(spaces as any, mockAlkemioClient);

    expect(mockGenerateDocument).toHaveBeenCalledWith(spaces[0]);
    expect(result).toHaveLength(1);
    expect(result[0].metadata.documentId).toBe('space-1');
  });

  it('should process callouts for each space', async () => {
    mockGenerateDocument.mockReturnValue({
      documentId: 'space-1',
      source: 'http://space.test',
      pageContent: 'Space content',
      type: DocumentType.SPACE,
      title: 'Root Space',
    });

    const callouts = [{ id: 'callout-1' }];
    const calloutDoc = new Document({ pageContent: 'callout doc' });
    mockProcessCallouts.mockResolvedValue([calloutDoc]);

    const spaces = [
      {
        id: 'space-1',
        collaboration: { calloutsSet: { callouts } },
        subspaces: [],
      },
    ];

    const result = await processSpaceTree(spaces as any, mockAlkemioClient);

    expect(mockProcessCallouts).toHaveBeenCalledWith(callouts, mockAlkemioClient);
    expect(result).toHaveLength(2);
    expect(result[1]).toBe(calloutDoc);
  });

  it('should recursively process subspaces', async () => {
    let callCount = 0;
    mockGenerateDocument.mockImplementation((space: any) => {
      callCount++;
      return {
        documentId: space.id || `doc-${callCount}`,
        source: `http://${space.id}.test`,
        pageContent: `Content for ${space.id}`,
        type: callCount === 1 ? DocumentType.SPACE : DocumentType.SUBSPACE,
        title: space.id,
      };
    });

    const spaces = [
      {
        id: 'root',
        collaboration: { calloutsSet: { callouts: [] } },
        subspaces: [
          {
            id: 'child-1',
            collaboration: { calloutsSet: { callouts: [] } },
            subspaces: [],
          },
          {
            id: 'child-2',
            collaboration: { calloutsSet: { callouts: [] } },
            subspaces: [],
          },
        ],
      },
    ];

    const result = await processSpaceTree(spaces as any, mockAlkemioClient);

    expect(mockGenerateDocument).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
    expect(result[0].metadata.documentId).toBe('root');
    expect(result[1].metadata.documentId).toBe('child-1');
    expect(result[2].metadata.documentId).toBe('child-2');
  });

  it('should handle deeply nested subspaces', async () => {
    let callCount = 0;
    mockGenerateDocument.mockImplementation((space: any) => {
      callCount++;
      return {
        documentId: space.id,
        source: `http://${space.id}.test`,
        pageContent: `Content for ${space.id}`,
        type: DocumentType.SUBSPACE,
        title: space.id,
      };
    });

    const spaces = [
      {
        id: 'level-0',
        collaboration: { calloutsSet: { callouts: [] } },
        subspaces: [
          {
            id: 'level-1',
            collaboration: { calloutsSet: { callouts: [] } },
            subspaces: [
              {
                id: 'level-2',
                collaboration: { calloutsSet: { callouts: [] } },
                subspaces: [],
              },
            ],
          },
        ],
      },
    ];

    const result = await processSpaceTree(spaces as any, mockAlkemioClient);

    expect(result).toHaveLength(3);
    expect(result[0].metadata.documentId).toBe('level-0');
    expect(result[1].metadata.documentId).toBe('level-1');
    expect(result[2].metadata.documentId).toBe('level-2');
  });

  it('should handle empty spaces array', async () => {
    const result = await processSpaceTree([], mockAlkemioClient);
    expect(result).toHaveLength(0);
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  it('should handle spaces with no collaboration', async () => {
    mockGenerateDocument.mockReturnValue({
      documentId: 'space-1',
      source: 'http://space.test',
      pageContent: 'Space content',
      type: DocumentType.SPACE,
      title: 'Space',
    });

    const spaces = [
      {
        id: 'space-1',
        subspaces: [],
      },
    ];

    const result = await processSpaceTree(spaces as any, mockAlkemioClient);

    expect(mockProcessCallouts).toHaveBeenCalledWith([], mockAlkemioClient);
    expect(result).toHaveLength(1);
  });

  it('should handle spaces with no subspaces property', async () => {
    mockGenerateDocument.mockReturnValue({
      documentId: 'space-1',
      source: 'http://space.test',
      pageContent: 'Space content',
      type: DocumentType.SPACE,
      title: 'Space',
    });

    const spaces = [
      {
        id: 'space-1',
        collaboration: { calloutsSet: { callouts: [] } },
      },
    ];

    const result = await processSpaceTree(spaces as any, mockAlkemioClient);

    expect(result).toHaveLength(1);
  });

  it('should process multiple root-level spaces', async () => {
    let callCount = 0;
    mockGenerateDocument.mockImplementation((space: any) => {
      callCount++;
      return {
        documentId: space.id,
        source: `http://${space.id}.test`,
        pageContent: `Content for ${space.id}`,
        type: DocumentType.SPACE,
        title: space.id,
      };
    });

    const spaces = [
      {
        id: 'space-a',
        collaboration: { calloutsSet: { callouts: [] } },
        subspaces: [],
      },
      {
        id: 'space-b',
        collaboration: { calloutsSet: { callouts: [] } },
        subspaces: [],
      },
    ];

    const result = await processSpaceTree(spaces as any, mockAlkemioClient);

    expect(result).toHaveLength(2);
  });
});
