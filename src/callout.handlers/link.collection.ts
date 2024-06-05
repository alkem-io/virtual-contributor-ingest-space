import fs from 'fs';
import https from 'https';
import http from 'http';
import { MimeType, AlkemioClient, Callout } from '@alkemio/client-lib';
import { Document } from 'langchain/document';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocumentType } from '../document.type';
import logger from '..//logger';

const downloadDocument = async (
  uri: string,
  path: string
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    let client;
    if (uri.startsWith('https')) {
      client = https;
    } else {
      client = http;
    }

    client
      .get(
        uri,
        {
          headers: {
            authorization: `Bearer ${process.env.TOKEN}`,
          },
        },
        res => {
          const { statusCode } = res;

          if (statusCode !== 200) {
            return reject(false);
          }
          // Image will be stored at this path
          const filePath = fs.createWriteStream(path);
          res.pipe(filePath);
          filePath.on('finish', () => {
            filePath.close();
            return resolve(true);
          });
        }
      )
      .on('error', error => {
        reject(error);
      });
  });
};

export const linkCollectionHandler = async (
  callout: Partial<Callout>,
  alkemioClient: AlkemioClient
): Promise<Document[]> => {
  if (!callout.contributions?.length) {
    return [];
  }
  const profile = callout.framing?.profile;

  if (!profile) {
    return [];
  }

  const documents: Document[] = [];
  for (let i = 0; i < callout.contributions.length; i++) {
    const link = callout.contributions[i].link;
    if (!link) {
      continue;
    }

    const [documentId] =
      link.uri.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      ) || [];

    if (!documentId) {
      continue;
    }

    const docInfo = await alkemioClient.document(documentId);

    if (!docInfo || docInfo.mimeType !== MimeType.Pdf) {
      continue;
    }

    const path = `/tmp/${documentId}`;

    let download;
    try {
      download = await downloadDocument(link.uri, path);
    } catch (error) {
      logger.error('Error downloading file:');
      logger.error(error);
      download = false;
    }

    if (download) {
      const loader = new PDFLoader(path, {
        splitPages: false,
      });

      try {
        const [doc] = await loader.load();

        if (doc) {
          doc.metadata = {
            documentId,
            source: link.uri,
            type: DocumentType.PdfFile,
            title: link.profile.displayName,
          };
          documents.push(doc);
        }
      } catch (error) {
        logger.error(`PDF file ${documentId} - ${link.uri} failed to load.`);
        logger.error(error);
      }
      fs.unlinkSync(path);
    }
  }
  return documents;
};
