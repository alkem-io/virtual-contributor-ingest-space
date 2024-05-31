import { Callout } from '@alkemio/client-lib';
import { Document } from 'langchain/document';
import generateDocument from '../generate.document';

export const baseHandler = async (
  callout: Partial<Callout>
): Promise<Document[]> => {
  const { id: documentId, type } = callout;
  const generated = generateDocument(callout.framing);
  const { title, source } = generated;
  let pageContent = generated.pageContent;

  // extra loop but will do for now
  const contributions = callout.contributions
    ?.filter((article: any) => !!article.link)
    .map((contribution: any) => {
      const { pageContent: contribArticle } = generateDocument(
        contribution.link
      );
      return contribArticle;
    })
    .join('\n');

  if (contributions)
    pageContent = `${pageContent}\nContributions:\n${contributions}`;

  const messages = callout.comments?.messages || [];
  const processedMessages = messages
    .map((message: any) => {
      const {
        profile: { displayName: senderName, url: senderUrl },
      } = message.sender!;
      const postedOn = new Date(message.timestamp).toLocaleString('en-US');
      return `\t${senderName} with profile link ${senderUrl} said '${message.message}' on ${postedOn}`;
    })
    .join('\n');

  if (processedMessages)
    pageContent = `${pageContent}\nMessages:\n${processedMessages}`;

  return [
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
};
