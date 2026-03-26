import { Document } from '@langchain/core/documents';

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

const mockParseOfficeAsync = jest.fn();
jest.mock('officeparser', () => ({
  parseOfficeAsync: mockParseOfficeAsync,
  parseOffice: jest.fn(),
}));

import fs from 'fs';
import { DocLoader } from '../../../src/loaders/doc.loader';

describe('DocLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create an instance with the given file path', () => {
    const loader = new DocLoader('/tmp/test.odt');
    expect(loader.filePath).toBe('/tmp/test.odt');
  });

  it('should load and parse a document file', async () => {
    const mockBuffer = Buffer.from('mock file content');
    (fs.readFileSync as jest.Mock).mockReturnValue(mockBuffer);
    mockParseOfficeAsync.mockResolvedValue('Parsed document text');

    const loader = new DocLoader('/tmp/test.odt');
    const result = await loader.load();

    expect(fs.readFileSync).toHaveBeenCalledWith('/tmp/test.odt');
    expect(mockParseOfficeAsync).toHaveBeenCalledWith(mockBuffer);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Document);
    expect(result[0].pageContent).toBe('Parsed document text');
  });

  it('should reject when parseOfficeAsync fails', async () => {
    const mockBuffer = Buffer.from('bad file');
    (fs.readFileSync as jest.Mock).mockReturnValue(mockBuffer);
    mockParseOfficeAsync.mockRejectedValue(new Error('Parse error'));

    const loader = new DocLoader('/tmp/bad.odt');

    await expect(loader.load()).rejects.toThrow('Parse error');
  });

  it('should reject when readFileSync throws', async () => {
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('File not found');
    });

    const loader = new DocLoader('/tmp/missing.odt');

    await expect(loader.load()).rejects.toThrow('File not found');
  });
});
