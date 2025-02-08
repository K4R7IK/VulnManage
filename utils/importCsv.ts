import fs from "fs";
import csv from "csv-parser";
import prisma from "@/lib/prisma";
import { ulid } from "ulid";
import crypto from "crypto";
import { z } from "zod";

// Types from CSV
interface RawVulnerabilityRow {
  Host: string;
  "Asset OS"?: string;
  Port: string;
  Protocol?: string;
  Name: string;
  CVE?: string;
  Description: string;
  Risk: string;
  "CVSS v2.0 Base Score": string;
  Synopsis?: string;
  Solution?: string;
  "See Also"?: string;
  "Plugin Output"?: string;
}

// Processed vulnerability with an optional createdAt override
interface ProcessedVulnerability {
  id: string;
  assetIp: string;
  assetOS: string | null;
  port: number | null;
  protocol: string | null;
  title: string;
  cveId: string[];
  description: string;
  riskLevel: string;
  cvssScore: number;
  impact: string | null;
  recommendations: string | null;
  references: string[];
  pluginOutput: string;
  quarters: string[]; // Stored as an array of quarter values
  uniqueHash: string;
  companyId: number;
  isResolved: boolean;
  createdAt?: Date; // Optional override if provided
}

// Options interface lets you toggle extra logging and supply a custom creation date.
interface ImportOptions {
  captureSkippedRows?: boolean;
  calculateSummary?: boolean;
  customCreatedAt?: Date;
}

// Validation schema for CSV rows
const riskLevelSchema = z.enum(["None", "Low", "Medium", "High", "Critical"]);
const vulnerabilityRowSchema = z.object({
  Host: z.string().min(1, "Host IP is required"),
  "Asset OS": z.string().optional(),
  Port: z.string(),
  Protocol: z.string().optional(),
  Name: z.string().min(1, "Vulnerability name is required"),
  CVE: z.string().optional(),
  Description: z.string(),
  Risk: riskLevelSchema,
  "CVSS v2.0 Base Score": z.string(),
  Synopsis: z.string().optional(),
  Solution: z.string().optional(),
  "See Also": z.string().optional(),
  "Plugin Output": z.string().optional(),
});

// Helper: Generate a unique hash from companyId and other fields.
function generateHash(companyId: number, ...fields: any[]): string {
  return crypto
    .createHash("md5")
    .update([companyId, ...fields].join("|"))
    .digest("hex");
}

// Process a single CSV row into a vulnerability record.
// Pass the optional customCreatedAt date if provided.
function processRow(
  row: RawVulnerabilityRow,
  companyId: number,
  quarterValue: string,
  customCreatedAt?: Date
): ProcessedVulnerability {
  const uniqueHash = generateHash(
    companyId,
    row.Host,
    row.Port,
    row.Protocol,
    row.Name,
    row.CVE,
    row.Description,
    row.Risk,
    row["CVSS v2.0 Base Score"],
    row.Synopsis,
    row.Solution,
    row["See Also"],
    row["Plugin Output"]
  );

  return {
    id: ulid(),
    assetIp: row.Host,
    assetOS: row["Asset OS"] || null,
    port: parseInt(row.Port, 10) || null,
    protocol: row.Protocol ? row.Protocol.toUpperCase() : null,
    title: row.Name,
    cveId: row.CVE ? row.CVE.split(",").map((cve) => cve.trim()) : [],
    description: row.Description,
    riskLevel: row.Risk,
    cvssScore: parseFloat(row["CVSS v2.0 Base Score"]) || 0,
    impact: row.Synopsis || null,
    recommendations: row.Solution || null,
    references: row["See Also"]
      ? row["See Also"].split(",").map((ref) => ref.trim())
      : [],
    pluginOutput: row["Plugin Output"] || "N/A",
    quarters: [quarterValue],
    uniqueHash,
    companyId,
    isResolved: false,
    createdAt: customCreatedAt ? customCreatedAt : new Date(),
  };
}

// Read CSV file and return an array of rows.
async function readCsvFile(filepath: string): Promise<RawVulnerabilityRow[]> {
  return new Promise((resolve, reject) => {
    const results: RawVulnerabilityRow[] = [];
    fs.createReadStream(filepath)
      .pipe(csv({ separator: "," }))
      .on("data", (data: RawVulnerabilityRow) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) =>
        reject(new Error(`Failed to read CSV file: ${error.message}`))
      );
  });
}

// Update vulnerability summary for a given company and quarter.
async function updateSummary(
  companyId: number,
  quarterValue: string,
  newCount: number,
  unresolvedCount: number,
  resolvedCount: number,
  customCreatedAt?: Date
): Promise<void> {
  // Fetch vulnerabilities for grouping purposes.
  const vulnerabilities = await prisma.vulnerability.findMany({
    where: { companyId, quarters: { has: quarterValue } },
  });

  // Summarize by OS.
  const osSummary = vulnerabilities.reduce((acc, vuln) => {
    const key = vuln.assetOS || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Summarize by risk.
  const riskSummary = vulnerabilities.reduce((acc, vuln) => {
    acc[vuln.riskLevel] = (acc[vuln.riskLevel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate vulnerabilities per IP.
  const vulnPerIp = vulnerabilities.reduce((acc, vuln) => {
    if (vuln.assetIp) {
      acc[vuln.assetIp] = (acc[vuln.assetIp] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  const topDevices = Object.entries(vulnPerIp)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ip, count]) => ({ ip, count }));

  // Upsert summary record with the newCount field.
  await prisma.vulnerabilitySummary.upsert({
    where: { companyId_quarter: { companyId, quarter: quarterValue } },
    update: {
      osSummary,
      riskSummary,
      topDevices,
      resolvedCount,
      unresolvedCount,
      newCount,
    },
    create: {
      companyId,
      quarter: quarterValue,
      osSummary,
      riskSummary,
      topDevices,
      resolvedCount,
      unresolvedCount,
      newCount,
      createdAt: customCreatedAt ? customCreatedAt : new Date(),
    },
  });
  console.log("Vulnerability summary calculated and upserted.");
}

/**
 * Import CSV data into the Vulnerability model with extended functionality.
 *
 * @param filepath - Path to the CSV file.
 * @param quarterValue - Quarter string (e.g., "Q1 2025").
 * @param companyId - Company ID (passed from the route).
 * @param options - Options to enable extra features and custom creation date.
 */
export async function importCsv(
  filepath: string,
  quarterValue: string,
  companyId: number,
  options: ImportOptions = {
    captureSkippedRows: false,
    calculateSummary: true,
  }
): Promise<void> {
  try {
    // Read CSV file
    const results = await readCsvFile(filepath);
    if (results.length === 0) {
      throw new Error("CSV file is empty");
    }

    // Map to hold CSV vulnerabilities (keyed by uniqueHash)
    const csvVulnMap = new Map<string, ProcessedVulnerability>();
    const captureSkipped = options.captureSkippedRows ?? false;
    const skippedRows: { row: RawVulnerabilityRow; reason: string }[] = [];

    // Process each CSV row
    for (const row of results) {
      try {
        const validatedRow = vulnerabilityRowSchema.parse(row);
        if (validatedRow.Risk === "None") {
          if (captureSkipped) {
            skippedRows.push({ row, reason: "Risk is 'None'" });
          }
          continue; // Skip this row
        }
        const processed = processRow(
          validatedRow,
          0, // temporary companyId; will update below
          quarterValue,
          options.customCreatedAt
        );
        csvVulnMap.set(processed.uniqueHash, processed);
      } catch (error) {
        if (captureSkipped) {
          skippedRows.push({
            row,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
        continue;
      }
    }

    if (captureSkipped && skippedRows.length > 0) {
      console.log("Skipped rows during import:", skippedRows);
    }

    // Counters for summary:
    let updateCount = 0;   // Number of vulnerabilities updated (existing in both CSV and DB)
    let resolveCount = 0;  // Number of vulnerabilities marked as resolved (existing in DB but not in CSV)
    let insertedCount = 0; // Number of new vulnerabilities inserted from CSV

    // Start a transaction for processing vulnerabilities (using the provided companyId)
    await prisma.$transaction(async (tx) => {
      // Update the companyId in all CSV vulnerabilities
      csvVulnMap.forEach((vuln) => {
        vuln.companyId = companyId;
      });

      // Fetch all existing vulnerabilities for the company.
      const existingVulns = await tx.vulnerability.findMany({
        where: { companyId },
      });
      const csvHashes = Array.from(csvVulnMap.keys());

      // For each existing vulnerability that is present in CSV, update quarters and mark unresolved.
      const updatePromises = existingVulns
        .filter((vuln) => csvHashes.includes(vuln.uniqueHash))
        .map((vuln) => {
          const csvVuln = csvVulnMap.get(vuln.uniqueHash)!;
          const updatedQuarters = Array.from(
            new Set([...vuln.quarters, ...csvVuln.quarters])
          );
          csvVulnMap.delete(vuln.uniqueHash); // Remove processed CSV record
          updateCount++;
          return tx.vulnerability.update({
            where: { id: vuln.id },
            data: {
              isResolved: false,
              quarters: updatedQuarters,
              updatedAt: new Date(),
            },
          });
        });

      await Promise.all(updatePromises);

      // Mark any existing vulnerabilities not in the CSV as resolved.
      const resolvePromises = existingVulns
        .filter((vuln) => !csvHashes.includes(vuln.uniqueHash))
        .map((vuln) => {
          resolveCount++;
          return tx.vulnerability.update({
            where: { id: vuln.id },
            data: { isResolved: true },
          });
        });
      await Promise.all(resolvePromises);

      // Insert new vulnerabilities (those remaining in csvVulnMap).
      const newVulnerabilities = Array.from(csvVulnMap.values());
      insertedCount = newVulnerabilities.length;
      if (newVulnerabilities.length > 0) {
        await tx.vulnerability.createMany({
          data: newVulnerabilities,
          skipDuplicates: true,
        });
      }

      console.log("Import complete:");
      console.log(`Updated: ${updateCount}`);
      console.log(`Resolved: ${resolveCount}`);
      console.log(`Inserted: ${insertedCount}`);
    }, { timeout: 15000 });

    // Update the summary if enabled.
    if (options.calculateSummary && companyId !== undefined) {
      await updateSummary(
        companyId,
        quarterValue,
        insertedCount, // new vulnerabilities count
        updateCount,   // unresolved count (existing CSV records updated)
        resolveCount,   // resolved count (existing DB records not in CSV)
        options.customCreatedAt
      );
    }
  } catch (error) {
    console.error("Error importing vulnerabilities:", error);
    throw error;
  } finally {
    try {
      await prisma.$disconnect();
    } catch (discError) {
      console.error("Error disconnecting prisma:", discError);
    }
  }
}
