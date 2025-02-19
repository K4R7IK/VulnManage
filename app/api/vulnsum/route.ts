import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAuth } from "@/utils/verifyAuth";

export async function GET(request: Request) {
  try {
    const auth = await verifyAuth();
    if (!auth.authenticated) return auth.response;

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
