import {
  DocumentType,
  typesMap,
  mapType,
  MimeTypeDocumentMap,
} from '../../src/document.type';
import {
  SpaceLevel,
  CalloutFramingType,
  MimeType,
} from '../../src/generated/graphql';

describe('DocumentType', () => {
  it('should have the expected enum values', () => {
    expect(DocumentType.KNOWLEDGE).toBe('KNOWLEDGE');
    expect(DocumentType.SPACE).toBe('SPACE');
    expect(DocumentType.SUBSPACE).toBe('SUBSPACE');
    expect(DocumentType.CALLOUT).toBe('CALLOUT');
    expect(DocumentType.PDF_FILE).toBe('PDF_FILE');
    expect(DocumentType.SPREADSHEET).toBe('SPREADSHEET');
    expect(DocumentType.DOCUMENT).toBe('DOCUMENT');
    expect(DocumentType.LINK).toBe('LINK');
    expect(DocumentType.MEMO).toBe('MEMO');
    expect(DocumentType.NONE).toBe('NONE');
    expect(DocumentType.WHITEBOARD).toBe('WHITEBOARD');
    expect(DocumentType.COLLECTION).toBe('COLLECTION');
    expect(DocumentType.POST).toBe('POST');
  });
});

describe('typesMap', () => {
  it('should map SpaceLevel.L0 to SPACE', () => {
    expect(typesMap[SpaceLevel.L0]).toBe(DocumentType.SPACE);
  });

  it('should map SpaceLevel.L1 to SUBSPACE', () => {
    expect(typesMap[SpaceLevel.L1]).toBe(DocumentType.SUBSPACE);
  });

  it('should map SpaceLevel.L2 to SUBSPACE', () => {
    expect(typesMap[SpaceLevel.L2]).toBe(DocumentType.SUBSPACE);
  });

  it('should not have a mapping for CalloutFramingType values', () => {
    expect(typesMap[CalloutFramingType.Link]).toBeUndefined();
    expect(typesMap[CalloutFramingType.Memo]).toBeUndefined();
  });
});

describe('mapType', () => {
  it('should return SPACE for SpaceLevel.L0', () => {
    expect(mapType(SpaceLevel.L0)).toBe(DocumentType.SPACE);
  });

  it('should return SUBSPACE for SpaceLevel.L1', () => {
    expect(mapType(SpaceLevel.L1)).toBe(DocumentType.SUBSPACE);
  });

  it('should return SUBSPACE for SpaceLevel.L2', () => {
    expect(mapType(SpaceLevel.L2)).toBe(DocumentType.SUBSPACE);
  });

  it('should return the type cast as DocumentType when not in typesMap', () => {
    // CalloutFramingType values are not in typesMap, so they get cast
    const result = mapType(CalloutFramingType.Link);
    expect(result).toBe('LINK');
  });

  it('should return MEMO for CalloutFramingType.Memo', () => {
    const result = mapType(CalloutFramingType.Memo);
    expect(result).toBe('MEMO');
  });

  it('should return WHITEBOARD for CalloutFramingType.Whiteboard', () => {
    const result = mapType(CalloutFramingType.Whiteboard);
    expect(result).toBe('WHITEBOARD');
  });

  it('should return NONE for CalloutFramingType.None', () => {
    const result = mapType(CalloutFramingType.None);
    expect(result).toBe('NONE');
  });
});

describe('MimeTypeDocumentMap', () => {
  it('should map PDF to PDF_FILE', () => {
    expect(MimeTypeDocumentMap[MimeType.Pdf]).toBe(DocumentType.PDF_FILE);
  });

  it('should map Doc to DOCUMENT', () => {
    expect(MimeTypeDocumentMap[MimeType.Doc]).toBe(DocumentType.DOCUMENT);
  });

  it('should map Odt to DOCUMENT', () => {
    expect(MimeTypeDocumentMap[MimeType.Odt]).toBe(DocumentType.DOCUMENT);
  });

  it('should map Docx to DOCUMENT', () => {
    expect(MimeTypeDocumentMap[MimeType.Docx]).toBe(DocumentType.DOCUMENT);
  });

  it('should map Xls to SPREADSHEET', () => {
    expect(MimeTypeDocumentMap[MimeType.Xls]).toBe(DocumentType.SPREADSHEET);
  });

  it('should map Xlsx to SPREADSHEET', () => {
    expect(MimeTypeDocumentMap[MimeType.Xlsx]).toBe(DocumentType.SPREADSHEET);
  });

  it('should map Ods to SPREADSHEET', () => {
    expect(MimeTypeDocumentMap[MimeType.Ods]).toBe(DocumentType.SPREADSHEET);
  });

  it('should return undefined for unmapped types', () => {
    expect(MimeTypeDocumentMap[MimeType.Png]).toBeUndefined();
    expect(MimeTypeDocumentMap[MimeType.Jpeg]).toBeUndefined();
  });
});
