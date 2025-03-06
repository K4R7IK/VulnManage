// app/api/vuln/carryforward/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAuth } from "@/utils/verifyAuth";

// Define types for the where clause
interface WhereClause {
  companyId: number;
  riskLevel?: { in: string[] };
  assetIp?: { in: string[] };
  port?: { in: number[] };
  title?: { contains: string; mode: string };
  [key: string]: unknown;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth();
    if (!auth.authenticated) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get("companyId");
    const sourceQuarter = searchParams.get("sourceQuarter");
    const targetQuarter = searchParams.get("targetQuarter");
    const status = searchParams.get("status") || "unresolved";

    // Pagination params
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;

    // Sorting params
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Filter params
    const riskLevels =
      searchParams.get("riskLevels")?.split(",").filter(Boolean) || [];
    const assetIps =
      searchParams.get("assetIps")?.split(",").filter(Boolean) || [];
    const ports =
      searchParams.get("ports")?.split(",").filter(Boolean).map(Number) || [];
    const searchQuery = searchParams.get("search") || "";

    // Validation
    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 },
      );
    }

    if (!sourceQuarter || !targetQuarter) {
      return NextResponse.json(
        { error: "Source and target quarters are required" },
        { status: 400 },
      );
    }

    if (sourceQuarter === targetQuarter) {
      return NextResponse.json(
        { error: "Source and target quarters must be different" },
        { status: 400 },
      );
    }

    // Build base query with company ID
    const whereClause: WhereClause = {
      companyId: Number(companyId),
    };

    // Add filters for riskLevel, assetIp, and port if provided
    if (riskLevels.length > 0) {
      whereClause.riskLevel = { in: riskLevels };
    }

    if (assetIps.length > 0) {
      whereClause.assetIp = { in: assetIps };
    }

    if (ports.length > 0) {
      whereClause.port = { in: ports };
    }

    // Add search filter if provided
    if (searchQuery) {
      whereClause.title = { contains: searchQuery, mode: "insensitive" };
    }

    // Get vulnerabilities in the source quarter with base filters
    const sourceVulnerabilities = await prisma.vulnerabilityQuarter.findMany({
      where: {
        quarter: sourceQuarter,
        vulnerability: whereClause,
      },
      select: {
        vulnerabilityId: true,
      },
    });

    // Get vulnerabilities in the target quarter with resolution status
    const targetVulnerabilities = await prisma.vulnerabilityQuarter.findMany({
      where: {
        quarter: targetQuarter,
        isResolved: status === "resolved",
      },
      select: {
        vulnerabilityId: true,
      },
    });

    // Create sets for efficient lookups
    const sourceVulnIds = new Set(
      sourceVulnerabilities.map(
        (v: { vulnerabilityId: string }) => v.vulnerabilityId,
      ),
    );
    const targetVulnIds = new Set(
      targetVulnerabilities.map(
        (v: { vulnerabilityId: string }) => v.vulnerabilityId,
      ),
    );

    // Find the intersection (vulnerabilities in both quarters)
    const vulnIds = Array.from(sourceVulnIds).filter((id) =>
      targetVulnIds.has(id),
    );

    // Calculate total count for pagination
    const totalCount = vulnIds.length;

    // Apply pagination to the IDs (to avoid database parameter limits)
    const paginatedIds = vulnIds.slice(skip, skip + limit);

    // Split the IDs into chunks to avoid too many bind variables
    const CHUNK_SIZE = 1000; // PostgreSQL typically allows up to 32767 parameters, but we'll be conservative
    const idChunks: string[][] = [];

    for (let i = 0; i < paginatedIds.length; i += CHUNK_SIZE) {
      idChunks.push(paginatedIds.slice(i, i + CHUNK_SIZE));
    }

    // Define the vulnerability type based on prisma return type
    type VulnerabilityWithQuarters = Awaited<
      ReturnType<typeof prisma.vulnerability.findFirst>
    > & {
      quarterData: {
        id: string;
        quarter: string;
        isResolved: boolean;
        fileUploadDate: Date;
      }[];
    };

    // Fetch vulnerabilities for each chunk and merge the results
    let carryForwardVulnerabilities: VulnerabilityWithQuarters[] = [];

    for (const chunk of idChunks) {
      const vulnerabilities = (await prisma.vulnerability.findMany({
        where: {
          id: { in: chunk },
        },
        include: {
          quarterData: {
            select: {
              id: true,
              quarter: true,
              isResolved: true,
              fileUploadDate: true,
            },
            orderBy: {
              fileUploadDate: "desc",
            },
          },
        },
      })) as VulnerabilityWithQuarters[];

      carryForwardVulnerabilities = [
        ...carryForwardVulnerabilities,
        ...vulnerabilities,
      ];
    }

    // Sort the results according to the requested sort order
    if (sortBy && sortBy !== "createdAt") {
      carryForwardVulnerabilities.sort((a, b) => {
        const aValue = a[sortBy as keyof typeof a];
        const bValue = b[sortBy as keyof typeof b];

        if (typeof aValue === "string" && typeof bValue === "string") {
          return sortOrder === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else {
          const numA = Number(aValue || 0);
          const numB = Number(bValue || 0);
          return sortOrder === "asc" ? numA - numB : numB - numA;
        }
      });
    } else {
      // Default sort by createdAt
      carryForwardVulnerabilities.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      });
    }

    // Get unique values for filters
    let allFilterOptions;

    // Only get filter options if we have vulnerabilities
    if (vulnIds.length > 0) {
      // Use a limited subset of IDs for filter options to avoid parameter limits
      const filterIds = vulnIds.slice(0, Math.min(vulnIds.length, 1000));

      const filterOptions = await prisma.vulnerability.findMany({
        where: {
          companyId: Number(companyId),
          id: { in: filterIds },
        },
        select: {
          riskLevel: true,
          assetIp: true,
          port: true,
        },
        distinct: ["riskLevel", "assetIp", "port"],
      });

      // Get unique quarters for the company
      const quartersResult = await prisma.vulnerabilityQuarter.findMany({
        where: {
          vulnerability: {
            companyId: Number(companyId),
          },
        },
        select: {
          quarter: true,
        },
        distinct: ["quarter"],
        orderBy: {
          quarter: "desc",
        },
      });

      // Process filter options with proper types
      type FilterOption = (typeof filterOptions)[number];

      allFilterOptions = {
        riskLevels: [
          ...new Set(filterOptions.map((v: FilterOption) => v.riskLevel)),
        ],
        assetIps: [
          ...new Set(filterOptions.map((v: FilterOption) => v.assetIp)),
        ],
        ports: [
          ...new Set(
            filterOptions
              .map((v: FilterOption) => v.port)
              .filter(Boolean) as number[],
          ),
        ],
        quarters: [
          ...new Set(quartersResult.map((q: { quarter: string }) => q.quarter)),
        ],
      };
    } else {
      // No vulnerabilities - return empty filter options
      allFilterOptions = {
        riskLevels: [],
        assetIps: [],
        ports: [],
        quarters: [],
      };
    }

    return NextResponse.json({
      data: carryForwardVulnerabilities,
      pagination: {
        total: totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit),
        limit,
      },
      filterOptions: allFilterOptions,
    });
  } catch (error) {
    console.error(
      "Error fetching carry forward vulnerabilities:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
