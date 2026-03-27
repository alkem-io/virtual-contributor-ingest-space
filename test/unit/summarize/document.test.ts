/**
 * T007: Tests for src/summarize/document.ts
 * - summarizeDocument calls graph.invoke and returns summary
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

import { summarizeDocument } from '../../../src/summarize/document';
import { buildGraph } from '../../../src/summarize/graph';

const mockBuildGraph = buildGraph as ReturnType<typeof vi.fn>;

describe('summarize/document', () => {
  const mockInvoke = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({ summary: 'Test document summary' });
    mockBuildGraph.mockReturnValue({ invoke: mockInvoke } as any);
  });

  it('should call buildGraph with summarize and refine prompts', async () => {
    const chunks = [
      { pageContent: 'chunk1', metadata: {} },
      { pageContent: 'chunk2', metadata: {} },
    ] as any[];

    await summarizeDocument(chunks);

    expect(mockBuildGraph).toHaveBeenCalledTimes(1);
    expect(mockBuildGraph).toHaveBeenCalledWith(
      expect.anything(), // summarizePrompt
      expect.anything()  // refinePrompt
    );
  });

  it('should call graph.invoke with chunks and recursionLimit', async () => {
    const chunks = [
      { pageContent: 'chunk1', metadata: {} },
      { pageContent: 'chunk2', metadata: {} },
      { pageContent: 'chunk3', metadata: {} },
    ] as any[];

    await summarizeDocument(chunks);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      { chunks },
      { recursionLimit: chunks.length * 2 + 10 } // 3 * 2 + 10 = 16
    );
  });

  it('should return the summary from graph invocation', async () => {
    const chunks = [{ pageContent: 'chunk1', metadata: {} }] as any[];
    mockInvoke.mockResolvedValue({ summary: 'Final summary result' });

    const result = await summarizeDocument(chunks);

    expect(result).toBe('Final summary result');
  });

  it('should calculate correct recursionLimit based on chunk count', async () => {
    const chunks = Array.from({ length: 5 }, (_, i) => ({
      pageContent: `chunk${i}`,
      metadata: {},
    })) as any[];

    await summarizeDocument(chunks);

    // recursionLimit = 5 * 2 + 10 = 20
    expect(mockInvoke).toHaveBeenCalledWith(
      { chunks },
      { recursionLimit: 20 }
    );
  });

  it('should handle single chunk', async () => {
    const chunks = [{ pageContent: 'only chunk', metadata: {} }] as any[];
    mockInvoke.mockResolvedValue({ summary: 'Single chunk summary' });

    const result = await summarizeDocument(chunks);

    expect(result).toBe('Single chunk summary');
    expect(mockInvoke).toHaveBeenCalledWith(
      { chunks },
      { recursionLimit: 12 } // 1 * 2 + 10
    );
  });

  it('should propagate errors from graph.invoke', async () => {
    const chunks = [{ pageContent: 'chunk1', metadata: {} }] as any[];
    mockInvoke.mockRejectedValue(new Error('Graph invocation failed'));

    await expect(summarizeDocument(chunks)).rejects.toThrow(
      'Graph invocation failed'
    );
  });
});
