import fs from 'fs';
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import { Document } from '@langchain/core/documents';

export class DocLoader extends BaseDocumentLoader {
  filePath = '';

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
  }

  async load(): Promise<Document[]> {
    const { parseOfficeAsync } = await DocLoaderImports();

    return new Promise((resolve, reject) => {
      const fileBuffers = fs.readFileSync(this.filePath);
      parseOfficeAsync(fileBuffers)
        .then((pageContent: string) => {
          resolve([
            new Document({
              pageContent,
            }),
          ]);
        })
        .catch((err: Error) => {
          reject(err);
        });
    });
  }
}

async function DocLoaderImports() {
  try {
    const { parseOfficeAsync, parseOffice } = await import('officeparser');
    return { parseOffice, parseOfficeAsync };
  } catch (e) {
    console.error(e);
    throw new Error(
      'Failed to load mammoth. Please install it with eg. `npm install mammoth`.'
    );
  }
}
