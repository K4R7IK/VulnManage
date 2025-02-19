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
  Loader,
  TextInput,
  GridCol,
  Button,
  Select,
} from "@mantine/core";
import { IconSearch, IconTableExport } from "@tabler/icons-react";
import { useEffect, useState, useCallback, useMemo } from "react";
import Papa from "papaparse";
import { saveAs } from "file-saver";

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
  quarters: string[];
  isResolved: boolean;
  createdAt: string;
}

interface Company {
  id: number;
  name: string;
}

export default function DetailsPage() {
  // Core states
  const [vulnerabilities, setVulnerabilities] = useState<
    Vulnerability[] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Sorting states
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Drawer states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);

  // Filter states
  const [riskLevels, setRiskLevels] = useState<string[]>([]);
  const [quarters, setQuarters] = useState<string[]>([]);
  const [assetIps, setAssetIps] = useState<string[]>([]);
  const [ports, setPorts] = useState<string[]>([]);

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/user", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setCompanyId(data.companyId);
          setUserRole(data.role);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchCompanies = async () => {
      if (userRole === "Admin") {
        try {
          const res = await fetch("/api/companies");
          const data = await res.json();
          setCompanies(data);
        } catch (error) {
          console.error("Error fetching companies:", error);
        }
      }
    };
    fetchCompanies();
  }, [userRole]);

  // Fetch vulnerabilities
  useEffect(() => {
    const fetchVulnerabilities = async () => {
      if (companyId) {
        try {
          setIsLoading(true);
          // Include credentials to send cookies along with the request
          const res = await fetch(`/api/vuln?companyId=${companyId}`, {
            credentials: "include",
          });
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          const data = await res.json();
          setVulnerabilities(data);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to fetch vulnerabilities"
          );
          console.error("Error fetching data:", err);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchVulnerabilities();
  }, [companyId]);

  const baseFilteredVulnerabilities = useMemo(() => {
    return vulnerabilities?.filter((vuln) => {
      const matchesRisk =
        riskLevels.length === 0 || riskLevels.includes(vuln.riskLevel);
      const matchesQuarter =
        quarters.length === 0 ||
        vuln.quarters?.some((q) => quarters.includes(q));
      const matchesIp =
        assetIps.length === 0 || assetIps.includes(vuln.assetIp);
      const matchesPort =
        ports.length === 0 || ports.includes(String(vuln.port));
      return matchesRisk && matchesQuarter && matchesIp && matchesPort;
    });
  }, [vulnerabilities, riskLevels, quarters, assetIps, ports]);

  const getFilterOptions = useMemo(() => {
    if (!vulnerabilities)
      return {
        riskLevels: [],
        quarters: [],
        assetIps: [],
        ports: [],
      };

    // Helper function to get available options based on current filters
    const getAvailableOptions = (
      field: keyof Vulnerability,
      currentFilter: string[]
    ) => {
      const tempVulns = vulnerabilities.filter((vuln) => {
        const matchesRisk =
          riskLevels.length === 0 ||
          (field !== "riskLevel" && riskLevels.includes(vuln.riskLevel));
        const matchesQuarter =
          quarters.length === 0 ||
          (field !== "quarters" &&
            vuln.quarters?.some((q) => quarters.includes(q)));
        const matchesIp =
          assetIps.length === 0 ||
          (field !== "assetIp" && assetIps.includes(vuln.assetIp));
        const matchesPort =
          ports.length === 0 ||
          (field !== "port" && ports.includes(String(vuln.port)));

        return matchesRisk && matchesQuarter && matchesIp && matchesPort;
      });

      return tempVulns;
    };

    // Get available options for each filter
    const riskLevelOptions = Array.from(
      new Set(
        getAvailableOptions("riskLevel", riskLevels).map((v) => v.riskLevel)
      )
    ).sort((a, b) => {
      const riskOrder = ["Critical", "High", "Medium", "Low"];
      const indexA = riskOrder.indexOf(a);
      const indexB = riskOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    const quarterOptions = Array.from(
      new Set(
        getAvailableOptions("quarters", quarters).flatMap(
          (v) => v.quarters || []
        )
      )
    ).sort((a, b) => {
      const prefixA = a.match(/^[A-Za-z]+/)?.[0] || "";
      const prefixB = b.match(/^[A-Za-z]+/)?.[0] || "";
      const numA = parseInt(a.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.match(/\d+/)?.[0] || "0");
      if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
      return numA - numB;
    });

    const assetIpOptions = Array.from(
      new Set(getAvailableOptions("assetIp", assetIps).map((v) => v.assetIp))
    );

    const portOptions = Array.from(
      new Set(getAvailableOptions("port", ports).map((v) => String(v.port)))
    );

    return {
      riskLevels: riskLevelOptions,
      quarters: quarterOptions,
      assetIps: assetIpOptions,
      ports: portOptions,
    };
  }, [vulnerabilities, riskLevels, quarters, assetIps, ports]);

  // Sorting handlers
  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        // Add this condition to clear sorting on third click
        if (sortDirection === "desc") {
          setSortField(null);
          setSortDirection("asc");
        } else {
          setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        }
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField, sortDirection]
  );
  // Memoized table rows
  // Filter vulnerabilities based on selected filters and search query
  const filteredVulnerabilities = useMemo(() => {
    return baseFilteredVulnerabilities?.filter(
      (vuln) =>
        searchQuery === "" ||
        vuln.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [baseFilteredVulnerabilities, searchQuery]);

  // Sort vulnerabilities
  const sortedVulnerabilities = useMemo(() => {
    if (!filteredVulnerabilities || !sortField) return filteredVulnerabilities;

    return [...filteredVulnerabilities].sort((a, b) => {
      const modifier = sortDirection === "asc" ? 1 : -1;

      switch (sortField) {
        case "title":
          return modifier * a.title.localeCompare(b.title);

        case "age":
          return (
            modifier *
            (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          );

        case "risk": {
          const riskOrder = ["Critical", "High", "Medium", "Low"];
          const riskA = riskOrder.indexOf(a.riskLevel);
          const riskB = riskOrder.indexOf(b.riskLevel);
          return modifier * (riskA - riskB);
        }

        case "resolved":
          return (
            modifier *
            (a.isResolved === b.isResolved ? 0 : a.isResolved ? 1 : -1)
          );

        default:
          return 0;
      }
    });
  }, [filteredVulnerabilities, sortField, sortDirection]);

  // Calculate time difference
  const getTimeDifference = useCallback((createdAt: string) => {
    const createdDate = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - createdDate.getTime();

    const diffDays = Math.floor(diffMs / (1000 * 3600 * 24));
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    const diffHours = Math.floor(diffMs / (1000 * 3600));
    if (diffHours > 0)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
  }, []);

  // Drawer handlers
  const openDrawer = useCallback((vuln: Vulnerability) => {
    setSelectedVuln(vuln);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedVuln(null);
  }, []);

  // Function to handle CSV export
  const handleExportCSV = useCallback(() => {
    if (!filteredVulnerabilities) return;

    const csvData = filteredVulnerabilities.map((vuln) => ({
      Title: vuln.title,
      "Asset IP": vuln.assetIp,
      "Operating System": vuln.assestOS,
      Port: vuln.port,
      Protocol: vuln.protocol,
      "CVE IDs": vuln.cveId.join(", "),
      Description: vuln.description,
      "Risk Level": vuln.riskLevel,
      "CVSS Score": vuln.cvssScore,
      Impact: vuln.impact,
      Recommendations: vuln.recommendations,
      References: vuln.references.join(", "),
      "Plugin Output": vuln.pluginOutput,
      Age: getTimeDifference(vuln.createdAt),
      Resolved: vuln.isResolved ? "Yes" : "No",
      "Created At": new Date(vuln.createdAt).toLocaleString(),
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    const now = new Date();
    const filename = `vulnerabilities_${now
      .toISOString()
      .replace(/[:.]/g, "-")}.csv`;

    saveAs(blob, filename);
  }, [filteredVulnerabilities]);

  return (
    <Flex direction="column" gap="md">
      <Grid miw="100%">
        <Grid.Col span={8}>
          <TextInput
            placeholder="Search vulnerabilities by title..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            disabled={isLoading}
          />
        </Grid.Col>
        <Grid.Col span={2}>
          {userRole === "Admin" && companies.length > 0 && (
            <Select
              placeholder="Select Company"
              data={companies.map((comp) => ({
                value: comp.id.toString(),
                label: comp.name,
              }))}
              value={companyId ? companyId.toString() : ""}
              onChange={(value) => setCompanyId(Number(value))}
            />
          )}
        </Grid.Col>
        <GridCol span={2}>
          <Button
            variant="light"
            fullWidth
            onClick={handleExportCSV}
            leftSection={<IconTableExport size={16} />}
          >
            Export CSV
          </Button>
        </GridCol>
      </Grid>
      <Grid miw="100%">
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <MultiSelect
            label="Risk Levels"
            data={getFilterOptions.riskLevels}
            value={riskLevels}
            onChange={setRiskLevels}
            searchable
            disabled={isLoading}
            placeholder="Select risk levels"
            clearable
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <MultiSelect
            label="Time Periods"
            data={getFilterOptions.quarters}
            value={quarters}
            onChange={setQuarters}
            searchable
            disabled={isLoading}
            placeholder="Select time periods"
            clearable
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <MultiSelect
            label="Asset IP"
            data={getFilterOptions.assetIps}
            value={assetIps}
            onChange={setAssetIps}
            searchable
            disabled={isLoading}
            placeholder="Select asset IPs"
            clearable
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <MultiSelect
            label="Ports"
            data={getFilterOptions.ports}
            value={ports}
            onChange={setPorts}
            searchable
            disabled={isLoading}
            placeholder="Select ports"
            clearable
          />
        </Grid.Col>
      </Grid>

      <Flex justify="space-between" align="center">
        <Title order={4}>Vulnerabilities</Title>
        {!isLoading && !error && (
          <Text size="sm" c="dimmed">
            Showing {filteredVulnerabilities?.length || 0}
            {vulnerabilities &&
            filteredVulnerabilities?.length !== vulnerabilities.length
              ? ` of ${vulnerabilities.length}`
              : ""}{" "}
            vulnerabilities
          </Text>
        )}
      </Flex>

      {error ? (
        <Text c="red">{error}</Text>
      ) : isLoading ? (
        <Loader size="lg" />
      ) : filteredVulnerabilities?.length ? (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th
                onClick={() => handleSort("title")}
                style={{ cursor: "pointer" }}
                role="button"
              >
                Title{" "}
                {sortField === "title" &&
                  (sortDirection === "asc"
                    ? "↑"
                    : sortDirection === "desc"
                    ? "↓"
                    : "")}
              </Table.Th>
              <Table.Th>Asset IP</Table.Th>
              <Table.Th
                onClick={() => handleSort("risk")}
                style={{ cursor: "pointer" }}
                role="button"
              >
                Risk Level{" "}
                {sortField === "risk" && (sortDirection === "asc" ? "↑" : "↓")}
              </Table.Th>
              <Table.Th>Port</Table.Th>
              <Table.Th
                onClick={() => handleSort("resolved")}
                style={{ cursor: "pointer" }}
                role="button"
              >
                Resolved{" "}
                {sortField === "resolved" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </Table.Th>
              <Table.Th
                onClick={() => handleSort("age")}
                style={{ cursor: "pointer" }}
                role="button"
              >
                Age{" "}
                {sortField === "age" && (sortDirection === "asc" ? "↑" : "↓")}
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedVulnerabilities?.map((vuln) => (
              <Table.Tr
                key={vuln.id}
                onClick={() => openDrawer(vuln)}
                style={{ cursor: "pointer" }}
                role="button"
                aria-label={`View details for vulnerability: ${vuln.title}`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDrawer(vuln);
                  }
                }}
              >
                <Table.Td>{vuln.title}</Table.Td>
                <Table.Td>{vuln.assetIp}</Table.Td>
                <Table.Td>{vuln.riskLevel}</Table.Td>
                <Table.Td>{vuln.port}</Table.Td>
                <Table.Td>{vuln.isResolved ? "Yes" : "No"}</Table.Td>
                <Table.Td>{getTimeDifference(vuln.createdAt)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text>No vulnerabilities found.</Text>
      )}

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
              <strong>CVE IDs:</strong>{" "}
              {selectedVuln.cveId?.join(", ") || "No CVEs assigned"}
            </Text>
            <Text>
              <strong>Description:</strong>{" "}
              {selectedVuln.description || "No description available"}
            </Text>
            <Text>
              <strong>Risk Level:</strong>{" "}
              {selectedVuln.riskLevel || "Not specified"}
            </Text>
            <Text>
              <strong>CVSS Score:</strong>{" "}
              {selectedVuln.cvssScore || "Not available"}
            </Text>
            <Text>
              <strong>Impact:</strong> {selectedVuln.impact || "Not specified"}
            </Text>
            <Text>
              <strong>Recommendations:</strong>{" "}
              {selectedVuln.recommendations || "No recommendations available"}
            </Text>
            <Text>
              <strong>References:</strong>{" "}
              {selectedVuln.references?.join(", ") || "No references available"}
            </Text>
            <Text>
              <strong>Plugin Output:</strong>{" "}
              {selectedVuln.pluginOutput || "No plugin output available"}
            </Text>
            <Text>
              <strong>Time Periods:</strong>{" "}
              {selectedVuln.quarters?.join(", ") || "No time periods assigned"}
            </Text>
            <Text>
              <strong>Resolved:</strong>{" "}
              {selectedVuln.isResolved ? "Yes" : "No"}
            </Text>
            <Text>
              <strong>Created At:</strong>{" "}
              {new Date(selectedVuln.createdAt).toLocaleString()}
            </Text>
          </Stack>
        )}
      </Drawer>
    </Flex>
  );
}
