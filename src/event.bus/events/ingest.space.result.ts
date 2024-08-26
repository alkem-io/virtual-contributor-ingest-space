export enum SpaceIngestionPurpose {
  KNOWLEDGE = 'knowledge',
  CONTEXT = 'context',
}

export enum SpaceIngestionResult {
  SUCCESS = 'success',
  FAILURE = 'failure',
}

export class IngestSpaceResult {
  constructor(
    public readonly spaceId: string,
    public readonly purpose: SpaceIngestionPurpose,
    public readonly personaServiceId: string,
    public readonly timestamp: number,
    public result?: SpaceIngestionResult,
    public error?: string
  ) {}
}