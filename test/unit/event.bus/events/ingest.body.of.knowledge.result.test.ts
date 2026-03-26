import {
  IngestBodyOfKnowledgeResult,
  IngestionResult,
  ErrorCode,
} from '../../../../src/event.bus/events/ingest.body.of.knowledge.result';
import {
  BodyOfKnowledgeType,
  IngestionPurpose,
} from '../../../../src/event.bus/events/ingest.body.of.knowledge';

describe('IngestBodyOfKnowledgeResult', () => {
  describe('constructor', () => {
    it('sets all provided fields', () => {
      const ts = Date.now();
      const result = new IngestBodyOfKnowledgeResult(
        'bok-1',
        BodyOfKnowledgeType.ALKEMIO_SPACE,
        IngestionPurpose.KNOWLEDGE,
        'persona-1',
        ts,
        IngestionResult.FAILURE,
        { code: ErrorCode.VECTOR_INSERT, message: 'fail' }
      );

      expect(result.bodyOfKnowledgeId).toBe('bok-1');
      expect(result.type).toBe(BodyOfKnowledgeType.ALKEMIO_SPACE);
      expect(result.purpose).toBe(IngestionPurpose.KNOWLEDGE);
      expect(result.personaId).toBe('persona-1');
      expect(result.timestamp).toBe(ts);
      expect(result.result).toBe(IngestionResult.FAILURE);
      expect(result.error).toEqual({
        code: ErrorCode.VECTOR_INSERT,
        message: 'fail',
      });
    });

    it('defaults result to SUCCESS', () => {
      const result = new IngestBodyOfKnowledgeResult(
        'bok-2',
        BodyOfKnowledgeType.ALKEMIO_KNOWLEDGE_BASE,
        IngestionPurpose.CONTEXT,
        'persona-2'
      );

      expect(result.result).toBe(IngestionResult.SUCCESS);
    });

    it('defaults error to undefined', () => {
      const result = new IngestBodyOfKnowledgeResult(
        'bok-3',
        BodyOfKnowledgeType.ALKEMIO_SPACE,
        IngestionPurpose.KNOWLEDGE,
        'persona-3'
      );

      expect(result.error).toBeUndefined();
    });

    it('defaults timestamp to a UTC-based number', () => {
      const before = Date.now();
      const result = new IngestBodyOfKnowledgeResult(
        'bok-4',
        BodyOfKnowledgeType.ALKEMIO_SPACE,
        IngestionPurpose.KNOWLEDGE,
        'persona-4'
      );
      const after = Date.now();

      expect(typeof result.timestamp).toBe('number');
      // The UTC conversion via toLocaleString can shift by the local timezone offset,
      // so allow tolerance equal to the max timezone offset (14 hours = 50400s)
      expect(result.timestamp).toBeGreaterThan(before - 50400000);
      expect(result.timestamp).toBeLessThan(after + 50400000);
    });

    it('allows mutable result and error fields', () => {
      const result = new IngestBodyOfKnowledgeResult(
        'bok-5',
        BodyOfKnowledgeType.ALKEMIO_SPACE,
        IngestionPurpose.KNOWLEDGE,
        'persona-5'
      );

      result.result = IngestionResult.FAILURE;
      result.error = { message: 'updated' };
      result.timestamp = 12345;

      expect(result.result).toBe(IngestionResult.FAILURE);
      expect(result.error).toEqual({ message: 'updated' });
      expect(result.timestamp).toBe(12345);
    });
  });

  describe('enum values', () => {
    it('IngestionResult has expected values', () => {
      expect(IngestionResult.SUCCESS).toBe('success');
      expect(IngestionResult.FAILURE).toBe('failure');
    });

    it('ErrorCode has expected values', () => {
      expect(ErrorCode.VECTOR_INSERT).toBe('vector_insert');
    });

    it('IngestionResult only contains known members', () => {
      const values = Object.values(IngestionResult);
      expect(values).toEqual(['success', 'failure']);
    });

    it('ErrorCode only contains known members', () => {
      const values = Object.values(ErrorCode);
      expect(values).toEqual(['vector_insert']);
    });
  });
});
