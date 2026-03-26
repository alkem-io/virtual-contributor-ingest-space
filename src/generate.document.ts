import { Reference } from './generated/graphql';
import { DocumentType, mapType } from './document.type';
import { parse } from 'node-html-parser';

interface GeneratedDocument {
  documentId: string;
  source: string;
  pageContent: string;
  type: DocumentType;
  title: string;
}

//TODO type this pls
export const generateDocument = (docLike: any): GeneratedDocument => {
  const { id: documentId, type, level } = docLike;

  const {
    references,
    tagset,
    url: source,
    description,
    tagline,
    displayName,
    location,
    type: profileType,
    who,
    why,
  } = docLike.profile || docLike.about.profile || {};

  // const { vision, impact, who } = context || {};

  const { city, country, postalCode } = location || {};

  // Section 1: Dense intro line — name, tagline, tags (stays with first chunk)
  const introParts = [displayName];
  if (tagline) introParts.push(tagline);
  if (tagset?.tags.length) introParts.push(`(${tagset.tags.join(', ')})`);
  const intro = introParts.join(' — ');

  // Section 2: Main content — description body (bulk of the document)
  let body = '';
  if (description) {
    try {
      const descriptionRoot = parse(description);
      body = descriptionRoot.structuredText.trim();
    } catch (error) {
      console.error('Error parsing HTML description:', error);
      body = description.trim();
    }
  }

  // Section 3: Context fields — grouped together
  const contextParts: string[] = [];
  if (why) contextParts.push(`Why: ${why}`);
  if (who) contextParts.push(`Who: ${who}`);
  if (postalCode || city || country)
    contextParts.push(
      `Location: ${[postalCode, city, country].filter(Boolean).join(', ')}`
    );

  // Section 4: References — only those with descriptions (skip empty ones)
  const refParts = (references || [])
    .filter(({ description }: Reference) => description)
    .map(({ description, name }: Reference) => `- ${name}: ${description}`);

  // Assemble: intro joined to body without a newline so the splitter keeps them together.
  // Context and references separated by double newline as natural split points.
  let pageContent = intro;
  if (body) pageContent = `${pageContent} — ${body}`;
  if (contextParts.length)
    pageContent = `${pageContent}\n\n${contextParts.join('\n')}`;
  if (refParts.length)
    pageContent = `${pageContent}\n\nReferences:\n${refParts.join('\n')}`;

  return {
    documentId,
    source,
    type: mapType(level ?? type ?? profileType),
    pageContent,
    title: displayName,
  };
};
