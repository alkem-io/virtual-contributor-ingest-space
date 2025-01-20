import generateDocument from '../generate.document';
import { Document } from 'langchain/document';
import { IngestBodyOfKnowledge } from '../event.bus/events/ingest.body.of.knowledge';
import { AlkemioCliClient } from '../graphql.client/AlkemioCliClient';
import logger from '../logger';
import { processCallouts } from '../process.callouts';
import { Callout } from '../generated/graphql';

export const embedKnowledgeBase = async (
  event: IngestBodyOfKnowledge,
  alkemioClient: AlkemioCliClient
) => {
  const knowledgeBaseId = event.bodyOfKnowledgeId;
  // make sure the service user has sufficient priviliges
  let knowledgeBase;
  try {
    knowledgeBase = await alkemioClient.ingestKnowledgeBase(knowledgeBaseId);
  } catch (error) {
    logger.error(error);
    throw new Error(
      `GraphQL connection failed while fetching knowledge base ${knowledgeBaseId}: ${error}`
    );
  }

  if (!knowledgeBase) {
    logger.error(`knowledgeBase ${knowledgeBaseId} not found.`);
    throw new Error(`knowledgeBase ${knowledgeBaseId} not found.`);
  }

  const documents: Document[] = []; //= await processknowledgeBaseTree(
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
