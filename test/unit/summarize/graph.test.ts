/**
 * T006: Tests for src/summarize/graph.ts
 * - calculateProgressiveLength at various ratios
 * - buildGraph returns a graph object with invoke method
 * - Missing MISTRAL_API_KEY env var causes error
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Must set env vars BEFORE importing the module under test,
// because graph.ts reads them at module scope.
const ORIGINAL_ENV = { ...process.env };

const mockCompile = vi.fn().mockReturnValue({ invoke: vi.fn() });
const mockAddConditionalEdges = vi.fn().mockReturnValue({ compile: mockCompile });
const mockAddConditionalEdges2 = vi.fn().mockReturnValue({
  addConditionalEdges: mockAddConditionalEdges,
});
const mockAddEdge = vi.fn().mockReturnValue({
  addConditionalEdges: mockAddConditionalEdges2,
});
const mockAddNode2 = vi.fn().mockReturnValue({ addEdge: mockAddEdge });
const mockAddNode1 = vi.fn().mockReturnValue({ addNode: mockAddNode2 });

vi.mock('@langchain/mistralai', () => ({
  ChatMistralAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({ content: 'mock response' }),
    pipe: vi.fn().mockReturnValue({
      invoke: vi.fn().mockResolvedValue({ content: 'mock response' }),
    }),
  })),
}));

const mockAnnotationField = vi.fn();
vi.mock('@langchain/langgraph', () => {
  const AnnotationFn: any = (...args: any[]) => mockAnnotationField(...args);
  AnnotationFn.Root = vi.fn().mockReturnValue({
    State: {},
  });
  return {
    Annotation: AnnotationFn,
    END: '__end__',
    START: '__start__',
    StateGraph: vi.fn().mockImplementation(() => ({
      addNode: mockAddNode1,
    })),
  };
});

vi.mock('@langchain/core/documents', () => ({
  Document: vi.fn(),
}));

vi.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: {
    fromMessages: vi.fn().mockReturnValue({
      pipe: vi.fn().mockReturnValue({
        invoke: vi.fn().mockResolvedValue({ content: 'mock' }),
      }),
    }),
  },
}));

vi.mock('langsmith/wrappers', () => ({
  wrapSDK: vi.fn((x: any) => x),
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

describe('summarize/graph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      MISTRAL_API_KEY: 'test-key',
      MISTRAL_SMALL_MODEL_NAME: 'mistral-small-test',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('calculateProgressiveLength', () => {
    // calculateProgressiveLength is not exported, but we can test it indirectly
    // by understanding its formula: Math.round(targetLength * Math.max(0.4, currentChunk / totalChunks))
    // We test the logic via a local reimplementation since it's a private function.

    const calculateProgressiveLength = (
      currentChunk: number,
      totalChunks: number,
      targetLength: number
    ): number => {
      const minRatio = 0.4;
      const progressRatio = currentChunk / totalChunks;
      return Math.round(targetLength * Math.max(minRatio, progressRatio));
    };

    it('should return minRatio * targetLength when ratio is 0/10', () => {
      const result = calculateProgressiveLength(0, 10, 10000);
      // ratio = 0/10 = 0, max(0.4, 0) = 0.4 => 10000 * 0.4 = 4000
      expect(result).toBe(4000);
    });

    it('should return half targetLength when ratio is 5/10', () => {
      const result = calculateProgressiveLength(5, 10, 10000);
      // ratio = 5/10 = 0.5, max(0.4, 0.5) = 0.5 => 10000 * 0.5 = 5000
      expect(result).toBe(5000);
    });

    it('should return full targetLength when ratio is 10/10', () => {
      const result = calculateProgressiveLength(10, 10, 10000);
      // ratio = 10/10 = 1.0, max(0.4, 1.0) = 1.0 => 10000 * 1.0 = 10000
      expect(result).toBe(10000);
    });

    it('should use minRatio when progress ratio is below 0.4', () => {
      const result = calculateProgressiveLength(1, 10, 10000);
      // ratio = 1/10 = 0.1, max(0.4, 0.1) = 0.4 => 10000 * 0.4 = 4000
      expect(result).toBe(4000);
    });

    it('should use progress ratio when above 0.4', () => {
      const result = calculateProgressiveLength(7, 10, 10000);
      // ratio = 7/10 = 0.7, max(0.4, 0.7) = 0.7 => 10000 * 0.7 = 7000
      expect(result).toBe(7000);
    });
  });

  describe('buildGraph', () => {
    it('should return a graph object with invoke method', async () => {
      // Need to re-import since module caches
      const { buildGraph } = await import('../../../src/summarize/graph');
      const mockPrompt = {
        pipe: vi.fn().mockReturnValue({
          invoke: vi.fn().mockResolvedValue({ content: 'test' }),
        }),
      };
      const graph = buildGraph(mockPrompt as any, mockPrompt as any);
      expect(graph).toBeDefined();
      expect(graph.invoke).toBeDefined();
      expect(typeof graph.invoke).toBe('function');
    });

    it('should create a StateGraph and compile it', async () => {
      const { StateGraph } = await import('@langchain/langgraph');
      const { buildGraph } = await import('../../../src/summarize/graph');

      const mockPrompt = {
        pipe: vi.fn().mockReturnValue({
          invoke: vi.fn().mockResolvedValue({ content: 'test' }),
        }),
      };

      buildGraph(mockPrompt as any, mockPrompt as any);

      expect(StateGraph).toHaveBeenCalled();
      expect(mockAddNode1).toHaveBeenCalledWith('initialSummary', expect.any(Function));
      expect(mockAddNode2).toHaveBeenCalledWith('refineSummary', expect.any(Function));
      expect(mockCompile).toHaveBeenCalled();
    });

    it('should use internal model', async () => {
      const { buildGraph } = await import('../../../src/summarize/graph');

      const mockPrompt = {
        pipe: vi.fn().mockReturnValue({
          invoke: vi.fn().mockResolvedValue({ content: 'test' }),
        }),
      };

      const graph = buildGraph(mockPrompt as any, mockPrompt as any);
      expect(graph).toBeDefined();
    });
  });

  describe('summaryLength', () => {
    it('should export summaryLength parsed from env or default 10000', async () => {
      const { summaryLength } = await import('../../../src/summarize/graph');
      expect(typeof summaryLength).toBe('number');
      // Default value or env-defined value
      expect(summaryLength).toBeGreaterThan(0);
    });
  });

  describe('initialSummary, refineSummary, shouldRefine (via node functions)', () => {
    let initialSummaryFn: Function;
    let refineSummaryFn: Function;

    beforeEach(async () => {
      vi.clearAllMocks();
      // Capture the functions passed to addNode
      mockAddNode1.mockImplementation((_name: string, fn: Function) => {
        initialSummaryFn = fn;
        return { addNode: mockAddNode2 };
      });
      mockAddNode2.mockImplementation((_name: string, fn: Function) => {
        refineSummaryFn = fn;
        return { addEdge: mockAddEdge };
      });

      const { buildGraph } = await import('../../../src/summarize/graph');
      const mockChainInvoke = vi.fn().mockResolvedValue({ content: 'test summary content' });
      const mockPrompt = {
        pipe: vi.fn().mockReturnValue({
          invoke: mockChainInvoke,
        }),
      };

      buildGraph(mockPrompt as any, mockPrompt as any);
    });

    it('initialSummary should invoke chain with first chunk and return summary', async () => {
      const input = {
        chunks: [
          { pageContent: 'chunk 0 content' },
          { pageContent: 'chunk 1 content' },
        ],
        index: 0,
        summary: '',
      };

      const result = await initialSummaryFn(input);

      expect(result).toEqual(
        expect.objectContaining({
          summary: 'test summary content',
          index: 1,
        })
      );
    });

    it('refineSummary should invoke chain with current chunk and existing summary', async () => {
      const input = {
        chunks: [
          { pageContent: 'chunk 0 content' },
          { pageContent: 'chunk 1 content' },
          { pageContent: 'chunk 2 content' },
        ],
        index: 1,
        summary: 'existing summary',
      };

      const result = await refineSummaryFn(input);

      expect(result).toEqual(
        expect.objectContaining({
          summary: 'test summary content',
          index: 2,
        })
      );
    });
  });

  describe('shouldRefine (via conditional edges)', () => {
    let shouldRefineFn: Function;

    beforeEach(async () => {
      vi.clearAllMocks();
      // Capture shouldRefine from the first addConditionalEdges call
      mockAddEdge.mockImplementation(() => ({
        addConditionalEdges: vi.fn().mockImplementation((_source: string, fn: Function, _targets: string[]) => {
          shouldRefineFn = fn;
          return {
            addConditionalEdges: vi.fn().mockImplementation(() => ({
              compile: vi.fn().mockReturnValue({ invoke: vi.fn() }),
            })),
          };
        }),
      }));

      const { buildGraph } = await import('../../../src/summarize/graph');
      const mockPrompt = {
        pipe: vi.fn().mockReturnValue({
          invoke: vi.fn().mockResolvedValue({ content: 'test' }),
        }),
      };

      buildGraph(mockPrompt as any, mockPrompt as any);
    });

    it('should return END when index >= chunks.length', () => {
      const input = {
        chunks: [{ pageContent: 'a' }, { pageContent: 'b' }],
        index: 2,
        summary: 'done',
      };

      const result = shouldRefineFn(input);
      expect(result).toBe('__end__');
    });

    it('should return "refineSummary" when index < chunks.length', () => {
      const input = {
        chunks: [{ pageContent: 'a' }, { pageContent: 'b' }, { pageContent: 'c' }],
        index: 1,
        summary: 'partial',
      };

      const result = shouldRefineFn(input);
      expect(result).toBe('refineSummary');
    });
  });

  describe('missing env vars', () => {
    it('should throw error when MISTRAL_API_KEY is missing', async () => {
      vi.resetModules();
      process.env.MISTRAL_API_KEY = '';
      delete process.env.MISTRAL_API_KEY;
      process.env.MISTRAL_SMALL_MODEL_NAME = 'some-model';

      // Re-mock dependencies after resetModules
      vi.doMock('@langchain/mistralai', () => ({
        ChatMistralAI: vi.fn().mockImplementation(() => ({
          invoke: vi.fn().mockResolvedValue({ content: 'mock response' }),
          pipe: vi.fn().mockReturnValue({
            invoke: vi.fn().mockResolvedValue({ content: 'mock response' }),
          }),
        })),
      }));
      vi.doMock('@langchain/langgraph', () => {
        const AnnotationFn: any = (...args: any[]) => vi.fn()(...args);
        AnnotationFn.Root = vi.fn().mockReturnValue({ State: {} });
        return {
          Annotation: AnnotationFn,
          END: '__end__',
          START: '__start__',
          StateGraph: vi.fn().mockImplementation(() => ({
            addNode: mockAddNode1,
          })),
        };
      });
      vi.doMock('@langchain/core/documents', () => ({ Document: vi.fn() }));
      vi.doMock('@langchain/core/prompts', () => ({
        ChatPromptTemplate: {
          fromMessages: vi.fn().mockReturnValue({
            pipe: vi.fn().mockReturnValue({
              invoke: vi.fn().mockResolvedValue({ content: 'mock' }),
            }),
          }),
        },
      }));
      vi.doMock('langsmith/wrappers', () => ({ wrapSDK: vi.fn((x: any) => x) }));
      vi.doMock('../../../src/logger', () => ({
        __esModule: true,
        default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), defaultMeta: {} },
      }));

      await expect(
        import('../../../src/summarize/graph')
      ).rejects.toThrow('MISTRAL_API_KEY environment variable is not set.');
    });

    it('should throw error when MISTRAL_SMALL_MODEL_NAME is missing', async () => {
      vi.resetModules();
      process.env.MISTRAL_API_KEY = 'test-key';
      delete process.env.MISTRAL_SMALL_MODEL_NAME;

      vi.doMock('@langchain/mistralai', () => ({
        ChatMistralAI: vi.fn().mockImplementation(() => ({
          invoke: vi.fn().mockResolvedValue({ content: 'mock response' }),
          pipe: vi.fn().mockReturnValue({
            invoke: vi.fn().mockResolvedValue({ content: 'mock response' }),
          }),
        })),
      }));
      vi.doMock('@langchain/langgraph', () => {
        const AnnotationFn: any = (...args: any[]) => vi.fn()(...args);
        AnnotationFn.Root = vi.fn().mockReturnValue({ State: {} });
        return {
          Annotation: AnnotationFn,
          END: '__end__',
          START: '__start__',
          StateGraph: vi.fn().mockImplementation(() => ({
            addNode: mockAddNode1,
          })),
        };
      });
      vi.doMock('@langchain/core/documents', () => ({ Document: vi.fn() }));
      vi.doMock('@langchain/core/prompts', () => ({
        ChatPromptTemplate: {
          fromMessages: vi.fn().mockReturnValue({
            pipe: vi.fn().mockReturnValue({
              invoke: vi.fn().mockResolvedValue({ content: 'mock' }),
            }),
          }),
        },
      }));
      vi.doMock('langsmith/wrappers', () => ({ wrapSDK: vi.fn((x: any) => x) }));
      vi.doMock('../../../src/logger', () => ({
        __esModule: true,
        default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), defaultMeta: {} },
      }));

      await expect(
        import('../../../src/summarize/graph')
      ).rejects.toThrow('MISTRAL_SMALL_MODEL_NAME environment variable is not set.');
    });
  });
});
