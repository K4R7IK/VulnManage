import { PrismaClient, Prisma } from "@prisma/client";
import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";
import fs from "fs";

// Ensure logs directory exists
const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configure Winston logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  ),
  defaultMeta: { service: "prisma" },
  transports: [
    // Write all logs to rotating files
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, "prisma-query-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
      level: "debug",
    }),
    // Write error logs to separate file
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, "prisma-error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "30d",
      level: "error",
    }),
  ],
});

// Add console logging in development mode
if (process.env.NODE_ENV === "development") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  );
}

// Define a type for the extended global object
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Custom event handler for logging queries
function createPrismaClient() {
  const prisma = new PrismaClient({
    log: [
      {
        emit: "event",
        level: "query",
      },
      {
        emit: "event",
        level: "error",
      },
      {
        emit: "event",
        level: "info",
      },
      {
        emit: "event",
        level: "warn",
      },
    ],
  });

  // Set up event listeners for all log types
  // @ts-ignore - Prisma types for events need to be ignored
  prisma.$on("query", (e: Prisma.QueryEvent) => {
    logger.debug("Query", {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  });

  // @ts-ignore
  prisma.$on("error", (e: Prisma.LogEvent) => {
    logger.error("Prisma Error", {
      message: e.message,
      target: e.target,
    });
  });

  // @ts-ignore
  prisma.$on("info", (e: Prisma.LogEvent) => {
    logger.info("Prisma Info", {
      message: e.message,
      target: e.target,
    });
  });

  // @ts-ignore
  prisma.$on("warn", (e: Prisma.LogEvent) => {
    logger.warn("Prisma Warning", {
      message: e.message,
      target: e.target,
    });
  });

  return prisma;
}

// Initialize client with singleton pattern
export const prisma = globalForPrisma.prisma || createPrismaClient();

// Save the instance to avoid multiple connections in development
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Helper function for explicit error logging
export function logPrismaError(operation: string, error: any) {
  logger.error(`Prisma Error in ${operation}`, {
    name: error.name,
    code: error.code,
    message: error.message,
    meta: error.meta,
    stack: error.stack,
  });
}
