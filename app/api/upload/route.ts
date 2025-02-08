import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import fs from "fs/promises";
import { importCsv } from "@/utils/importCsv";
import os from "os";
import { Readable } from "stream";
import { z } from "zod";

// Move to separate config/constants file
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ["text/csv", "application/vnd.ms-excel"];

// Define types for better type safety
interface FormFields {
  quarter: string;
  companyId: number;
  creationDate: string;
}

interface UploadedFile {
  filepath: string;
  mimetype: string;
  originalFilename: string;
}

// Validation schema
const uploadSchema = z.object({
  quarter: z.string().min(1, "Quarter is required"),
  companyId: z.number().min(1, "Company ID is required"),
  creationDate: z.string().min(1, "Creation date is required"),
});

// Get JWT secret with type safety
const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
  throw new Error("JWT_SECRET environment variable is not set");
}

export const config = {
  api: {
    bodyParser: false,
  },
};

async function requestToStream(req: Request): Promise<Readable> {
  // Convert the web ReadableStream to a Node.js Readable stream.
  const nodeStream = Readable.fromWeb(req.body);
  // Attach headers from the original request to the stream.
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
    form.parse(stream, (err, fields, files) => {
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
        creationDate: Array.isArray(fields.creationDate)
          ? fields.creationDate[0]
          : fields.creationDate,
      };

      resolve({ fields: formattedFields, files });
    });
  });
}

async function verifyToken(token: string) {
  try {
    const secret = new TextEncoder().encode(SECRET_KEY);
    const { payload } = await jwtVerify(token, secret);

    if (!payload.email) {
      throw new Error("Invalid token payload");
    }

    return payload;
  } catch (error) {
    throw new Error("Invalid token");
  }
}

export async function POST(req: Request) {
  try {
    // Authentication
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("token");
    if (!tokenCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await verifyToken(tokenCookie.value);

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

    // Process CSV file, passing the custom creation date from the form as an option
    console.log(
      file.filepath,
      fields.quarter,
      Number(fields.companyId),
      fields.creationDate,
    );
    await importCsv(file.filepath, fields.quarter, Number(fields.companyId), {
      captureSkippedRows: false,
      calculateSummary: true,
      customCreatedAt: new Date(fields.creationDate),
    });

    // Cleanup: Delete temp file
    await fs.unlink(file.filepath).catch((error) => {
      console.error("Error deleting temp file:", error);
    });

    return NextResponse.json(
      { message: "File processed successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error processing file:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error processing file";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
