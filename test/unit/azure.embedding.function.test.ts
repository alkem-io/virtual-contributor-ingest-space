/**
 * T009: Tests for src/azure.embedding.function.ts
 * - OpenAICompatibleEmbeddingFunction.generate returns embeddings
 * - Error handling on API failure
 */

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      embeddings: {
        create: mockCreate,
      },
    })),
  };
});

jest.mock('../../src/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    defaultMeta: {},
  },
}));

import { OpenAICompatibleEmbeddingFunction } from '../../src/azure.embedding.function';
import OpenAI from 'openai';

describe('OpenAICompatibleEmbeddingFunction', () => {
  let embeddingFn: OpenAICompatibleEmbeddingFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    embeddingFn = new OpenAICompatibleEmbeddingFunction(
      'https://api.example.com',
      'test-api-key',
      'text-embedding-model'
    );
  });

  describe('constructor', () => {
    it('should create an OpenAI client with correct params', () => {
      expect(OpenAI).toHaveBeenCalledWith({
        baseURL: 'https://api.example.com',
        apiKey: 'test-api-key',
      });
    });
  });

  describe('generate', () => {
    it('should return embeddings for given texts', async () => {
      mockCreate.mockResolvedValue({
        data: [
          { embedding: [0.1, 0.2, 0.3], index: 0 },
          { embedding: [0.4, 0.5, 0.6], index: 1 },
        ],
      });

      const result = await embeddingFn.generate(['hello', 'world']);

      expect(result).toEqual([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ]);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-model',
        input: ['hello', 'world'],
      });
    });

    it('should return single embedding for single text', async () => {
      mockCreate.mockResolvedValue({
        data: [{ embedding: [0.7, 0.8, 0.9], index: 0 }],
      });

      const result = await embeddingFn.generate(['single text']);

      expect(result).toEqual([[0.7, 0.8, 0.9]]);
    });

    it('should return empty array for empty data', async () => {
      mockCreate.mockResolvedValue({ data: [] });

      const result = await embeddingFn.generate([]);

      expect(result).toEqual([]);
    });

    it('should throw error on API failure', async () => {
      const apiError = new Error('API rate limit exceeded');
      (apiError as any).status = 429;
      mockCreate.mockRejectedValue(apiError);

      await expect(embeddingFn.generate(['test'])).rejects.toThrow(
        'API rate limit exceeded'
      );
    });

    it('should log error details on failure', async () => {
      const logger = require('../../src/logger').default;
      const apiError = new Error('Connection timeout');
      (apiError as any).status = 503;
      mockCreate.mockRejectedValue(apiError);

      await expect(embeddingFn.generate(['test text'])).rejects.toThrow(
        'Connection timeout'
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Embedding generation failed',
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Connection timeout',
            status: 503,
          }),
          textCount: 1,
          firstTextLength: 9,
        })
      );
    });

    it('should handle error without status property', async () => {
      const apiError = new Error('Network error');
      mockCreate.mockRejectedValue(apiError);

      await expect(embeddingFn.generate(['test'])).rejects.toThrow(
        'Network error'
      );
    });

    it('should pass model name correctly to create call', async () => {
      mockCreate.mockResolvedValue({
        data: [{ embedding: [1.0], index: 0 }],
      });

      const customFn = new OpenAICompatibleEmbeddingFunction(
        'https://custom.api.com',
        'key',
        'custom-model-v2'
      );
      await customFn.generate(['test']);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'custom-model-v2',
        input: ['test'],
      });
    });
  });
});
