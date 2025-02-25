import { verifyAuth } from "@/utils/verifyAuth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const auth = await verifyAuth();
    if (!auth.authenticated) return auth.response;

    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId");

    // Pagination params
    const page = Number(url.searchParams.get("page")) || 1;
    const limit = Number(url.searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;

    // Sorting params
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";

    // Filter params
    const riskLevels = url.searchParams.get("riskLevels")?.split(",") || [];
    const assetIps = url.searchParams.get("assetIps")?.split(",") || [];
    const ports = url.searchParams.get("ports")?.split(",").map(Number) || [];
    const searchQuery = url.searchParams.get("search") || "";
    const quarter = url.searchParams.get("quarter");
    const status = url.searchParams.get("status"); // 'resolved', 'unresolved', or null

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 },
      );
    }

    // Build where clause
    const whereClause: any = {
      companyId: Number(companyId),
    };

    // Add filters
    if (riskLevels.length > 0) {
      whereClause.riskLevel = { in: riskLevels };
    }
    if (assetIps.length > 0) {
      whereClause.assetIp = { in: assetIps };
    }
    if (ports.length > 0) {
      whereClause.port = { in: ports };
    }
    if (searchQuery) {
      whereClause.title = { contains: searchQuery, mode: "insensitive" };
    }

    // Handle quarter and status filtering
    if (quarter || status) {
      whereClause.quarterData = {
        some: {
          ...(quarter && { quarter }),
          ...(status === "resolved" && { isResolved: true }),
          ...(status === "unresolved" && { isResolved: false }),
        },
      };
    }

    // Get total count for pagination
    const total = await prisma.vulnerability.count({
      where: whereClause,
    });

    // Get paginated and filtered data
    const vulnerabilities = await prisma.vulnerability.findMany({
      where: whereClause,
      include: {
        quarterData: {
          select: {
            id: true,
            quarter: true,
            isResolved: true,
            quarterDate: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip,
      take: limit,
    });

    // Get unique values for filters
    const filterOptions = await prisma.vulnerability.findMany({
      where: { companyId: Number(companyId) },
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

    // Process filter options
    const uniqueFilterOptions = {
      riskLevels: [...new Set(filterOptions.map((v) => v.riskLevel))],
      assetIps: [...new Set(filterOptions.map((v) => v.assetIp))],
      ports: [...new Set(filterOptions.map((v) => v.port).filter(Boolean))],
      quarters: [...new Set(quartersResult.map((q) => q.quarter))],
    };

    return NextResponse.json({
      data: vulnerabilities,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      },
      filterOptions: uniqueFilterOptions,
    });
  } catch (error) {
    console.error("Error fetching vulnerabilities:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
