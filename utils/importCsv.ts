// utils/importCsv.ts
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
  [key: string]: any; // Allow for additional fields that might be present
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
const DB_QUERY_BATCH_SIZE = 10000; // Increased from 5000

// Process vulnerabilities in batches - optimized for performance
async function processBatchOptimized(
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

  // Build an optimized query to fetch existing vulnerabilities
  // Use "in" queries with batched hashes to avoid too many parameters
  const hashChunks = chunkArray(batchHashes, DB_QUERY_BATCH_SIZE);
  let allExistingVulns: any[] = [];

  // Process each chunk of hashes
  for (const hashChunk of hashChunks) {
    // Get existing vulnerabilities by hashes for this chunk
    const chunkExistingVulns = await tx.vulnerability.findMany({
      where: {
        AND: [
          { companyId: vulnBatch[0].vulnData.companyId }, // All items in batch have same companyId
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

  // Map existing vulnerabilities by hash for fast lookup
  const existingVulnMap = new Map(
    allExistingVulns.map((vuln) => [vuln.uniqueHash, vuln]),
  );

  // Prepare bulk operations
  const newVulnerabilities: Omit<
    Vulnerability,
    "id" | "createdAt" | "updatedAt"
  >[] = [];
  const existingVulnUpdates: {
    vulnerabilityId: string;
    existingQuarterId?: string;
    createNew: boolean;
  }[] = [];

  // Process each vulnerability from the batch
  for (const { vulnData, hash } of vulnBatch) {
    if (existingVulnMap.has(hash)) {
      // Case 1: Vulnerability exists in database
      const existingVuln = existingVulnMap.get(hash)!;

      // Check if we already have an entry for this quarter
      const existingQuarter = existingVuln.quarterData.find(
        (q: any) => q.quarter === quarter,
      );

      if (existingQuarter) {
        // Only add to update list if it's marked as resolved
        if (existingQuarter.isResolved) {
          existingVulnUpdates.push({
            vulnerabilityId: existingVuln.id,
            existingQuarterId: existingQuarter.id,
            createNew: false,
          });
        }
      } else {
        // Need to create new quarter entry
        existingVulnUpdates.push({
          vulnerabilityId: existingVuln.id,
          createNew: true,
        });
      }
    } else {
      // Case 2: New vulnerability
      newVulnerabilities.push(vulnData);
    }
  }

  // OPTIMIZATION: Process bulk operations

  // 1. First, create all new vulnerabilities in bulk
  if (newVulnerabilities.length > 0) {
    // Create vulnerabilities in chunks to avoid parameter limits
    const newVulnsChunks = chunkArray(newVulnerabilities, DB_QUERY_BATCH_SIZE);

    for (const chunk of newVulnsChunks) {
      // Create vulnerabilities one by one with their quarters
      // We can't use createMany because we need to create related quarterData
      for (const vulnData of chunk) {
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

  // 2. Handle existing vulnerability quarter updates
  if (existingVulnUpdates.length > 0) {
    // Process updates in chunks
    const updateChunks = chunkArray(existingVulnUpdates, DB_QUERY_BATCH_SIZE);

    for (const chunk of updateChunks) {
      // Group updates to reduce database calls
      const quartesToUpdate = chunk.filter((item) => !item.createNew);
      const quartersToCreate = chunk.filter((item) => item.createNew);

      // Update existing quarters that need to be marked as not resolved
      if (quartesToUpdate.length > 0) {
        for (const item of quartesToUpdate) {
          await tx.vulnerabilityQuarter.update({
            where: { id: item.existingQuarterId },
            data: { isResolved: false },
          });
        }
      }

      // Create new quarter entries for existing vulnerabilities
      if (quartersToCreate.length > 0) {
        for (const item of quartersToCreate) {
          await tx.vulnerabilityQuarter.create({
            data: {
              vulnerabilityId: item.vulnerabilityId,
              quarter,
              isResolved: false,
              fileUploadDate: fileUploadDate,
            },
          });
        }
      }
    }
  }
}

// Main import function with batch processing - Optimized version
export async function importVulnerabilities(
  prisma: PrismaClient,
  params: ImportParams,
): Promise<void> {
  const {
    fileUploadDate,
    quarter,
    csvContent,
    batchSize = 5000, // Increased default batch size to 5000 from 1000
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
    // OPTIMIZATION: Parse CSV with settings optimized for error tolerance
    const parseResult = Papa.parse<CsvRow>(csvContent, {
      header: true,
      skipEmptyLines: "greedy", // Skip all kinds of empty lines
      dynamicTyping: true, // Auto-convert numbers and booleans
      fastMode: false, // Disable fast mode for better error handling
      // Key options for handling problematic CSVs:
      delimiter: ",", // Explicitly define the delimiter
      transformHeader: (header: string) => header.trim(), // Trim headers
      transform: (value: any) =>
        typeof value === "string" ? value.trim() : value, // Trim values
      comments: false, // No comment handling
    });

    // Log any parsing errors but continue if possible
    if (parseResult.errors && parseResult.errors.length > 0) {
      // Log all errors for debugging
      console.warn(`CSV parsing had ${parseResult.errors.length} errors`);
      parseResult.errors.forEach((err: Papa.ParseError, i: number) => {
        if (i < 5) {
          // Log only first 5 errors to avoid console flooding
          console.warn(
            `Error ${i + 1}: ${err.message} at row ${err.row || "unknown"}`,
          );
        }
      });

      // Check if we have parsed data despite the errors
      if (parseResult.data.length === 0) {
        if (operationId) {
          ProgressTracker.update(operationId, {
            status: "error",
            message: `CSV parsing failed: No data could be parsed`,
          });
        }
        throw new Error(`CSV parsing failed: No data could be parsed`);
      } else {
        // Continue with the data we have, but log a warning
        console.warn(
          `Continuing with ${parseResult.data.length} successfully parsed rows despite ${parseResult.errors.length} parsing errors`,
        );

        // Clean up data - handle any rows with __parsed_extra field (extra columns)
        parseResult.data = parseResult.data.map((row: any) => {
          // If we have extra fields, we don't need them
          if (row.__parsed_extra) {
            const cleanedRow = { ...row };
            delete cleanedRow.__parsed_extra;
            return cleanedRow;
          }
          return row;
        });

        if (operationId) {
          ProgressTracker.update(operationId, {
            progress: 10,
            message: `Processing ${parseResult.data.length} rows from CSV (with some parsing warnings)...`,
          });
        }
      }
    }

    // Logging Totals rows before filtering
    console.log(`Total rows in Csv: ${parseResult.data.length}`);
    if (operationId) {
      ProgressTracker.update(operationId, {
        progress: 10,
        message: `Processing ${parseResult.data.length} rows from CSV...`,
      });
    }

    // OPTIMIZATION: Filter using a more efficient method
    // Filter out rows with "None" risk level
    const validRows = parseResult.data.filter(
      (row: CsvRow) => row.Risk !== "None",
    );
    console.log(`Rows after remove None risk: ${validRows.length}`);

    // OPTIMIZATION: More efficient way to find unique rows
    const rowMap = new Map<string, CsvRow>();
    for (const row of validRows) {
      const rowString = JSON.stringify(row);
      rowMap.set(rowString, row);
    }
    const uniqueRows = Array.from(rowMap.values());
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
      // Log a sample of duplicates for inspection
      if (validRows.length - uniqueRows.length > 0) {
        const rowStrings = validRows.map((row: CsvRow) => JSON.stringify(row));
        const counts: Record<string, number> = {};
        for (const str of rowStrings) {
          counts[str] = (counts[str] || 0) + 1;
        }

        let count = 0;
        for (const [row, cnt] of Object.entries(counts)) {
          if (cnt > 1) {
            console.log(`Duplicate entry found ${cnt} times:`, JSON.parse(row));
            if (++count >= 5) break; // Log only first 5 duplicates
          }
        }
      }
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

      // OPTIMIZATION: Streamline vulnerability data generation
      const vulnDataAndHashes = uniqueRows.map((row: CsvRow) => {
        const vulnData = {
          ...mapCsvRowToVulnerability(row, params),
          assetOS: params.assetOS, // Ensure assetOS is not null
        };
        const hash = generateVulnHash(vulnData);
        vulnData.uniqueHash = hash;
        return { vulnData, hash };
      });

      // Get all unique hashes from the import data
      // OPTIMIZATION: Use Set for uniqueness checking
      const allUniqueHashes = new Set(vulnDataAndHashes.map((v) => v.hash));
      console.log(`Total unique vulnerabilities: ${allUniqueHashes.size}`);

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

      // OPTIMIZATION: Process batches in parallel where possible, but maintain the transaction boundaries
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

        // Each batch gets its own transaction
        await prisma.$transaction(
          async (tx) => {
            // OPTIMIZATION: Use the optimized processing function
            await processBatchOptimized(
              tx,
              batch,
              quarter,
              fileUploadDate,
              previousQuarter,
            );
          },
          {
            // Increase transaction timeouts for larger batches
            timeout: 120000, // 2 minutes
            maxWait: 30000, // 30 seconds
          },
        );

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

      // OPTIMIZATION: Use a more efficient approach for finding old vulnerabilities
      // Instead of loading everything, we'll use a more targeted approach

      // First, find active vulnerabilities IDs only (not the full objects)
      const activeVulnIds = await prisma.vulnerabilityQuarter.findMany({
        where: {
          vulnerability: {
            companyId: params.companyId,
            assetOS: params.assetOS,
          },
          ...(previousQuarter ? { quarter: previousQuarter.quarter } : {}),
          isResolved: false,
        },
        select: {
          vulnerabilityId: true,
        },
      });

      const uniqueActiveVulnIds = [
        ...new Set(activeVulnIds.map((v) => v.vulnerabilityId)),
      ];
      console.log(
        `Found ${uniqueActiveVulnIds.length} active vulnerability IDs to check`,
      );

      // Filter to only include IDs that are not in the current import
      const hashSet = new Set(allUniqueHashes);

      // Determine which vulnerabilities need resolution in batches
      const vulnIdsToResolve: string[] = [];

      // Process in chunks to avoid loading too many at once
      const activeIdChunks = chunkArray(
        uniqueActiveVulnIds,
        DB_QUERY_BATCH_SIZE,
      );

      for (const idChunk of activeIdChunks) {
        // Get uniqueHashes for this chunk of IDs
        const vulnsWithHashes = await prisma.vulnerability.findMany({
          where: {
            id: { in: idChunk },
          },
          select: {
            id: true,
            uniqueHash: true,
          },
        });

        // Add to resolution list if not in current import
        for (const vuln of vulnsWithHashes) {
          if (!hashSet.has(vuln.uniqueHash)) {
            vulnIdsToResolve.push(vuln.id);
          }
        }
      }

      console.log(
        `Found total of ${vulnIdsToResolve.length} vulnerabilities to mark as resolved`,
      );

      // Process in batches to avoid large transactions
      const unresolvedBatches = chunkArray(vulnIdsToResolve, batchSize);

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

        // OPTIMIZATION: Bulk update using more efficient approach
        await prisma.$transaction(
          async (tx) => {
            // First check which vulnerabilities already have quarter entries
            const existingQuarters = await tx.vulnerabilityQuarter.findMany({
              where: {
                vulnerabilityId: { in: batch },
                quarter: quarter,
              },
              select: {
                id: true,
                vulnerabilityId: true,
                isResolved: true,
              },
            });

            // Map for quick lookup
            const existingQuarterMap = new Map(
              existingQuarters.map((q) => [q.vulnerabilityId, q]),
            );

            // Separate into updates and creates
            const quartersToUpdate: string[] = [];
            const quartersToCreate: string[] = [];

            for (const vulnId of batch) {
              const existing = existingQuarterMap.get(vulnId);
              if (existing) {
                if (!existing.isResolved) {
                  quartersToUpdate.push(existing.id);
                }
              } else {
                quartersToCreate.push(vulnId);
              }
            }

            // Bulk update existing quarters
            if (quartersToUpdate.length > 0) {
              // Update in chunks to avoid parameter limits
              const updateChunks = chunkArray(
                quartersToUpdate,
                DB_QUERY_BATCH_SIZE,
              );

              for (const chunk of updateChunks) {
                await tx.vulnerabilityQuarter.updateMany({
                  where: { id: { in: chunk } },
                  data: { isResolved: true },
                });
              }
            }

            // Create new quarter entries for those that don't have one
            for (const vulnId of quartersToCreate) {
              await tx.vulnerabilityQuarter.create({
                data: {
                  vulnerabilityId: vulnId,
                  quarter,
                  isResolved: true,
                  fileUploadDate: fileUploadDate,
                },
              });
            }
          },
          {
            // Increase timeouts for larger batches
            timeout: 120000, // 2 minutes
            maxWait: 30000, // 30 seconds
          },
        );

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
