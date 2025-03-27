// utils/csvProcessWorker.ts
import { parentPort, workerData } from 'worker_threads';
import { createHash } from 'crypto';
import { RiskLevel } from '@prisma/client';

// Types copied from importCsv.ts to avoid circular dependencies
type CsvRow = {
  CVE: string;
  "CVSS v2.0 Base Score": string;
  Risk: string;
  Host: string;
  Protocol: string;
  Port: string;
  Name: string;
  Synopsis: string;
  Description: string;
  Solution: string;
  "See Also": string;
  "Plugin Output": string;
  [key: string]: any;
};

type WorkerData = {
  rows: CsvRow[];
  params: {
    fileUploadDate: string; // ISO string format
    quarter: string;
    assetOS: string;
    companyId: number;
  };
};

// Convert risk string to RiskLevel enum
function mapRiskLevel(risk: string): RiskLevel {
  const riskMap: Record<string, RiskLevel> = {
    None: RiskLevel.None,
    Low: RiskLevel.Low,
    Medium: RiskLevel.Medium,
    High: RiskLevel.High,
    Critical: RiskLevel.Critical,
  };
  return riskMap[risk] || RiskLevel.None;
}

// Generate unique hash for vulnerability
function generateVulnHash(vuln: {
  assetOS: string;
  assetIp: string;
  port: number | null;
  protocol: string | null;
  title: string;
  cveId: string[];
  riskLevel: RiskLevel;
  cvssScore: number | null;
  impact: string;
  companyId: number;
}): string {
  const data = JSON.stringify({
    ...vuln,
    cveId: vuln.cveId.sort(),
  });
  return createHash("sha256").update(data).digest("hex");
}

// Convert CSV row to vulnerability object
function mapCsvRowToVulnerability(
  row: CsvRow,
  params: WorkerData['params'],
): any {
  return {
    assetIp: row.Host,
    assetOS: params.assetOS,
    port: row.Port ? parseInt(row.Port) : null,
    protocol: row.Protocol ? row.Protocol : null,
    title: row.Name,
    cveId: row.CVE ? [row.CVE] : ["None"],
    description: row.Description,
    riskLevel: mapRiskLevel(row.Risk),
    cvssScore: row["CVSS v2.0 Base Score"]
      ? parseFloat(row["CVSS v2.0 Base Score"])
      : null,
    impact: row.Synopsis,
    recommendations: row.Solution,
    references: row["See Also"] ? [row["See Also"]] : [],
    pluginOutput: row["Plugin Output"] || null,
    companyId: params.companyId,
    fileUploadDate: new Date(params.fileUploadDate),
    uniqueHash: "", // Will be set after object creation
  };
}

if (parentPort) {
  const { rows, params } = workerData as WorkerData;
  
  try {
    const results = rows.map(row => {
      const vulnData = mapCsvRowToVulnerability(row, params);
      const { description, recommendations, references, pluginOutput, ...cleanVulnData } = vulnData;
      // Ensure protocol is explicitly included in the hash calculation
      const hash = generateVulnHash({
        ...cleanVulnData,
        protocol: vulnData.protocol
      });
      vulnData.uniqueHash = hash;
      return { vulnData, hash };
    });
    
    parentPort.postMessage(results);
  } catch (error) {
    parentPort.postMessage({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}