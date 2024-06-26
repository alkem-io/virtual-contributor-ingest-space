/* eslint-disable @typescript-eslint/no-explicit-any */
import { GraphQLClient } from 'graphql-request';
import { Sdk, getSdk } from '../generated/graphql';
import { Logger } from 'winston';
import {
  AlkemioClient,
  AlkemioClientConfig as BaseAlkemioClientConfig,
  createConfigUsingEnvVars,
} from '@alkemio/client-lib';
import logger from '../logger';

interface AlkemioClientConfig extends BaseAlkemioClientConfig {
  logger: Logger;
}

export class AlkemioCliClient {
  public config!: AlkemioClientConfig;
  public sdkClient!: Sdk;
  public alkemioLibClient!: AlkemioClient;
  public logger: Logger;
  public apiToken!: string;

  constructor(config?: AlkemioClientConfig) {
    if (!config) {
      config = createConfigUsingEnvVars();
    }

    if (!config) {
      throw new Error('Unable to find env vars config');
    }

    this.config = config;
    if (config.logger) {
      this.logger = config.logger;
    } else {
      this.logger = logger;
    }
    this.apiToken = 'Not set yet!';
    this.logger.info(`Alkemio server: ${config.apiEndpointPrivateGraphql}`);
  }

  async initialise() {
    try {
      this.alkemioLibClient = new AlkemioClient(this.config);
      await this.alkemioLibClient.enableAuthentication();
      this.apiToken = this.alkemioLibClient.apiToken;
      this.logger.info(`API token: ${this.apiToken}`);

      const client = new GraphQLClient(this.config.apiEndpointPrivateGraphql, {
        headers: {
          authorization: `Bearer ${this.apiToken}`,
        },
      });
      this.sdkClient = getSdk(client);
    } catch (error) {
      throw new Error(`Unable to create client for Alkemio endpoint: ${error}`);
    }
  }

  async logUser() {
    const userResponse = await this.sdkClient.me();
    this.logger.info(
      `Authenticated user: '${userResponse.data.me.user?.profile.displayName}'`
    );
  }

  async validateConnection() {
    return await this.alkemioLibClient.validateConnection();
  }

  public async ingestSpace(spaceID: string) {
    const result = await this.sdkClient.spaceIngest({ spaceID });

    return result.data.lookup.space;
  }

  public async document(documentID: string) {
    const result = await this.sdkClient.document({ documentID });

    return result.data.lookup.document;
  }
}
