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
  Button,
  Select,
  Affix,
  Transition,
  Tabs,
  Group,
  Pagination,
  Badge,
  Box,
  Paper,
  Alert,
} from "@mantine/core";
import {
  IconSearch,
  IconTableExport,
  IconArrowUp,
  IconAlertCircle,
  IconRefresh,
  IconChevronDown,
  IconChevronUp,
} from "@tabler/icons-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useWindowScroll } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";

interface VulnerabilityQuarter {
  id: string;
  quarter: string;
  isResolved: boolean;
  fileUploadDate: string;
}

interface Vulnerability {
  id: string;
  assetIp: string;
  assetOS: string | null;
  port: number | null;
  protocol: string | null;
  title: string;
  cveId: string[];
  description: string;
  riskLevel: "None" | "Low" | "Medium" | "High" | "Critical";
  cvssScore: number | null;
  impact: string;
  recommendations: string;
  references: string[];
  pluginOutput: string | null;
  createdAt: string;
  quarterData: VulnerabilityQuarter[];
}

interface Company {
  id: number;
  name: string;
}

interface FilterOptions {
  riskLevels: string[];
  assetIps: string[];
  ports: number[];
  quarters: string[];
}

interface PaginationData {
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
  totalItems: number;
}

export default function CarryForwardPage() {
  const [scroll, scrollTo] = useWindowScroll();

  // Pagination states
  const [paginationData, setPaginationData] = useState<PaginationData>({
    currentPage: 1,
    itemsPerPage: 50,
    totalPages: 0,
    totalItems: 0,
  });

  // Tab state
  const [activeStatus, setActiveStatus] = useState<"unresolved" | "resolved">(
    "unresolved",
  );

  // Filter states
  const [riskLevels, setRiskLevels] = useState<string[]>([]);
  const [sourceQuarter, setSourceQuarter] = useState<string>("");
  const [targetQuarter, setTargetQuarter] = useState<string>("");
  const [assetIps, setAssetIps] = useState<string[]>([]);
  const [ports, setPorts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Sorting states
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Filter options (available choices for filters)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    riskLevels: [],
    assetIps: [],
    ports: [],
    quarters: [],
  });

  // Core states
  const [vulnerabilities, setVulnerabilities] = useState<
    Vulnerability[] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Drawer states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);

  // Search debounce
  const searchTimeoutRef = useRef<number | null>(null);
  const [activeSearchQuery, setActiveSearchQuery] = useState(searchQuery);

  // Helper function to get latest quarter data
  const getLatestQuarterData = (quarterData: VulnerabilityQuarter[]) => {
    if (!quarterData.length) return null;
    return quarterData.reduce(
      (latest, current) =>
        new Date(current.fileUploadDate) > new Date(latest.fileUploadDate)
          ? current
          : latest,
      quarterData[0],
    );
  };

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);

    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      setActiveSearchQuery(value);
    }, 500);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Handle filters change
  const handleFilterChange = useCallback(
    (filterType: "risk" | "ip" | "port", values: string[]) => {
      console.log(`Filter change for ${filterType}:`, values);

      // Ensure we have valid arrays (not null/undefined)
      const safeValues = values || [];

      switch (filterType) {
        case "risk":
          setRiskLevels(safeValues);
          break;
        case "ip":
          setAssetIps(safeValues);
          break;
        case "port":
          setPorts(safeValues);
          break;
      }

      // Reset to first page when filters change
      setPaginationData((prev) => ({ ...prev, currentPage: 1 }));
    },
    [],
  );

  // Main data fetching function
  const fetchCarryForwardVulnerabilities = useCallback(async () => {
    if (!companyId || !sourceQuarter || !targetQuarter) return;

    try {
      setIsLoading(true);

      // Construct query parameters
      const params = new URLSearchParams({
        companyId: companyId.toString(),
        sourceQuarter: sourceQuarter,
        targetQuarter: targetQuarter,
        page: paginationData.currentPage.toString(),
        limit: paginationData.itemsPerPage.toString(),
        sortBy: sortField,
        sortOrder: sortDirection,
        status: activeStatus,
      });

      // Add search query if it exists
      if (activeSearchQuery) {
        params.append("search", activeSearchQuery);
      }

      // Add array parameters if they have values (important to check length)
      if (riskLevels.length > 0) {
        params.append("riskLevels", riskLevels.join(","));
      }

      if (assetIps.length > 0) {
        params.append("assetIps", assetIps.join(","));
      }

      if (ports.length > 0) {
        params.append("ports", ports.join(","));
      }

      // Log the params for debugging
      console.log("API request parameters:", params.toString());

      // This endpoint would need to be implemented on the backend
      const res = await fetch(`/api/vuln/carryforward?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }

      const response = await res.json();
      console.log("API response:", response);

      setVulnerabilities(response.data);
      setPaginationData((prev) => ({
        ...prev,
        totalItems: response.pagination.total,
        totalPages: response.pagination.totalPages,
      }));

      // Only update filter options if they exist in the response
      if (response.filterOptions) {
        setFilterOptions(response.filterOptions);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch vulnerabilities",
      );
      notifications.show({
        title: "Error",
        message: "Failed to fetch carry forward vulnerabilities",
        color: "red",
        icon: <IconAlertCircle />,
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    companyId,
    sourceQuarter,
    targetQuarter,
    paginationData.currentPage,
    paginationData.itemsPerPage,
    sortField,
    sortDirection,
    activeStatus,
    activeSearchQuery,
    riskLevels,
    assetIps,
    ports,
  ]);

  // Initial data fetch useEffect
  useEffect(() => {
    const fetchUserAndCompany = async () => {
      try {
        const res = await fetch("/api/auth/user", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setUserRole(data.role);
          if (data.role === "Admin") {
            const companiesRes = await fetch("/api/companies");
            const companiesData = await companiesRes.json();
            setCompanies(companiesData);
            if (!companyId && companiesData.length > 0) {
              setCompanyId(companiesData[0].id);
            }
          } else {
            setCompanyId(data.companyId);
          }
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
        setError("Failed to load user data");
      }
    };

    const fetchQuarters = async () => {
      if (!companyId) return;

      try {
        const res = await fetch(`/api/quarters?companyId=${companyId}`, {
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          const quartersList = data.map((q: any) => q.quarter);

          // Sort quarters in descending order to get latest first
          // Assuming quarters are named in a way that sorts correctly (like "Q1 2023", "Q2 2023", etc.)
          quartersList.sort().reverse();

          setFilterOptions((prev) => ({
            ...prev,
            quarters: quartersList,
          }));

          // Set default values for source and target quarters
          if (quartersList.length >= 2) {
            // Latest quarter for target
            setTargetQuarter(quartersList[0]);
            // Second latest quarter for source
            setSourceQuarter(quartersList[1]);
          } else if (quartersList.length === 1) {
            // If only one quarter exists, set it as target and leave source empty
            setTargetQuarter(quartersList[0]);
          }
        }
      } catch (error) {
        console.error("Error fetching quarters:", error);
      }
    };

    fetchUserAndCompany();
    fetchQuarters();
  }, [companyId]);

  // Fetch vulnerabilities when dependencies change
  useEffect(() => {
    if (sourceQuarter && targetQuarter && sourceQuarter !== targetQuarter) {
      fetchCarryForwardVulnerabilities();
    }
  }, [fetchCarryForwardVulnerabilities, sourceQuarter, targetQuarter]);

  // Reset to first page when filters change
  useEffect(() => {
    setPaginationData((prev) => ({ ...prev, currentPage: 1 }));
  }, [
    riskLevels,
    assetIps,
    ports,
    sourceQuarter,
    targetQuarter,
    activeSearchQuery,
    activeStatus,
    paginationData.itemsPerPage,
  ]);

  // Event Handlers
  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField],
  );

  const openDrawer = useCallback((vuln: Vulnerability) => {
    setSelectedVuln(vuln);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedVuln(null);
  }, []);

  const handleRefresh = useCallback(() => {
    if (sourceQuarter && targetQuarter && sourceQuarter !== targetQuarter) {
      fetchCarryForwardVulnerabilities();
    }
  }, [fetchCarryForwardVulnerabilities, sourceQuarter, targetQuarter]);

  // Handle export
  const handleExport = useCallback(() => {
    if (!companyId || !sourceQuarter || !targetQuarter) {
      notifications.show({
        title: "Export Error",
        message: "Please select source and target quarters to export",
        color: "red",
      });
      return;
    }

    // Construct export URL with all current filters
    const params = new URLSearchParams({
      companyId: companyId.toString(),
      sourceQuarter: sourceQuarter,
      targetQuarter: targetQuarter,
      status: activeStatus,
    });

    // Add search query if it exists
    if (activeSearchQuery) {
      params.append("search", activeSearchQuery);
    }

    // Add array parameters if they have values (important to check length)
    if (riskLevels.length > 0) {
      params.append("riskLevels", riskLevels.join(","));
    }

    if (assetIps.length > 0) {
      params.append("assetIps", assetIps.join(","));
    }

    if (ports.length > 0) {
      params.append("ports", ports.join(","));
    }

    console.log("Export URL parameters:", params.toString());

    // Trigger file download
    window.location.href = `/api/vuln/carryforward/export?${params.toString()}`;
  }, [
    companyId,
    sourceQuarter,
    targetQuarter,
    activeStatus,
    activeSearchQuery,
    riskLevels,
    assetIps,
    ports,
  ]);

  // Time difference calculation for display
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

  // Get badge color for risk level
  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "Critical":
        return "red";
      case "High":
        return "orange";
      case "Medium":
        return "yellow";
      case "Low":
        return "blue";
      default:
        return "gray";
    }
  };

  return (
    <Flex direction="column" gap="md">
      {/* Scroll to top button */}
      <Affix bottom={20} right={20}>
        <Transition transition="slide-up" mounted={scroll.y > 0}>
          {(transitionStyles) => (
            <Button
              leftSection={<IconArrowUp size={16} />}
              style={transitionStyles}
              onClick={() => scrollTo({ y: 0 })}
            >
              Scroll to top
            </Button>
          )}
        </Transition>
      </Affix>

      {/* Page title and description */}
      <Paper p="md" withBorder>
        <Title order={2}>Vulnerability Carry Forward</Title>
        <Text c="dimmed" size="sm" mt={5}>
          Track vulnerabilities that persist between quarters to identify
          long-standing issues.
        </Text>
      </Paper>

      {/* Search and Company Selection Section */}
      <Grid miw="100%" align="flex-end">
        <Grid.Col span={7}>
          <TextInput
            label="Search Vulnerabilities by Title"
            placeholder="Search vulnerabilities by title..."
            value={searchQuery}
            onChange={(event) => handleSearchChange(event.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
          />
        </Grid.Col>
        <Grid.Col span={2}>
          {userRole === "Admin" && companies.length > 0 && (
            <Select
              label="Security Company"
              placeholder="Select Company"
              data={companies.map((comp) => ({
                value: comp.id.toString(),
                label: comp.name,
              }))}
              value={companyId ? companyId.toString() : ""}
              onChange={(value) => setCompanyId(Number(value))}
              checkIconPosition="right"
            />
          )}
        </Grid.Col>
        <Grid.Col span={1}>
          <Select
            label="Items per page"
            placeholder="Items per page"
            value={paginationData.itemsPerPage.toString()}
            onChange={(value) =>
              setPaginationData((prev) => ({
                ...prev,
                itemsPerPage: Number(value),
              }))
            }
            data={[
              { value: "50", label: "50" },
              { value: "100", label: "100" },
            ]}
            checkIconPosition="right"
          />
        </Grid.Col>
        <Grid.Col span={2}>
          <Button
            variant="light"
            rightSection={<IconTableExport size={16} />}
            fullWidth
            onClick={handleExport}
            disabled={
              !sourceQuarter ||
              !targetQuarter ||
              sourceQuarter === targetQuarter
            }
          >
            Export CSV
          </Button>
        </Grid.Col>
      </Grid>

      {/* Quarter Selection Section */}
      <Paper p="md" withBorder>
        <Grid miw="100%">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Select
              label="Source Quarter"
              placeholder="Select source quarter"
              data={filterOptions.quarters.map((q) => ({ value: q, label: q }))}
              value={sourceQuarter}
              onChange={(value) => setSourceQuarter(value || "")}
              checkIconPosition="right"
              required
              error={
                sourceQuarter === targetQuarter && targetQuarter !== ""
                  ? "Source and target quarters must be different"
                  : null
              }
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Select
              label="Target Quarter"
              placeholder="Select target quarter"
              data={filterOptions.quarters.map((q) => ({ value: q, label: q }))}
              value={targetQuarter}
              onChange={(value) => setTargetQuarter(value || "")}
              checkIconPosition="right"
              required
              error={
                sourceQuarter === targetQuarter && sourceQuarter !== ""
                  ? "Source and target quarters must be different"
                  : null
              }
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 2 }}>
            <Button
              mt={29}
              fullWidth
              onClick={handleRefresh}
              leftSection={<IconRefresh size={16} />}
              disabled={
                !sourceQuarter ||
                !targetQuarter ||
                sourceQuarter === targetQuarter ||
                isLoading
              }
            >
              Refresh
            </Button>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Other Filters Section */}
      <Grid miw="100%">
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <MultiSelect
            label="Risk Levels"
            data={filterOptions.riskLevels.map((level) => ({
              value: level,
              label: level,
            }))}
            value={riskLevels}
            onChange={(values) => {
              console.log("Risk levels selected:", values);
              handleFilterChange("risk", values);
            }}
            searchable
            disabled={isLoading}
            placeholder="Select risk levels"
            checkIconPosition="right"
            clearable
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <MultiSelect
            checkIconPosition="right"
            label="Asset IP"
            data={filterOptions.assetIps.map((ip) => ({
              value: ip,
              label: ip,
            }))}
            value={assetIps}
            onChange={(values) => {
              console.log("Asset IPs selected:", values);
              handleFilterChange("ip", values);
            }}
            searchable
            disabled={isLoading}
            placeholder="Select asset IPs"
            clearable
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <MultiSelect
            label="Ports"
            data={filterOptions.ports.map((port) => ({
              value: port.toString(),
              label: port.toString(),
            }))}
            value={ports}
            onChange={(values) => {
              console.log("Ports selected:", values);
              handleFilterChange("port", values);
            }}
            searchable
            disabled={isLoading}
            placeholder="Select ports"
            checkIconPosition="right"
            clearable
          />
        </Grid.Col>
      </Grid>

      {/* Status Tabs */}
      <Tabs
        value={activeStatus}
        onChange={(value) =>
          setActiveStatus(value as "unresolved" | "resolved")
        }
      >
        <Tabs.List>
          <Tabs.Tab value="unresolved">Unresolved Vulnerabilities</Tabs.Tab>
          <Tabs.Tab value="resolved">Resolved Vulnerabilities</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* Warning if quarters not selected */}
      {(!sourceQuarter ||
        !targetQuarter ||
        sourceQuarter === targetQuarter) && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Selection Required"
          color="blue"
          variant="light"
        >
          Please select different source and target quarters to view carry
          forward vulnerabilities.
        </Alert>
      )}

      {/* Table Title and Count */}
      <Flex justify="space-between" align="center">
        <Title order={4}>
          {activeStatus === "unresolved"
            ? "Unresolved Vulnerabilities"
            : "Resolved Vulnerabilities"}{" "}
          Carried Forward
        </Title>
        {!isLoading && !error && vulnerabilities && (
          <Text size="sm" c="dimmed">
            Showing{" "}
            {(paginationData.currentPage - 1) * paginationData.itemsPerPage + 1}{" "}
            to{" "}
            {Math.min(
              paginationData.currentPage * paginationData.itemsPerPage,
              paginationData.totalItems,
            )}{" "}
            of {paginationData.totalItems} entries
          </Text>
        )}
      </Flex>

      {/* Table Section with Loading and Error States */}
      {error ? (
        <Alert
          color="red"
          title="Error Loading Data"
          icon={<IconAlertCircle size={16} />}
        >
          {error}
        </Alert>
      ) : isLoading ? (
        <Flex justify="center">
          <Loader size="lg" type="dots" />
        </Flex>
      ) : vulnerabilities?.length ? (
        <>
          <Table highlightOnHover stickyHeader stickyHeaderOffset={60}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th
                  onClick={() => handleSort("title")}
                  style={{ cursor: "pointer" }}
                  role="button"
                >
                  <Group gap={4}>
                    Title
                    {sortField === "title" &&
                      (sortDirection === "asc" ? (
                        <IconChevronUp size={14} />
                      ) : (
                        <IconChevronDown size={14} />
                      ))}
                  </Group>
                </Table.Th>
                <Table.Th>Asset IP</Table.Th>
                <Table.Th
                  onClick={() => handleSort("riskLevel")}
                  style={{ cursor: "pointer" }}
                  role="button"
                >
                  <Group gap={4}>
                    Risk Level
                    {sortField === "riskLevel" &&
                      (sortDirection === "asc" ? (
                        <IconChevronUp size={14} />
                      ) : (
                        <IconChevronDown size={14} />
                      ))}
                  </Group>
                </Table.Th>
                <Table.Th>Port</Table.Th>
                <Table.Th>First Seen</Table.Th>
                <Table.Th>Last Updated</Table.Th>
                <Table.Th>Status in {targetQuarter}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {vulnerabilities.map((vuln) => {
                const targetQuarterData = vuln.quarterData.find(
                  (qd) => qd.quarter === targetQuarter,
                );
                const sourceQuarterData = vuln.quarterData.find(
                  (qd) => qd.quarter === sourceQuarter,
                );

                return (
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
                    <Table.Td>
                      <Badge color={getRiskBadgeColor(vuln.riskLevel)}>
                        {vuln.riskLevel}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{vuln.port || "N/A"}</Table.Td>
                    <Table.Td>
                      {sourceQuarterData?.fileUploadDate
                        ? new Date(
                            sourceQuarterData.fileUploadDate,
                          ).toLocaleDateString()
                        : "N/A"}
                    </Table.Td>
                    <Table.Td>
                      {targetQuarterData?.fileUploadDate
                        ? new Date(
                            targetQuarterData.fileUploadDate,
                          ).toLocaleDateString()
                        : "N/A"}
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={targetQuarterData?.isResolved ? "green" : "red"}
                      >
                        {targetQuarterData?.isResolved
                          ? "Resolved"
                          : "Unresolved"}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
          <Group justify="center" mt="md">
            <Pagination
              total={paginationData.totalPages}
              boundaries={1}
              siblings={1}
              value={paginationData.currentPage}
              onChange={(page) =>
                setPaginationData((prev) => ({ ...prev, currentPage: page }))
              }
              withEdges
              size="md"
            />
          </Group>
        </>
      ) : sourceQuarter && targetQuarter && sourceQuarter !== targetQuarter ? (
        <Alert title="No Vulnerabilities Found" color="gray" variant="light">
          No carry forward vulnerabilities found between {sourceQuarter} and{" "}
          {targetQuarter} with the selected filters.
        </Alert>
      ) : null}

      {/* Drawer Component */}
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
              <strong>Operating System:</strong> {selectedVuln.assetOS || "N/A"}
            </Text>
            <Text>
              <strong>Port:</strong> {selectedVuln.port || "N/A"}
            </Text>
            <Text>
              <strong>Protocol:</strong> {selectedVuln.protocol || "N/A"}
            </Text>
            <Text>
              <strong>CVE IDs:</strong>{" "}
              {selectedVuln.cveId.length > 0
                ? selectedVuln.cveId.join(", ")
                : "No CVEs assigned"}
            </Text>
            <Text>
              <strong>Description:</strong>{" "}
              {selectedVuln.description || "No description available"}
            </Text>
            <Text>
              <strong>Risk Level:</strong> {selectedVuln.riskLevel}
            </Text>
            <Text>
              <strong>CVSS Score:</strong>{" "}
              {selectedVuln.cvssScore || "Not available"}
            </Text>
            <Text>
              <strong>Impact:</strong> {selectedVuln.impact}
            </Text>
            <Text>
              <strong>Recommendations:</strong>{" "}
              {selectedVuln.recommendations || "No recommendations available"}
            </Text>
            <Text>
              <strong>References:</strong>{" "}
              {selectedVuln.references.length > 0
                ? selectedVuln.references.join(", ")
                : "No references available"}
            </Text>
            <Text>
              <strong>Plugin Output:</strong>{" "}
              {selectedVuln.pluginOutput || "No plugin output available"}
            </Text>
            <Text>
              <strong>Quarter History:</strong>
            </Text>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Quarter</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Date</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {selectedVuln.quarterData
                  .sort(
                    (a, b) =>
                      new Date(b.fileUploadDate).getTime() -
                      new Date(a.fileUploadDate).getTime(),
                  )
                  .map((qd) => (
                    <Table.Tr key={qd.id}>
                      <Table.Td>{qd.quarter}</Table.Td>
                      <Table.Td>
                        <Badge color={qd.isResolved ? "green" : "red"}>
                          {qd.isResolved ? "Resolved" : "Unresolved"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {new Date(qd.fileUploadDate).toLocaleDateString()}
                      </Table.Td>
                    </Table.Tr>
                  ))}
              </Table.Tbody>
            </Table>
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
