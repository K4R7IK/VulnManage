// app/api/vuln/overdue/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAuth } from "@/utils/verifyAuth";
import { determineAssetType } from "@/utils/slaUtils";
import { PrismaClient } from "@prisma/client";

// Define valid asset types
type AssetType = "Internet" | "Intranet" | "Endpoint";
type RiskLevel = "Critical" | "High" | "Medium" | "Low" | "None";

class OverdueVulnerabilityService {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  async getCompanySLAs(companyId: number) {
    try {
      const slaRecords = await this.prisma.riskSLA.findMany({
        where: { companyId },
      });

      const slaMapping: Record<string, Record<string, number>> = {
        Internet: {},
        Intranet: {},
        Endpoint: {},
      };

      for (const record of slaRecords) {
        if (!slaMapping[record.type]) {
          slaMapping[record.type] = {};
        }
        slaMapping[record.type][record.riskLevel] = record.sla;
      }

      return slaMapping;
    } catch (error) {
      console.error("Error fetching SLAs:", error);
      return {
        Internet: {},
        Intranet: {},
        Endpoint: {},
      };
    }
  }

  getDefaultSLAs() {
    return {
      Internet: {
        Critical: 7,
        High: 14,
        Medium: 30,
        Low: 60,
        None: 90,
      },
      Intranet: {
        Critical: 14,
        High: 30,
        Medium: 60,
        Low: 90,
        None: 120,
      },
      Endpoint: {
        Critical: 30,
        High: 60,
        Medium: 90,
        Low: 120,
        None: 180,
      },
    } as const;
  }

  // Calculate SLA deadline based on risk level and asset type
  calculateSLADeadline(
    discoveryDate: Date,
    riskLevel: string,
    assetType: string,
    slaMapping: Record<string, Record<string, number>>,
  ): Date {
    // Get SLA days from mapping or use defaults
    const defaultSLAs = this.getDefaultSLAs();
    const validAssetType = (assetType as AssetType) || "Internet";
    const validRiskLevel = (riskLevel as RiskLevel) || "Medium";

    // First check custom SLA mapping
    let slaDays = 30; // Default fallback
    if (
      slaMapping[validAssetType] &&
      slaMapping[validAssetType][validRiskLevel]
    ) {
      slaDays = slaMapping[validAssetType][validRiskLevel];
    }
    // Then check default SLAs if not found in custom mapping
    else if (
      defaultSLAs[validAssetType as keyof typeof defaultSLAs]?.[
        validRiskLevel as keyof typeof defaultSLAs.Internet
      ]
    ) {
      slaDays =
        defaultSLAs[validAssetType as keyof typeof defaultSLAs][
          validRiskLevel as keyof typeof defaultSLAs.Internet
        ];
    }

    // Calculate deadline
    const deadline = new Date(discoveryDate);
    deadline.setDate(deadline.getDate() + slaDays);
    return deadline;
  }
}

const overdueService = new OverdueVulnerabilityService(prisma);

// GET: Fetch vulnerabilities that are past their SLA with optimized pagination
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth();
    if (!auth.authenticated) return auth.response;

    // Get params from query
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const sortBy = searchParams.get("sortBy") || "riskLevel";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const searchTerm = searchParams.get("search") || "";
    const riskLevels = searchParams.get("riskLevels")
      ? searchParams.get("riskLevels")?.split(",")
      : [];
    const assetTypes = searchParams.get("assetTypes")
      ? searchParams.get("assetTypes")?.split(",")
      : [];

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 },
      );
    }

    // Get SLA configurations for the company
    const slaMapping = await overdueService.getCompanySLAs(Number(companyId));

    // Build the query
    const where = {
      companyId: Number(companyId),
      quarterData: {
        some: {
          isResolved: false,
        },
      },
      ...(searchTerm
        ? {
            OR: [
              { title: { contains: searchTerm } },
              { assetIp: { contains: searchTerm } },
            ],
          }
        : {}),
      ...(riskLevels?.length
        ? {
            riskLevel: { in: riskLevels },
          }
        : {}),
    };

    // Count total vulnerabilities (this is a separate query)
    const totalCount = await prisma.vulnerability.count({ where });

    // Query for vulnerabilities with pagination
    const vulnerabilitiesQuery = {
      where,
      include: {
        quarterData: {
          orderBy: {
            fileUploadDate: "desc",
          },
          take: 1,
        },
      },
      take: limit,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1, // Skip the cursor
          }
        : {}),
    };

    // Add orderBy based on sortBy field
    const orderBy =
      sortBy === "riskLevel"
        ? { riskLevel: sortOrder === "asc" ? "asc" : "desc" }
        : { id: sortOrder === "asc" ? "asc" : "desc" }; // Default to id if not sorting by riskLevel

    const vulnerabilities = await prisma.vulnerability.findMany({
      ...vulnerabilitiesQuery,
      orderBy,
    });

    // Get today's date for overdue calculation
    const today = new Date();

    // Post-process to calculate days past SLA and filter to only overdue items
    const overdueVulnerabilities = [];
    let nextCursor = null;

    for (const vuln of vulnerabilities) {
      // Get the asset type for this vulnerability
      const assetType = determineAssetType(vuln.assetIp, vuln.assetOS);

      // Skip if asset type filter is applied and this doesn't match
      if (assetTypes?.length && !assetTypes.includes(assetType)) {
        continue;
      }

      // Get the most recent quarter data
      const latestQuarter = vuln.quarterData[0];
      if (!latestQuarter) continue;

      // Get the file upload date (discovery date)
      const discoveryDate = new Date(latestQuarter.fileUploadDate);

      // Calculate SLA deadline
      const deadline = overdueService.calculateSLADeadline(
        discoveryDate,
        vuln.riskLevel,
        assetType,
        slaMapping,
      );

      // Calculate days past SLA
      const diffTime = today.getTime() - deadline.getTime();
      const daysPastSLA = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Only include vulnerabilities that are overdue (daysPastSLA > 0)
      if (daysPastSLA > 0) {
        overdueVulnerabilities.push({
          id: vuln.id,
          assetIp: vuln.assetIp,
          assetOS: vuln.assetOS,
          title: vuln.title,
          riskLevel: vuln.riskLevel,
          fileUploadDate: latestQuarter.fileUploadDate.toISOString(),
          daysPastSLA: daysPastSLA,
          assetType: assetType,
        });
      }
    }

    // Sort by days past SLA if needed (this can't be done at the database level directly)
    if (sortBy === "daysPastSLA") {
      overdueVulnerabilities.sort((a, b) => {
        return sortOrder === "asc"
          ? a.daysPastSLA - b.daysPastSLA
          : b.daysPastSLA - a.daysPastSLA;
      });
    }

    // Set the next cursor
    if (
      overdueVulnerabilities.length === limit &&
      overdueVulnerabilities.length > 0
    ) {
      nextCursor = overdueVulnerabilities[overdueVulnerabilities.length - 1].id;
    }

    // Return the response
    return NextResponse.json({
      data: overdueVulnerabilities,
      nextCursor,
      totalCount,
    });
  } catch (error) {
    console.error("Error fetching overdue vulnerabilities:", error);
    return NextResponse.json(
      { error: "Failed to fetch overdue vulnerabilities" },
      { status: 500 },
    );
  }
}
