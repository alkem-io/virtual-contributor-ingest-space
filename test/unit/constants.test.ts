/**
 * T013: Tests for src/constants.ts
 * - Default values and env var overrides
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('constants', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  describe('default values', () => {
    it('should have CHUNK_SIZE default of 2000', async () => {
      vi.resetModules();
      delete process.env.CHUNK_SIZE;
      const { CHUNK_SIZE } = await import('../../src/constants');
      expect(CHUNK_SIZE).toBe(2000);
    });

    it('should have CHUNK_OVERLAP default of 200', async () => {
      vi.resetModules();
      delete process.env.CHUNK_OVERLAP;
      const { CHUNK_OVERLAP } = await import('../../src/constants');
      expect(CHUNK_OVERLAP).toBe(200);
    });

    it('should have BATCH_SIZE default of 20', async () => {
      vi.resetModules();
      delete process.env.BATCH_SIZE;
      const { BATCH_SIZE } = await import('../../src/constants');
      expect(BATCH_SIZE).toBe(20);
    });
  });

  describe('env var overrides', () => {
    it('should override CHUNK_SIZE from env', async () => {
      vi.resetModules();
      process.env.CHUNK_SIZE = '5000';
      const { CHUNK_SIZE } = await import('../../src/constants');
      expect(CHUNK_SIZE).toBe(5000);
    });

    it('should override CHUNK_OVERLAP from env', async () => {
      vi.resetModules();
      process.env.CHUNK_OVERLAP = '500';
      const { CHUNK_OVERLAP } = await import('../../src/constants');
      expect(CHUNK_OVERLAP).toBe(500);
    });

    it('should override BATCH_SIZE from env', async () => {
      vi.resetModules();
      process.env.BATCH_SIZE = '50';
      const { BATCH_SIZE } = await import('../../src/constants');
      expect(BATCH_SIZE).toBe(50);
    });

    it('should parse string env values as integers', async () => {
      vi.resetModules();
      process.env.CHUNK_SIZE = '3500';
      const { CHUNK_SIZE } = await import('../../src/constants');
      expect(typeof CHUNK_SIZE).toBe('number');
      expect(CHUNK_SIZE).toBe(3500);
    });

    it('should handle NaN env values by returning NaN', async () => {
      vi.resetModules();
      process.env.CHUNK_SIZE = 'not-a-number';
      const { CHUNK_SIZE } = await import('../../src/constants');
      expect(CHUNK_SIZE).toBeNaN();
    });
  });
});
