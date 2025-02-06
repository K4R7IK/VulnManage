import fs from "fs";
import csv from "csv-parser";
import prisma from "@/lib/prisma";
import { ulid } from "ulid";
import crypto from "crypto";
import { z } from "zod";

// Types
interface RawVulnerabilityRow {
  Host: string;
  "Asset OS"?: string;
  Port: string;
  Protocol?: string;
  Name: string;
  CVE?: string;
  Description?: string;
  Risk: string;
  "CVSS v2.0 Base Score": string;
  Synopsis?: string;
  Solution?: string;
  "See Also"?: string;
  "Plugin Output"?: string;
}

interface ProcessedVulnerability {
  id: string;
  assetIp: string;
  assetOS: string | null;
  port: number | null;
  protocol: string | null;
  title: string;
  cveId: string[];
  description: string[];
  riskLevel: string;
  cvssScore: number;
  impact: string | null;
  recommendations: string | null;
  references: string[];
  pluginOutput: string;
  quarters: string[];
  uniqueHash: string;
  companyId: number;
  isResolved: boolean;
}

// Validation schemas
const riskLevelSchema = z.enum(["None", "Low", "Medium", "High", "Critical"]);

const vulnerabilityRowSchema = z.object({
  Host: z.string().min(1, "Host IP is required"),
  "Asset OS": z.string().optional(),
  Port: z.string(),
  Protocol: z.string().optional(),
  Name: z.string().min(1, "Vulnerability name is required"),
  CVE: z.string().optional(),
  Description: z.string().optional(),
  Risk: riskLevelSchema,
  "CVSS v2.0 Base Score": z.string(),
  Synopsis: z.string().optional(),
  Solution: z.string().optional(),
  "See Also": z.string().optional(),
  "Plugin Output": z.string().optional(),
});

// Options interface to toggle additional logging/features
interface ImportOptions {
  captureSkippedRows?: boolean;
  calculateSummary?: boolean;
}

// Helper functions
function generateHash(companyId: number, ...fields: any[]): string {
  return crypto
    .createHash("md5")
    .update([companyId, ...fields].join("|"))
    .digest("hex");
}

function processRow(
  row: RawVulnerabilityRow,
  companyId: number,
  quarters: string,
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
    row["Plugin Output"],
  );

  return {
    id: ulid(),
    assetIp: row.Host,
    assetOS: row["Asset OS"] || null,
    port: parseInt(row.Port, 10) || null,
    protocol: row.Protocol ? row.Protocol.toUpperCase() : null,
    title: row.Name,
    cveId: row.CVE ? row.CVE.split(",").map((cve) => cve.trim()) : [],
    description: row.Description
      ? row.Description.split("\n").map((desc) => desc.trim())
      : [],
    riskLevel: row.Risk,
    cvssScore: parseFloat(row["CVSS v2.0 Base Score"]) || 0,
    impact: row.Synopsis || null,
    recommendations: row.Solution || null,
    references: row["See Also"]
      ? row["See Also"].split(",").map((ref) => ref.trim())
      : [],
    pluginOutput: row["Plugin Output"] || "N/A",
    quarters: [quarters],
    uniqueHash,
    companyId,
    isResolved: false,
  };
}

async function readCsvFile(filepath: string): Promise<RawVulnerabilityRow[]> {
  return new Promise((resolve, reject) => {
    const results: RawVulnerabilityRow[] = [];
    fs.createReadStream(filepath)
      .pipe(csv({ separator: "," }))
      .on("data", (data: RawVulnerabilityRow) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) =>
        reject(new Error(`Failed to read CSV file: ${error.message}`)),
      );
  });
}

/**
 * Parses a CSV file, imports vulnerabilities into the database,
 * and calculates a vulnerability summary.
 *
 * @param filepath - Path to the CSV file.
 * @param quarters - Quarter information.
 * @param companyId - Company ID (number).
 * @param options - Import options to enable/disable features.
 */
export async function parseCsv(
  filepath: string,
  quarters: string,
  companyId: number,
  options: ImportOptions = {
    captureSkippedRows: false,
    calculateSummary: true,
  },
): Promise<void> {
  try {
    if (!filepath || !quarters || !companyId) {
      throw new Error(
        "Missing required parameters: filepath, quarters, or companyId",
      );
    }

    // Read CSV file
    const results = await readCsvFile(filepath);
    if (results.length === 0) {
      throw new Error("CSV file is empty");
    }

    // Process and validate rows
    const vulnerabilityMap = new Map<string, ProcessedVulnerability>();
    const captureSkipped = options.captureSkippedRows ?? false;
    const skippedRows: { row: RawVulnerabilityRow; reason: string }[] = [];

    for (const row of results) {
      try {
        const validatedRow = vulnerabilityRowSchema.parse(row);

        // Skip entries with Risk level "None"
        if (validatedRow.Risk === "None") {
          if (captureSkipped) {
            skippedRows.push({ row, reason: "Risk is 'None'" });
          }
          continue;
        }

        const processedVuln = processRow(validatedRow, companyId, quarters);

        // Only add if not already in map (avoid duplicates)
        if (!vulnerabilityMap.has(processedVuln.uniqueHash)) {
          vulnerabilityMap.set(processedVuln.uniqueHash, processedVuln);
        } else if (captureSkipped) {
          skippedRows.push({ row, reason: "Duplicate row" });
        }
      } catch (error) {
        if (captureSkipped) {
          skippedRows.push({
            row,
            reason: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
        continue;
      }
    }

    if (captureSkipped && skippedRows.length > 0) {
      console.log("Skipped rows during import:", skippedRows);
    }

    // Insert vulnerabilities in a transaction (batching with a 15s timeout)
    await prisma.$transaction(
      async (tx) => {
        const newVulnerabilities = Array.from(vulnerabilityMap.values());
        if (newVulnerabilities.length === 0) {
          console.warn("No valid vulnerabilities found to import");
          return;
        }
        const BATCH_SIZE = 100;
        for (let i = 0; i < newVulnerabilities.length; i += BATCH_SIZE) {
          const batch = newVulnerabilities.slice(i, i + BATCH_SIZE);
          await tx.vulnerability.createMany({
            data: batch,
            skipDuplicates: true,
          });
        }
        console.log(
          `Successfully imported ${newVulnerabilities.length} vulnerabilities`,
        );
      },
      { timeout: 15000 },
    );

    // Calculate and upsert vulnerability summary if enabled
    if (options.calculateSummary) {
      // Group vulnerabilities by assetOS for OS summary
      const osGroup = await prisma.vulnerability.groupBy({
        by: ["assetOS"],
        where: {
          companyId,
          quarters: { has: quarters },
        },
        _count: { assetOS: true },
      });
      const osSummaryData = osGroup.reduce<Record<string, number>>(
        (acc, curr) => {
          const key = curr.assetOS || "Unknown";
          acc[key] = curr._count.assetOS;
          return acc;
        },
        {},
      );

      // Group vulnerabilities by riskLevel for risk summary
      const riskGroup = await prisma.vulnerability.groupBy({
        by: ["riskLevel"],
        where: {
          companyId,
          quarters: { has: quarters },
        },
        _count: { riskLevel: true },
      });
      const riskSummaryData = riskGroup.reduce<Record<string, number>>(
        (acc, curr) => {
          acc[curr.riskLevel] = curr._count.riskLevel;
          return acc;
        },
        {},
      );

      // Group by assetIp for top devices (and take top 5)
      const devicesGroup = await prisma.vulnerability.groupBy({
        by: ["assetIp"],
        where: {
          companyId,
          quarters: { has: quarters },
        },
        _count: { assetIp: true },
        orderBy: { _count: { assetIp: "desc" } },
      });
      const topDevicesData = devicesGroup.slice(0, 10).map((d) => ({
        assetIp: d.assetIp,
        count: d._count.assetIp,
      }));

      // Count resolved and unresolved vulnerabilities
      const resolvedCount = await prisma.vulnerability.count({
        where: {
          companyId,
          quarters: { has: quarters },
          isResolved: true,
        },
      });
      const unresolvedCount = await prisma.vulnerability.count({
        where: {
          companyId,
          quarters: { has: quarters },
          isResolved: false,
        },
      });

      // Upsert the summary record (using the compound unique key [companyId, quarter])
      await prisma.vulnerabilitySummary.upsert({
        where: { companyId_quarter: { companyId, quarter: quarters } },
        update: {
          osSummary: osSummaryData,
          riskSummary: riskSummaryData,
          topDevices: topDevicesData,
          resolvedCount,
          unresolvedCount,
        },
        create: {
          companyId,
          quarter: quarters,
          osSummary: osSummaryData,
          riskSummary: riskSummaryData,
          topDevices: topDevicesData,
          resolvedCount,
          unresolvedCount,
        },
      });
      console.log("Vulnerability summary calculated and upserted.");
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error during CSV import";
    console.error("Error importing vulnerabilities:", errorMessage);
    throw new Error(`Failed to import CSV: ${errorMessage}`);
  } finally {
    await prisma.$disconnect();
  }
}
