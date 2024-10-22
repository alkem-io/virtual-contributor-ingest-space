import winston from 'winston';

const logger = winston.createLogger({
  level: (process.env.LOGGING_LEVEL || 'debug').toLowerCase(),
  // format: winston.format.json(),
  format: winston.format.combine(
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
      format: winston.format.simple(),
    })
  );
} else {
  logger.add(
    new winston.transports.Console({
      format: winston.format.json(),
    })
  );
}

export default logger;
