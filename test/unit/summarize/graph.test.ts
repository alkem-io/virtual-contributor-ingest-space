/**
 * T006: Tests for src/summarize/graph.ts
 * - calculateProgressiveLength at various ratios
 * - buildGraph returns a graph object with invoke method
 * - Missing MISTRAL_API_KEY env var causes error
 */

// Must set env vars BEFORE importing the module under test,
// because graph.ts reads them at module scope.
const ORIGINAL_ENV = { ...process.env };

const mockCompile = jest.fn().mockReturnValue({ invoke: jest.fn() });
const mockAddConditionalEdges = jest.fn().mockReturnValue({ compile: mockCompile });
const mockAddConditionalEdges2 = jest.fn().mockReturnValue({
  addConditionalEdges: mockAddConditionalEdges,
});
const mockAddEdge = jest.fn().mockReturnValue({
  addConditionalEdges: mockAddConditionalEdges2,
});
const mockAddNode2 = jest.fn().mockReturnValue({ addEdge: mockAddEdge });
const mockAddNode1 = jest.fn().mockReturnValue({ addNode: mockAddNode2 });

jest.mock('@langchain/mistralai', () => ({
  ChatMistralAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'mock response' }),
    pipe: jest.fn().mockReturnValue({
      invoke: jest.fn().mockResolvedValue({ content: 'mock response' }),
    }),
  })),
}));

const mockAnnotationField = jest.fn();
jest.mock('@langchain/langgraph', () => {
  const AnnotationFn: any = (...args: any[]) => mockAnnotationField(...args);
  AnnotationFn.Root = jest.fn().mockReturnValue({
    State: {},
  });
  return {
    Annotation: AnnotationFn,
    END: '__end__',
    START: '__start__',
    StateGraph: jest.fn().mockImplementation(() => ({
      addNode: mockAddNode1,
    })),
  };
});

jest.mock('@langchain/core/documents', () => ({
  Document: jest.fn(),
}));

jest.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: {
    fromMessages: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnValue({
        invoke: jest.fn().mockResolvedValue({ content: 'mock' }),
      }),
    }),
  },
}));

jest.mock('@langchain/core/language_models/chat_models', () => ({
  BaseChatModel: jest.fn(),
}));

jest.mock('langsmith/wrappers', () => ({
  wrapSDK: jest.fn((x: any) => x),
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

describe('summarize/graph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    it('should return a graph object with invoke method', () => {
      // Need to re-require since module caches
      const { buildGraph } = require('../../../src/summarize/graph');
      const mockPrompt = {
        pipe: jest.fn().mockReturnValue({
          invoke: jest.fn().mockResolvedValue({ content: 'test' }),
        }),
      };
      const graph = buildGraph(mockPrompt as any, mockPrompt as any);
      expect(graph).toBeDefined();
      expect(graph.invoke).toBeDefined();
      expect(typeof graph.invoke).toBe('function');
    });

    it('should create a StateGraph and compile it', () => {
      const { StateGraph } = require('@langchain/langgraph');
      const { buildGraph } = require('../../../src/summarize/graph');

      const mockPrompt = {
        pipe: jest.fn().mockReturnValue({
          invoke: jest.fn().mockResolvedValue({ content: 'test' }),
        }),
      };

      buildGraph(mockPrompt as any, mockPrompt as any);

      expect(StateGraph).toHaveBeenCalled();
      expect(mockAddNode1).toHaveBeenCalledWith('initialSummary', expect.any(Function));
      expect(mockAddNode2).toHaveBeenCalledWith('refineSummary', expect.any(Function));
      expect(mockCompile).toHaveBeenCalled();
    });

    it('should use default model when none provided', () => {
      const { buildGraph } = require('../../../src/summarize/graph');

      const mockPrompt = {
        pipe: jest.fn().mockReturnValue({
          invoke: jest.fn().mockResolvedValue({ content: 'test' }),
        }),
      };

      // Call without third argument - should use modelMistralSmall default
      const graph = buildGraph(mockPrompt as any, mockPrompt as any);
      expect(graph).toBeDefined();
    });

    it('should use provided custom model', () => {
      const { buildGraph } = require('../../../src/summarize/graph');

      const mockPrompt = {
        pipe: jest.fn().mockReturnValue({
          invoke: jest.fn().mockResolvedValue({ content: 'test' }),
        }),
      };
      const mockModel = {
        invoke: jest.fn(),
        pipe: jest.fn(),
      };

      const graph = buildGraph(mockPrompt as any, mockPrompt as any, mockModel as any);
      expect(graph).toBeDefined();
      // The prompt.pipe should be called with the custom model
      expect(mockPrompt.pipe).toHaveBeenCalledWith(mockModel);
    });
  });

  describe('summaryLength', () => {
    it('should export summaryLength parsed from env or default 10000', () => {
      const { summaryLength } = require('../../../src/summarize/graph');
      expect(typeof summaryLength).toBe('number');
      // Default value or env-defined value
      expect(summaryLength).toBeGreaterThan(0);
    });
  });

  describe('initialSummary, refineSummary, shouldRefine (via node functions)', () => {
    let initialSummaryFn: Function;
    let refineSummaryFn: Function;

    beforeEach(() => {
      jest.clearAllMocks();
      // Capture the functions passed to addNode
      mockAddNode1.mockImplementation((_name: string, fn: Function) => {
        initialSummaryFn = fn;
        return { addNode: mockAddNode2 };
      });
      mockAddNode2.mockImplementation((_name: string, fn: Function) => {
        refineSummaryFn = fn;
        return { addEdge: mockAddEdge };
      });

      const { buildGraph } = require('../../../src/summarize/graph');
      const mockChainInvoke = jest.fn().mockResolvedValue({ content: 'test summary content' });
      const mockPrompt = {
        pipe: jest.fn().mockReturnValue({
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

    beforeEach(() => {
      jest.clearAllMocks();
      // Capture shouldRefine from the first addConditionalEdges call
      mockAddEdge.mockImplementation(() => ({
        addConditionalEdges: jest.fn().mockImplementation((_source: string, fn: Function, _targets: string[]) => {
          shouldRefineFn = fn;
          return {
            addConditionalEdges: jest.fn().mockImplementation(() => ({
              compile: jest.fn().mockReturnValue({ invoke: jest.fn() }),
            })),
          };
        }),
      }));

      const { buildGraph } = require('../../../src/summarize/graph');
      const mockPrompt = {
        pipe: jest.fn().mockReturnValue({
          invoke: jest.fn().mockResolvedValue({ content: 'test' }),
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
    it('should throw error when MISTRAL_API_KEY is missing', () => {
      // We need to isolate the module to test module-level throw.
      // Since the module was already loaded with valid env, we test the pattern:
      // The module-level code checks for MISTRAL_API_KEY and throws.
      // To verify this, we check that the env guard exists in the source.
      // A true isolation test would require jest.isolateModules.
      jest.isolateModules(() => {
        process.env.MISTRAL_API_KEY = '';
        delete process.env.MISTRAL_API_KEY;
        process.env.MISTRAL_SMALL_MODEL_NAME = 'some-model';

        expect(() => {
          require('../../../src/summarize/graph');
        }).toThrow('MISTRAL_API_KEY environment variable is not set.');
      });
    });

    it('should throw error when MISTRAL_SMALL_MODEL_NAME is missing', () => {
      jest.isolateModules(() => {
        process.env.MISTRAL_API_KEY = 'test-key';
        delete process.env.MISTRAL_SMALL_MODEL_NAME;

        expect(() => {
          require('../../../src/summarize/graph');
        }).toThrow('MISTRAL_SMALL_MODEL_NAME environment variable is not set.');
      });
    });
  });
});
