import { SpaceIngestionPurpose } from './ingest.space';

export enum SpaceIngestionResult {
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

export class IngestSpaceResult {
  constructor(
    public readonly spaceId: string,
    public readonly purpose: SpaceIngestionPurpose,
    public readonly personaServiceId: string,
    public readonly timestamp: number,
    public result: SpaceIngestionResult = SpaceIngestionResult.SUCCESS,
    public error?: IngestError
  ) {}
}
