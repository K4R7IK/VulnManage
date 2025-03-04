import { PrismaClient, RiskLevel } from "@prisma/client";

type SummaryParams = {
  companyId: number;
  quarter: string;
  fileUploadDate: Date;
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
        "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extend"
      >,
  params: SummaryParams,
) {
  const { companyId, quarter } = params;
  console.log("Calculating summary for quarter:", quarter);

  // Initialize counters and trackers
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
  let totalCount = 0;

  // Track unique assets for this quarter
  const uniqueAssets = new Set<string>();

  // Find the previous quarter
  const prevQuarterData = await findPreviousQuarter(
    prisma,
    companyId,
    quarter,
    params.fileUploadDate,
  );

  console.log("Previous quarter:", prevQuarterData?.quarter || "none");

  // If there's a previous quarter, we need to get its vulnerabilities for comparison
  let previousVulnerabilityIds = new Set<string>();
  if (prevQuarterData) {
    const prevQuarterVulnerabilities =
      await prisma.vulnerabilityQuarter.findMany({
        where: {
          quarter: prevQuarterData.quarter,
          vulnerability: {
            companyId,
          },
        },
        select: {
          vulnerabilityId: true,
          isResolved: true,
        },
      });

    // Store IDs of active (unresolved) vulnerabilities from previous quarter
    previousVulnerabilityIds = new Set(
      prevQuarterVulnerabilities
        .filter((v) => !v.isResolved)
        .map((v) => v.vulnerabilityId),
    );

    console.log(
      `Found ${previousVulnerabilityIds.size} active vulnerabilities in previous quarter ${prevQuarterData.quarter}`,
    );
  }

  // Use pagination to avoid "too many bind variables" error for large datasets
  let lastId: string | null = null;
  let hasMore = true;
  const PAGE_SIZE = 1000; // Process 1000 records at a time

  console.log("Fetching vulnerabilities in batches...");

  // Track current quarter vulnerability IDs to determine what was resolved
  const currentQuarterIds = new Set<string>();

  while (hasMore) {
    // Get vulnerabilities for this quarter
    const vulnerabilityBatch = await prisma.vulnerability.findMany({
      where: {
        companyId,
        id: lastId ? { gt: lastId } : undefined, // Cursor-based pagination
        quarterData: {
          some: {
            quarter: quarter,
          },
        },
      },
      include: {
        quarterData: {
          where: {
            quarter: quarter,
          },
        },
      },
      orderBy: {
        id: "asc", // Ensure consistent ordering for pagination
      },
      take: PAGE_SIZE,
    });

    // Update pagination info
    hasMore = vulnerabilityBatch.length === PAGE_SIZE;

    if (vulnerabilityBatch.length > 0) {
      lastId = vulnerabilityBatch[vulnerabilityBatch.length - 1].id;
    }

    console.log(
      `Processing batch of ${vulnerabilityBatch.length} vulnerabilities for quarter ${quarter}...`,
    );

    // Process each vulnerability
    for (const vuln of vulnerabilityBatch) {
      // Add to total count
      totalCount++;

      // Keep track of IDs in current quarter
      currentQuarterIds.add(vuln.id);

      // Categorize based on previous quarter existence
      const existedInPrevious = previousVulnerabilityIds.has(vuln.id);
      const isResolvedInCurrent = vuln.quarterData[0]?.isResolved || false;

      // Track OS and risk data for all vulnerabilities in this quarter
      riskSummary[vuln.riskLevel]++;

      if (vuln.assetOS) {
        osSummary[vuln.assetOS] = (osSummary[vuln.assetOS] || 0) + 1;
      }

      if (vuln.assetIp) {
        deviceCount[vuln.assetIp] = (deviceCount[vuln.assetIp] || 0) + 1;
        uniqueAssets.add(vuln.assetIp);
      }

      // Categorize as new or unresolved
      if (!existedInPrevious && !isResolvedInCurrent) {
        // New vulnerabilities: didn't exist in previous quarter and not resolved in current
        newCount++;
      } else if (existedInPrevious && !isResolvedInCurrent) {
        // Unresolved vulnerabilities: existed in previous quarter and still not resolved
        unresolvedCount++;
      }
    }
  }

  // For resolved count, we need to find vulnerabilities from previous quarter
  // that either don't exist in current quarter or are marked as resolved
  if (prevQuarterData) {
    for (const prevVulnId of previousVulnerabilityIds) {
      // If it doesn't exist in current quarter or is marked as resolved
      const stillExists = currentQuarterIds.has(prevVulnId);

      if (!stillExists) {
        // If the vulnerability doesn't appear in current quarter, it's considered resolved
        resolvedCount++;
      } else {
        // If it exists in current quarter, check if it's marked as resolved
        const resolvedStatus = await prisma.vulnerabilityQuarter.findFirst({
          where: {
            vulnerabilityId: prevVulnId,
            quarter: quarter,
            isResolved: true,
          },
        });

        if (resolvedStatus) {
          resolvedCount++;
        }
      }
    }
  }

  console.log(
    `Processed a total of ${totalCount} vulnerabilities for quarter ${quarter}`,
  );
  console.log(
    `New: ${newCount}, Resolved: ${resolvedCount}, Unresolved: ${unresolvedCount}`,
  );

  const uniqueAssetCount = uniqueAssets.size;

  const topDevices: TopDevice[] = Object.entries(deviceCount)
    .map(([assetIp, count]) => ({ assetIp, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  console.log("Risk Summary:", riskSummary);
  console.log("OS Summary:", osSummary);
  console.log("Top Affected Devices:", topDevices);
  console.log("Unique Asset Count:", uniqueAssetCount);

  // Calculate growth rates using previous quarter summary
  let assetChangeRate: number | null = null;
  let vulnerabilityGrowthRate: number | null = null;

  if (prevQuarterData) {
    // Calculate asset change rate if previous quarter data exists
    if (prevQuarterData.uniqueAssetCount) {
      assetChangeRate =
        prevQuarterData.uniqueAssetCount > 0
          ? ((uniqueAssetCount - prevQuarterData.uniqueAssetCount) /
              prevQuarterData.uniqueAssetCount) *
            100
          : null;
    }

    // Calculate vulnerability growth rate
    vulnerabilityGrowthRate =
      prevQuarterData.totalCount > 0
        ? ((totalCount - prevQuarterData.totalCount) /
            prevQuarterData.totalCount) *
          100
        : null;

    console.log("Asset Change Rate:", assetChangeRate);
    console.log("Vulnerability Growth Rate:", vulnerabilityGrowthRate);
  }

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
      uniqueAssetCount,
      assetChangeRate,
      vulnerabilityGrowthRate,
      fileUploadDate: params.fileUploadDate,
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
      uniqueAssetCount,
      assetChangeRate,
      vulnerabilityGrowthRate,
      fileUploadDate: params.fileUploadDate,
    },
  });

  console.log(
    `Summary calculation for quarter ${quarter} completed successfully.`,
  );
}

// Helper function to find the previous quarter data
async function findPreviousQuarter(
  prisma: any,
  companyId: number,
  currentQuarter: string,
  currentFileUploadDate: Date,
) {
  return await prisma.vulnerabilitySummary.findFirst({
    where: {
      companyId,
      quarter: {
        not: currentQuarter,
      },
      fileUploadDate: {
        lt: currentFileUploadDate,
      },
    },
    orderBy: {
      fileUploadDate: "desc",
    },
  });
}
