import { MimeType } from '@alkemio/client-lib';

export enum DocumentType {
  Space = 'space',
  Challenge = 'challenge',
  Callout = 'callout',
  PdfFile = 'pdf_file',
  SpreadSheet = 'spreadsheet',
  Doc = 'document',
}

export const MimeTypeDocumentMap: {
  [key in MimeType]?: DocumentType;
} = {
  [MimeType.Pdf]: DocumentType.PdfFile,
  [MimeType.Doc]: DocumentType.Doc,
  [MimeType.Odt]: DocumentType.Doc,
  [MimeType.Docx]: DocumentType.Doc,
  [MimeType.Xls]: DocumentType.SpreadSheet,
  [MimeType.Xlsx]: DocumentType.SpreadSheet,
  [MimeType.Ods]: DocumentType.SpreadSheet,
};
