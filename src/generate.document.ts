import { DocumentType } from './document.type';

interface GeneratedDocument {
  documentId: string;
  source: string;
  pageContent: string;
  type: DocumentType;
  title: string;
}

export default (docLike: any): GeneratedDocument => {
  const {
    id: documentId,
    type,
    profile: {
      references,
      tagset,
      url: source,
      description,
      tagline,
      displayName,
      location,
      visuals,
    },
    context,
  } = docLike;
  const { vision, impact, who } = context || {};
  const { city, country, postalCode } = location || {};

  let pageContent = `Name: ${displayName}`;
  if (tagline) pageContent = `${pageContent}\nTagline: ${tagline}`;
  if (tagset?.tags.length)
    pageContent = `${pageContent}\nTags: ${tagset?.tags.join(', ')}`;
  if (description) pageContent = `${pageContent}\nDescription: ${description}`;
  if (impact) pageContent = `${pageContent}\nImpact: ${impact}`;
  if (vision) pageContent = `${pageContent}\nVision: ${vision}`;
  if (who) pageContent = `${pageContent}\nWho: ${who}`;

  const processedVisuals = visuals
    .map((visual: any) => `\t${visual.name}: ${visual.uri}`)
    .join('\n');
  if (processedVisuals)
    pageContent = `${pageContent}\nVisuals: ${processedVisuals}`;

  if (postalCode || city || country)
    pageContent = `${pageContent}\nLocation: ${postalCode} ${city} ${country}`;

  const processedRefs = references.map(
    ({ description, name, uri }: any) =>
      `\tReference name: ${name}\n\tReference description: ${description}\n\tUri: ${uri}\n`
  );
  if (processedRefs)
    pageContent = `${pageContent}\nReferences:\n${processedRefs}`;

  pageContent = `${pageContent}\nURL: ${source}`;
  return { documentId, source, type, pageContent, title: displayName };
};