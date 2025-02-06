// lib/prisma-errors.ts
import { Prisma } from "@prisma/client";

export function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle known Prisma errors
    switch (error.code) {
      case "P2002":
        return {
          message: "A unique constraint would be violated.",
          status: 409,
        };
      case "P2025":
        return {
          message: "Record not found.",
          status: 404,
        };
      case "P2014":
        return {
          message:
            "The change you are trying to make would violate the required relation.",
          status: 400,
        };
      default:
        return {
          message: "Database error occurred.",
          status: 500,
        };
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      message: "Invalid data provided.",
      status: 400,
    };
  }

  // Handle other types of errors
  return {
    message: "An unexpected error occurred.",
    status: 500,
  };
}
