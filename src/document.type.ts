import { CalloutFramingType, MimeType, SpaceLevel } from './generated/graphql'; // '@alkemio/client-lib';

export enum DocumentType {
  KNOWLEDGE = 'KNOWLEDGE',
  SPACE = 'SPACE',
  SUBSPACE = 'SUBSPACE',
  CALLOUT = 'CALLOUT',
  PDF_FILE = 'PDF_FILE',
  SPREADSHEET = 'SPREADSHEET',
  DOCUMENT = 'DOCUMENT',
  // copy CalloutFramingType here
  LINK = 'LINK',
  MEMO = 'MEMO',
  NONE = 'NONE',
  WHITEBOARD = 'WHITEBOARD',
  COLLECTION = 'COLLECTION',
  POST = 'POST',
}

export const typesMap: {
  [key in SpaceLevel | CalloutFramingType]?: DocumentType;
} = {
  [SpaceLevel.L0]: DocumentType.SPACE,
  [SpaceLevel.L1]: DocumentType.SUBSPACE,
  [SpaceLevel.L2]: DocumentType.SUBSPACE,
};

export const mapType = (
  type: SpaceLevel | CalloutFramingType
): DocumentType => {
  const mapped = typesMap[type];
  if (mapped) {
    return mapped;
  }
  return type as unknown as DocumentType;
};

export const MimeTypeDocumentMap: {
  [key in MimeType]?: DocumentType;
} = {
  [MimeType.Pdf]: DocumentType.PDF_FILE,
  [MimeType.Doc]: DocumentType.DOCUMENT,
  [MimeType.Odt]: DocumentType.DOCUMENT,
  [MimeType.Docx]: DocumentType.DOCUMENT,
  [MimeType.Xls]: DocumentType.SPREADSHEET,
  [MimeType.Xlsx]: DocumentType.SPREADSHEET,
  [MimeType.Ods]: DocumentType.SPREADSHEET,
};
