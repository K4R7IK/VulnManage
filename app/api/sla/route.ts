// app/api/sla/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAuth } from "@/utils/verifyAuth";

// Define a service for handling SLA operations
class SLAService {
  constructor(private prisma: typeof prisma) { }

  async getSLAConfig(companyId: number) {
    try {
      // Use Prisma's findMany instead of raw SQL
      const slaConfigs = await this.prisma.riskSLA.findMany({
        where: { companyId },
        orderBy: [{ type: "asc" }, { riskLevel: "desc" }],
      });

      return slaConfigs;
    } catch (error) {
      console.error("Error fetching SLA config:", error);
      // Return empty array if table doesn't exist or other error occurs
      return [];
    }
  }

  async updateSLAConfig(companyId: number, slaData: any[]) {
    try {
      // Use a transaction to ensure atomicity
      return await this.prisma.$transaction(async (tx) => {
        // Delete existing SLA configurations for this company
        await tx.riskSLA.deleteMany({
          where: { companyId },
        });

        // Insert new SLA configurations
        // Must use individual create calls since createMany doesn't return data
        for (const sla of slaData) {
          await tx.riskSLA.create({
            data: {
              companyId,
              riskLevel: sla.riskLevel,
              sla: Number(sla.sla),
              type: sla.type,
            },
          });
        }

        return true;
      });
    } catch (error) {
      console.error("Error updating SLA config:", error);
      throw error;
    }
  }
}

const slaService = new SLAService(prisma);

// GET: Fetch SLA configuration for a company
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

    // Fetch SLA configuration for the company
    const slaConfig = await slaService.getSLAConfig(Number(companyId));

    return NextResponse.json(slaConfig);
  } catch (error) {
    console.error("Error fetching SLA configuration:", error);
    return NextResponse.json(
      { error: "Failed to fetch SLA configuration" },
      { status: 500 }
    );
  }
}

// POST: Create or update SLA configuration
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth();
    if (!auth.authenticated) return auth.response;

    // Only admins can update SLA configuration
    if (auth.user && auth.user.role !== "Admin") {
      return NextResponse.json(
        { error: "Unauthorized: Admin privileges required" },
        { status: 403 }
      );
    }

    // Get request body
    const body = await request.json();
    const { companyId, slaData } = body;

    if (!companyId || !slaData || !Array.isArray(slaData)) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }

    // Update SLA configurations
    await slaService.updateSLAConfig(Number(companyId), slaData);

    return NextResponse.json({
      message: "SLA configuration updated successfully",
    });
  } catch (error) {
    console.error("Error updating SLA configuration:", error);
    return NextResponse.json(
      { error: "Failed to update SLA configuration" },
      { status: 500 }
    );
  }
}
