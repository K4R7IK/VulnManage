// clearVulnData.ts
import prisma from "../lib/prisma";

async function clearVulnerabilities() {
  try {
    const result = await prisma.vulnerability.deleteMany({});
    console.log(`Cleared ${result.count} vulnerabilities.`);
  } catch (error) {
    console.error("Error clearing vulnerabilities:", error);
  } finally {
    await prisma.$disconnect();
  }
}

async function clearSummary() {
  try {
    const result = await prisma.vulnerabilitySummary.deleteMany({});
    console.log(`Cleared ${result.count} vulnerabilities.`);
  } catch (error) {
    console.error("Error clearing vulnerabilities:", error);
  } finally {
    await prisma.$disconnect();
  }
}
clearVulnerabilities();
clearSummary();
