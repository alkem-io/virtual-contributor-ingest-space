import {
  IngestBodyOfKnowledge,
  BodyOfKnowledgeType,
  IngestionPurpose,
  SummarizationModel,
} from '../../../../src/event.bus/events/ingest.body.of.knowledge';

describe('IngestBodyOfKnowledge', () => {
  describe('constructor', () => {
    it('sets all provided fields', () => {
      const event = new IngestBodyOfKnowledge(
        'space-123',
        BodyOfKnowledgeType.ALKEMIO_SPACE,
        IngestionPurpose.KNOWLEDGE,
        'persona-456',
        SummarizationModel.MISTRAL_SMALL
      );

      expect(event.bodyOfKnowledgeId).toBe('space-123');
      expect(event.type).toBe(BodyOfKnowledgeType.ALKEMIO_SPACE);
      expect(event.purpose).toBe(IngestionPurpose.KNOWLEDGE);
      expect(event.personaId).toBe('persona-456');
      expect(event.summarizationModel).toBe(SummarizationModel.MISTRAL_SMALL);
    });

    it('defaults summarizationModel to MISTRAL_SMALL', () => {
      const event = new IngestBodyOfKnowledge(
        'kb-789',
        BodyOfKnowledgeType.ALKEMIO_KNOWLEDGE_BASE,
        IngestionPurpose.CONTEXT,
        'persona-001'
      );

      expect(event.summarizationModel).toBe(SummarizationModel.MISTRAL_SMALL);
    });

    it('fields are readonly', () => {
      const event = new IngestBodyOfKnowledge(
        'id',
        BodyOfKnowledgeType.ALKEMIO_SPACE,
        IngestionPurpose.KNOWLEDGE,
        'persona'
      );

      // TypeScript enforces readonly at compile time;
      // verify the properties exist and hold their values
      expect(event.bodyOfKnowledgeId).toBe('id');
      expect(event.personaId).toBe('persona');
    });
  });

  describe('enum values', () => {
    it('BodyOfKnowledgeType has expected values', () => {
      expect(BodyOfKnowledgeType.ALKEMIO_SPACE).toBe('alkemio-space');
      expect(BodyOfKnowledgeType.ALKEMIO_KNOWLEDGE_BASE).toBe(
        'alkemio-knowledge-base'
      );
    });

    it('IngestionPurpose has expected values', () => {
      expect(IngestionPurpose.KNOWLEDGE).toBe('knowledge');
      expect(IngestionPurpose.CONTEXT).toBe('context');
    });

    it('SummarizationModel has expected values', () => {
      expect(SummarizationModel.MISTRAL_SMALL).toBe('mistral-small');
    });
  });
});
