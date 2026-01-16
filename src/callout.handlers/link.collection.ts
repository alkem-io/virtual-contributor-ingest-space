import fs from 'fs';
import https from 'https';
import http from 'http';
import { Logger } from 'winston';
import { MimeType, Callout } from '../generated/graphql';
import { Document } from '@langchain/core/documents';
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { MimeTypeDocumentMap } from '../document.type';
import { SpreadSheetLoader, DocLoader } from '../loaders';
import { AlkemioCliClient } from 'src/graphql.client/AlkemioCliClient';
import { serializeError } from '../logger';

const downloadDocument = async (
  uri: string,
  path: string,
  apiToken: string
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
            authorization: `Bearer ${apiToken}`,
          },
        },
        res => {
          const { statusCode } = res;
          // file will be stored at this path
          const filePath = fs.createWriteStream(path);
          res.pipe(filePath);
          filePath.on('finish', () => {
            filePath.close();
            if (statusCode !== 200) {
              // reject here so the result of the request is stored on the filesystem
              // for easier debugging
              return reject(res);
            }

            return resolve(true);
          });
        }
      )
      .on('error', error => {
        reject(error);
      });
  });
};

const fileLoaderFactories: {
  [key in MimeType]?: (
    path: string
  ) => BaseDocumentLoader | PDFLoader | DocxLoader;
} = {
  [MimeType.Pdf]: (path: string) => new PDFLoader(path, { splitPages: false }),

  [MimeType.Ods]: (path: string) => new SpreadSheetLoader(path),
  [MimeType.Xlsx]: (path: string) => new SpreadSheetLoader(path),
  [MimeType.Xls]: (path: string) => new SpreadSheetLoader(path),

  [MimeType.Odt]: (path: string) => new DocLoader(path),
  [MimeType.Docx]: (path: string) => new DocxLoader(path),

  // skip old MS Word .doc format as it's too hard to parse :(
  // [MimeType.Doc]: (path: string) => new DocLoader(path),
};

export const linkCollectionHandler = async (
  callout: Partial<Callout>,
  logger: Logger,
  alkemioClient: AlkemioCliClient | null
): Promise<Document[]> => {
  if (!callout.contributions?.length || !alkemioClient) {
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

    let docInfo;
    try {
      docInfo = await alkemioClient.document(documentId);
      if (!docInfo) {
        continue;
      }
    } catch (error) {
      logger.error(error);
      continue;
    }

    const loaderFactory = fileLoaderFactories[docInfo.mimeType];

    if (!loaderFactory) {
      continue;
    }

    const path = `/tmp/${documentId}`;

    let download;

    try {
      download = await downloadDocument(link.uri, path, alkemioClient.apiToken);
    } catch (error) {
      logger.error({
        error: serializeError(error),
        message: 'Error downloading file',
        documentId,
        uri: link.uri,
      });
      download = false;
    }

    if (download) {
      const loader = loaderFactory(path);

      try {
        const docs = await loader.load();

        for (let index = 0; index < docs.length; index++) {
          const doc = docs[index];
          doc.metadata = {
            ...doc.metadata,
            documentId: `${documentId}-page${index}`,
            source: link.uri,
            type: MimeTypeDocumentMap[docInfo.mimeType],
            title: link.profile.displayName,
          };
          documents.push(doc);
        }
      } catch (error) {
        logger.error({
          error: serializeError(error),
          message: 'File failed to load',
          mimeType: docInfo.mimeType,
          file: documentId,
          uri: link.uri,
        });
      }
      fs.unlinkSync(path);
    }
  }
  return documents;
};
