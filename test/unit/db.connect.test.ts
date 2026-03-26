/**
 * T010: Tests for src/db.connect.ts
 * - dbConnect creates ChromaClient with correct config
 * - Missing credentials handling
 */

const mockChromaClientInstance = {
  heartbeat: jest.fn().mockResolvedValue(1234567890),
};

jest.mock('chromadb', () => ({
  ChromaClient: jest.fn().mockImplementation(() => mockChromaClientInstance),
}));

import { dbConnect } from '../../src/db.connect';
import { ChromaClient } from 'chromadb';

const MockedChromaClient = ChromaClient as jest.MockedClass<typeof ChromaClient>;

describe('dbConnect', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      VECTOR_DB_CREDENTIALS: 'test-credentials',
      VECTOR_DB_HOST: 'localhost',
      VECTOR_DB_PORT: '8000',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('should create ChromaClient with correct host, port, and auth header', () => {
    const client = dbConnect();

    expect(MockedChromaClient).toHaveBeenCalledWith({
      host: 'localhost',
      port: 8000,
      headers: {
        Authorization: 'Bearer test-credentials',
      },
    });
    expect(client).toBe(mockChromaClientInstance);
  });

  it('should convert port string to number', () => {
    process.env.VECTOR_DB_PORT = '9999';

    dbConnect();

    expect(MockedChromaClient).toHaveBeenCalledWith(
      expect.objectContaining({ port: 9999 })
    );
  });

  it('should throw error when credentials are missing', () => {
    delete process.env.VECTOR_DB_CREDENTIALS;

    expect(() => dbConnect()).toThrow('No ChromaDB credentials provided');
  });

  it('should throw error when credentials are empty string', () => {
    process.env.VECTOR_DB_CREDENTIALS = '';

    expect(() => dbConnect()).toThrow('No ChromaDB credentials provided');
  });

  it('should throw error when host is missing', () => {
    delete process.env.VECTOR_DB_HOST;

    expect(() => dbConnect()).toThrow(
      'VECTOR_DB_HOST and VECTOR_DB_PORT must be provided'
    );
  });

  it('should throw error when port is missing', () => {
    delete process.env.VECTOR_DB_PORT;

    expect(() => dbConnect()).toThrow(
      'VECTOR_DB_HOST and VECTOR_DB_PORT must be provided'
    );
  });

  it('should throw error when both host and port are missing', () => {
    delete process.env.VECTOR_DB_HOST;
    delete process.env.VECTOR_DB_PORT;

    expect(() => dbConnect()).toThrow(
      'VECTOR_DB_HOST and VECTOR_DB_PORT must be provided'
    );
  });

  it('should use Bearer token format for authorization', () => {
    process.env.VECTOR_DB_CREDENTIALS = 'my-secret-token';

    dbConnect();

    expect(MockedChromaClient).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { Authorization: 'Bearer my-secret-token' },
      })
    );
  });

  it('should return the created client instance', () => {
    const result = dbConnect();
    expect(result).toBeDefined();
    expect(result).toBe(mockChromaClientInstance);
  });
});
