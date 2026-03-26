jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../src/generated/graphql', () => ({
  getSdk: jest.fn().mockReturnValue({
    me: jest.fn(),
    spaceIngest: jest.fn(),
    knowledgeBaseIngest: jest.fn(),
    document: jest.fn(),
  }),
  // Re-export enums needed by other imports
  CalloutContributionType: {
    Link: 'LINK',
    Post: 'POST',
    Whiteboard: 'WHITEBOARD',
    Memo: 'MEMO',
  },
  CalloutVisibility: {
    Draft: 'DRAFT',
    Published: 'PUBLISHED',
  },
  MimeType: {},
  SpaceLevel: { L0: 'L0', L1: 'L1', L2: 'L2' },
  CalloutFramingType: {},
}));

jest.mock('@alkemio/client-lib', () => ({
  AlkemioClient: jest.fn().mockImplementation(() => ({
    enableAuthentication: jest.fn().mockResolvedValue(undefined),
    apiToken: 'mock-api-token',
  })),
  createConfigUsingEnvVars: jest.fn().mockReturnValue({
    apiEndpointPrivateGraphql: 'http://localhost/graphql',
  }),
}));

jest.mock('../../../src/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { AlkemioCliClient } from '../../../src/graphql.client/AlkemioCliClient';
import { AlkemioClient, createConfigUsingEnvVars } from '@alkemio/client-lib';
import { GraphQLClient } from 'graphql-request';
import { getSdk } from '../../../src/generated/graphql';

describe('AlkemioCliClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with provided config', () => {
      const config = {
        apiEndpointPrivateGraphql: 'http://test/graphql',
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } as any,
      };

      const client = new AlkemioCliClient(config as any);

      expect(client.config).toBe(config);
      expect(client.apiToken).toBe('Not set yet!');
      expect(client.logger).toBe(config.logger);
    });

    it('should use createConfigUsingEnvVars when no config provided', () => {
      const client = new AlkemioCliClient();

      expect(createConfigUsingEnvVars).toHaveBeenCalled();
      expect(client.config.apiEndpointPrivateGraphql).toBe('http://localhost/graphql');
    });

    it('should throw when no config and env vars return nothing', () => {
      (createConfigUsingEnvVars as jest.Mock).mockReturnValueOnce(undefined);

      expect(() => new AlkemioCliClient()).toThrow('Unable to find env vars config');
    });

    it('should use default logger when config has no logger', () => {
      const config = {
        apiEndpointPrivateGraphql: 'http://test/graphql',
      };

      const client = new AlkemioCliClient(config as any);

      // Should use the module-level logger
      expect(client.logger).toBeDefined();
    });
  });

  describe('initialise', () => {
    it('should set up AlkemioClient and SDK', async () => {
      const client = new AlkemioCliClient();
      await client.initialise();

      expect(AlkemioClient).toHaveBeenCalledWith(client.config);
      expect(client.apiToken).toBe('mock-api-token');
      expect(GraphQLClient).toHaveBeenCalledWith('http://localhost/graphql', {
        headers: { authorization: 'Bearer mock-api-token' },
      });
      expect(getSdk).toHaveBeenCalled();
      expect(client.sdkClient).toBeDefined();
    });

    it('should throw when AlkemioClient creation fails', async () => {
      (AlkemioClient as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Auth failure');
      });

      const client = new AlkemioCliClient();

      await expect(client.initialise()).rejects.toThrow(
        'Unable to create client for Alkemio endpoint'
      );
    });
  });

  describe('logUser', () => {
    it('should log the authenticated user display name', async () => {
      const client = new AlkemioCliClient();
      await client.initialise();

      const mockMe = (client.sdkClient.me as jest.Mock);
      mockMe.mockResolvedValue({
        data: {
          me: {
            user: {
              profile: {
                displayName: 'Test User',
              },
            },
          },
        },
      });

      await client.logUser();

      expect(client.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Test User')
      );
    });

    it('should handle missing user profile with optional chaining', async () => {
      const client = new AlkemioCliClient();
      await client.initialise();

      const mockMe = (client.sdkClient.me as jest.Mock);
      mockMe.mockResolvedValue({
        data: {
          me: {
            user: null,
          },
        },
      });

      // Should not throw due to optional chaining
      await expect(client.logUser()).resolves.not.toThrow();
      expect(client.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('undefined')
      );
    });

    it('should handle missing profile on user', async () => {
      const client = new AlkemioCliClient();
      await client.initialise();

      const mockMe = (client.sdkClient.me as jest.Mock);
      mockMe.mockResolvedValue({
        data: {
          me: {
            user: { profile: null },
          },
        },
      });

      await expect(client.logUser()).resolves.not.toThrow();
    });
  });

  describe('ingestSpace', () => {
    it('should call spaceIngest and return space data', async () => {
      const client = new AlkemioCliClient();
      await client.initialise();

      const mockSpace = { id: 'space-1', name: 'Test Space' };
      (client.sdkClient.spaceIngest as jest.Mock).mockResolvedValue({
        data: { lookup: { space: mockSpace } },
      });

      const result = await client.ingestSpace('space-1');

      expect(client.sdkClient.spaceIngest).toHaveBeenCalledWith({
        spaceID: 'space-1',
      });
      expect(result).toBe(mockSpace);
    });
  });

  describe('ingestKnowledgeBase', () => {
    it('should call knowledgeBaseIngest and return data', async () => {
      const client = new AlkemioCliClient();
      await client.initialise();

      const mockKB = { id: 'kb-1', name: 'Test KB' };
      (client.sdkClient.knowledgeBaseIngest as jest.Mock).mockResolvedValue({
        data: { lookup: { knowledgeBase: mockKB } },
      });

      const result = await client.ingestKnowledgeBase('kb-1');

      expect(client.sdkClient.knowledgeBaseIngest).toHaveBeenCalledWith({
        knowledgeBaseID: 'kb-1',
      });
      expect(result).toBe(mockKB);
    });
  });

  describe('document', () => {
    it('should call document and return data', async () => {
      const client = new AlkemioCliClient();
      await client.initialise();

      const mockDoc = { id: 'doc-1', mimeType: 'PDF' };
      (client.sdkClient.document as jest.Mock).mockResolvedValue({
        data: { lookup: { document: mockDoc } },
      });

      const result = await client.document('doc-1');

      expect(client.sdkClient.document).toHaveBeenCalledWith({
        documentID: 'doc-1',
      });
      expect(result).toBe(mockDoc);
    });
  });
});
