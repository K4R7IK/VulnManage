// lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

// Define the type for our extended Prisma client
declare global {
  let prisma: ExtendedPrismaClient | undefined;
}

type ExtendedPrismaClient = ReturnType<typeof getPrismaClient>;

//function getPrismaClient() {
//  const client = new PrismaClient({
//    log:
//      process.env.NODE_ENV === "development"
//        ? ["query", "error", "warn"]
//        : ["error"],
//  }).$extends(withAccelerate());
//
//  return client;
//}
function getPrismaClient() {
  const client = new PrismaClient({}).$extends(withAccelerate());

  return client;
}
// Ensure we reuse any existing client instance in development
const prisma = global.prisma || getPrismaClient();

// Save the client in development to prevent multiple instances
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;
