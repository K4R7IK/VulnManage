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

// Unified key generation function for both CSV row deduplication and database uniqueness
function generateUniqueKey(
  input: CsvRow | Omit<Vulnerability, "id" | "createdAt" | "updatedAt">,
  params?: ImportParams,
): string {
  // Determine if we're working with a CsvRow or a Vulnerability
  const isCsvRow = "Host" in input;

  // Extract and normalize values based on input type
  const assetIp = isCsvRow
    ? (input.Host || "").toLowerCase().trim()
    : ((input as any).assetIp || "").toLowerCase().trim();

  const assetOS =
    isCsvRow && params
      ? (params.assetOS || "").toLowerCase().trim()
      : ((input as any).assetOS || "").toLowerCase().trim();

  const port = isCsvRow
    ? input.Port || ""
    : (input as any).port !== null
      ? (input as any).port.toString()
      : "";

  const protocol = isCsvRow
    ? (input.Protocol || "").toLowerCase().trim()
    : ((input as any).protocol || "").toLowerCase().trim();

  const title = isCsvRow
    ? (input.Name || "").toLowerCase().trim()
    : ((input as any).title || "").toLowerCase().trim();

  const risk = isCsvRow
    ? (input.Risk || "").toLowerCase().trim()
    : ((input as any).riskLevel || "").toString().toLowerCase().trim();

  const impact = isCsvRow
    ? (input.Synopsis || "").toLowerCase().trim().substring(0, 50)
    : ((input as any).impact || "").toLowerCase().trim().substring(0, 50);

  const companyId =
    isCsvRow && params
      ? params.companyId.toString()
      : ((input as any).companyId || "").toString();

  // Create the composite key with all essential fields
  return `${assetIp}|${assetOS}|${port}|${protocol}|${title}|${risk}|${impact}|${companyId}`;
}

// Convert CSV row to vulnerability object - optimized for better null handling
function mapCsvRowToVulnerability(
  row: CsvRow,
  params: ImportParams,
): Omit<Vulnerability, "id" | "createdAt" | "updatedAt"> {
  // Pre-process values once to avoid repeated operations
  const port = row.Port ? parseInt(row.Port) : null;
  const protocol = row.Protocol || null;
  const cvssScore = row["CVSS v2.0 Base Score"]
    ? parseFloat(row["CVSS v2.0 Base Score"])
    : null;
  const cveId = row.CVE ? [row.CVE] : ["None"];
  const references = row["See Also"] ? [row["See Also"]] : [];

  // Create the vulnerability object
  const vulnData: Omit<Vulnerability, "id" | "createdAt" | "updatedAt"> = {
    assetIp: row.Host,
    assetOS: params.assetOS,
    port,
    protocol,
    title: row.Name,
    cveId,
    description: row.Description,
    riskLevel: mapRiskLevel(row.Risk),
    cvssScore,
    impact: row.Synopsis,
    recommendations: row.Solution,
    references,
    pluginOutput: row["Plugin Output"] || null,
    companyId: params.companyId,
    fileUploadDate: params.fileUploadDate,
    uniqueHash: "", // Will be set below
  };

  // Generate uniqueHash using our unified key generation function
  vulnData.uniqueHash = generateUniqueKey(vulnData);

  return vulnData;
}

// Split array into chunks of specified size - more efficient one-liner
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / chunkSize) }, (_, i) =>
    array.slice(i * chunkSize, (i + 1) * chunkSize),
  );
}

// Optimized batch size for database queries
const DB_QUERY_BATCH_SIZE = 5000;

// Process vulnerabilities in batches - optimized for performance
async function processBatch(
  tx: Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  vulnBatch: {
    vulnData: Omit<Vulnerability, "id" | "createdAt" | "updatedAt">;
  }[],
  quarter: string,
  fileUploadDate: Date,
  previousQuarter: { fileUploadDate: Date; quarter: string } | null,
): Promise<void> {
  if (vulnBatch.length === 0) return;

  // Extract uniqueHashes from batch
  const batchHashes = vulnBatch.map((item) => item.vulnData.uniqueHash);
  const companyId = vulnBatch[0].vulnData.companyId;
  const assetOS = vulnBatch[0].vulnData.assetOS;

  // Build an optimized query to fetch existing vulnerabilities
  // Use "in" queries with batched hashes to avoid too many parameters
  const hashChunks = chunkArray(batchHashes, DB_QUERY_BATCH_SIZE);
  let allExistingVulns: any[] = [];

  // Process each chunk of hashes
  for (const hashChunk of hashChunks) {
    // Get existing vulnerabilities by uniqueHash for this chunk with optimized query
    // Only select the fields we actually need
    const chunkExistingVulns = await tx.vulnerability.findMany({
      where: {
        companyId,
        assetOS,
        uniqueHash: { in: hashChunk },
      },
      select: {
        id: true,
        uniqueHash: true,
        quarterData: {
          where: previousQuarter
            ? {
                OR: [{ quarter: previousQuarter.quarter }, { quarter }],
              }
            : undefined,
          select: {
            id: true,
            quarter: true,
            isResolved: true,
          },
          orderBy: { fileUploadDate: "desc" },
        },
      },
    });

    allExistingVulns = [...allExistingVulns, ...chunkExistingVulns];
  }

  // Map existing vulnerabilities by uniqueHash for O(1) lookups instead of O(n) array searches
  const existingVulnMap = new Map(
    allExistingVulns.map((vuln) => [vuln.uniqueHash, vuln]),
  );

  // Prepare operations by type for more efficient batch processing
  const newVulnerabilities: Omit<
    Vulnerability,
    "id" | "createdAt" | "updatedAt"
  >[] = [];
  const quarterUpdates: { id: string; isResolved: boolean }[] = [];
  const quarterCreates: {
    vulnerabilityId: string;
    quarter: string;
    isResolved: boolean;
    fileUploadDate: Date;
  }[] = [];

  // Process vulnerabilities from batch - grouping by operation type
  for (const { vulnData } of vulnBatch) {
    const uniqueHash = vulnData.uniqueHash;

    if (existingVulnMap.has(uniqueHash)) {
      // Case 1: Vulnerability exists in database
      const existingVuln = existingVulnMap.get(uniqueHash)!;

      // Check if we already have an entry for this quarter
      const existingQuarter = existingVuln.quarterData.find(
        (q: any) => q.quarter === quarter,
      );

      if (existingQuarter) {
        // Add to update array if it was marked as resolved
        if (existingQuarter.isResolved) {
          quarterUpdates.push({
            id: existingQuarter.id,
            isResolved: false,
          });
        }
      } else {
        // Add to create array
        quarterCreates.push({
          vulnerabilityId: existingVuln.id,
          quarter,
          isResolved: false,
          fileUploadDate,
        });
      }
    } else {
      // Case 2: New vulnerability
      newVulnerabilities.push(vulnData);
    }
  }

  // Process operations in batches for better performance
  // 1. Create new vulnerabilities - still need individual creates due to relationship
  for (const vulnData of newVulnerabilities) {
    await tx.vulnerability.create({
      data: {
        ...vulnData,
        quarterData: {
          create: {
            quarter,
            isResolved: false,
            fileUploadDate,
          },
        },
      },
    });
  }

  // 2. Update existing quarters in bulk where possible
  const updateChunks = chunkArray(quarterUpdates, DB_QUERY_BATCH_SIZE);
  for (const chunk of updateChunks) {
    // Process each update in parallel
    await Promise.all(
      chunk.map((update) =>
        tx.vulnerabilityQuarter.update({
          where: { id: update.id },
          data: { isResolved: update.isResolved },
        }),
      ),
    );
  }

  // 3. Create new quarters in bulk where possible
  const createChunks = chunkArray(quarterCreates, DB_QUERY_BATCH_SIZE);
  for (const chunk of createChunks) {
    // Process each create in parallel
    await Promise.all(
      chunk.map((create) =>
        tx.vulnerabilityQuarter.create({
          data: create,
        }),
      ),
    );
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
    batchSize = 5000, // Increased default batch size to 5000
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
    // OPTIMIZATION: Improved CSV parsing with more robust settings
    const parseResult = Papa.parse<CsvRow>(csvContent, {
      header: true,
      skipEmptyLines: "greedy", // Skip all kinds of empty lines
      dynamicTyping: true, // Auto-convert numbers and booleans
      fastMode: false, // Disable fast mode for better error handling
      delimiter: ",", // Explicitly define the delimiter
      transformHeader: (header: string) => header.trim(), // Trim headers
      transform: (value: any) =>
        typeof value === "string" ? value.trim() : value, // Trim values
      comments: false, // No comment handling
    });

    // Log any parsing errors but continue if possible
    if (parseResult.errors.length > 0) {
      console.warn(`CSV parsing had ${parseResult.errors.length} errors`);
      parseResult.errors.slice(0, 5).forEach((err, i) => {
        console.warn(
          `Error ${i + 1}: ${err.message} at row ${err.row || "unknown"}`,
        );
      });

      if (parseResult.data.length === 0) {
        if (operationId) {
          ProgressTracker.update(operationId, {
            status: "error",
            message: `CSV parsing failed: No data could be parsed`,
          });
        }
        throw new Error(`CSV parsing failed: No data could be parsed`);
      } else {
        if (operationId) {
          ProgressTracker.update(operationId, {
            progress: 10,
            message: `Processing ${parseResult.data.length} rows from CSV (with some parsing warnings)...`,
          });
        }
        console.warn(
          `Continuing with ${parseResult.data.length} successfully parsed rows`,
        );
      }
    }

    // Logging Totals rows before filtering
    console.log(`Total rows in CSV: ${parseResult.data.length}`);
    if (operationId) {
      ProgressTracker.update(operationId, {
        progress: 10,
        message: `Processing ${parseResult.data.length} rows from CSV...`,
      });
    }

    // OPTIMIZATION: More efficient filtering and deduplication
    // Filter out rows with "None" risk level
    const validRows = parseResult.data.filter((row) => row.Risk !== "None");
    console.log(`Rows after removing None risk: ${validRows.length}`);

    // OPTIMIZATION: Use simple key generation for deduplication
    const uniqueRowsMap = new Map<string, CsvRow>();
    for (const row of validRows) {
      // Use our unified key generation function for deduplication
      const key = generateUniqueKey(row, params);
      uniqueRowsMap.set(key, row);
    }

    const uniqueRows = Array.from(uniqueRowsMap.values());
    console.log(`Unique rows: ${uniqueRows.length}`);

    if (operationId) {
      ProgressTracker.update(operationId, {
        progress: 15,
        message: `Found ${uniqueRows.length} unique vulnerabilities to process`,
      });
    }

    // Log duplicate stats if found
    if (uniqueRows.length < validRows.length) {
      console.log(
        `Found ${validRows.length - uniqueRows.length} duplicate rows`,
      );
      // Only log a sample of duplicates for debugging
      if (validRows.length - uniqueRows.length > 0) {
        const duplicateKeys = new Map<string, number>();

        // Count occurrences of each key
        for (const row of validRows) {
          const key = generateUniqueKey(row, params);
          duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1);
        }

        // Log a few examples of duplicates
        let count = 0;
        for (const [key, occurrences] of duplicateKeys.entries()) {
          if (occurrences > 1) {
            console.log(
              `Key with ${occurrences} duplicates: ${key.substring(0, 100)}...`,
            );
            if (++count >= 5) break; // Only log first 5 duplicate keys
          }
        }
      }
    }

    try {
      // Find the most recent quarter before the provided date
      if (operationId) {
        ProgressTracker.update(operationId, {
          progress: 20,
          message: "Finding previous quarter data...",
        });
      }

      // OPTIMIZATION: More specific query with only needed fields
      const previousQuarter = await prisma.vulnerabilityQuarter.findFirst({
        where: {
          vulnerability: {
            companyId: params.companyId,
            assetOS: params.assetOS,
          },
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

      // Process CSV rows and generate vulnerability data
      if (operationId) {
        ProgressTracker.update(operationId, {
          progress: 25,
          message: "Generating vulnerability data...",
        });
      }

      // OPTIMIZATION: More efficient vulnerability data generation
      const vulnDataBatch = uniqueRows.map((row) => {
        // mapCsvRowToVulnerability now generates uniqueHash internally
        const vulnData = mapCsvRowToVulnerability(row, params);
        return { vulnData };
      });

      // Get all unique hashes from the import data using a Set for better performance
      const allUniqueHashes = new Set(
        vulnDataBatch.map((v) => v.vulnData.uniqueHash),
      );
      console.log(`Total unique vulnerabilities: ${allUniqueHashes.size}`);

      // Split the vulnerabilities into batches
      const batches = chunkArray(vulnDataBatch, batchSize);
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
      const batchProgressShare = 40; // 40% of total progress for processing batches
      const batchProgressPerUnit =
        batches.length > 0 ? batchProgressShare / batches.length : 0;

      // Process each batch with improved transaction settings
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(
          `Processing batch ${i + 1}/${batches.length} with ${batch.length} items`,
        );

        if (operationId) {
          ProgressTracker.update(operationId, {
            progress: 30 + Math.floor(i * batchProgressPerUnit),
            message: `Processing batch ${i + 1} of ${batches.length}...`,
          });
        }

        // Each batch gets its own transaction with improved settings
        await prisma.$transaction(
          async (tx) => {
            await processBatch(
              tx,
              batch,
              quarter,
              fileUploadDate,
              previousQuarter,
            );
          },
          {
            // Increased transaction timeouts for larger batches
            timeout: 180000, // 3 minutes
            maxWait: 45000, // 45 seconds
          },
        );

        console.log(`Completed batch ${i + 1}/${batches.length}`);
      }

      // After all batches are processed, handle vulnerabilities not in current CSV
      console.log("Processing vulnerabilities not in current CSV...");

      if (operationId) {
        ProgressTracker.update(operationId, {
          progress: 70,
          message: "Resolving old vulnerabilities...",
        });
      }

      // Process just the current OS type
      console.log(`Processing OS: ${params.assetOS}`);

      // OPTIMIZATION: More efficient resolution of old vulnerabilities
      // First, check if we need to handle this at all
      const hasUnresolvedVulnerabilities =
        await prisma.vulnerabilityQuarter.findFirst({
          where: {
            vulnerability: {
              companyId: params.companyId,
              assetOS: params.assetOS,
            },
            isResolved: false,
            ...(previousQuarter ? { quarter: previousQuarter.quarter } : {}),
          },
          select: { id: true },
        });

      if (!hasUnresolvedVulnerabilities) {
        console.log(
          "No unresolved vulnerabilities from previous quarter. Skipping resolution phase.",
        );
      } else {
        // Find active vulnerabilities for this company and OS in smaller batches
        // Use a cursor-based approach to avoid loading too many records at once
        let lastId: string | null = null;
        let hasMore = true;
        const PAGE_SIZE = 2500; // Increase page size for better performance
        const vulnIdsToResolve: string[] = [];
        let totalUnresolvedVulns = 0;

        while (hasMore) {
          // OPTIMIZATION: More targeted query to reduce data transfer
          const activeVulnsBatch = await prisma.vulnerability.findMany({
            where: {
              companyId: params.companyId,
              assetOS: params.assetOS,
              ...(lastId ? { id: { gt: lastId } } : {}), // Cursor pagination
              quarterData: {
                some: {
                  ...(previousQuarter
                    ? { quarter: previousQuarter.quarter }
                    : {}),
                  isResolved: false,
                },
              },
            },
            select: {
              id: true,
              uniqueHash: true,
              quarterData: {
                where: { quarter },
                select: { id: true, isResolved: true },
              },
            },
            orderBy: { id: "asc" },
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

          // Filter this batch using the hashSet for efficient lookups
          for (const vuln of activeVulnsBatch) {
            if (!allUniqueHashes.has(vuln.uniqueHash)) {
              // Only include vulnerabilities that aren't in the current import
              vulnIdsToResolve.push(vuln.id);
            }
          }

          totalUnresolvedVulns = vulnIdsToResolve.length;
          console.log(
            `Found ${vulnIdsToResolve.length} vulnerabilities to resolve so far`,
          );
        }

        console.log(
          `Found total of ${totalUnresolvedVulns} vulnerabilities to mark as resolved`,
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
            `Processing unresolved batch ${i + 1}/${unresolvedBatches.length} with ${batch.length} items`,
          );

          if (operationId) {
            ProgressTracker.update(operationId, {
              progress: 70 + Math.floor(i * unresolvedProgressPerUnit),
              message: `Resolving old vulnerabilities: batch ${i + 1} of ${unresolvedBatches.length}...`,
            });
          }

          // OPTIMIZATION: More efficient transaction handling for resolving old vulnerabilities
          await prisma.$transaction(
            async (tx) => {
              // Check if these vulnerabilities already have quarter entries for current quarter
              const existingQuarters = await tx.vulnerabilityQuarter.findMany({
                where: {
                  vulnerabilityId: { in: batch },
                  quarter,
                },
                select: {
                  id: true,
                  vulnerabilityId: true,
                  isResolved: true,
                },
              });

              // Create lookup map for efficient processing
              const existingQuarterMap = new Map(
                existingQuarters.map((q) => [q.vulnerabilityId, q]),
              );

              // Group by operation type
              const quartersToUpdate: string[] = [];
              const vulnIdsForNewQuarters: string[] = [];

              for (const vulnId of batch) {
                const existing = existingQuarterMap.get(vulnId);
                if (existing) {
                  if (!existing.isResolved) {
                    quartersToUpdate.push(existing.id);
                  }
                } else {
                  vulnIdsForNewQuarters.push(vulnId);
                }
              }

              // Perform bulk updates where possible
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

              // Create new quarters for those that don't have them
              if (vulnIdsForNewQuarters.length > 0) {
                // Create in chunks to avoid parameter limits
                const createChunks = chunkArray(
                  vulnIdsForNewQuarters,
                  DB_QUERY_BATCH_SIZE,
                );
                for (const chunk of createChunks) {
                  // Unfortunately, we can't use createMany with relationships
                  // But we can use Promise.all for parallel processing
                  await Promise.all(
                    chunk.map((vulnId) =>
                      tx.vulnerabilityQuarter.create({
                        data: {
                          vulnerabilityId: vulnId,
                          quarter,
                          isResolved: true,
                          fileUploadDate,
                        },
                      }),
                    ),
                  );
                }
              }
            },
            {
              // Improved transaction settings
              timeout: 180000, // 3 minutes
              maxWait: 45000, // 45 seconds
            },
          );

          console.log(
            `Completed unresolved batch ${i + 1}/${unresolvedBatches.length}`,
          );
        }
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
          message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
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
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    throw error;
  }
}
