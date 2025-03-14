import { Document } from 'langchain/document';
import { IngestBodyOfKnowledge } from '../event.bus/events/ingest.body.of.knowledge';
import { AlkemioCliClient } from '../graphql.client/AlkemioCliClient';
import { processCallouts } from '../process.callouts';
import { Callout } from '../generated/graphql';
import { generateDocument } from '../generate.document';

export const embedKnowledgeBase = async (
  event: IngestBodyOfKnowledge,
  alkemioClient: AlkemioCliClient
) => {
  const knowledgeBaseId = event.bodyOfKnowledgeId;
  // make sure the service user has sufficient priviliges
  const knowledgeBase = await alkemioClient.ingestKnowledgeBase(
    knowledgeBaseId
  );
  const documents: Document[] = [];
  const { documentId, source, pageContent, type, title } =
    generateDocument(knowledgeBase);

  documents.push(
    new Document({
      id: documentId,
      pageContent,
      metadata: {
        documentId,
        source,
        type,
        title,
      },
    })
  );

  const calloutDocs = await processCallouts(
    (knowledgeBase.calloutsSet?.callouts || []) as Partial<Callout>[],
    alkemioClient
  );
  documents.push(...calloutDocs);

  return { bodyOfKnowledge: knowledgeBase, documents };
};
