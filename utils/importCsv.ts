import { createHash } from "crypto";
import { PrismaClient, RiskLevel, Vulnerability } from "@prisma/client";
import Papa from "papaparse";
import { calculateVulnerabilitySummary } from "./calculateSummary";
import { ProgressTracker } from "./progressTracker";

// Types for CSV and import data
type CsvRow = {
  CVE: string;
  "CVSS v2.0 Base Score": string;
  Risk: string;
  Host: string;
  Protocol: string;
  Port: string;
  Name: string;
  Synopsis: string;
  Description: string;
  Solution: string;
  "See Also": string;
  "Plugin Output": string;
};

type ImportParams = {
  fileUploadDate: Date;
  quarter: string;
  assetOS: string;
  csvContent: string;
  companyId: number;
  batchSize?: number; // Optional parameter to control batch size
  operationId?: string; // Optional ID for tracking progress
};

// Convert risk string to RiskLevel enum
function mapRiskLevel(risk: string): RiskLevel {
  const riskMap: Record<string, RiskLevel> = {
    None: RiskLevel.None,
    Low: RiskLevel.Low,
    Medium: RiskLevel.Medium,
    High: RiskLevel.High,
    Critical: RiskLevel.Critical,
  };
  return riskMap[risk] || RiskLevel.None;
}

// Generate unique hash for vulnerability
function generateVulnHash(vuln: {
  assetOS: string;
  assetIp: string;
  port: number | null;
  protocol: string | null;
  title: string;
  cveId: string[];
  description: string;
  riskLevel: RiskLevel;
  cvssScore: number | null;
  impact: string;
  recommendations: string;
  references: string[];
  companyId: number;
  pluginOutput: string | null;
}): string {
  const normalizedData = {
    assetOS: vuln.assetOS,
    assetIp: vuln.assetIp,
    port: vuln.port,
    protocol: vuln.protocol,
    title: vuln.title,
    cveId: [...vuln.cveId].sort(),
    description: vuln.description,
    riskLevel: vuln.riskLevel,
    cvssScore: vuln.cvssScore,
    impact: vuln.impact,
    recommendations: vuln.recommendations,
    companyId: vuln.companyId,
    references: [...vuln.references].sort(),
    pluginOutput: vuln.pluginOutput ? vuln.pluginOutput.trim() : "",
  };

  const data = JSON.stringify(normalizedData);
  return createHash("sha256").update(data).digest("hex");
}

// Convert CSV row to vulnerability object
function mapCsvRowToVulnerability(
  row: CsvRow,
  params: ImportParams,
): Omit<Vulnerability, "id" | "createdAt" | "updatedAt"> {
  return {
    assetIp: row.Host,
    assetOS: params.assetOS,
    port: row.Port ? parseInt(row.Port) : null,
    protocol: row.Protocol ? row.Protocol : null,
    title: row.Name,
    cveId: row.CVE ? [row.CVE] : ["None"],
    description: row.Description,
    riskLevel: mapRiskLevel(row.Risk),
    cvssScore: row["CVSS v2.0 Base Score"]
      ? parseFloat(row["CVSS v2.0 Base Score"])
      : null,
    impact: row.Synopsis,
    recommendations: row.Solution,
    references: row["See Also"] ? [row["See Also"]] : [],
    pluginOutput: row["Plugin Output"] || null,
    companyId: params.companyId,
    fileUploadDate: params.fileUploadDate,
    uniqueHash: "", // Will be set after object creation
  };
}

// Split array into chunks of specified size
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// Batch size for database queries to avoid "too many bind variables" error
const DB_QUERY_BATCH_SIZE = 5000;

// Process a batch of vulnerabilities
async function processBatch(
  tx: Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  vulnBatch: {
    vulnData: Omit<Vulnerability, "id" | "createdAt" | "updatedAt">;
    hash: string;
  }[],
  quarter: string,
  fileUploadDate: Date,
  previousQuarter: { fileUploadDate: Date; quarter: string } | null,
): Promise<void> {
  // Extract hashes from batch
  const batchHashes = vulnBatch.map((item) => item.hash);

  // Split hashes into smaller chunks to avoid "too many bind variables" error
  const hashChunks = chunkArray(batchHashes, DB_QUERY_BATCH_SIZE);

  // Collect existing vulnerabilities from all chunks
  let allExistingVulns: any[] = [];

  for (const hashChunk of hashChunks) {
    // Get existing vulnerabilities by hashes for this chunk
    const chunkExistingVulns = await tx.vulnerability.findMany({
      where: {
        AND: [
          { companyId: vulnBatch[0].vulnData.companyId }, // All items in batch have same companyId
          { assetOS: vulnBatch[0].vulnData.assetOS }, // All items in batch have same assetOS
          { uniqueHash: { in: hashChunk } },
        ],
      },
      include: {
        quarterData: {
          where: previousQuarter
            ? {
                OR: [{ quarter: previousQuarter.quarter }, { quarter }],
              }
            : undefined,
          orderBy: { fileUploadDate: "desc" },
        },
      },
    });

    allExistingVulns = [...allExistingVulns, ...chunkExistingVulns];
  }

  // Map existing vulnerabilities by hash
  const existingVulnMap = new Map(
    allExistingVulns.map((vuln) => [vuln.uniqueHash, vuln]),
  );

  // Process vulnerabilities from batch
  for (const { vulnData, hash } of vulnBatch) {
    if (existingVulnMap.has(hash)) {
      // Case 1: Vulnerability exists in database
      const existingVuln = existingVulnMap.get(hash)!;

      // Check if we already have an entry for this quarter
      const existingQuarter = existingVuln.quarterData.find(
        (q: any) => q.quarter === quarter,
      );

      if (existingQuarter) {
        // Update existing quarter if it was marked as resolved
        if (existingQuarter.isResolved) {
          await tx.vulnerabilityQuarter.update({
            where: { id: existingQuarter.id },
            data: { isResolved: false },
          });
        }
      } else {
        // Create new quarter entry
        await tx.vulnerabilityQuarter.create({
          data: {
            vulnerabilityId: existingVuln.id,
            quarter,
            isResolved: false,
            fileUploadDate: fileUploadDate,
          },
        });
      }
    } else {
      // Case 2: New vulnerability
      await tx.vulnerability.create({
        data: {
          ...vulnData,
          quarterData: {
            create: {
              quarter,
              isResolved: false,
              fileUploadDate: fileUploadDate,
            },
          },
        },
      });
    }
  }
}

// Main import function with batch processing
export async function importVulnerabilities(
  prisma: PrismaClient,
  params: ImportParams,
): Promise<void> {
  const {
    fileUploadDate,
    quarter,
    csvContent,
    batchSize = 1000, // Increased default batch size to 1000
    operationId,
  } = params;

  // Collection to track duplicates for logging later
  const duplicateTracker = {
    totalRows: 0,
    noneRiskRemoved: 0,
    duplicates: new Map<string, Array<CsvRow>>(), // Map of hash -> array of duplicate rows
  };

  // Initialize progress tracking if operationId is provided
  if (operationId) {
    ProgressTracker.create(operationId);
    ProgressTracker.update(operationId, {
      status: "processing",
      progress: 5,
      message: "Parsing CSV data...",
    });
  }

  try {
    // Parse CSV content
    const parseResult = Papa.parse<CsvRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    if (parseResult.errors.length > 0) {
      if (operationId) {
        ProgressTracker.update(operationId, {
          status: "error",
          message: `CSV parsing failed: ${parseResult.errors[0].message}`,
        });
      }
      throw new Error(`CSV parsing failed: ${parseResult.errors[0].message}`);
    }

    // Save total rows for reporting
    duplicateTracker.totalRows = parseResult.data.length;

    // Filter out rows with "None" risk level
    const rowsWithNoneRisk = parseResult.data.filter(
      (row) => row.Risk === "None",
    );
    duplicateTracker.noneRiskRemoved = rowsWithNoneRisk.length;

    const validRows = parseResult.data.filter((row) => row.Risk !== "None");

    // Generate hashes for all rows first
    const vulnDataAndHashes = validRows.map((row) => {
      const vulnData = {
        ...mapCsvRowToVulnerability(row, params),
        assetOS: params.assetOS,
      };
      const hash = generateVulnHash(vulnData);
      vulnData.uniqueHash = hash;
      return { vulnData, hash, originalRow: row };
    });

    // Track the duplicates by hash
    const hashCount = new Map<string, number>();

    vulnDataAndHashes.forEach(({ hash, originalRow }) => {
      // Count occurrences of each hash
      hashCount.set(hash, (hashCount.get(hash) || 0) + 1);

      // Add to duplicates tracker if this hash appears more than once
      if (hashCount.get(hash)! > 1) {
        if (!duplicateTracker.duplicates.has(hash)) {
          // Find the first occurrence and add it to duplicates collection
          const firstItem = vulnDataAndHashes.find(
            (item) => item.hash === hash,
          );
          if (firstItem) {
            duplicateTracker.duplicates.set(hash, [firstItem.originalRow]);
          }
        }

        // Add this duplicate to the collection
        duplicateTracker.duplicates.get(hash)!.push(originalRow);
      }
    });

    // Deduplicate based on hash
    const uniqueVulnDataAndHashes = Array.from(
      new Map(vulnDataAndHashes.map((item) => [item.hash, item])).values(),
    );

    // Get all unique hashes from the import data
    const allUniqueHashes = uniqueVulnDataAndHashes.map((v) => v.hash);

    // Split the vulnerabilities into batches
    const batches = chunkArray(uniqueVulnDataAndHashes, batchSize);

    if (operationId) {
      ProgressTracker.update(operationId, {
        progress: 30,
        message: `Processing vulnerabilities in ${batches.length} batches...`,
      });
    }

    // Progress calculations
    // Reserve 30% for initial processing, 40% for batch processing, 20% for resolving old vulns, 10% for summary
    const batchProgressShare = 40; // 40% of total progress for processing batches
    const batchProgressPerUnit =
      batches.length > 0 ? batchProgressShare / batches.length : 0;

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      if (operationId) {
        ProgressTracker.update(operationId, {
          progress: 30 + Math.floor(i * batchProgressPerUnit),
          message: `Processing batch ${i + 1} of ${batches.length}...`,
        });
      }

      await prisma.$transaction(async (tx) => {
        await processBatch(tx, batch, quarter, fileUploadDate, null);
      });
    }

    // After all batches are processed, handle vulnerabilities not in current CSV (Case 3)
    if (operationId) {
      ProgressTracker.update(operationId, {
        progress: 70,
        message: "Resolving old vulnerabilities...",
      });
    }

    // Find active vulnerabilities for this company and OS in smaller batches
    // Use a cursor-based approach to avoid loading too many records at once
    let lastId: string | null = null;
    let hasMore = true;
    const PAGE_SIZE = 1000; // Process 1000 records at a time
    const unresolvedVulns: Vulnerability[] = [];
    let totalUnresolvedVulns = 0;

    while (hasMore) {
      const activeVulnsBatch: (Vulnerability & {
        quarterData: {
          id: string;
          quarter: string;
          isResolved: boolean;
          fileUploadDate: Date;
        }[];
      })[] = await prisma.vulnerability.findMany({
        where: {
          AND: [
            { companyId: params.companyId },
            { assetOS: params.assetOS },
            lastId ? { id: { gt: lastId } } : {}, // Cursor pagination
            {
              quarterData: {
                some: {
                  AND: [
                    {
                      isResolved: false,
                    },
                  ],
                },
              },
            },
          ],
        },
        include: {
          quarterData: {
            orderBy: { fileUploadDate: "desc" },
          },
        },
        orderBy: {
          id: "asc", // Consistent ordering for pagination
        },
        take: PAGE_SIZE,
      });

      // Update pagination info
      hasMore = activeVulnsBatch.length === PAGE_SIZE;
      if (activeVulnsBatch.length > 0) {
        lastId = activeVulnsBatch[activeVulnsBatch.length - 1].id;
      }

      // Filter this batch and add to our collection
      const hashSet = new Set(allUniqueHashes);
      const unresolvedInBatch = activeVulnsBatch.filter(
        (vuln: Vulnerability) => !hashSet.has(vuln.uniqueHash),
      );

      unresolvedVulns.push(...unresolvedInBatch);
      totalUnresolvedVulns += unresolvedInBatch.length;
    }

    // Process in batches to avoid large transactions
    const unresolvedBatches = chunkArray(unresolvedVulns, batchSize);

    // Progress calculations for unresolved batches
    const unresolvedProgressShare = 20; // 20% of total progress for resolving old vulns
    const unresolvedProgressPerUnit =
      unresolvedBatches.length > 0
        ? unresolvedProgressShare / unresolvedBatches.length
        : unresolvedProgressShare;

    for (let i = 0; i < unresolvedBatches.length; i++) {
      const batch = unresolvedBatches[i];

      if (operationId) {
        ProgressTracker.update(operationId, {
          progress: 70 + Math.floor(i * unresolvedProgressPerUnit),
          message: `Resolving old vulnerabilities: batch ${i + 1} of ${
            unresolvedBatches.length
          }...`,
        });
      }

      await prisma.$transaction(async (tx) => {
        // Mark these vulnerabilities as resolved for current quarter
        for (const vuln of batch) {
          const existingQuarter = await tx.vulnerabilityQuarter.findFirst({
            where: {
              vulnerabilityId: vuln.id,
              quarter: quarter,
            },
          });

          if (existingQuarter) {
            if (!existingQuarter.isResolved) {
              await tx.vulnerabilityQuarter.update({
                where: { id: existingQuarter.id },
                data: { isResolved: true },
              });
            }
          } else {
            await tx.vulnerabilityQuarter.create({
              data: {
                vulnerabilityId: vuln.id,
                quarter,
                isResolved: true,
                fileUploadDate: fileUploadDate,
              },
            });
          }
        }
      });
    }

    // After all processing is done, calculate the summary
    if (operationId) {
      ProgressTracker.update(operationId, {
        progress: 90,
        message: "Calculating vulnerability summary...",
      });
    }

    await calculateVulnerabilitySummary(prisma, {
      companyId: params.companyId,
      quarter: quarter,
      fileUploadDate: params.fileUploadDate,
    });

    // Now that all processing is complete, log the duplicate information
    console.log("=== CSV IMPORT SUMMARY ===");
    console.log(`Total rows in CSV: ${duplicateTracker.totalRows}`);
    console.log(
      `'None' risk rows removed: ${duplicateTracker.noneRiskRemoved}`,
    );

    const totalDuplicates =
      Array.from(duplicateTracker.duplicates.values()).reduce(
        (sum, arr) => sum + arr.length,
        0,
      ) - duplicateTracker.duplicates.size;

    console.log(`Duplicate rows removed: ${totalDuplicates}`);
    console.log(
      `Unique vulnerabilities processed: ${uniqueVulnDataAndHashes.length}`,
    );
    console.log(`Vulnerabilities marked as resolved: ${totalUnresolvedVulns}`);

    if (duplicateTracker.duplicates.size > 0) {
      console.log("\n=== DUPLICATE DETAILS ===");
      let duplicateCount = 1;

      duplicateTracker.duplicates.forEach((rows, hash) => {
        console.log(
          `\nDuplicate Group #${duplicateCount++} (${rows.length} occurrences):`,
        );
        console.log("First occurrence kept:");
        console.log(`  Title: ${rows[0].Name}`);
        console.log(`  Host: ${rows[0].Host}`);
        console.log(`  Port: ${rows[0].Port}`);
        console.log(`  Risk: ${rows[0].Risk}`);

        if (rows.length > 1) {
          console.log("Duplicate entries removed:");
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            console.log(
              `  ${i}: Title: ${row.Name}, Host: ${row.Host}, Port: ${row.Port}, Risk: ${row.Risk}`,
            );
          }
        }
      });
    }

    console.log("\n=== IMPORT COMPLETED SUCCESSFULLY ===");

    if (operationId) {
      ProgressTracker.update(operationId, {
        status: "completed",
        progress: 100,
        message: "Import completed successfully!",
      });
    }
  } catch (error) {
    console.error("Error during CSV parsing:", error);
    if (operationId) {
      ProgressTracker.update(operationId, {
        status: "error",
        message: `Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    throw error;
  }
}
