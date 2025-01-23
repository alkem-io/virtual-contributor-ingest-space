export enum IngestionPurpose {
  KNOWLEDGE = 'knowledge',
  CONTEXT = 'context',
}
export enum BodyOfKnowledgeType {
  ALKEMIO_SPACE = 'alkemio-space',
  ALKEMIO_KNOWLEDGE_BASE = 'alkemio-knowledge-base',
}

export class IngestBodyOfKnowledge {
  constructor(
    public readonly bodyOfKnowledgeId: string,
    public readonly type: BodyOfKnowledgeType,
    public readonly purpose: IngestionPurpose,
    public readonly personaServiceId: string
  ) {}
}
