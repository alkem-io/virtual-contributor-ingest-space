import { Document } from '@langchain/core/documents';

jest.mock('../../../src/generate.document', () => ({
  generateDocument: jest.fn(),
}));

jest.mock('../../../src/process.callouts', () => ({
  processCallouts: jest.fn(),
}));

import { embedKnowledgeBase } from '../../../src/data.readers/knowledge.base';
import { generateDocument } from '../../../src/generate.document';
import { processCallouts } from '../../../src/process.callouts';
import {
  BodyOfKnowledgeType,
  IngestionPurpose,
  IngestBodyOfKnowledge,
} from '../../../src/event.bus/events/ingest.body.of.knowledge';
import { DocumentType } from '../../../src/document.type';

const mockGenerateDocument = generateDocument as jest.Mock;
const mockProcessCallouts = processCallouts as jest.Mock;

describe('embedKnowledgeBase', () => {
  const mockKB = {
    id: 'kb-1',
    profile: { displayName: 'Test KB', url: 'http://kb.test' },
    calloutsSet: {
      callouts: [{ id: 'callout-1' }],
    },
  };

  const mockAlkemioClient = {
    ingestKnowledgeBase: jest.fn().mockResolvedValue(mockKB),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAlkemioClient.ingestKnowledgeBase.mockResolvedValue(mockKB);
    mockGenerateDocument.mockReturnValue({
      documentId: 'kb-1',
      source: 'http://kb.test',
      pageContent: 'KB content',
      type: DocumentType.KNOWLEDGE,
      title: 'Test KB',
    });
    mockProcessCallouts.mockResolvedValue([]);
  });

  it('should call ingestKnowledgeBase with the bodyOfKnowledgeId', async () => {
    const event = new IngestBodyOfKnowledge(
      'kb-1',
      BodyOfKnowledgeType.ALKEMIO_KNOWLEDGE_BASE,
      IngestionPurpose.KNOWLEDGE,
      'persona-1'
    );

    await embedKnowledgeBase(event, mockAlkemioClient);

    expect(mockAlkemioClient.ingestKnowledgeBase).toHaveBeenCalledWith('kb-1');
  });

  it('should generate a document from the knowledge base', async () => {
    const event = new IngestBodyOfKnowledge(
      'kb-1',
      BodyOfKnowledgeType.ALKEMIO_KNOWLEDGE_BASE,
      IngestionPurpose.KNOWLEDGE,
      'persona-1'
    );

    await embedKnowledgeBase(event, mockAlkemioClient);

    expect(mockGenerateDocument).toHaveBeenCalledWith(mockKB);
  });

  it('should process callouts from the knowledge base', async () => {
    const event = new IngestBodyOfKnowledge(
      'kb-1',
      BodyOfKnowledgeType.ALKEMIO_KNOWLEDGE_BASE,
      IngestionPurpose.KNOWLEDGE,
      'persona-1'
    );

    await embedKnowledgeBase(event, mockAlkemioClient);

    expect(mockProcessCallouts).toHaveBeenCalledWith(
      [{ id: 'callout-1' }],
      mockAlkemioClient
    );
  });

  it('should return bodyOfKnowledge and combined documents', async () => {
    const calloutDoc = new Document({ pageContent: 'callout doc' });
    mockProcessCallouts.mockResolvedValue([calloutDoc]);

    const event = new IngestBodyOfKnowledge(
      'kb-1',
      BodyOfKnowledgeType.ALKEMIO_KNOWLEDGE_BASE,
      IngestionPurpose.KNOWLEDGE,
      'persona-1'
    );

    const result = await embedKnowledgeBase(event, mockAlkemioClient);

    expect(result.bodyOfKnowledge).toBe(mockKB);
    expect(result.documents).toHaveLength(2);
    expect(result.documents[0].pageContent).toBe('KB content');
    expect(result.documents[1]).toBe(calloutDoc);
  });

  it('should handle knowledge base with no calloutsSet', async () => {
    const kbNoCallouts = { id: 'kb-2', profile: { displayName: 'KB 2' } };
    mockAlkemioClient.ingestKnowledgeBase.mockResolvedValue(kbNoCallouts);

    const event = new IngestBodyOfKnowledge(
      'kb-2',
      BodyOfKnowledgeType.ALKEMIO_KNOWLEDGE_BASE,
      IngestionPurpose.KNOWLEDGE,
      'persona-1'
    );

    await embedKnowledgeBase(event, mockAlkemioClient);

    expect(mockProcessCallouts).toHaveBeenCalledWith([], mockAlkemioClient);
  });

  it('should propagate errors from ingestKnowledgeBase', async () => {
    mockAlkemioClient.ingestKnowledgeBase.mockRejectedValue(
      new Error('KB not found')
    );

    const event = new IngestBodyOfKnowledge(
      'bad-kb',
      BodyOfKnowledgeType.ALKEMIO_KNOWLEDGE_BASE,
      IngestionPurpose.KNOWLEDGE,
      'persona-1'
    );

    await expect(
      embedKnowledgeBase(event, mockAlkemioClient)
    ).rejects.toThrow('KB not found');
  });
});
