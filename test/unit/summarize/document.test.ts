/**
 * T007: Tests for src/summarize/document.ts
 * - summarizeDocument calls graph.invoke and returns summary
 */

jest.mock('../../../src/summarize/graph', () => ({
  buildGraph: jest.fn(),
}));

jest.mock('../../../src/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    defaultMeta: {},
  },
}));

jest.mock('@langchain/core/prompts', () => ({
  SystemMessagePromptTemplate: {
    fromTemplate: jest.fn().mockReturnValue({}),
  },
  HumanMessagePromptTemplate: {
    fromTemplate: jest.fn().mockReturnValue({}),
  },
  ChatPromptTemplate: {
    fromMessages: jest.fn().mockReturnValue({
      pipe: jest.fn(),
    }),
  },
}));

jest.mock('@langchain/core/documents', () => ({
  Document: jest.fn().mockImplementation((args: any) => args),
}));

jest.mock('@langchain/core/language_models/chat_models', () => ({
  BaseChatModel: jest.fn(),
}));

import { summarizeDocument } from '../../../src/summarize/document';
import { buildGraph } from '../../../src/summarize/graph';

const mockBuildGraph = buildGraph as jest.MockedFunction<typeof buildGraph>;

describe('summarize/document', () => {
  const mockInvoke = jest.fn();
  const mockModel = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockResolvedValue({ summary: 'Test document summary' });
    mockBuildGraph.mockReturnValue({ invoke: mockInvoke } as any);
  });

  it('should call buildGraph with summarize and refine prompts and model', async () => {
    const chunks = [
      { pageContent: 'chunk1', metadata: {} },
      { pageContent: 'chunk2', metadata: {} },
    ] as any[];

    await summarizeDocument(chunks, mockModel);

    expect(mockBuildGraph).toHaveBeenCalledTimes(1);
    expect(mockBuildGraph).toHaveBeenCalledWith(
      expect.anything(), // summarizePrompt
      expect.anything(), // refinePrompt
      mockModel
    );
  });

  it('should call graph.invoke with chunks and recursionLimit', async () => {
    const chunks = [
      { pageContent: 'chunk1', metadata: {} },
      { pageContent: 'chunk2', metadata: {} },
      { pageContent: 'chunk3', metadata: {} },
    ] as any[];

    await summarizeDocument(chunks, mockModel);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      { chunks },
      { recursionLimit: chunks.length * 2 + 10 } // 3 * 2 + 10 = 16
    );
  });

  it('should return the summary from graph invocation', async () => {
    const chunks = [{ pageContent: 'chunk1', metadata: {} }] as any[];
    mockInvoke.mockResolvedValue({ summary: 'Final summary result' });

    const result = await summarizeDocument(chunks, mockModel);

    expect(result).toBe('Final summary result');
  });

  it('should calculate correct recursionLimit based on chunk count', async () => {
    const chunks = Array.from({ length: 5 }, (_, i) => ({
      pageContent: `chunk${i}`,
      metadata: {},
    })) as any[];

    await summarizeDocument(chunks, mockModel);

    // recursionLimit = 5 * 2 + 10 = 20
    expect(mockInvoke).toHaveBeenCalledWith(
      { chunks },
      { recursionLimit: 20 }
    );
  });

  it('should handle single chunk', async () => {
    const chunks = [{ pageContent: 'only chunk', metadata: {} }] as any[];
    mockInvoke.mockResolvedValue({ summary: 'Single chunk summary' });

    const result = await summarizeDocument(chunks, mockModel);

    expect(result).toBe('Single chunk summary');
    expect(mockInvoke).toHaveBeenCalledWith(
      { chunks },
      { recursionLimit: 12 } // 1 * 2 + 10
    );
  });

  it('should propagate errors from graph.invoke', async () => {
    const chunks = [{ pageContent: 'chunk1', metadata: {} }] as any[];
    mockInvoke.mockRejectedValue(new Error('Graph invocation failed'));

    await expect(summarizeDocument(chunks, mockModel)).rejects.toThrow(
      'Graph invocation failed'
    );
  });
});
