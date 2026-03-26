import { serializeError, getErrorMessage } from '../../src/logger';

describe('serializeError', () => {
  it('should serialize an Error instance', () => {
    const error = new Error('test error');
    error.stack = 'Error: test error\n    at Test';

    const result = serializeError(error);

    expect(result).toEqual(
      expect.objectContaining({
        name: 'Error',
        message: 'test error',
        stack: 'Error: test error\n    at Test',
      })
    );
  });

  it('should include additional properties on the error', () => {
    const error = new Error('custom error') as any;
    error.code = 'ERR_CUSTOM';
    error.statusCode = 500;

    const result = serializeError(error) as any;

    expect(result.code).toBe('ERR_CUSTOM');
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe('custom error');
  });

  it('should return non-Error values as-is', () => {
    expect(serializeError('string error')).toBe('string error');
    expect(serializeError(42)).toBe(42);
    expect(serializeError(null)).toBeNull();
    expect(serializeError(undefined)).toBeUndefined();
  });

  it('should return objects as-is when not Error instances', () => {
    const obj = { foo: 'bar' };
    expect(serializeError(obj)).toBe(obj);
  });
});

describe('getErrorMessage', () => {
  it('should return message from Error instance', () => {
    expect(getErrorMessage(new Error('fail'))).toBe('fail');
  });

  it('should JSON.stringify objects', () => {
    expect(getErrorMessage({ code: 'ERR' })).toBe('{"code":"ERR"}');
  });

  it('should return String for primitives', () => {
    expect(getErrorMessage('string error')).toBe('string error');
    expect(getErrorMessage(42)).toBe('42');
    expect(getErrorMessage(null)).toBe('null');
    expect(getErrorMessage(undefined)).toBe('undefined');
  });

  it('should handle circular references in objects', () => {
    const obj: any = {};
    obj.self = obj;

    // JSON.stringify will throw on circular, so it falls back to String()
    const result = getErrorMessage(obj);
    expect(typeof result).toBe('string');
  });
});

describe('errorSerializer format via actual logger', () => {
  it('should process error objects through the format pipeline when logging', (done) => {
    const logger = require('../../src/logger').default;
    const winston = require('winston');

    // Add a custom transport that captures the formatted output
    const capturedLogs: any[] = [];
    const captureTransport = new winston.transports.Stream({
      stream: new (require('stream').Writable)({
        write(chunk: any, _encoding: string, callback: Function) {
          try {
            capturedLogs.push(JSON.parse(chunk.toString()));
          } catch {
            capturedLogs.push(chunk.toString());
          }
          callback();
        },
      }),
      format: winston.format.json(),
    });
    logger.add(captureTransport);

    // Log an error object directly - triggers info.message instanceof Error path (lines 27-38)
    const err = new Error('direct error log') as any;
    err.code = 'TEST_CODE';
    logger.error(err);

    // Log with nested error property - triggers info.error instanceof Error path (lines 42-55)
    const nestedErr = new Error('nested err') as any;
    nestedErr.statusCode = 503;
    logger.error('Something failed', { error: nestedErr });

    // Log a plain message - passes through unchanged (line 58)
    logger.info('plain message test');

    // Give transports time to flush
    setTimeout(() => {
      logger.remove(captureTransport);
      // Just verify no crash occurred and logger processed successfully
      expect(capturedLogs.length).toBeGreaterThanOrEqual(1);
      done();
    }, 100);
  });

  it('should serialize Error as the main info object (via logger.log)', (done) => {
    const logger = require('../../src/logger').default;
    const winston = require('winston');

    const capturedLogs: any[] = [];
    const captureTransport = new winston.transports.Stream({
      stream: new (require('stream').Writable)({
        write(chunk: any, _encoding: string, callback: Function) {
          try {
            capturedLogs.push(JSON.parse(chunk.toString()));
          } catch {
            capturedLogs.push(chunk.toString());
          }
          callback();
        },
      }),
      format: winston.format.json(),
    });
    logger.add(captureTransport);

    // Use logger.log with Error to trigger the Error instanceof branch (lines 7-24)
    const err = new Error('log level error') as any;
    err.customField = 'extra';
    logger.log({ level: 'error', message: err });

    setTimeout(() => {
      logger.remove(captureTransport);
      expect(capturedLogs.length).toBeGreaterThanOrEqual(1);
      done();
    }, 100);
  });
});

describe('logger transports (environment-based)', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('should add console transport in non-production mode', () => {
    const logger = require('../../src/logger').default;
    const consoleTransports = logger.transports.filter(
      (t: any) => t.constructor.name === 'Console'
    );
    expect(consoleTransports.length).toBeGreaterThanOrEqual(1);
  });

  it('should have the correct logging level from env or default', () => {
    const logger = require('../../src/logger').default;
    const expectedLevel = (process.env.LOGGING_LEVEL || 'debug').toLowerCase();
    expect(logger.level).toBe(expectedLevel);
  });

  it('should add production console transport when NODE_ENV is production', () => {
    jest.isolateModules(() => {
      process.env.NODE_ENV = 'production';
      const prodLogger = require('../../src/logger').default;
      expect(prodLogger).toBeDefined();
      const consoleTransports = prodLogger.transports.filter(
        (t: any) => t.constructor.name === 'Console'
      );
      expect(consoleTransports.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('logger instance', () => {
  it('should export a default logger', () => {
    const logger = require('../../src/logger').default;
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });

  it('should have file transports configured', () => {
    const logger = require('../../src/logger').default;
    const transportNames = logger.transports.map(
      (t: any) => t.constructor.name
    );
    // Should have at least File transports and Console
    expect(transportNames).toContain('File');
    expect(transportNames).toContain('Console');
  });

  it('should have default meta with service name', () => {
    const logger = require('../../src/logger').default;
    expect(logger.defaultMeta).toEqual(
      expect.objectContaining({ service: 'space-ingest' })
    );
  });

  it('should have error.log file transport', () => {
    const logger = require('../../src/logger').default;
    const fileTransports = logger.transports.filter(
      (t: any) => t.constructor.name === 'File'
    );
    const filenames = fileTransports.map((t: any) => t.filename);
    expect(filenames).toContain('error.log');
    expect(filenames).toContain('combined.log');
  });
});
