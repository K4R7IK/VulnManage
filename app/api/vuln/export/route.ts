// app/api/vuln/carryforward/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/utils/verifyAuth";
import { prisma } from "@/lib/prisma";

interface ExportedCarryForwardVulnerability {
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
  "Source Quarter": string;
  "Target Quarter": string;
  "Status in Source": string;
  "Status in Target": string;
  "First Seen": string;
  "Last Updated": string;
  [key: string]: string | number; // Index signature to allow dynamic property access
}

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuth();
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const companyId = searchParams.get("companyId")
      ? Number(searchParams.get("companyId"))
      : null;
    const sourceQuarter = searchParams.get("sourceQuarter");
    const targetQuarter = searchParams.get("targetQuarter");
    const status = searchParams.get("status") || "unresolved";
    const riskLevels =
      searchParams.get("riskLevels")?.split(",").filter(Boolean) || [];
    const assetIps =
      searchParams.get("assetIps")?.split(",").filter(Boolean) || [];
    const ports =
      searchParams.get("ports")?.split(",").filter(Boolean).map(Number) || [];

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

    // Build where clause
    const where: any = {
      companyId,
      ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
      ...(riskLevels.length > 0 ? { riskLevel: { in: riskLevels } } : {}),
      ...(assetIps.length > 0 ? { assetIp: { in: assetIps } } : {}),
      ...(ports.length > 0 ? { port: { in: ports } } : {}),
    };

    // Get vulnerabilities in the source quarter
    const sourceVulnerabilities = await prisma.vulnerabilityQuarter.findMany({
      where: {
        quarter: sourceQuarter,
        vulnerability: where,
      },
      select: {
        vulnerabilityId: true,
      },
    });

    // Get vulnerabilities in the target quarter
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

    // Split the IDs into chunks to avoid too many bind variables
    const CHUNK_SIZE = 1000; // PostgreSQL typically allows up to 32767 parameters, but we'll be conservative
    const idChunks: string[][] = [];

    for (let i = 0; i < vulnIds.length; i += CHUNK_SIZE) {
      idChunks.push(vulnIds.slice(i, i + CHUNK_SIZE));
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
          quarterData: true,
        },
      })) as VulnerabilityWithQuarters[];

      carryForwardVulnerabilities = [
        ...carryForwardVulnerabilities,
        ...vulnerabilities,
      ];
    }

    // Sort the results by creation date
    carryForwardVulnerabilities.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // Process the data for CSV export
    const csvData = carryForwardVulnerabilities.map((vuln) => {
      // Find source and target quarter data
      const sourceQuarterData = vuln.quarterData.find(
        (q) => q.quarter === sourceQuarter,
      );
      const targetQuarterData = vuln.quarterData.find(
        (q) => q.quarter === targetQuarter,
      );

      // Format dates
      const firstSeenDate = sourceQuarterData?.fileUploadDate
        ? new Date(sourceQuarterData.fileUploadDate).toISOString().split("T")[0]
        : "N/A";

      const lastUpdatedDate = targetQuarterData?.fileUploadDate
        ? new Date(targetQuarterData.fileUploadDate).toISOString().split("T")[0]
        : "N/A";

      return {
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
        "Source Quarter": sourceQuarter,
        "Target Quarter": targetQuarter,
        "Status in Source": sourceQuarterData?.isResolved
          ? "Resolved"
          : "Unresolved",
        "Status in Target": targetQuarterData?.isResolved
          ? "Resolved"
          : "Unresolved",
        "First Seen": firstSeenDate,
        "Last Updated": lastUpdatedDate,
      };
    });

    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(","),
      ...csvData.map((row) =>
        headers
          .map((header) => {
            const value =
              row[header as keyof ExportedCarryForwardVulnerability];
            return JSON.stringify(value?.toString() || "").replace(/\\n/g, " ");
          })
          .join(","),
      ),
    ].join("\n");

    const fileName = `carry-forward-vulnerabilities-${sourceQuarter}-to-${targetQuarter}-${status}-${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error(
      "Export error:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      {
        error: "Export failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
