"use client";

import { useEffect, useState } from "react";
import {
  Container,
  Card,
  Grid,
  Table,
  Text,
  Loader,
  SegmentedControl,
  Accordion,
  Flex,
  Group,
  Title,
  Button,
} from "@mantine/core";
import { BarChart } from "@mantine/charts";
import Link from "next/link";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId?: number;
}

interface VulnerabilitySummary {
  id: string;
  quarter: string;
  osSummary: Record<string, number>;
  riskSummary: Record<string, number>;
  topDevices: { ip: string; count: number }[];
  resolvedCount: number;
  unresolvedCount: number;
  newCount: number;
}

interface Company {
  id: number;
  name: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    null,
  );
  const [summaries, setSummaries] = useState<VulnerabilitySummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch user information from /api/auth/user
  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/user", {
          credentials: "include",
        });
        const data = await res.json();
        if (!data.error) {
          setUser(data);
          // If standard user, automatically select user's company.
          if (data.role !== "Admin") {
            setSelectedCompanyId(data.companyId);
          }
        } else {
          console.error("User fetch error:", data.error);
        }
      } catch (error) {
        console.error("Error fetching user info:", error);
      }
    }
    fetchUser();
  }, []);

  // If user is admin, fetch the list of companies.
  useEffect(() => {
    async function fetchCompanies() {
      if (user && user.role === "Admin") {
        try {
          const res = await fetch("/api/companies");
          const data = await res.json();
          setCompanies(data);
          // Optionally select the first company if none is selected.
          if (data.length > 0 && !selectedCompanyId) {
            setSelectedCompanyId(data[0].id);
          }
        } catch (error) {
          console.error("Error fetching companies:", error);
        }
      }
    }
    fetchCompanies();
  }, [user, selectedCompanyId]);

  // Fetch vulnerability summary data for the selected company.
  useEffect(() => {
    async function fetchSummaries() {
      if (selectedCompanyId) {
        try {
          setLoading(true);
          const res = await fetch(
            `/api/vulnsum?companyId=${selectedCompanyId}`,
          );
          const data = await res.json();
          setSummaries(data);
        } catch (error) {
          console.error("Error fetching vulnerability summaries:", error);
        } finally {
          setLoading(false);
        }
      }
    }
    fetchSummaries();
  }, [selectedCompanyId]);

  if (loading) {
    return (
      <Flex direction="column" justify="center" align="center" mih="100vh">
        <Loader type="dots" size="xl" />
      </Flex>
    );
  }

  // Prepare chart data for risk summary.
  const riskChartData = summaries.map((summary) => ({
    quarter: summary.quarter,
    ...summary.riskSummary,
  }));

  // Prepare chart data for OS summary.
  const osChartData = summaries.map((summary) => ({
    quarter: summary.quarter,
    ...summary.osSummary,
  }));

  return (
    <Container fluid>
      <Group justify="space-between" my="sm">
        <Title size="h2" fw={700} mb="md">
          Summary Overview
        </Title>

        {user && user.role === "Admin" && companies.length > 0 && (
          <SegmentedControl
            data={companies.map((comp) => ({
              value: comp.id.toString(),
              label: comp.name,
            }))}
            value={selectedCompanyId ? selectedCompanyId.toString() : ""}
            onChange={(value) => setSelectedCompanyId(Number(value))}
            withItemsBorders
            radius="md"
          />
        )}
        <Button component={Link} href="/dashboard/details" variant="light">
          View Table
        </Button>
      </Group>
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, xl: 6 }}>
          <Card withBorder p="md" shadow="md">
            <Text size="lg" mb="sm" fw={600}>
              Risk Summary by Quarter
            </Text>
            <BarChart
              h={250}
              data={riskChartData}
              dataKey="quarter"
              series={[
                { name: "Low", color: "yellow" },
                { name: "Medium", color: "orange" },
                { name: "High", color: "red" },
                { name: "Critical", color: "brown" },
              ]}
            />
          </Card>
        </Grid.Col>

        {/* OS Summary Chart */}
        <Grid.Col span={{ base: 12, xl: 6 }}>
          <Card withBorder p="md" shadow="md">
            <Text size="lg" mb="sm" fw={600}>
              OS Summary by Quarter
            </Text>
            <BarChart
              h={250}
              data={osChartData}
              dataKey="quarter"
              series={[{ name: "Unknown", color: "blue" }]}
            />
          </Card>
        </Grid.Col>
        <Grid.Col>
          <Card withBorder shadow="md">
            <Text size="lg" fw={600} mb="sm">
              Vulnerability Summary by Quarter
            </Text>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Quarter</Table.Th>
                  <Table.Th>New Count</Table.Th>
                  <Table.Th>Resolved</Table.Th>
                  <Table.Th>Unresolved</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {summaries.map((summary) => (
                  <Table.Tr key={summary.id}>
                    <Table.Td>{summary.quarter}</Table.Td>
                    <Table.Td>{summary.newCount}</Table.Td>
                    <Table.Td>{summary.resolvedCount}</Table.Td>
                    <Table.Td>{summary.unresolvedCount}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </Grid.Col>
        <Grid.Col>
          <Card withBorder shadow="md" p="md">
            <Text size="lg" fw={600} mb="sm">
              Top Vulnerable Devices by Quarter
            </Text>
            <Accordion variant="separated">
              {summaries.map((summary) => (
                <Accordion.Item key={summary.id} value={summary.id}>
                  <Accordion.Control>
                    Top Vulnerable Devices in {summary.quarter}
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Table highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Device IP</Table.Th>
                          <Table.Th>Vulnerability Count</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {summary.topDevices.map((device: any) => (
                          <Table.Tr key={device.ip}>
                            <Table.Td>{device.ip}</Table.Td>
                            <Table.Td>{device.count}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
