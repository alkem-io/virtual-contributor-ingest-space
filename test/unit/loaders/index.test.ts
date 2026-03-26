describe('loaders/index exports', () => {
  it('should export SpreadSheetLoader', () => {
    // Use require to avoid module-level side effects with mocking
    const loaders = require('../../../src/loaders');
    expect(loaders.SpreadSheetLoader).toBeDefined();
    expect(typeof loaders.SpreadSheetLoader).toBe('function');
  });

  it('should export DocLoader', () => {
    const loaders = require('../../../src/loaders');
    expect(loaders.DocLoader).toBeDefined();
    expect(typeof loaders.DocLoader).toBe('function');
  });

  it('should create a SpreadSheetLoader instance', () => {
    const { SpreadSheetLoader } = require('../../../src/loaders');
    const loader = new SpreadSheetLoader('/tmp/test.xlsx');
    expect(loader.filePath).toBe('/tmp/test.xlsx');
  });

  it('should create a DocLoader instance', () => {
    const { DocLoader } = require('../../../src/loaders');
    const loader = new DocLoader('/tmp/test.odt');
    expect(loader.filePath).toBe('/tmp/test.odt');
  });
});
