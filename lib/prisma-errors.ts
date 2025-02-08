import { Prisma } from "@prisma/client";

/**
 * Handles errors thrown by Prisma and returns a standardized error object.
 *
 * @param error - The error thrown by Prisma.
 * @returns An object containing a user-friendly message and an HTTP status code.
 */
export function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle known Prisma errors by error code.
    switch (error.code) {
      case "P2002":
        // Unique constraint violation
        return {
          message: "A unique constraint would be violated.",
          status: 409,
        };
      case "P2025":
        // Record to update/delete not found.
        return {
          message: "Record not found.",
          status: 404,
        };
      case "P2014":
        // Required relation violation.
        return {
          message:
            "The change you are trying to make would violate the required relation.",
          status: 400,
        };
      default:
        console.error("Prisma Known Request Error:", error);
        return {
          message: "Database error occurred.",
          status: 500,
        };
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    // Handle validation errors from Prisma.
    return {
      message: "Invalid data provided.",
      status: 400,
    };
  }

  // Log any unexpected errors and return a generic message.
  console.error("Unexpected Error:", error);
  return {
    message: "An unexpected error occurred.",
    status: 500,
  };
}
