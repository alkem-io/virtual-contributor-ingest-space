import { Logger } from 'winston';
import { Callout, CalloutContribution } from '../generated/graphql';
import { Document } from 'langchain/document';
import generateDocument from '../generate.document';

export const baseHandler = async (
  callout: Partial<Callout>,
  logger: Logger
): Promise<Document[]> => {
  const { id: documentId, type } = callout;
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
  // extra loop but will do for now
  callout.contributions
    ?.map((contribution: Partial<CalloutContribution>) => {
      let docLike;
      if (!!contribution.link) {
        docLike = contribution.link;
      } else if (!!contribution.post) {
        docLike = contribution.post;
      }
      const { pageContent, documentId, source, type, title } =
        generateDocument(docLike);
      result.push(
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
    })
    .join('\n');

  logger.info(
    `Documents for Callout (${documentId}) generated. # of documents ${result.length}`
  );
  return result;
};
