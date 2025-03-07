import { Reference, Visual } from './generated/graphql';
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
  const { id: documentId, type } = docLike;

  const {
    references,
    tagset,
    url: source,
    description,
    tagline,
    displayName,
    location,
    visuals,
    type: profileType,
    who,
    why,
  } = docLike.profile || docLike.about.profile || {};

  // const { vision, impact, who } = context || {};

  const { city, country, postalCode } = location || {};

  let pageContent = `Name: ${displayName}`;
  if (tagline) pageContent = `${pageContent}\nTagline: ${tagline}`;
  if (tagset?.tags.length)
    pageContent = `${pageContent}\nTags: ${tagset?.tags.join(', ')}`;
  if (description) {
    const descriptionRoot = parse(description);
    pageContent = `${pageContent}\nDescription: ${descriptionRoot.structuredText}`;
  }
  if (why) pageContent = `${pageContent}\nWhy: ${why}`;
  if (who) pageContent = `${pageContent}\nWho: ${who}`;

  let processedVisuals = '';
  (visuals || []).forEach((visual: Visual) => {
    if (visual.uri) {
      processedVisuals += `\t${visual.name}: ${visual.uri}`;
    }
  });

  if (processedVisuals)
    pageContent = `${pageContent}\nVisuals:\n${processedVisuals}`;

  if (postalCode || city || country)
    pageContent = `${pageContent}\nLocation: ${postalCode} ${city} ${country}`;

  const processedRefs = (references || [])
    .map(
      ({ description, name, uri }: Reference) =>
        `\tReference name: ${name}\n\tReference description: ${description}\n\tUri: ${uri}\n`
    )
    .join('\n');
  if (processedRefs)
    pageContent = `${pageContent}\nReferences:\n${processedRefs}`;

  pageContent = `${pageContent}\nURL: ${source}`;
  console.log(pageContent);
  return {
    documentId,
    source,
    type: mapType(type ?? profileType),
    pageContent,
    title: displayName,
  };
};
