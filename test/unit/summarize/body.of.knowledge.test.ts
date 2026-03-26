/**
 * T008: Tests for src/summarize/body.of.knowledge.ts
 * - summariseBodyOfKnowledge calls graph.invoke with recursionLimit
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

import { summariseBodyOfKnowledge } from '../../../src/summarize/body.of.knowledge';
import { buildGraph } from '../../../src/summarize/graph';

const mockBuildGraph = buildGraph as jest.MockedFunction<typeof buildGraph>;

describe('summarize/body.of.knowledge', () => {
  const mockInvoke = jest.fn();
  const mockModel = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockResolvedValue({ summary: 'BoK summary' });
    mockBuildGraph.mockReturnValue({ invoke: mockInvoke } as any);
  });

  it('should call buildGraph with prompts and model', async () => {
    const chunks = [
      { pageContent: 'doc summary 1', metadata: {} },
      { pageContent: 'doc summary 2', metadata: {} },
    ] as any[];

    await summariseBodyOfKnowledge(chunks, mockModel);

    expect(mockBuildGraph).toHaveBeenCalledTimes(1);
    expect(mockBuildGraph).toHaveBeenCalledWith(
      expect.anything(), // summarizePrompt
      expect.anything(), // refinePrompt
      mockModel
    );
  });

  it('should call graph.invoke with chunks and correct recursionLimit', async () => {
    const chunks = [
      { pageContent: 'summary 1', metadata: {} },
      { pageContent: 'summary 2', metadata: {} },
      { pageContent: 'summary 3', metadata: {} },
    ] as any[];

    await summariseBodyOfKnowledge(chunks, mockModel);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      { chunks },
      { recursionLimit: 3 * 2 + 10 } // 16
    );
  });

  it('should return the summary from graph invocation', async () => {
    const chunks = [{ pageContent: 'chunk', metadata: {} }] as any[];
    mockInvoke.mockResolvedValue({ summary: 'Body of knowledge overview' });

    const result = await summariseBodyOfKnowledge(chunks, mockModel);

    expect(result).toBe('Body of knowledge overview');
  });

  it('should handle many chunks with correct recursion limit', async () => {
    const chunks = Array.from({ length: 10 }, (_, i) => ({
      pageContent: `summary ${i}`,
      metadata: {},
    })) as any[];

    await summariseBodyOfKnowledge(chunks, mockModel);

    expect(mockInvoke).toHaveBeenCalledWith(
      { chunks },
      { recursionLimit: 30 } // 10 * 2 + 10
    );
  });

  it('should handle single chunk', async () => {
    const chunks = [{ pageContent: 'only doc', metadata: {} }] as any[];
    mockInvoke.mockResolvedValue({ summary: 'Single doc BoK' });

    const result = await summariseBodyOfKnowledge(chunks, mockModel);

    expect(result).toBe('Single doc BoK');
    expect(mockInvoke).toHaveBeenCalledWith(
      { chunks },
      { recursionLimit: 12 } // 1 * 2 + 10
    );
  });

  it('should propagate errors from graph.invoke', async () => {
    const chunks = [{ pageContent: 'chunk', metadata: {} }] as any[];
    mockInvoke.mockRejectedValue(new Error('BoK summarization failed'));

    await expect(summariseBodyOfKnowledge(chunks, mockModel)).rejects.toThrow(
      'BoK summarization failed'
    );
  });
});
