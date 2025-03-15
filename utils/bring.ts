import { prisma } from "@/lib/prisma";

async function getAllVulnerabilities() {
  const vulnerabilities = await prisma.vulnerabilitySummary.findMany({
    include: {
      company: true, // include related company information if needed
    },
  });
  return vulnerabilities;
}

// Example usage:
getAllVulnerabilities()
  .then((data) => console.log(data))
  .catch((error) => console.error("Error fetching vulnerabilities:", error));
