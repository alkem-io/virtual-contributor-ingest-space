import { describe, it, expect } from 'vitest';

describe('loaders/index exports', () => {
  it('should export SpreadSheetLoader', async () => {
    const loaders = await import('../../../src/loaders');
    expect(loaders.SpreadSheetLoader).toBeDefined();
    expect(typeof loaders.SpreadSheetLoader).toBe('function');
  });

  it('should export DocLoader', async () => {
    const loaders = await import('../../../src/loaders');
    expect(loaders.DocLoader).toBeDefined();
    expect(typeof loaders.DocLoader).toBe('function');
  });

  it('should create a SpreadSheetLoader instance', async () => {
    const { SpreadSheetLoader } = await import('../../../src/loaders');
    const loader = new SpreadSheetLoader('/tmp/test.xlsx');
    expect(loader.filePath).toBe('/tmp/test.xlsx');
  });

  it('should create a DocLoader instance', async () => {
    const { DocLoader } = await import('../../../src/loaders');
    const loader = new DocLoader('/tmp/test.odt');
    expect(loader.filePath).toBe('/tmp/test.odt');
  });
});
