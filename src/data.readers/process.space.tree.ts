import { Document } from 'langchain/document';

import { Space } from '../generated/graphql';

import { generateDocument } from '../generate.document';
import { AlkemioCliClient } from '../graphql.client/AlkemioCliClient';
import { processCallouts } from '../process.callouts';

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
      subspace.collaboration?.calloutsSet?.callouts || [],
      alkemioClient
    );
    documents.push(...calloutDocs);

    // incoke recursively for the subspaces of the rootSpace
    const subspacesDocs = await processSpaceTree(
      (subspace.subspaces || []) as Partial<Space>[],
      alkemioClient
    );
    documents.push(...subspacesDocs);
  }

  return documents;
};
