// utils/slaUtils.ts
import { RiskLevel } from "@prisma/client";

/**
 * Enum for asset types, matching the Prisma schema
 */
export enum AssetType {
  Internet = "Internet",
  Intranet = "Intranet",
  Endpoint = "Endpoint",
}

/**
 * Default SLA values (in days) for different asset types and risk levels
 */
export const DEFAULT_SLA_VALUES = {
  Internet: {
    Critical: 1,
    High: 5,
    Medium: 10,
    Low: 20,
    None: 90,
  },
  Intranet: {
    Critical: 1,
    High: 5,
    Medium: 10,
    Low: 20,
    None: 90,
  },
  Endpoint: {
    Critical: 1,
    High: 5,
    Medium: 10,
    Low: 20,
    None: 90,
  },
};

/**
 * Determines the asset type based on IP address or OS
 * This function can be customized based on your organization's network segmentation
 */
export function determineAssetType(
  assetIp: string,
  assetOS: string | null
): string {
  // Internet-facing assets (public IPs, DMZ, etc.)
  if (
    assetIp.startsWith("203.") ||
    assetIp.startsWith("54.") ||
    assetIp.includes("dmz") ||
    assetIp.includes("pub")
  ) {
    return AssetType.Internet;
  }

  // Endpoint devices (workstations, laptops, etc.)
  if (
    assetOS?.toLowerCase().includes("windows") ||
    assetOS?.toLowerCase().includes("mac") ||
    assetIp.startsWith("10.10.") ||
    assetIp.includes("endpoint") ||
    assetIp.includes("workstation")
  ) {
    return AssetType.Endpoint;
  }

  // Default to Intranet for internal servers and other assets
  return AssetType.Intranet;
}

/**
 * Calculates the SLA deadline date given a discovery date, risk level, and asset type
 */
export function calculateSLADeadline(
  discoveryDate: Date,
  riskLevel: string,
  assetType: string,
  customSLAs?: Record<string, Record<string, number>>
): Date {
  // Use custom SLA if available, otherwise use default
  const slaDays =
    customSLAs &&
    customSLAs[assetType] &&
    customSLAs[assetType][riskLevel] !== undefined
      ? customSLAs[assetType][riskLevel]
      : DEFAULT_SLA_VALUES[assetType]?.[riskLevel] || 30; // Fallback to 30 days if no matching SLA

  const deadline = new Date(discoveryDate);
  deadline.setDate(deadline.getDate() + slaDays);

  return deadline;
}

/**
 * Calculates days past SLA for a vulnerability
 * Returns positive number if overdue, 0 if on the deadline, negative if within SLA
 */
export function calculateDaysPastSLA(
  discoveryDate: Date,
  riskLevel: string,
  assetType: string,
  customSLAs?: Record<string, Record<string, number>>
): number {
  const today = new Date();
  const slaDeadline = calculateSLADeadline(
    discoveryDate,
    riskLevel,
    assetType,
    customSLAs
  );

  const diffTime = today.getTime() - slaDeadline.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
