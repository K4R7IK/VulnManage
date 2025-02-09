"use client";

import {
  Flex,
  Grid,
  MultiSelect,
  Table,
  Text,
  Title,
  Drawer,
  Stack,
} from "@mantine/core";
import { useEffect, useState } from "react";

interface Vulnerability {
  id: string;
  assetIp: string;
  assestOS: string;
  port: number;
  protocol: string;
  title: string;
  cveId: string[];
  description: string;
  riskLevel: string;
  cvssScore: number;
  impact: string;
  recommendations: string;
  references: string[];
  pluginOutput: string;
  quarter: string[];
  isResolved: boolean;
  createdAt: string;
}

export default function DetailsPage() {
  // State to hold vulnerabilities
  const [vulnerabilities, setVulnerabilities] = useState<
    Vulnerability[] | null
  >(null);
  // State for controlling the Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);

  useEffect(() => {
    fetch("/api/vuln")
      .then((res) => res.json())
      .then((data) => setVulnerabilities(data))
      .catch((error) => console.error("Error fetching data:", error));
  }, []);

  // Calculate time difference between created date and current date
  const getTimeDifference = (createdAt: string) => {
    const createdDate = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - createdDate.getTime();

    const diffDays = Math.floor(diffMs / (1000 * 3600 * 24));
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    }

    const diffHours = Math.floor(diffMs / (1000 * 3600));
    if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    }

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
  };

  // Opens the Drawer and sets the selected vulnerability
  const openDrawer = (vuln: Vulnerability) => {
    setSelectedVuln(vuln);
    setDrawerOpen(true);
  };

  // Closes the Drawer and clears the selected vulnerability
  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedVuln(null);
  };

  // Build table rows; clicking a row opens the Drawer.
  const rows = vulnerabilities?.map((vuln) => (
    <Table.Tr
      key={vuln.id}
      onClick={() => openDrawer(vuln)}
      style={{ cursor: "pointer" }}
    >
      <Table.Td>{vuln.title}</Table.Td>
      <Table.Td>{vuln.assetIp}</Table.Td>
      <Table.Td>{vuln.riskLevel}</Table.Td>
      <Table.Td>{vuln.port}</Table.Td>
      <Table.Td>{vuln.isResolved ? "Yes" : "No"}</Table.Td>
      <Table.Td>{getTimeDifference(vuln.createdAt)}</Table.Td>
    </Table.Tr>
  ));

  return (
    <Flex direction="column" gap="md">
      <Grid miw="100%">
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <MultiSelect
            label="Risk Levels"
            data={["Low", "Medium", "High", "Critical"]}
            searchable
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <MultiSelect
            label="Quarters"
            data={["Q1", "Q2", "Q3", "Q4"]}
            searchable
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <MultiSelect
            label="Asset IP"
            data={[
              "192.168.0.1",
              "192.168.3.23",
              "23.46.23.6",
              "768.45.234.67",
            ]}
            searchable
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <MultiSelect
            label="Ports"
            data={["80", "443", "8080", "8081"]}
            searchable
          />
        </Grid.Col>
      </Grid>

      <Title order={4}>Vulnerabilities</Title>
      {vulnerabilities ? (
        vulnerabilities.length > 0 ? (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Title</Table.Th>
                <Table.Th>Asset IP</Table.Th>
                <Table.Th>Risk Level</Table.Th>
                <Table.Th>Port</Table.Th>
                <Table.Th>Resolved</Table.Th>
                <Table.Th>Age</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        ) : (
          <Text>No vulnerabilities found.</Text>
        )
      ) : (
        <Text>Loading vulnerabilities...</Text>
      )}

      {/* Drawer that displays all details for the selected vulnerability */}
      <Drawer
        opened={drawerOpen}
        onClose={closeDrawer}
        title="Vulnerability Details"
        padding="md"
        position="right"
        size="lg"
        radius="md"
        offset={8}
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
      >
        {selectedVuln && (
          <Stack>
            <Text>
              <strong>Title:</strong> {selectedVuln.title}
            </Text>
            <Text>
              <strong>Asset IP:</strong> {selectedVuln.assetIp}
            </Text>
            <Text>
              <strong>Operating System:</strong> {selectedVuln.assestOS}
            </Text>
            <Text>
              <strong>Port:</strong> {selectedVuln.port}
            </Text>
            <Text>
              <strong>Protocol:</strong> {selectedVuln.protocol}
            </Text>
            <Text>
              <strong>CVE IDs:</strong> {selectedVuln.cveId.join(", ")}
            </Text>
            <Text>
              <strong>Description:</strong> {selectedVuln.description}
            </Text>
            <Text>
              <strong>Risk Level:</strong> {selectedVuln.riskLevel}
            </Text>
            <Text>
              <strong>CVSS Score:</strong> {selectedVuln.cvssScore}
            </Text>
            <Text>
              <strong>Impact:</strong> {selectedVuln.impact}
            </Text>
            <Text>
              <strong>Recommendations:</strong> {selectedVuln.recommendations}
            </Text>
            <Text>
              <strong>References:</strong> {selectedVuln.references.join(", ")}
            </Text>
            <Text>
              <strong>Plugin Output:</strong> {selectedVuln.pluginOutput}
            </Text>
            <Text>
              <strong>Quarters:</strong> {selectedVuln.quarter}
            </Text>
            <Text>
              <strong>Resolved:</strong>{" "}
              {selectedVuln.isResolved ? "Yes" : "No"}
            </Text>
            <Text>
              <strong>Created At:</strong> {selectedVuln.createdAt}
            </Text>
          </Stack>
        )}
      </Drawer>
    </Flex>
  );
}
