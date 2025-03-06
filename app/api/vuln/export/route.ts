// app/api/vuln/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/utils/verifyAuth";
import prisma from "@/lib/prisma";

interface ExportedVulnerability {
  "Asset IP": string;
  "Asset OS": string;
  Port: string | number;
  Protocol: string;
  Title: string;
  "CVE IDs": string;
  "Risk Level": string;
  "CVSS Score": string | number;
  Description: string;
  Impact: string;
  Recommendations: string;
  References: string;
  Company: string;
  Status: string;
  Quarter: string;
  "Created At": string;
  [key: string]: string | number; // Index signature to allow dynamic property access
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await verifyAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const companyId = searchParams.get("companyId")
      ? Number(searchParams.get("companyId"))
      : null;
    const tab = searchParams.get("tab") || "all";

    const where: Record<string, unknown> = {
      title: { contains: search, mode: "insensitive" },
    };

    // Company access control
    if (user.role !== "Admin") {
      where.companyId = user.companyId;
    } else if (companyId) {
      where.companyId = companyId;
    }

    // Tab filtering
    if (tab === "resolved") {
      where.quarterData = {
        some: {
          isResolved: true,
        },
      };
    } else if (tab === "unresolved") {
      where.quarterData = {
        some: {
          isResolved: false,
        },
      };
    }

    const vulnerabilities = await prisma.vulnerability.findMany({
      where,
      include: {
        company: {
          select: {
            name: true,
          },
        },
        quarterData: {
          select: {
            isResolved: true,
            quarter: true,
          },
          orderBy: {
            fileUploadDate: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const csvData = vulnerabilities.map((vuln) => ({
      "Asset IP": vuln.assetIp,
      "Asset OS": vuln.assetOS || "",
      Port: vuln.port || "",
      Protocol: vuln.protocol || "",
      Title: vuln.title,
      "CVE IDs": vuln.cveId.join(", "),
      "Risk Level": vuln.riskLevel,
      "CVSS Score": vuln.cvssScore || "",
      Description: vuln.description.replace(/[\n\r]+/g, " "),
      Impact: vuln.impact.replace(/[\n\r]+/g, " "),
      Recommendations: vuln.recommendations.replace(/[\n\r]+/g, " "),
      References: vuln.references.join(", "),
      Company: vuln.company.name,
      Status: vuln.quarterData[0]?.isResolved ? "Resolved" : "Unresolved",
      Quarter: vuln.quarterData[0]?.quarter || "",
      "Created At": vuln.createdAt.toISOString().split("T")[0],
    }));

    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(","),
      ...csvData.map((row) =>
        headers
          .map((header) => {
            const value = row[header as keyof ExportedVulnerability];
            return JSON.stringify(value?.toString() || "").replace(/\\n/g, " ");
          })
          .join(","),
      ),
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="vulnerabilities-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
