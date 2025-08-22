import { Logger } from 'winston';
import { Callout } from '../generated/graphql';
import { Document } from 'langchain/document';
import { generateDocument } from '../generate.document';

export const baseHandler = async (
  callout: Partial<Callout>,
  logger: Logger
): Promise<Document[]> => {
  const { id: documentId, framing } = callout;
  const type = framing?.type;
  logger.info(
    `Generating document for Callout (${documentId}) of type ${type}`
  );

  const generated = generateDocument(callout.framing);
  const { title, source } = generated;
  let pageContent = generated.pageContent;

  const messages = callout.comments?.messages || [];
  const processedMessages: string[] = [];
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (!message.sender) {
      continue;
    }

    const {
      profile: { displayName: senderName, url: senderUrl },
    } = message.sender;
    const postedOn = new Date(message.timestamp).toLocaleString('en-US');
    processedMessages.push(
      `\t${senderName} with profile link ${senderUrl} said '${message.message}' on ${postedOn}`
    );
  }

  if (processedMessages.length)
    pageContent = `${pageContent}\nMessages:\n${processedMessages.join('\n')}`;

  const result: Document[] = [
    new Document({
      id: documentId,
      pageContent,
      metadata: {
        documentId,
        source,
        type,
        title,
      },
    }),
  ];

  logger.info(`Generating documents for Callout (${documentId}) contributions`);

  for (const contribution of callout.contributions || []) {
    let docLike;
    if (contribution.link) {
      docLike = contribution.link;
    } else if (contribution.post) {
      docLike = contribution.post;
    }

    if (docLike) {
      const { pageContent, documentId, source, type, title } =
        generateDocument(docLike);
      result.push(
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
    }
  }
  logger.info(
    `Documents for Callout (${documentId}) generated. # of documents ${result.length}`
  );
  return result;
};
