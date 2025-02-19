// app/api/vuln/route.ts

import { verifyAuth } from "@/utils/verifyAuth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const auth = await verifyAuth();
    if (!auth.authenticated) return auth.response;

    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    const vuln = await prisma.vulnerability.findMany({
      where: { companyId: Number(companyId) },
    });

    return NextResponse.json(vuln);
  } catch (error) {
    console.error("Error fetching vulnerabilities:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
