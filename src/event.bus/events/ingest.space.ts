export enum SpaceIngestionPurpose {
  KNOWLEDGE = 'knowledge',
  CONTEXT = 'context',
}

export class IngestSpace {
  constructor(
    public readonly spaceId: string,
    public readonly purpose: SpaceIngestionPurpose,
    public readonly personaServiceId: string
  ) {}
}
