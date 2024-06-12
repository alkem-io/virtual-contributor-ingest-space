import fs from 'fs';
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import { Document } from 'langchain/document';

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
        .then(pageContent => {
          resolve([
            new Document({
              pageContent,
            }),
          ]);
        })
        .catch(err => {
          reject(err);
        });
    });
  }
}

async function DocLoaderImports() {
  try {
    const { parseOfficeAsync, parseOffice } = await import('officeParser');
    return { parseOffice, parseOfficeAsync };
  } catch (e) {
    console.error(e);
    throw new Error(
      'Failed to load mammoth. Please install it with eg. `npm install mammoth`.'
    );
  }
}
