import amqlib, { Connection as AmqlibConnection, Channel } from 'amqplib';
import logger from '../logger';
import { IngestBodyOfKnowledge } from './events/ingest.body.of.knowledge';
import { IngestBodyOfKnowledgeResult } from './events/ingest.body.of.knowledge.result';

type ConsumeCallback = (event: IngestBodyOfKnowledge) => void | Promise<void>;

type ConnectionConfig = {
  host: string;
  user: string;
  password: string;
  port: string;
  incomingQueue: string;
  outgoingQueue: string;
  exchange: string;
};

export class Connection {
  connection!: AmqlibConnection;
  channel!: Channel;
  private connected!: boolean;
  private config!: ConnectionConfig;

  static #instance: Connection;

  static async get() {
    if (!this.#instance) {
      this.#instance = new Connection();
      await this.#instance.connect();
    }

    return this.#instance;
  }

  private getEnvValue(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`${key} is empty in environment.`);
    }

    return value;
  }

  private loadConfigFromEnv() {
    this.config = {
      host: this.getEnvValue('RABBITMQ_HOST'),
      user: this.getEnvValue('RABBITMQ_USER'),
      password: this.getEnvValue('RABBITMQ_PASSWORD'),
      port: this.getEnvValue('RABBITMQ_PORT'),
      incomingQueue: this.getEnvValue(
        'RABBITMQ_INGEST_BODY_OF_KNOWLEDGE_QUEUE'
      ),
      outgoingQueue: this.getEnvValue(
        'RABBITMQ_INGEST_BODY_OF_KNOWLEDGE_RESULT_QUEUE'
      ),
      exchange: this.getEnvValue('RABBITMQ_EVENT_BUS_EXCHANGE'),
    };
  }

  async connect() {
    if (this.connected && this.channel) {
      return;
    }

    try {
      this.loadConfigFromEnv();

      logger.info('Connecting to RabbitMQ Server');

      const connectionString = `amqp://${this.config.user}:${this.config.password}@${this.config.host}:${this.config.port}`;

      this.connection = await amqlib.connect(connectionString);

      logger.info('Rabbit MQ Connection is ready.');

      this.channel = await this.connection.createChannel();

      // important! handle message in a sequemce instead of paralell; for some reason
      // _spamming_ the queue with messages results in all sorts of random exceptions;
      //
      // being able to bomb the queue with messages is important for a collection name migration
      // we need to do
      this.channel.prefetch(1);

      await this.channel.assertQueue(this.config.incomingQueue, {
        durable: true,
      });
      await this.channel.assertQueue(this.config.outgoingQueue, {
        durable: true,
      });
      await this.channel.assertExchange(this.config.exchange, 'direct');

      // just one outgoing event for now; if we introduce more we can rework this to dinamically
      // bind event to queues
      await this.channel.bindQueue(
        this.config.outgoingQueue,
        this.config.exchange,
        'IngestSpaceResult'
      );

      logger.info('RabbitMQ initialised successfully');
      this.connected = true;
    } catch (error) {
      logger.error(error);
      logger.error('Not connected to MQ Server');
    }
  }

  async send(message: IngestBodyOfKnowledgeResult) {
    try {
      if (!this.channel) {
        await this.connect();
      }

      this.channel.sendToQueue(
        this.config.outgoingQueue,
        Buffer.from(JSON.stringify(message))
      );
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  async consume(handler: ConsumeCallback) {
    this.channel.consume(
      this.config.incomingQueue,
      msg => {
        {
          if (!msg) {
            return logger.error('Invalid incoming message');
          }
          try {
            const { bodyOfKnowledgeId, type, purpose, personaServiceId } =
              JSON.parse(JSON.parse(msg.content.toString()));
            const event = new IngestBodyOfKnowledge(
              bodyOfKnowledgeId,
              type,
              purpose,
              personaServiceId
            );
            handler(event);
          } catch (error) {
            logger.error(error);
          }
        }
      },
      {
        noAck: true,
      }
    );
  }
}
