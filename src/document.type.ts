import { } from '@alkemio/client-lib';
import { CalloutType, MimeType, SpaceLevel } from './generated/graphql'; // '@alkemio/client-lib';

export enum DocumentType {
  KNOWLEDGE = 'KNOWLEDGE',
  SPACE = 'SPACE',
  SUBSPACE = 'SUBSPACE',
  CALLOUT = 'CALLOUT',
  PDF_FILE = 'PDF_FILE',
  SPREADSHEET = 'SPREADSHEET',
  DOCUMENT = 'DOCUMENT',
  // copy CalloutType here
  LINK_COLLECTION = 'LINK_COLLECTION',
  POST = 'POST',
  POST_COLLECTION = 'POST_COLLECTION',
  WHITEBOARD = 'WHITEBOARD',
  WHITEBOARD_COLLECTION = 'WHITEBOARD_COLLECTION',
}

export const typesMap: {
  [key in SpaceLevel | CalloutType]?: DocumentType;
} = {
  [SpaceLevel.L0]: DocumentType.SPACE,
  [SpaceLevel.L1]: DocumentType.SUBSPACE,
  [SpaceLevel.L2]: DocumentType.SUBSPACE,
};

export const mapType = (type: SpaceLevel | CalloutType): DocumentType => {
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
