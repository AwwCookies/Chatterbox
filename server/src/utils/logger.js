import winston from 'winston';
import Transport from 'winston-transport';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom transport to store logs in memory for API access
class MemoryTransport extends Transport {
  constructor(opts) {
    super(opts);
    this.logService = null;
  }

  setLogService(service) {
    this.logService = service;
  }

  log(info, callback) {
    setImmediate(() => {
      if (this.logService) {
        const { level, message, timestamp, stack, ...meta } = info;
        this.logService.addLog(level, message, { ...meta, stack });
      }
    });
    callback();
  }
}

// Create memory transport instance
const memoryTransport = new MemoryTransport();

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }
  if (stack) {
    log += `\n${stack}`;
  }
  return log;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
    memoryTransport,
  ],
});

// Function to initialize logger with log service (called after service is imported)
export const initializeLogService = (logService) => {
  memoryTransport.setLogService(logService);
};

export default logger;
