import {
  IngestionPurpose,
  BodyOfKnowledgeType,
} from './ingest.body.of.knowledge';

export enum IngestionResult {
  SUCCESS = 'success',
  FAILURE = 'failure',
}

export enum ErrorCode {
  VECTOR_INSERT = 'vector_insert',
}

type IngestError = {
  code?: ErrorCode;
  message: string;
};

export class IngestBodyOfKnowledgeResult {
  constructor(
    public readonly bodyOfKnowledgeId: string,
    public readonly type: BodyOfKnowledgeType,
    public readonly purpose: IngestionPurpose,
    public readonly personaId: string,
    public timestamp: number = new Date(
      new Date().toLocaleString('en', { timeZone: 'UTC' })
    ).getTime(),
    public result: IngestionResult = IngestionResult.SUCCESS,
    public error?: IngestError
  ) { }
}
