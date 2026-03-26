/**
 * T008: Tests for src/summarize/body.of.knowledge.ts
 * - summariseBodyOfKnowledge calls graph.invoke with recursionLimit
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/summarize/graph', () => ({
  buildGraph: vi.fn(),
}));

vi.mock('../../../src/logger', () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    defaultMeta: {},
  },
}));

vi.mock('@langchain/core/prompts', () => ({
  SystemMessagePromptTemplate: {
    fromTemplate: vi.fn().mockReturnValue({}),
  },
  HumanMessagePromptTemplate: {
    fromTemplate: vi.fn().mockReturnValue({}),
  },
  ChatPromptTemplate: {
    fromMessages: vi.fn().mockReturnValue({
      pipe: vi.fn(),
    }),
  },
}));

vi.mock('@langchain/core/documents', () => ({
  Document: vi.fn().mockImplementation((args: any) => args),
}));

import { summariseBodyOfKnowledge } from '../../../src/summarize/body.of.knowledge';
import { buildGraph } from '../../../src/summarize/graph';

const mockBuildGraph = buildGraph as ReturnType<typeof vi.fn>;

describe('summarize/body.of.knowledge', () => {
  const mockInvoke = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({ summary: 'BoK summary' });
    mockBuildGraph.mockReturnValue({ invoke: mockInvoke } as any);
  });

  it('should call buildGraph with prompts', async () => {
    const chunks = [
      { pageContent: 'doc summary 1', metadata: {} },
      { pageContent: 'doc summary 2', metadata: {} },
    ] as any[];

    await summariseBodyOfKnowledge(chunks);

    expect(mockBuildGraph).toHaveBeenCalledTimes(1);
    expect(mockBuildGraph).toHaveBeenCalledWith(
      expect.anything(), // summarizePrompt
      expect.anything()  // refinePrompt
    );
  });

  it('should call graph.invoke with chunks and correct recursionLimit', async () => {
    const chunks = [
      { pageContent: 'summary 1', metadata: {} },
      { pageContent: 'summary 2', metadata: {} },
      { pageContent: 'summary 3', metadata: {} },
    ] as any[];

    await summariseBodyOfKnowledge(chunks);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      { chunks },
      { recursionLimit: 3 * 2 + 10 } // 16
    );
  });

  it('should return the summary from graph invocation', async () => {
    const chunks = [{ pageContent: 'chunk', metadata: {} }] as any[];
    mockInvoke.mockResolvedValue({ summary: 'Body of knowledge overview' });

    const result = await summariseBodyOfKnowledge(chunks);

    expect(result).toBe('Body of knowledge overview');
  });

  it('should handle many chunks with correct recursion limit', async () => {
    const chunks = Array.from({ length: 10 }, (_, i) => ({
      pageContent: `summary ${i}`,
      metadata: {},
    })) as any[];

    await summariseBodyOfKnowledge(chunks);

    expect(mockInvoke).toHaveBeenCalledWith(
      { chunks },
      { recursionLimit: 30 } // 10 * 2 + 10
    );
  });

  it('should handle single chunk', async () => {
    const chunks = [{ pageContent: 'only doc', metadata: {} }] as any[];
    mockInvoke.mockResolvedValue({ summary: 'Single doc BoK' });

    const result = await summariseBodyOfKnowledge(chunks);

    expect(result).toBe('Single doc BoK');
    expect(mockInvoke).toHaveBeenCalledWith(
      { chunks },
      { recursionLimit: 12 } // 1 * 2 + 10
    );
  });

  it('should propagate errors from graph.invoke', async () => {
    const chunks = [{ pageContent: 'chunk', metadata: {} }] as any[];
    mockInvoke.mockRejectedValue(new Error('BoK summarization failed'));

    await expect(summariseBodyOfKnowledge(chunks)).rejects.toThrow(
      'BoK summarization failed'
    );
  });
});
