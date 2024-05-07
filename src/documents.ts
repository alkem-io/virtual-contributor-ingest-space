import { Metadata } from 'chromadb';

export type DocumentType = 'space' | 'challenge' | 'callout';

export default class Documents {
  private ids: string[] = [];
  private documents: string[] = [];
  private metadatas: Metadata[] = [];

  add(
    id: string,
    document: string,
    source: string,
    type: DocumentType,
    title: string
  ): Documents {
    this.ids.push(id);
    this.documents.push(document);
    this.metadatas.push({ source, type, title });
    return this;
  }

  forEmbed() {
    return {
      ids: this.ids,
      documents: this.documents,
      metadatas: this.metadatas,
    };
  }
}
