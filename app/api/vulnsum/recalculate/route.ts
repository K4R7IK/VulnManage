// app/api/vulnsum/recalculate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { calculateVulnerabilitySummary } from "@/utils/calculateSummary";
import { verifyAuth } from "@/utils/verifyAuth";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth();
    if (!auth.authenticated) return auth.response;

    // Extract companyId from query parameters
    const searchParams = request.nextUrl.searchParams;
    const companyIdStr = searchParams.get("companyId");

    if (!companyIdStr) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 },
      );
    }

    const companyId = parseInt(companyIdStr, 10);

    // Get all distinct quarters for this company
    const quarters = await prisma.vulnerabilityQuarter.findMany({
      where: {
        vulnerability: {
          companyId,
        },
      },
      distinct: ["quarter"],
      select: { quarter: true },
    });
    const uniqueQuarters = [...new Set(quarters.map((q) => q.quarter))];
    console.log(
      `Recalculating summaries for company ${companyId}, quarters:`,
      uniqueQuarters,
    );

    if (uniqueQuarters.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No quarters found for this company",
        },
        { status: 404 },
      );
    }

    // For each quarter, recalculate the summary
    for (const quarter of uniqueQuarters) {
      try {
        // Get the file upload date for this quarter (using the most recent one)
        const latestQuarterData = await prisma.vulnerabilityQuarter.findFirst({
          where: {
            quarter,
            vulnerability: {
              companyId,
            },
          },
          orderBy: {
            fileUploadDate: "desc",
          },
          select: {
            fileUploadDate: true,
          },
        });

        if (latestQuarterData) {
          console.log(
            `Recalculating for quarter ${quarter} with upload date ${latestQuarterData.fileUploadDate}`,
          );
          await calculateVulnerabilitySummary(prisma, {
            companyId,
            quarter,
            fileUploadDate: latestQuarterData.fileUploadDate,
          });
        } else {
          console.warn(`No file upload date found for quarter ${quarter}`);
        }
      } catch (quarterError) {
        console.error(`Error processing quarter ${quarter}:`, quarterError);
        // Continue with other quarters instead of failing the entire request
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully recalculated summaries for ${uniqueQuarters.length} quarters`,
    });
  } catch (error) {
    console.error("Error recalculating summaries:", error);
    return NextResponse.json(
      { error: "Failed to recalculate summaries", details: String(error) },
      { status: 500 },
    );
  } finally {
    // Make sure to disconnect the Prisma client
    await prisma.$disconnect();
  }
}
