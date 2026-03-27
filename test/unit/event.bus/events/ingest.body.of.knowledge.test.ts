import { describe, it, expect } from 'vitest';
import {
  IngestBodyOfKnowledge,
  BodyOfKnowledgeType,
  IngestionPurpose,
} from '../../../../src/event.bus/events/ingest.body.of.knowledge';

describe('IngestBodyOfKnowledge', () => {
  describe('constructor', () => {
    it('sets all provided fields', () => {
      const event = new IngestBodyOfKnowledge(
        'space-123',
        BodyOfKnowledgeType.ALKEMIO_SPACE,
        IngestionPurpose.KNOWLEDGE,
        'persona-456'
      );

      expect(event.bodyOfKnowledgeId).toBe('space-123');
      expect(event.type).toBe(BodyOfKnowledgeType.ALKEMIO_SPACE);
      expect(event.purpose).toBe(IngestionPurpose.KNOWLEDGE);
      expect(event.personaId).toBe('persona-456');
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
  });
});
