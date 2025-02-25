import { PrismaClient, RiskLevel } from "@prisma/client";

type SummaryParams = {
  companyId: number;
  quarter: string; // Expected format: "YYYY-QN"
};

type OSCount = {
  [key: string]: number;
};

type RiskCount = {
  [key in RiskLevel]: number;
};

type TopDevice = {
  assetIp: string;
  count: number;
};

export async function calculateVulnerabilitySummary(
  prisma:
    | PrismaClient
    | Omit<
        PrismaClient,
        "$connect" | "$disconnect" | "$on" | "$transaction" | "$use"
      >,
  params: SummaryParams,
) {
  const { companyId, quarter } = params;
  console.log("Calculating summary for quarter:", quarter);

  // Get all vulnerabilities for this company and quarter
  const vulnerabilities = await prisma.vulnerability.findMany({
    where: {
      companyId,
      quarterData: {
        some: {
          quarter,
        },
      },
    },
    include: {
      quarterData: true,
    },
  });

  console.log(`Found ${vulnerabilities.length} vulnerabilities for summary.`);

  // Process vulnerabilities and generate summary
  const riskSummary: RiskCount = {
    [RiskLevel.None]: 0,
    [RiskLevel.Low]: 0,
    [RiskLevel.Medium]: 0,
    [RiskLevel.High]: 0,
    [RiskLevel.Critical]: 0,
  };

  const osSummary: OSCount = {};
  const deviceCount: Record<string, number> = {};
  let resolvedCount = 0;
  let unresolvedCount = 0;
  let newCount = 0;

  for (const vuln of vulnerabilities) {
    riskSummary[vuln.riskLevel]++;
    if (vuln.assetOS) {
      osSummary[vuln.assetOS] = (osSummary[vuln.assetOS] || 0) + 1;
    }
    if (vuln.assetIp) {
      deviceCount[vuln.assetIp] = (deviceCount[vuln.assetIp] || 0) + 1;
    }

    // Check the vulnerability quarter status
    const latestQuarter = vuln.quarterData.find((q) => q.quarter === quarter);
    if (latestQuarter?.isResolved && vuln.quarterData.length !== 1) {
      resolvedCount++;
    }
    if (!latestQuarter?.isResolved && vuln.quarterData.length !== 1) {
      unresolvedCount++;
    }

    if (!latestQuarter || vuln.quarterData.length === 1) {
      newCount++;
    }
  }

  const totalCount = vulnerabilities.length;
  const topDevices: TopDevice[] = Object.entries(deviceCount)
    .map(([assetIp, count]) => ({ assetIp, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  console.log("Risk Summary:", riskSummary);
  console.log("OS Summary:", osSummary);
  console.log("Top Affected Devices:", topDevices);

  // Save the summary to the database
  await prisma.vulnerabilitySummary.upsert({
    where: {
      companyId_quarter: { companyId, quarter },
    },
    update: {
      riskSummary,
      osSummary,
      topDevices,
      resolvedCount,
      unresolvedCount,
      newCount,
      totalCount,
    },
    create: {
      companyId,
      quarter,
      riskSummary,
      osSummary,
      topDevices,
      resolvedCount,
      unresolvedCount,
      newCount,
      totalCount,
    },
  });

  console.log("Summary calculation completed successfully.");
}
