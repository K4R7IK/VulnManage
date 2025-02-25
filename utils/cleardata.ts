// utils/cleardata.ts
import prisma from "@/lib/prisma";

export async function clearDatabase() {
  try {
    console.log("Starting database cleanup...");

    // Delete in order to respect foreign key constraints
    console.log("Deleting VulnerabilityQuarter records...");
    await prisma.vulnerabilityQuarter.deleteMany();

    console.log("Deleting VulnerabilitySummary records...");
    await prisma.vulnerabilitySummary.deleteMany();

    console.log("Deleting Vulnerability records...");
    await prisma.vulnerability.deleteMany();

    // console.log("Deleting RegisterToken records...");
    // await prisma.registerToken.deleteMany();

    // console.log("Deleting User records...");
    // await prisma.user.deleteMany();

    // console.log("Deleting Company records...");
    // await prisma.company.deleteMany();

    console.log("Database cleanup completed successfully");
  } catch (error) {
    console.error("Error during database cleanup:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  clearDatabase()
    .then(() => console.log("Database cleared successfully"))
    .catch(console.error);
}
