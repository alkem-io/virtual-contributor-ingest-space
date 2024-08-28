import { Document } from 'langchain/document';

import { CalloutVisibility, Callout, Space } from '../generated/graphql';

import logger from '../logger';
import generateDocument from '../generate.document';
import { handleCallout } from '../callout.handlers';
import { AlkemioCliClient } from '../graphql.client/AlkemioCliClient';
// recursive function
// first invocation is with [rootSpace]
// second invocation is with rootSpace.subspaces
// third is with the subspaces of each subspace and so on
export const processSpaceTree = async (
  spaces: Partial<Space>[],
  alkemioClient: AlkemioCliClient
) => {
  const documents: Document[] = [];
  for (let i = 0; i < spaces.length; i++) {
    const subspace = spaces[i];
    const { documentId, source, pageContent, type, title } =
      generateDocument(subspace);
    documents.push(
      new Document({
        pageContent,
        metadata: {
          documentId,
          source,
          type,
          title,
        },
      })
    );

    for (let j = 0; j < (subspace.collaboration?.callouts || []).length; j++) {
      const callout = (subspace.collaboration?.callouts || [])[j];
      if (callout && callout.visibility === CalloutVisibility.Published) {
        const document = await handleCallout(
          callout as Partial<Callout>,
          logger,
          alkemioClient
        );
        // empty doc - nothing to do here
        if (document) {
          documents.push(...document);
        }
      }
    }

    // incoke recursively for the subspaces of the rootSpace
    const subspacesDocs = await processSpaceTree(
      (subspace.subspaces || []) as Partial<Space>[],
      alkemioClient
    );
    documents.push(...subspacesDocs);
  }

  return documents;
};
