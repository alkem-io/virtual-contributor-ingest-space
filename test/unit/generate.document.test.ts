/**
 * T012: Tests for src/generate.document.ts
 * - generateDocument with full entity, missing fields, HTML parsing, fallback
 */
import { describe, it, expect, vi } from 'vitest';
import * as nodeHtmlParser from 'node-html-parser';

vi.mock('../../src/generated/graphql', () => ({
  CalloutFramingType: {},
  MimeType: {},
  SpaceLevel: {
    L0: 'L0',
    L1: 'L1',
    L2: 'L2',
  },
}));

vi.mock('../../src/document.type', () => ({
  DocumentType: {
    KNOWLEDGE: 'KNOWLEDGE',
    SPACE: 'SPACE',
    SUBSPACE: 'SUBSPACE',
    CALLOUT: 'CALLOUT',
    PDF_FILE: 'PDF_FILE',
    SPREADSHEET: 'SPREADSHEET',
    DOCUMENT: 'DOCUMENT',
    LINK: 'LINK',
    MEMO: 'MEMO',
    NONE: 'NONE',
    WHITEBOARD: 'WHITEBOARD',
    COLLECTION: 'COLLECTION',
    POST: 'POST',
  },
  mapType: vi.fn((type: string) => type),
}));

import { generateDocument } from '../../src/generate.document';

describe('generateDocument', () => {
  describe('full entity', () => {
    it('should generate a complete document with all fields', () => {
      const entity = {
        id: 'entity-123',
        type: 'KNOWLEDGE',
        profile: {
          url: 'https://example.com/entity',
          description: '<p>This is <strong>bold</strong> content.</p>',
          tagline: 'A great entity',
          displayName: 'Test Entity',
          location: {
            city: 'Amsterdam',
            country: 'Netherlands',
            postalCode: '1012',
          },
          visuals: [],
          tagset: { tags: ['innovation', 'tech'] },
          references: [
            { description: 'A useful link', name: 'Ref1' },
            { description: 'Another link', name: 'Ref2' },
          ],
          who: 'Engineers and designers',
          why: 'To build better products',
        },
      };

      const result = generateDocument(entity);

      expect(result.documentId).toBe('entity-123');
      expect(result.source).toBe('https://example.com/entity');
      expect(result.title).toBe('Test Entity');
      expect(result.pageContent).toContain('Test Entity');
      expect(result.pageContent).toContain('A great entity');
      expect(result.pageContent).toContain('innovation, tech');
      expect(result.pageContent).toContain('bold');
      expect(result.pageContent).toContain('Why: To build better products');
      expect(result.pageContent).toContain('Who: Engineers and designers');
      expect(result.pageContent).toContain('Location: 1012, Amsterdam, Netherlands');
      expect(result.pageContent).toContain('- Ref1: A useful link');
      expect(result.pageContent).toContain('- Ref2: Another link');
      expect(result.pageContent).toContain('References:');
    });
  });

  describe('missing fields', () => {
    it('should handle missing tagline', () => {
      const entity = {
        id: 'entity-1',
        type: 'KNOWLEDGE',
        profile: {
          url: 'https://example.com',
          displayName: 'No Tagline',
          description: 'Simple desc',
        },
      };

      const result = generateDocument(entity);

      expect(result.pageContent).toContain('No Tagline');
      expect(result.pageContent).toContain('Simple desc');
    });

    it('should handle missing description', () => {
      const entity = {
        id: 'entity-2',
        type: 'KNOWLEDGE',
        profile: {
          url: 'https://example.com',
          displayName: 'No Description',
          tagline: 'Has tagline',
        },
      };

      const result = generateDocument(entity);

      expect(result.pageContent).toContain('No Description');
      expect(result.pageContent).toContain('Has tagline');
      // The em dash separates intro parts (displayName — tagline), so it IS present
      // But no body text from description should appear
      expect(result.pageContent).toBe('No Description \u2014 Has tagline');
    });

    it('should handle missing tags', () => {
      const entity = {
        id: 'entity-3',
        type: 'KNOWLEDGE',
        profile: {
          url: 'https://example.com',
          displayName: 'No Tags',
        },
      };

      const result = generateDocument(entity);

      expect(result.pageContent).toBe('No Tags');
    });

    it('should handle empty tags array', () => {
      const entity = {
        id: 'entity-3b',
        type: 'KNOWLEDGE',
        profile: {
          url: 'https://example.com',
          displayName: 'Empty Tags',
          tagset: { tags: [] },
        },
      };

      const result = generateDocument(entity);

      expect(result.pageContent).not.toContain('(');
    });

    it('should handle missing location', () => {
      const entity = {
        id: 'entity-4',
        type: 'KNOWLEDGE',
        profile: {
          url: 'https://example.com',
          displayName: 'No Location',
        },
      };

      const result = generateDocument(entity);

      expect(result.pageContent).not.toContain('Location:');
    });

    it('should handle partial location (only city)', () => {
      const entity = {
        id: 'entity-4b',
        type: 'KNOWLEDGE',
        profile: {
          url: 'https://example.com',
          displayName: 'Partial Location',
          location: {
            city: 'Berlin',
          },
        },
      };

      const result = generateDocument(entity);

      expect(result.pageContent).toContain('Location: Berlin');
      expect(result.pageContent).not.toContain('undefined');
    });

    it('should handle missing references', () => {
      const entity = {
        id: 'entity-5',
        type: 'KNOWLEDGE',
        profile: {
          url: 'https://example.com',
          displayName: 'No Refs',
        },
      };

      const result = generateDocument(entity);

      expect(result.pageContent).not.toContain('References:');
    });

    it('should filter out references without descriptions', () => {
      const entity = {
        id: 'entity-6',
        type: 'KNOWLEDGE',
        profile: {
          url: 'https://example.com',
          displayName: 'Filtered Refs',
          references: [
            { description: 'Good ref', name: 'Ref1' },
            { description: '', name: 'Empty' },
            { description: null, name: 'Null' },
            { description: 'Another good', name: 'Ref2' },
          ],
        },
      };

      const result = generateDocument(entity);

      expect(result.pageContent).toContain('- Ref1: Good ref');
      expect(result.pageContent).toContain('- Ref2: Another good');
      expect(result.pageContent).not.toContain('Empty');
      expect(result.pageContent).not.toContain('Null');
    });

    it('should handle missing who and why', () => {
      const entity = {
        id: 'entity-7',
        type: 'KNOWLEDGE',
        profile: {
          url: 'https://example.com',
          displayName: 'No Context',
        },
      };

      const result = generateDocument(entity);

      expect(result.pageContent).not.toContain('Who:');
      expect(result.pageContent).not.toContain('Why:');
    });
  });

  describe('HTML parsing', () => {
    it('should parse HTML description to structured text', () => {
      const entity = {
        id: 'html-1',
        type: 'KNOWLEDGE',
        profile: {
          url: 'https://example.com',
          displayName: 'HTML Test',
          description: '<h1>Title</h1><p>Paragraph with <em>emphasis</em>.</p><ul><li>Item 1</li><li>Item 2</li></ul>',
        },
      };

      const result = generateDocument(entity);

      // Should contain text without HTML tags
      expect(result.pageContent).toContain('Title');
      expect(result.pageContent).toContain('Paragraph');
      expect(result.pageContent).toContain('emphasis');
      expect(result.pageContent).not.toContain('<h1>');
      expect(result.pageContent).not.toContain('<p>');
      expect(result.pageContent).not.toContain('<em>');
    });

    it('should fall back to raw description on parse error', () => {
      // Force node-html-parser's parse to throw so the catch branch is exercised
      const parseSpy = vi.spyOn(nodeHtmlParser, 'parse').mockImplementationOnce(() => {
        throw new Error('Simulated parse failure');
      });

      const entity = {
        id: 'html-2',
        type: 'KNOWLEDGE',
        profile: {
          url: 'https://example.com',
          displayName: 'Fallback Test',
          description: 'Plain text description without HTML',
        },
      };

      const result = generateDocument(entity);

      // The raw description should be preserved despite the parse error
      expect(result.pageContent).toContain('Plain text description without HTML');
      expect(parseSpy).toHaveBeenCalled();

      parseSpy.mockRestore();
    });
  });

  describe('about.profile fallback', () => {
    it('should use about.profile when profile is not present', () => {
      const entity = {
        id: 'about-1',
        type: 'KNOWLEDGE',
        about: {
          profile: {
            url: 'https://about.example.com',
            displayName: 'About Profile',
            tagline: 'About tagline',
            description: 'About description',
          },
        },
      };

      const result = generateDocument(entity);

      expect(result.documentId).toBe('about-1');
      expect(result.source).toBe('https://about.example.com');
      expect(result.title).toBe('About Profile');
      expect(result.pageContent).toContain('About Profile');
      expect(result.pageContent).toContain('About tagline');
    });
  });

  describe('type mapping', () => {
    it('should use level when available', async () => {
      const { mapType } = await import('../../src/document.type');
      const entity = {
        id: 'type-1',
        type: 'CALLOUT',
        level: 'L0',
        profile: {
          url: 'https://example.com',
          displayName: 'Type Test',
        },
      };

      generateDocument(entity);

      expect(mapType).toHaveBeenCalledWith('L0');
    });

    it('should fall back to type when level is not available', async () => {
      const { mapType } = await import('../../src/document.type');
      const entity = {
        id: 'type-2',
        type: 'CALLOUT',
        profile: {
          url: 'https://example.com',
          displayName: 'Type Test 2',
        },
      };

      generateDocument(entity);

      expect(mapType).toHaveBeenCalledWith('CALLOUT');
    });

    it('should fall back to profileType when both level and type are missing', async () => {
      const { mapType } = await import('../../src/document.type');
      const entity = {
        id: 'type-3',
        profile: {
          url: 'https://example.com',
          displayName: 'Profile Type',
          type: 'MEMO',
        },
      };

      generateDocument(entity);

      expect(mapType).toHaveBeenCalledWith('MEMO');
    });
  });

  describe('pageContent structure', () => {
    it('should join intro parts with dashes', () => {
      const entity = {
        id: 'struct-1',
        type: 'KNOWLEDGE',
        profile: {
          url: 'https://example.com',
          displayName: 'Name',
          tagline: 'Tagline',
          tagset: { tags: ['tag1', 'tag2'] },
        },
      };

      const result = generateDocument(entity);

      // Format: "Name — Tagline — (tag1, tag2)"
      expect(result.pageContent).toMatch(/Name\s+\u2014\s+Tagline\s+\u2014\s+\(tag1, tag2\)/);
    });

    it('should separate body from intro with em dash', () => {
      const entity = {
        id: 'struct-2',
        type: 'KNOWLEDGE',
        profile: {
          url: 'https://example.com',
          displayName: 'Name',
          description: '<p>Body text</p>',
        },
      };

      const result = generateDocument(entity);

      // Intro connected to body: "Name — Body text"
      expect(result.pageContent).toContain('Name \u2014 Body text');
    });

    it('should separate context section with double newline', () => {
      const entity = {
        id: 'struct-3',
        type: 'KNOWLEDGE',
        profile: {
          url: 'https://example.com',
          displayName: 'Name',
          why: 'Purpose',
        },
      };

      const result = generateDocument(entity);

      expect(result.pageContent).toContain('\n\nWhy: Purpose');
    });

    it('should separate references section with double newline', () => {
      const entity = {
        id: 'struct-4',
        type: 'KNOWLEDGE',
        profile: {
          url: 'https://example.com',
          displayName: 'Name',
          references: [{ description: 'A ref', name: 'R1' }],
        },
      };

      const result = generateDocument(entity);

      expect(result.pageContent).toContain('\n\nReferences:\n- R1: A ref');
    });
  });
});
