import { prisma } from "@/lib/prisma";

async function getAllVulnerabilities() {
  const vulnerabilities = await prisma.vulnerability.findMany({
    where: {
      AND: [
        {
          title: {
            equals: "WebDAV Detection",
          },
          port: {
            equals: 80,
          },
          assetIp: {
            equals: "hos.client1.com",
          },
          protocol: {
            equals: "tcp",
          },
        },
      ],
    },
    include: {
      quarterData: {
        select: {
          id: true,
          quarter: true,
          isResolved: true,
          fileUploadDate: true,
          vulnerabilityId: true,
        },
      },
    },
  });
  return vulnerabilities;
}

// Example usage:
getAllVulnerabilities()
  .then((data) => {
    console.log("All vulnerability data:");
    console.log("----------------------");
    data.forEach((vuln, index) => {
      console.log(`\nVulnerability ${index + 1}:`);
      console.log("Title:", vuln.title);
      console.log("Asset IP:", vuln.assetIp);
      console.log("Port:", vuln.port);
      console.log("Protocol:", vuln.protocol);
      console.log("Hash", vuln.uniqueHash);
      console.log("\nQuarter Data:");
      vuln.quarterData.forEach((quarter) => {
        console.log(`- Quarter: ${quarter.quarter}`);
        console.log(`  Resolved: ${quarter.isResolved}`);
        console.log(`  Upload Date: ${quarter.fileUploadDate}`);
        console.log(`  ID: ${quarter.id}`);
      });
      console.log("----------------------");
    });
  })
  .catch((error) => console.error("Error fetching vulnerabilities:", error));
