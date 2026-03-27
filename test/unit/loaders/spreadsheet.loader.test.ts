import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Document } from '@langchain/core/documents';

const mockReadFile = vi.fn();
const mockSheetToCsv = vi.fn();

vi.mock('xlsx', () => ({
  readFile: mockReadFile,
  utils: {
    sheet_to_csv: mockSheetToCsv,
  },
}));

import { SpreadSheetLoader } from '../../../src/loaders/spreadsheet.loader';

describe('SpreadSheetLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create an instance with the given file path', () => {
    const loader = new SpreadSheetLoader('/tmp/test.xlsx');
    expect(loader.filePath).toBe('/tmp/test.xlsx');
  });

  it('should load a spreadsheet with a single sheet', async () => {
    const mockSheet = { '!ref': 'A1:B2' };
    mockReadFile.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: mockSheet },
    });
    mockSheetToCsv.mockReturnValue('col1,col2\nval1,val2');

    const loader = new SpreadSheetLoader('/tmp/test.xlsx');
    const result = await loader.load();

    expect(mockReadFile).toHaveBeenCalledWith('/tmp/test.xlsx');
    expect(mockSheetToCsv).toHaveBeenCalledWith(mockSheet, { blankrows: false });
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Document);
    expect(result[0].pageContent).toBe('col1,col2\nval1,val2');
    expect(result[0].metadata.sheetName).toBe('Sheet1');
  });

  it('should load a spreadsheet with multiple sheets', async () => {
    const sheet1 = { '!ref': 'A1:A1' };
    const sheet2 = { '!ref': 'A1:A1' };
    mockReadFile.mockReturnValue({
      SheetNames: ['Data', 'Summary'],
      Sheets: { Data: sheet1, Summary: sheet2 },
    });
    mockSheetToCsv
      .mockReturnValueOnce('data csv')
      .mockReturnValueOnce('summary csv');

    const loader = new SpreadSheetLoader('/tmp/multi.xlsx');
    const result = await loader.load();

    expect(result).toHaveLength(2);
    expect(result[0].pageContent).toBe('data csv');
    expect(result[0].metadata.sheetName).toBe('Data');
    expect(result[1].pageContent).toBe('summary csv');
    expect(result[1].metadata.sheetName).toBe('Summary');
  });

  it('should reject when readFile throws', async () => {
    mockReadFile.mockImplementation(() => {
      throw new Error('Cannot read file');
    });

    const loader = new SpreadSheetLoader('/tmp/bad.xlsx');

    await expect(loader.load()).rejects.toThrow('Cannot read file');
  });

  it('should handle empty workbook', async () => {
    mockReadFile.mockReturnValue({
      SheetNames: [],
      Sheets: {},
    });

    const loader = new SpreadSheetLoader('/tmp/empty.xlsx');
    const result = await loader.load();

    expect(result).toHaveLength(0);
  });
});
