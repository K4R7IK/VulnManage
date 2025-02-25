import { PrismaClient } from "@prisma/client";

declare global {
  let prisma: ExtendedPrismaClient | undefined;
}

type ExtendedPrismaClient = ReturnType<typeof getPrismaClient>;

function getPrismaClient() {
  const client = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    transactionOptions: {
      maxWait: 10000,
      timeout: 120000,
    },
  });
  return client;
}

const prisma = global.prisma || getPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;
