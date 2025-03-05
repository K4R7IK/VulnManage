// app/api/vuln/overdue/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAuth } from "@/utils/verifyAuth";
import { determineAssetType } from "@/utils/slaUtils";

class OverdueVulnerabilityService {
  constructor(private prisma: typeof prisma) {}

  async getCompanySLAs(companyId: number) {
    try {
      // Use Prisma's findMany instead of raw SQL
      const slaRecords = await this.prisma.riskSLA.findMany({
        where: { companyId },
      });

      // Format the result into a more usable structure
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
      // Return default mapping if table doesn't exist or other error occurs
      return {
        Internet: {},
        Intranet: {},
        Endpoint: {},
      };
    }
  }

  async getDefaultSLAs() {
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
    };
  }

  calculateDaysPastSLA(
    discoveryDate: Date,
    riskLevel: string,
    assetType: string,
    slaMapping: Record<string, Record<string, number>>
  ): number {
    const today = new Date();

    // Get SLA days from mapping or use defaults
    const defaultSLAs = this.getDefaultSLAs();
    const slaDays =
      (slaMapping[assetType] && slaMapping[assetType][riskLevel]) ||
      defaultSLAs[assetType]?.[riskLevel] ||
      30; // Fallback to 30 days

    // Calculate deadline
    const deadline = new Date(discoveryDate);
    deadline.setDate(deadline.getDate() + slaDays);

    // Calculate days difference
    const diffTime = today.getTime() - deadline.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

const overdueService = new OverdueVulnerabilityService(prisma);

// GET: Fetch vulnerabilities that are past their SLA
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth();
    if (!auth.authenticated) return auth.response;

    // Get companyId from query params
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    // Fetch active (unresolved) vulnerabilities for the company
    const activeVulnerabilities = await prisma.vulnerability.findMany({
      where: {
        companyId: Number(companyId),
        quarterData: {
          some: {
            isResolved: false, // Only include unresolved vulnerabilities
          },
        },
      },
      include: {
        quarterData: {
          orderBy: {
            fileUploadDate: "desc",
          },
          take: 1,
        },
      },
    });

    // Get SLA configurations for the company
    const slaMapping = await overdueService.getCompanySLAs(Number(companyId));

    // Process vulnerabilities to find those that are overdue
    const overdueVulnerabilities = activeVulnerabilities
      .map((vuln) => {
        // Get the asset type for this vulnerability
        const assetType = determineAssetType(vuln.assetIp, vuln.assetOS);

        // Get the most recent quarter data for this vulnerability
        const latestQuarter = vuln.quarterData[0];
        if (!latestQuarter) return null;

        // Get the file upload date (discovery date)
        const discoveryDate = new Date(latestQuarter.fileUploadDate);

        // Calculate days past SLA
        const daysPastSLA = overdueService.calculateDaysPastSLA(
          discoveryDate,
          vuln.riskLevel,
          assetType,
          slaMapping
        );

        // Only include vulnerabilities that are overdue (daysPastSLA > 0)
        if (daysPastSLA > 0) {
          return {
            id: vuln.id,
            assetIp: vuln.assetIp,
            assetOS: vuln.assetOS,
            title: vuln.title,
            riskLevel: vuln.riskLevel,
            fileUploadDate: latestQuarter.fileUploadDate.toISOString(),
            daysPastSLA: daysPastSLA,
            assetType: assetType,
          };
        }

        return null;
      })
      .filter(Boolean); // Remove null values

    return NextResponse.json(overdueVulnerabilities);
  } catch (error) {
    console.error("Error fetching overdue vulnerabilities:", error);
    return NextResponse.json(
      { error: "Failed to fetch overdue vulnerabilities" },
      { status: 500 }
    );
  }
}
