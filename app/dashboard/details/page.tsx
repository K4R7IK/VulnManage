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
  Paper,
  Alert,
} from "@mantine/core";
import {
  IconSearch,
  IconTableExport,
  IconArrowUp,
  IconAlertCircle,
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

export default function DetailsPage() {
  const [scroll, scrollTo] = useWindowScroll();

  // Pagination states
  const [paginationData, setPaginationData] = useState<PaginationData>({
    currentPage: 1,
    itemsPerPage: 50,
    totalPages: 0,
    totalItems: 0,
  });

  // Filter states
  const [riskLevels, setRiskLevels] = useState<string[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const [assetIps, setAssetIps] = useState<string[]>([]);
  const [ports, setPorts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<"all" | "resolved" | "unresolved">(
    "all",
  );

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

  // Search debounce
  const searchTimeoutRef = useRef<number | null>(null);
  const [activeSearchQuery, setActiveSearchQuery] = useState(searchQuery);

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

  // Main data fetching function
  const fetchVulnerabilities = useCallback(async () => {
    if (!companyId) return;

    try {
      setIsLoading(true);

      // Construct query parameters
      const params = new URLSearchParams({
        companyId: companyId.toString(),
        page: paginationData.currentPage.toString(),
        limit: paginationData.itemsPerPage.toString(),
        sortBy: sortField,
        sortOrder: sortDirection,
      });

      // Add status if not 'all'
      if (status !== "all") {
        params.append("status", status);
      }

      // Add selected quarter if any
      if (selectedQuarter) {
        params.append("quarter", selectedQuarter);
      }

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

      const res = await fetch(`/api/vuln?${params.toString()}`, {
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
        message: "Failed to fetch vulnerabilities",
        color: "red",
        icon: <IconAlertCircle />,
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    companyId,
    paginationData.currentPage,
    paginationData.itemsPerPage,
    sortField,
    sortDirection,
    activeSearchQuery,
    selectedQuarter,
    status,
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
      }
    };
    fetchUserAndCompany();
  }, [companyId]);

  // Fetch vulnerabilities when dependencies change
  useEffect(() => {
    fetchVulnerabilities();
  }, [fetchVulnerabilities]);

  // Reset to first page when filters change
  useEffect(() => {
    setPaginationData((prev) => ({ ...prev, currentPage: 1 }));
  }, [
    riskLevels,
    assetIps,
    ports,
    selectedQuarter,
    activeSearchQuery,
    status,
    paginationData.itemsPerPage,
  ]);

  // Handle export
  const handleExport = useCallback(() => {
    if (!companyId) {
      notifications.show({
        title: "Export Error",
        message: "Please select a company to export",
        color: "red",
      });
      return;
    }

    // Construct export URL with all current filters
    const params = new URLSearchParams({
      companyId: companyId.toString(),
      tab: status,
    });

    // Add search query if it exists
    if (activeSearchQuery) {
      params.append("search", activeSearchQuery);
    }

    // Add selected quarter if any
    if (selectedQuarter) {
      params.append("quarter", selectedQuarter);
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
    window.location.href = `/api/vuln/export?${params.toString()}`;
  }, [
    companyId,
    selectedQuarter,
    status,
    activeSearchQuery,
    riskLevels,
    assetIps,
    ports,
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
    },
    [],
  );

  const openDrawer = useCallback((vuln: Vulnerability) => {
    setSelectedVuln(vuln);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedVuln(null);
  }, []);

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
        <Title order={2}>Vulnerability Details</Title>
        <Text color="dimmed" size="sm" mt={5}>
          View and filter all vulnerabilities in the system.
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
          >
            Export CSV
          </Button>
        </Grid.Col>
      </Grid>

      {/* Filters Section */}
      <Paper p="md" withBorder>
        <Grid miw="100%">
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
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
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
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
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
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
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Select
              label="Quarter"
              data={
                filterOptions.quarters?.map((quarter) => ({
                  value: quarter,
                  label: quarter,
                })) || []
              }
              value={selectedQuarter}
              onChange={(value) => setSelectedQuarter(value || "")}
              placeholder="Select quarter"
              clearable
              disabled={isLoading}
              checkIconPosition="right"
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Status Tabs */}
      <Tabs
        value={status}
        onChange={(value) =>
          setStatus(value as "all" | "resolved" | "unresolved")
        }
      >
        <Tabs.List>
          <Tabs.Tab value="all">All</Tabs.Tab>
          <Tabs.Tab value="resolved">Resolved</Tabs.Tab>
          <Tabs.Tab value="unresolved">Unresolved</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* Table Title and Count */}
      <Flex justify="space-between" align="center">
        <Title order={4}>Vulnerabilities</Title>
        {!isLoading && !error && vulnerabilities && (
          <Text size="sm" c="dimmed">
            Showing{" "}
            {paginationData.totalItems > 0
              ? `${(paginationData.currentPage - 1) * paginationData.itemsPerPage + 1} to ${Math.min(
                  paginationData.currentPage * paginationData.itemsPerPage,
                  paginationData.totalItems,
                )} of ${paginationData.totalItems}`
              : "0"}{" "}
            entries
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
        <Flex justify="center" p="xl">
          <Loader size="lg" type="dots" />
        </Flex>
      ) : vulnerabilities?.length ? (
        <>
          <Paper withBorder>
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
                  <Table.Th
                    onClick={() => handleSort("status")}
                    style={{ cursor: "pointer" }}
                    role="button"
                  >
                    <Group gap={4}>
                      Status
                      {sortField === "status" &&
                        (sortDirection === "asc" ? (
                          <IconChevronUp size={14} />
                        ) : (
                          <IconChevronDown size={14} />
                        ))}
                    </Group>
                  </Table.Th>
                  <Table.Th
                    onClick={() => handleSort("createdAt")}
                    style={{ cursor: "pointer" }}
                    role="button"
                  >
                    <Group gap={4}>
                      Age
                      {sortField === "createdAt" &&
                        (sortDirection === "asc" ? (
                          <IconChevronUp size={14} />
                        ) : (
                          <IconChevronDown size={14} />
                        ))}
                    </Group>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {vulnerabilities.map((vuln) => {
                  const currentQuarterData = selectedQuarter
                    ? vuln.quarterData.find(
                        (qd) => qd.quarter === selectedQuarter,
                      )
                    : getLatestQuarterData(vuln.quarterData);
                  const isResolved = currentQuarterData?.isResolved ?? false;

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
                        <Badge color={isResolved ? "green" : "red"}>
                          {isResolved ? "Resolved" : "Unresolved"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{getTimeDifference(vuln.createdAt)}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Paper>
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
      ) : (
        <Alert title="No Vulnerabilities Found" color="gray" variant="light">
          No vulnerabilities found matching the current filters.
        </Alert>
      )}

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
              <strong>Risk Level:</strong>{" "}
              <Badge color={getRiskBadgeColor(selectedVuln.riskLevel)}>
                {selectedVuln.riskLevel}
              </Badge>
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
