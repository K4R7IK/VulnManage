// app/api/upload/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import { importVulnerabilities } from "@/utils/importCsv";
import os from "os";
import { Readable } from "stream";
import { z } from "zod";
import { verifyAuth } from "@/utils/verifyAuth";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

// Move to separate config/constants file
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const ALLOWED_FILE_TYPES = ["text/csv", "application/vnd.ms-excel"];

// Define types for better type safety
interface FormFields {
  quarter: string;
  companyId: number;
  fileUploadDate: string;
  assetOS: string;
}

interface UploadedFile {
  filepath: string;
  mimetype: string;
  originalFilename: string;
}

// Define specific error type for form parsing
interface FormidableError extends Error {
  code?: string;
  httpCode?: number;
}

// Validation schema
const uploadSchema = z.object({
  quarter: z.string().min(1, "Quarter is required"),
  companyId: z.number().min(1, "Company ID is required"),
  fileUploadDate: z.string().min(1, "Creation date is required"),
  assetOS: z.string().min(1, "Asset OS is required"),
});

export const config = {
  api: {
    bodyParser: false,
  },
};

async function requestToStream(req: Request): Promise<Readable> {
  if (!req.body) {
    return new Readable({
      read() {
        this.push(null);
      },
    });
  }

  const nodeStream = Readable.fromWeb(req.body);
  (nodeStream as any).headers = Object.fromEntries(req.headers.entries());
  return nodeStream;
}

async function parseForm(req: Request): Promise<{
  fields: FormFields;
  files: { file?: UploadedFile[] };
}> {
  const formidable = (await import("formidable")).default;
  const form = formidable({
    uploadDir: os.tmpdir(),
    keepExtensions: true,
    maxFileSize: MAX_FILE_SIZE,
    multiples: false,
    filter: ({ mimetype }) => {
      return mimetype ? ALLOWED_FILE_TYPES.includes(mimetype) : false;
    },
  });

  const stream = await requestToStream(req);

  return new Promise((resolve, reject) => {
    form.parse(
      stream,
      (
        err: FormidableError | null,
        fields: {
          quarter: string;
          companyId: string;
          fileUploadDate: string;
          assetOS: string;
        },
        files: Record<string, UploadedFile[]>,
      ) => {
        if (err) {
          reject(err);
          return;
        }

        // Transform fields to expected format
        const formattedFields: FormFields = {
          quarter: Array.isArray(fields.quarter)
            ? fields.quarter[0]
            : fields.quarter,
          companyId: Number(
            Array.isArray(fields.companyId)
              ? fields.companyId[0]
              : fields.companyId,
          ),
          fileUploadDate: Array.isArray(fields.fileUploadDate)
            ? fields.fileUploadDate[0]
            : fields.fileUploadDate,
          assetOS: Array.isArray(fields.assetOS)
            ? fields.assetOS[0]
            : fields.assetOS,
        };

        resolve({ fields: formattedFields, files });
      },
    );
  });
}

export async function POST(req: Request) {
  try {
    const auth = await verifyAuth();
    if (!auth.authenticated) return auth.response;

    // Generate a unique operation ID for tracking
    const operationId = uuidv4();

    // Parse form data
    const { fields, files } = await parseForm(req);

    // Validate fields
    const validationResult = uploadSchema.safeParse(fields);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.message },
        { status: 400 },
      );
    }

    const file = files.file?.[0];
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Read file content
    const csvContent = await fs.readFile(file.filepath, "utf-8");

    // Return the operation ID immediately for tracking
    // The processing will continue in the background
    const response = NextResponse.json(
      {
        message: "File uploaded and processing started",
        operationId: operationId,
      },
      { status: 202 },
    );

    // Start processing in the background
    // We're not awaiting this as we want to return the operation ID right away
    importVulnerabilities(prisma, {
      fileUploadDate: new Date(fields.fileUploadDate),
      quarter: fields.quarter,
      assetOS: fields.assetOS,
      csvContent,
      companyId: fields.companyId,
      operationId, // Pass the operation ID for progress tracking
      batchSize: 10000, // Use a batch size of 10000
    })
      .catch((error) => {
        console.error("Background processing error:", error);
      })
      .finally(async () => {
        // Cleanup: Delete temp file
        await fs.unlink(file.filepath).catch((error) => {
          console.error("Error deleting temp file:", error);
        });
      });

    return response;
  } catch (error: unknown) {
    // Improved error handling
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error processing file:", { error: errorMessage });

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
