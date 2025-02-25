import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyAuth } from "@/utils/verifyAuth";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const auth = await verifyAuth();
    if (!auth.authenticated) return auth.response;

    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get("companyId") || "");

    if (isNaN(companyId)) {
      return NextResponse.json(
        { error: "Invalid company ID" },
        { status: 400 },
      );
    }

    const quarters = await prisma.vulnerabilityQuarter.findMany({
      where: {
        vulnerability: {
          companyId: companyId,
        },
      },
      select: {
        quarter: true,
        quarterDate: true,
      },
      distinct: ["quarter"],
      orderBy: {
        quarterDate: "desc",
      },
    });

    return NextResponse.json(quarters);
  } catch (error) {
    console.error("Error fetching quarters:", error);
    return NextResponse.json(
      { error: "Failed to fetch quarters" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
