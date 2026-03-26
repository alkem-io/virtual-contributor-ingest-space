import { Document } from '@langchain/core/documents';

jest.mock('../../../src/data.readers/process.space.tree', () => ({
  processSpaceTree: jest.fn(),
}));

import { embedSpace } from '../../../src/data.readers/space';
import { processSpaceTree } from '../../../src/data.readers/process.space.tree';
import {
  BodyOfKnowledgeType,
  IngestionPurpose,
  IngestBodyOfKnowledge,
} from '../../../src/event.bus/events/ingest.body.of.knowledge';

const mockProcessSpaceTree = processSpaceTree as jest.Mock;

describe('embedSpace', () => {
  const mockSpace = {
    id: 'space-1',
    profile: { displayName: 'Test Space', url: 'http://space.test' },
    subspaces: [],
  };

  const mockAlkemioClient = {
    ingestSpace: jest.fn().mockResolvedValue(mockSpace),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAlkemioClient.ingestSpace.mockResolvedValue(mockSpace);
  });

  it('should call ingestSpace with the bodyOfKnowledgeId', async () => {
    const event = new IngestBodyOfKnowledge(
      'space-1',
      BodyOfKnowledgeType.ALKEMIO_SPACE,
      IngestionPurpose.KNOWLEDGE,
      'persona-1'
    );

    mockProcessSpaceTree.mockResolvedValue([]);

    await embedSpace(event, mockAlkemioClient);

    expect(mockAlkemioClient.ingestSpace).toHaveBeenCalledWith('space-1');
  });

  it('should call processSpaceTree with the space wrapped in an array', async () => {
    const event = new IngestBodyOfKnowledge(
      'space-1',
      BodyOfKnowledgeType.ALKEMIO_SPACE,
      IngestionPurpose.KNOWLEDGE,
      'persona-1'
    );

    mockProcessSpaceTree.mockResolvedValue([]);

    await embedSpace(event, mockAlkemioClient);

    expect(mockProcessSpaceTree).toHaveBeenCalledWith(
      [mockSpace],
      mockAlkemioClient
    );
  });

  it('should return bodyOfKnowledge and documents', async () => {
    const event = new IngestBodyOfKnowledge(
      'space-1',
      BodyOfKnowledgeType.ALKEMIO_SPACE,
      IngestionPurpose.KNOWLEDGE,
      'persona-1'
    );

    const docs = [new Document({ pageContent: 'space doc' })];
    mockProcessSpaceTree.mockResolvedValue(docs);

    const result = await embedSpace(event, mockAlkemioClient);

    expect(result.bodyOfKnowledge).toBe(mockSpace);
    expect(result.documents).toBe(docs);
  });

  it('should propagate errors from ingestSpace', async () => {
    const event = new IngestBodyOfKnowledge(
      'bad-space',
      BodyOfKnowledgeType.ALKEMIO_SPACE,
      IngestionPurpose.KNOWLEDGE,
      'persona-1'
    );

    mockAlkemioClient.ingestSpace.mockRejectedValue(new Error('Not found'));

    await expect(embedSpace(event, mockAlkemioClient)).rejects.toThrow('Not found');
  });
});
