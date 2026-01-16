import winston from 'winston';
import { format } from 'logform';

// Custom format to properly serialize Error objects
const errorSerializer = format((info: any) => {
  // If the main log argument is an Error object
  if (info instanceof Error) {
    // Reconstruct the info object with error details
    const errorInfo: any = {
      level: (info as any).level || 'error',
      message: info.message,
      name: info.name,
      stack: info.stack,
    };

    // Copy over any other properties from the original info
    Object.keys(info).forEach(key => {
      if (!['message', 'name', 'stack', 'level'].includes(key)) {
        errorInfo[key] = (info as any)[key];
      }
    });

    return errorInfo;
  }

  // If info.message is an Error object (when logger.error(error) is called)
  if (info.message instanceof Error) {
    const error = info.message;
    info.message = error.message;
    info.errorName = error.name;
    info.stack = error.stack;

    // Copy any custom error properties
    Object.keys(error).forEach(key => {
      if (!['message', 'name', 'stack'].includes(key)) {
        info[key] = (error as any)[key];
      }
    });
  }

  // Handle nested error property
  if (info.error instanceof Error) {
    const error = info.error;
    info.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    // Copy any custom error properties
    Object.keys(error).forEach(key => {
      if (!['message', 'name', 'stack'].includes(key)) {
        info.error[key] = (error as any)[key];
      }
    });
  }

  return info;
});

const logger = winston.createLogger({
  level: (process.env.LOGGING_LEVEL || 'debug').toLowerCase(),
  // format: winston.format.json(),
  format: winston.format.combine(
    errorSerializer(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
  ),

  defaultMeta: { service: 'space-ingest' },
  transports: [
    //
    // - Write all logs with importance level of `error` or less to `error.log`
    // - Write all logs with importance level of `info` or less to `combined.log`
    //
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        errorSerializer(),
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
} else {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(errorSerializer(), winston.format.json()),
    })
  );
}

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
};

export const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error as any), // Include any additional properties
    };
  }
  return error;
};

export default logger;
