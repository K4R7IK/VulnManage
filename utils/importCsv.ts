import { createHash } from "crypto";
import { PrismaClient, RiskLevel, Vulnerability } from "@prisma/client";
import Papa from "papaparse";
import { calculateVulnerabilitySummary } from "./calculateSummary";

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
  createdDate: Date;
  quarter: string;
  assetOS: string;
  csvContent: string;
  companyId: number;
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
  port?: number;
  protocol?: string;
  title: string;
  cveId: string[];
  description: string;
  riskLevel: RiskLevel;
  cvssScore?: number;
  impact: string;
  recommendations: string;
  references: string[];
  companyId: number;
  pluginOutput?: string | null;
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
    protocol: row.Protocol || null, // Changed from lowercase protocol to match CSV header
    title: row.Name, // Changed from name to match CSV header
    cveId: row.CVE ? [row.CVE] : ["None"],
    description: row.Description,
    riskLevel: mapRiskLevel(row.Risk), // Changed from lowercase risk to match CSV header
    cvssScore: row["CVSS v2.0 Base Score"] // Changed to match CSV header
      ? parseFloat(row["CVSS v2.0 Base Score"])
      : null,
    impact: row.Synopsis, // Changed from synopsis to match CSV header
    recommendations: row.Solution, // Changed from solution to match CSV header
    references: row["See Also"] ? [row["See Also"]] : [], // Changed from seeAlso to match CSV header
    pluginOutput: row["Plugin Output"] || null, // Changed from pluginOutput to match CSV header
    companyId: params.companyId,
    uniqueHash: "", // Will be set after object creation
  };
}

// Main import function
export async function importVulnerabilities(
  prisma: PrismaClient,
  params: ImportParams,
): Promise<void> {
  const { createdDate, quarter, csvContent } = params;

  // Parse CSV content
  const parseResult = Papa.parse<CsvRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  if (parseResult.errors.length > 0) {
    throw new Error(`CSV parsing failed: ${parseResult.errors[0].message}`);
  }

  // Logging Totals rows before filtering
  console.log(`Total rows in Csv: ${parseResult.data.length}`);

  // Filter out rows with "None" risk level
  const validRows = parseResult.data.filter((row) => row.Risk !== "None");
  console.log(`Rows after remove None risk: ${validRows.length}`);

  const rowStrings = validRows.map((row) => JSON.stringify(row));
  const uniqueRows = [...new Set(rowStrings)].map((str) => JSON.parse(str));
  console.log(`Unique rows : ${uniqueRows.length}`);

  if (uniqueRows.length < validRows.length) {
    console.log(`Found ${validRows.length - uniqueRows.length} duplicate rows`);
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

  // Start transaction
  try {
    await prisma.$transaction(async (tx) => {
      // Find the most recent quarter before the provided date
      const previousQuarter = await tx.vulnerabilityQuarter.findFirst({
        where: {
          vulnerability: { companyId: params.companyId },
          quarterDate: { lt: createdDate },
        },
        orderBy: {
          quarterDate: "desc",
        },
        select: {
          quarterDate: true,
          quarter: true,
        },
      });

      // Process CSV rows and generate hashes
      const vulnDataAndHashes = uniqueRows.map((row) => {
        const vulnData = {
          ...mapCsvRowToVulnerability(row, params),
          assetOS: params.assetOS, // Ensure assetOS is not null
        };
        const hash = generateVulnHash(vulnData);
        vulnData.uniqueHash = hash;
        return { vulnData, hash };
      });

      const uniqueHashes = [...new Set(vulnDataAndHashes.map((v) => v.hash))];

      // Get existing vulnerabilities by hashes
      const existingVulns = await tx.vulnerability.findMany({
        where: {
          AND: [
            { companyId: params.companyId },
            { assetOS: params.assetOS },
            { uniqueHash: { in: uniqueHashes } },
          ],
        },
        include: {
          quarterData: {
            where: previousQuarter
              ? {
                  OR: [{ quarter: previousQuarter.quarter }, { quarter }],
                }
              : undefined,
            orderBy: { quarterDate: "desc" },
          },
        },
      });

      // Map existing vulnerabilities by hash
      const existingVulnMap = new Map(
        existingVulns.map((vuln) => [vuln.uniqueHash, vuln]),
      );

      // Process vulnerabilities from CSV
      for (const { vulnData, hash } of vulnDataAndHashes) {
        if (existingVulnMap.has(hash)) {
          // Case 1: Vulnerability exists in database
          const existingVuln = existingVulnMap.get(hash)!;

          // Check if we already have an entry for this quarter
          const existingQuarter = existingVuln.quarterData.find(
            (q) => q.quarter === quarter,
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
                quarterDate: createdDate,
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
                  quarterDate: createdDate,
                },
              },
            },
          });
        }
      }

      // Case 3: Handle vulnerabilities not in current CSV
      const unresolvedVulns = await tx.vulnerability.findMany({
        where: {
          AND: [
            { companyId: params.companyId },
            { assetOS: params.assetOS },
            { uniqueHash: { notIn: uniqueHashes } },
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
            orderBy: { quarterDate: "desc" },
          },
        },
      });

      // Mark these vulnerabilities as resolved for current quarter
      for (const vuln of unresolvedVulns) {
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
              quarterDate: createdDate,
            },
          });
        }
      }
    });

    await calculateVulnerabilitySummary(prisma, {
      companyId: params.companyId,
      quarter: quarter,
      createdDate: createdDate,
    });
  } catch (error) {
    console.error("Error importing vulnerabilities:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
