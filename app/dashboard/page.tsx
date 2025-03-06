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
  SimpleGrid,
  Button,
  Badge,
  Paper,
  Tooltip,
} from "@mantine/core";
import { BarChart, LineChart, DonutChart } from "@mantine/charts";
import {
  IconRefresh,
  IconServerBolt,
  IconShieldCheck,
  IconAlertTriangle,
  IconArrowUpRight,
  IconArrowDownRight,
} from "@tabler/icons-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId?: number;
}

interface TopDevice {
  assetIp: string;
  count: number;
}

interface VulnerabilitySummary {
  id: string;
  quarter: string;
  osSummary: Record<string, number>;
  riskSummary: Record<string, number>;
  topDevices: TopDevice[];
  resolvedCount: number;
  unresolvedCount: number;
  newCount: number;
  totalCount: number;
  uniqueAssetCount?: number; // New field
  assetChangeRate?: number; // New field
  vulnerabilityGrowthRate?: number; // New field
}

interface Company {
  id: number;
  name: string;
}

function formatKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    null,
  );
  const [summaries, setSummaries] = useState<VulnerabilitySummary[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculatingStatus, setRecalculatingStatus] = useState({
    loading: false,
    message: "",
  });

  // Fetch user information
  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/user", { credentials: "include" });
        const data = await res.json();
        if (!data.error) {
          setUser(data);
          // If standard user, automatically select user's company
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

  // Fetch companies for admins
  useEffect(() => {
    async function fetchCompanies() {
      if (user && user.role === "Admin") {
        try {
          const res = await fetch("/api/companies");
          const data = await res.json();
          setCompanies(data);
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

  // Fetch vulnerability summaries
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
          // Set the most recent quarter as the selected quarter
          if (data.length > 0 && !selectedQuarter) {
            setSelectedQuarter(data[0].quarter);
          }
        } catch (error) {
          console.error("Error fetching vulnerability summaries:", error);
        } finally {
          setLoading(false);
        }
      }
    }
    fetchSummaries();
  }, [selectedCompanyId]);

  // Function to recalculate summaries
  const handleRecalculateSummaries = async () => {
    if (!selectedCompanyId) return;

    setRecalculatingStatus({
      loading: true,
      message: "Recalculating summaries...",
    });
    try {
      // This would call an API endpoint to trigger the recalculation
      const res = await fetch(
        `/api/vulnsum/recalculate?companyId=${selectedCompanyId}`,
        {
          method: "POST",
        },
      );
      const data = await res.json();
      if (data.success) {
        setRecalculatingStatus({
          loading: false,
          message: "Recalculation complete!",
        });
        // Fetch updated data
        const updateRes = await fetch(
          `/api/vulnsum?companyId=${selectedCompanyId}`,
        );
        const updatedData = await updateRes.json();
        setSummaries(updatedData);
      } else {
        setRecalculatingStatus({
          loading: false,
          message: "Recalculation failed",
        });
      }
    } catch (error) {
      console.error("Error recalculating summaries:", error);
      setRecalculatingStatus({
        loading: false,
        message: "Error recalculating",
      });
    }

    // Reset message after 3 seconds
    setTimeout(() => {
      setRecalculatingStatus({ loading: false, message: "" });
    }, 3000);
  };

  if (loading) {
    return (
      <Flex direction="column" justify="center" align="center" mih="100vh">
        <Loader type="dots" size="xl" />
      </Flex>
    );
  }

  // Get the currently selected quarter summary
  const currentQuarterSummary =
    summaries.find((s) => s.quarter === selectedQuarter) || summaries[0];

  // Calculate total statistics across all quarters
  const totalStats = summaries.reduce(
    (acc, summary) => {
      acc.totalVulnerabilities += summary.totalCount;
      acc.resolvedVulnerabilities += summary.resolvedCount;
      return acc;
    },
    {
      totalVulnerabilities: 0,
      resolvedVulnerabilities: 0,
      uniqueAssets: currentQuarterSummary.uniqueAssetCount || 0,
    },
  );

  // Calculate remediation rate
  const remediationRate =
    totalStats.totalVulnerabilities > 0
      ? Math.round(
          (totalStats.resolvedVulnerabilities /
            totalStats.totalVulnerabilities) *
            100,
        )
      : 0;

  // Prepare chart data for risk summary
  const riskChartData = summaries.map((summary) => ({
    quarter: summary.quarter,
    ...summary.riskSummary,
  }));

  // Prepare chart data for OS summary
  const osChartData = summaries.map((summary) => ({
    quarter: summary.quarter,
    ...Object.fromEntries(
      Object.entries(summary.osSummary).map(([key, value]) => [
        formatKey(key),
        value,
      ]),
    ),
  }));

  // Prepare trend data for new, resolved, unresolved
  const trendData = summaries.map((summary) => ({
    quarter: summary.quarter,
    new: summary.newCount,
    resolved: summary.resolvedCount,
    unresolved: summary.unresolvedCount,
  }));

  // Create pie chart data for current quarter risk distribution
  const riskDistributionData = currentQuarterSummary
    ? Object.entries(currentQuarterSummary.riskSummary).map(([key, value]) => ({
        name: key,
        value: value,
        color:
          key === "Critical"
            ? "brown"
            : key === "High"
              ? "red"
              : key === "Medium"
                ? "orange"
                : "yellow",
      }))
    : [];

  // Prepare data for additional visualizations as needed

  return (
    <Container fluid>
      <Group justify="space-between" my="sm">
        <Title size="h1">Security Dashboard</Title>

        {user && user.role === "Admin" && (
          <Group>
            {companies.length > 0 && (
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

            <Tooltip label="Recalculate Vulnerability Summaries">
              <Button
                leftSection={<IconRefresh size={16} />}
                variant="light"
                onClick={handleRecalculateSummaries}
                loading={recalculatingStatus.loading}
              >
                {recalculatingStatus.message || "Recalculate"}
              </Button>
            </Tooltip>
          </Group>
        )}

        {user && user.role !== "Admin" && (
          <Text size="xl" fw={500}>
            {companies.find((comp) => comp.id === user.companyId)?.name}
          </Text>
        )}
      </Group>

      {/* High-level summary cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="md">
        <Card withBorder p="md" shadow="sm">
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Total Vulnerabilities
            </Text>
            <IconAlertTriangle size={20} color="red" />
          </Group>
          <Text size="xl" fw={700} mt="md">
            {totalStats.totalVulnerabilities}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Across all quarters
          </Text>
        </Card>

        <Card withBorder p="md" shadow="sm">
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Unique Assets Affected
            </Text>
            <IconServerBolt size={20} color="blue" />
          </Group>
          <Text size="xl" fw={700} mt="md">
            {totalStats.uniqueAssets}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Devices with vulnerabilities
          </Text>
        </Card>

        <Card withBorder p="md" shadow="sm">
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Remediation Rate
            </Text>
            <IconShieldCheck size={20} color="green" />
          </Group>
          <Text size="xl" fw={700} mt="md">
            {remediationRate}%
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Resolved vs total
          </Text>
        </Card>

        <Card withBorder p="md" shadow="sm">
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Current Quarter
            </Text>
            {currentQuarterSummary?.vulnerabilityGrowthRate &&
              (currentQuarterSummary.vulnerabilityGrowthRate > 0 ? (
                <Group gap={4}>
                  <Text size="xs" c="red">
                    {currentQuarterSummary.vulnerabilityGrowthRate}%
                  </Text>
                  <IconArrowUpRight size={16} color="red" />
                </Group>
              ) : (
                <Group gap={4}>
                  <Text size="xs" c="green">
                    {Math.abs(
                      currentQuarterSummary.vulnerabilityGrowthRate || 0,
                    )}
                    %
                  </Text>
                  <IconArrowDownRight size={16} color="green" />
                </Group>
              ))}
          </Group>
          <Text size="xl" fw={700} mt="md">
            {selectedQuarter || currentQuarterSummary?.quarter || "N/A"}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            {currentQuarterSummary?.newCount || 0} new vulnerabilities
          </Text>
        </Card>
      </SimpleGrid>

      {/* Quarter selector */}
      {summaries.length > 0 && (
        <Paper withBorder p="xs" mb="md">
          <Group>
            <Text size="sm" fw={500}>
              Select Quarter for Detailed View:
            </Text>
            <SegmentedControl
              data={summaries.map((s) => ({
                value: s.quarter,
                label: s.quarter,
              }))}
              value={selectedQuarter || ""}
              onChange={setSelectedQuarter}
              size="xs"
            />
          </Group>
        </Paper>
      )}

      <Grid gutter="md">
        {/* Risk Summary Chart */}
        <Grid.Col span={{ base: 12, md: 6 }}>
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
              withLegend
              legendProps={{ verticalAlign: "bottom" }}
            />
          </Card>
        </Grid.Col>

        {/* OS Summary Chart */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder p="md" shadow="md">
            <Text size="lg" mb="sm" fw={600}>
              OS Summary by Quarter
            </Text>
            <BarChart
              h={250}
              data={osChartData}
              dataKey="quarter"
              series={[
                { name: "Windows", color: "blue" },
                { name: "Linux", color: "green" },
                { name: "Network Device", color: "orange" },
                { name: "Vm", color: "teal" },
                { name: "Security Solution", color: "red" },
              ]}
              withLegend
              legendProps={{ verticalAlign: "bottom" }}
            />
          </Card>
        </Grid.Col>

        {/* Vulnerability Trend Line Chart */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card withBorder p="md" shadow="md">
            <Text size="lg" mb="sm" fw={600}>
              Vulnerability Trend
            </Text>
            <LineChart
              h={250}
              data={trendData}
              dataKey="quarter"
              series={[
                { name: "new", color: "blue", label: "New" },
                { name: "resolved", color: "green", label: "Resolved" },
                { name: "unresolved", color: "red", label: "Unresolved" },
              ]}
              curveType="monotone"
              withLegend
              legendProps={{ verticalAlign: "bottom" }}
              withDots
              dotProps={{ r: 4 }}
            />
          </Card>
        </Grid.Col>

        {/* Risk Distribution Donut Chart for the selected quarter */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder p="md" shadow="md" h="100%">
            <Text size="lg" mb="sm" fw={600}>
              Risk Distribution for{" "}
              {selectedQuarter || currentQuarterSummary?.quarter}
            </Text>
            <DonutChart
              data={riskDistributionData}
              h={250}
              withLabels
              labelsType="percent"
              withTooltip
              tooltipDataSource="segment"
              paddingAngle={1}
              thickness={30}
            />
          </Card>
        </Grid.Col>

        {/* Vulnerability Summary Table */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder shadow="md">
            <Text size="lg" fw={600} mb="sm">
              Vulnerability Summary by Quarter
            </Text>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Quarter</Table.Th>
                  <Table.Th>New</Table.Th>
                  <Table.Th>Resolved</Table.Th>
                  <Table.Th>Unresolved</Table.Th>
                  <Table.Th>Assets</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {summaries.map((summary) => (
                  <Table.Tr key={summary.id}>
                    <Table.Td>{summary.quarter}</Table.Td>
                    <Table.Td>{summary.newCount}</Table.Td>
                    <Table.Td>{summary.resolvedCount}</Table.Td>
                    <Table.Td>{summary.unresolvedCount}</Table.Td>
                    <Table.Td>{summary.uniqueAssetCount || "N/A"}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </Grid.Col>

        {/* Top Vulnerable Devices Accordion */}
        <Grid.Col>
          <Card withBorder shadow="md" p="md">
            <Text size="lg" fw={600} mb="sm">
              Top Vulnerable Devices by Quarter
            </Text>
            <Accordion variant="separated">
              {summaries.map((summary) => (
                <Accordion.Item key={summary.id} value={summary.id}>
                  <Accordion.Control>
                    <Group>
                      <Text>Top Vulnerable Devices in {summary.quarter}</Text>
                      <Badge>{summary.topDevices.length} Devices</Badge>
                    </Group>
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
                        {summary.topDevices.map((device) => (
                          <Table.Tr key={`${device.assetIp}:${device.count}`}>
                            <Table.Td>{device.assetIp}</Table.Td>
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
