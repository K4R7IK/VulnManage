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
  const data = JSON.stringify({
    ...vuln,
    cveId: vuln.cveId.sort(),
    references: vuln.references.sort(),
  });
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

    // Logging Totals rows before filtering
    console.log(`Total rows in Csv: ${parseResult.data.length}`);
    if (operationId) {
      ProgressTracker.update(operationId, {
        progress: 10,
        message: `Processing ${parseResult.data.length} rows from CSV...`,
      });
    }

    // Filter out rows with "None" risk level
    const validRows = parseResult.data.filter((row) => row.Risk !== "None");
    console.log(`Rows after remove None risk: ${validRows.length}`);

    const rowStrings = validRows.map((row) => JSON.stringify(row));
    const uniqueRows = [...new Set(rowStrings)].map((str) => JSON.parse(str));
    console.log(`Unique rows : ${uniqueRows.length}`);

    if (operationId) {
      ProgressTracker.update(operationId, {
        progress: 15,
        message: `Found ${uniqueRows.length} unique vulnerabilities to process`,
      });
    }

    if (uniqueRows.length < validRows.length) {
      console.log(
        `Found ${validRows.length - uniqueRows.length} duplicate rows`,
      );
      // Log the duplicates for inspection
      const counts = rowStrings.reduce(
        (acc, curr) => {
          acc[curr] = (acc[curr] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      Object.entries(counts)
        .filter(([_, count]) => count > 1)
        .forEach(([row, count]) => {
          console.log(`Duplicate entry found ${count} times:`, JSON.parse(row));
        });
    }

    try {
      // Find the most recent quarter before the provided date - outside of batch processing
      if (operationId) {
        ProgressTracker.update(operationId, {
          progress: 20,
          message: "Finding previous quarter data...",
        });
      }

      const previousQuarter = await prisma.vulnerabilityQuarter.findFirst({
        where: {
          vulnerability: { companyId: params.companyId },
          fileUploadDate: { lt: fileUploadDate },
        },
        orderBy: {
          fileUploadDate: "desc",
        },
        select: {
          fileUploadDate: true,
          quarter: true,
        },
      });

      // Process CSV rows and generate hashes
      if (operationId) {
        ProgressTracker.update(operationId, {
          progress: 25,
          message: "Generating vulnerability data...",
        });
      }

      const vulnDataAndHashes = uniqueRows.map((row) => {
        const vulnData = {
          ...mapCsvRowToVulnerability(row, params),
          assetOS: params.assetOS, // Ensure assetOS is not null
        };
        const hash = generateVulnHash(vulnData);
        vulnData.uniqueHash = hash;
        return { vulnData, hash };
      });

      // Get all unique hashes from the import data
      const allUniqueHashes = [
        ...new Set(vulnDataAndHashes.map((v) => v.hash)),
      ];
      console.log(`Total unique vulnerabilities: ${allUniqueHashes.length}`);

      // Split the vulnerabilities into batches
      const batches = chunkArray(vulnDataAndHashes, batchSize);
      console.log(
        `Processing in ${batches.length} batches of max ${batchSize} items`,
      );

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
        console.log(
          `Processing batch ${i + 1}/${batches.length} with ${
            batch.length
          } items`,
        );

        if (operationId) {
          ProgressTracker.update(operationId, {
            progress: 30 + Math.floor(i * batchProgressPerUnit),
            message: `Processing batch ${i + 1} of ${batches.length}...`,
          });
        }

        await prisma.$transaction(async (tx) => {
          await processBatch(
            tx,
            batch,
            quarter,
            fileUploadDate,
            previousQuarter,
          );
        });

        console.log(`Completed batch ${i + 1}/${batches.length}`);
      }

      // After all batches are processed, handle vulnerabilities not in current CSV (Case 3)
      console.log("Processing vulnerabilities not in current CSV...");

      if (operationId) {
        ProgressTracker.update(operationId, {
          progress: 70,
          message: "Resolving old vulnerabilities...",
        });
      }

      // Process just the current OS type
      console.log(`Processing OS: ${params.assetOS}`);

      // Find active vulnerabilities for this company and OS in smaller batches
      // Use a cursor-based approach to avoid loading too many records at once
      let lastId: string | null = null;
      let hasMore = true;
      const PAGE_SIZE = 1000; // Process 1000 records at a time
      const unresolvedVulns: any[] = [];
      let totalUnresolvedVulns = 0;

      while (hasMore) {
        const activeVulnsBatch = await prisma.vulnerability.findMany({
          where: {
            AND: [
              { companyId: params.companyId },
              { assetOS: params.assetOS },
              lastId ? { id: { gt: lastId } } : {}, // Cursor pagination
              {
                quarterData: {
                  some: {
                    AND: [
                      previousQuarter
                        ? {
                            quarter: previousQuarter.quarter,
                            isResolved: false,
                          }
                        : {
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
              where: previousQuarter
                ? {
                    OR: [{ quarter: previousQuarter.quarter }, { quarter }],
                  }
                : undefined,
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

        console.log(
          `Found ${activeVulnsBatch.length} active vulnerabilities in batch`,
        );

        // Filter this batch and add to our collection
        const hashSet = new Set(allUniqueHashes);
        const unresolvedInBatch = activeVulnsBatch.filter(
          (vuln) => !hashSet.has(vuln.uniqueHash),
        );

        unresolvedVulns.push(...unresolvedInBatch);
        totalUnresolvedVulns += unresolvedInBatch.length;

        console.log(
          `Added ${unresolvedInBatch.length} vulnerabilities to be resolved`,
        );
      }

      console.log(
        `Found total of ${totalUnresolvedVulns} vulnerabilities to mark as resolved`,
      );

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
        console.log(
          `Processing unresolved batch ${i + 1}/${
            unresolvedBatches.length
          } with ${batch.length} items`,
        );

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
            const existingQuarter = vuln.quarterData.find(
              (q) => q.quarter === quarter,
            );

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

        console.log(
          `Completed unresolved batch ${i + 1}/${unresolvedBatches.length}`,
        );
      }

      // After all processing is done, calculate the summary
      console.log("Calculating vulnerability summary...");

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

      console.log("Import completed successfully");

      if (operationId) {
        ProgressTracker.update(operationId, {
          status: "completed",
          progress: 100,
          message: "Import completed successfully!",
        });
      }
    } catch (error) {
      console.error("Error importing vulnerabilities:", error);
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
    } finally {
      await prisma.$disconnect();
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
