import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    const whereClause = companyId ? { companyId: Number(companyId) } : {};

    const summaries = await prisma.vulnerabilitySummary.findMany({
      where: whereClause,
      orderBy: {
        quarter: "desc",
      },
      take: 10,
    });

    return NextResponse.json(summaries);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch vulnerability summaries" },
      { status: 500 }
    );
  }
}
