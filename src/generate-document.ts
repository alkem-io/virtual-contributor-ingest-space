import { DocumentType } from './documents';

interface GeneratedDocument {
  id: string;
  source: string;
  document: string;
  type: DocumentType;
}

export default (docLike: any): GeneratedDocument => {
  const {
    id,
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

  let document = `Name: ${displayName}`;
  if (tagline) document = `${document}\nTagline: ${tagline}`;
  if (tagset?.tags.length)
    document = `${document}\nTags: ${tagset?.tags.join(', ')}`;
  if (description) document = `${document}\nDescription: ${description}`;
  if (impact) document = `${document}\nImpact: ${impact}`;
  if (vision) document = `${document}\nVision: ${vision}`;
  if (who) document = `${document}\nWho: ${who}`;

  const processedVisuals = visuals
    .map((visual: any) => `\t${visual.name}: ${visual.uri}`)
    .join('\n');
  if (processedVisuals) document = `${document}\nVisuals: ${processedVisuals}`;

  if (postalCode || city || country)
    document = `${document}\nLocation: ${postalCode} ${city} ${country}`;

  const processedRefs = references.map(
    ({ description, name, uri }: any) =>
      `\tReference name: ${name}\n\tReference description: ${description}\n\tUri: ${uri}\n`
  );
  if (processedRefs) document = `${document}\nReferences:\n${processedRefs}`;

  document = `${document}\nURL: ${source}`;
  return { id, source, type, document };
};
