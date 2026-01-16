import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import { Document } from '@langchain/core/documents';

export class SpreadSheetLoader extends BaseDocumentLoader {
  filePath = '';

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
  }

  async load(): Promise<Document[]> {
    const xlsx = await SpreadSheetLoaderImports();

    return new Promise((resolve, reject) => {
      try {
        const result: Document[] = [];
        const workbook = xlsx.readFile(this.filePath);

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const pageContent = xlsx.utils.sheet_to_csv(sheet, {
            blankrows: false,
          });
          result.push(new Document({ pageContent, metadata: { sheetName } }));
        }
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }
}

async function SpreadSheetLoaderImports() {
  try {
    const xlsx = await import('xlsx');
    return xlsx;
  } catch (e) {
    console.error(e);
    throw new Error(
      'Failed to load mammoth. Please install it with eg. `npm install mammoth`.'
    );
  }
}
