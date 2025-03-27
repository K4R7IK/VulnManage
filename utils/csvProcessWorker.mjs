// utils/csvProcessWorker.ts
import { parentPort, workerData } from 'worker_threads';
import { createHash } from 'crypto';
import { RiskLevel } from '@prisma/client';
// Convert risk string to RiskLevel enum
function mapRiskLevel(risk) {
    const riskMap = {
        None: RiskLevel.None,
        Low: RiskLevel.Low,
        Medium: RiskLevel.Medium,
        High: RiskLevel.High,
        Critical: RiskLevel.Critical,
    };
    return riskMap[risk] || RiskLevel.None;
}
// Generate unique hash for vulnerability
function generateVulnHash(vuln) {
    const data = JSON.stringify({
        ...vuln,
        cveId: vuln.cveId.sort(),
    });
    return createHash("sha256").update(data).digest("hex");
}
// Convert CSV row to vulnerability object
function mapCsvRowToVulnerability(row, params) {
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
    const { rows, params } = workerData;
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
    }
    catch (error) {
        parentPort.postMessage({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
