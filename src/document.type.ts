import { CalloutType, MimeType, SpaceType } from '@alkemio/client-lib';

export enum DocumentType {
  KNOWLEDGE = 'KNOWLEDGE',
  SUBSPACE = 'SUBSPACE',
  CALLOUT = 'CALLOUT',
  PDF_FILE = 'PDF_FILE',
  SPREADSHEET = 'SPREADSHEET',
  DOCUMENT = 'DOCUMENT',
  LINK_COLLECTION = 'LINK_COLLECTION',
  POST = 'POST',
  POST_COLLECTION = 'POST_COLLECTION',
  WHITEBOARD = 'WHITEBOARD',
  WHITEBOARD_COLLECTION = 'WHITEBOARD_COLLECTION',
}

export const typesMap: {
  [key in SpaceType | CalloutType]?: DocumentType;
} = {
  // [SpaceType.VirtualContributor]: DocumentType.KNOWLEDGE,
  // [SpaceType.BlankSlate]: DocumentType.SPACE,
  [SpaceType.Challenge]: DocumentType.SUBSPACE,
  [SpaceType.Opportunity]: DocumentType.SUBSPACE,

  // [DocumentType.Challenge]: DocumentType.Subspace,
  // [DocumentType.Opportunity]: DocumentType.Subspace,
};

export const getType = (type: SpaceType | CalloutType): DocumentType => {
  const mapped = typesMap[type];
  if (mapped) {
    return typesMap[type]!;
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
