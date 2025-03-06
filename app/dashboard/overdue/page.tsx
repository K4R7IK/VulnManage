"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Container,
  Card,
  Title,
  Text,
  Table,
  Badge,
  Loader,
  Select,
  Paper,
  Flex,
  MultiSelect,
  TextInput,
  Pagination,
  Group,
  Box,
  Button,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconSearch,
  IconClock,
  IconArrowBadgeUp,
  IconArrowBadgeDown,
  IconRefresh,
} from "@tabler/icons-react";

// Define types
interface Vulnerability {
  id: string;
  assetIp: string;
  assetOS: string | null;
  title: string;
  riskLevel: "Critical" | "High" | "Medium" | "Low" | "None";
  fileUploadDate: string;
  daysPastSLA: number;
  assetType: string;
}

interface Company {
  id: number;
  name: string;
}

export default function OverdueVulnerabilitiesPage() {
  // State variables
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedRiskLevels, setSelectedRiskLevels] = useState<string[]>([]);
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Pagination and sorting state
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [totalItems, setTotalItems] = useState(0);
  const [cursors, setCursors] = useState<Record<number, string>>({});
  const [sortBy, setSortBy] = useState<string>("riskLevel");
  const [sortOrder, setSortOrder] = useState<string>("desc");

  // Ref for search debounce
  const searchTimeoutRef = useRef<number | null>(null);

  // Options for items per page
  const itemsPerPageOptions = [
    { value: "25", label: "25 rows" },
    { value: "50", label: "50 rows" },
    { value: "100", label: "100 rows" },
    { value: "200", label: "200 rows" },
  ];

  // Handle search term change with debounce
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    // Set a new timeout
    searchTimeoutRef.current = window.setTimeout(() => {
      setDebouncedSearchTerm(value);
      // Reset pagination when search changes
      setPage(1);
      setCursors({});
    }, 500);
  }, []);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Fetch user information on component mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await fetch("/api/auth/user", { credentials: "include" });
        const data = await res.json();
        if (res.ok) {
          setUserRole(data.role);
          if (data.role !== "Admin") {
            setSelectedCompanyId(data.companyId?.toString() || null);
          }
        }
      } catch (error) {
        console.error("Error fetching user info:", error);
      }
    };
    fetchUserInfo();
  }, []);

  // Fetch companies (for admins)
  useEffect(() => {
    const fetchCompanies = async () => {
      if (userRole === "Admin") {
        try {
          const res = await fetch("/api/companies", { credentials: "include" });
          const data = await res.json();
          if (res.ok) {
            setCompanies(data);
            if (data.length > 0 && !selectedCompanyId) {
              setSelectedCompanyId(data[0].id.toString());
            }
          }
        } catch (error) {
          console.error("Error fetching companies:", error);
          notifications.show({
            title: "Error",
            message: "Failed to fetch companies",
            color: "red",
          });
        }
      }
    };
    fetchCompanies();
  }, [userRole]);

  // Function to toggle sort order
  const toggleSortOrder = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc"); // Default to descending when changing fields
    }
    // Reset pagination on sort change
    setPage(1);
    setCursors({});
  };

  const handleRefresh = useCallback(() => {
    if (!selectedCompanyId) return;

    setLoading(true);
    try {
      // Determine the cursor for this page (if not the first page)
      const cursor = page > 1 ? cursors[page - 1] : undefined;

      // Build the URL with query parameters
      let url = `/api/vuln/overdue?companyId=${selectedCompanyId}&limit=${itemsPerPage}`;
      if (cursor) url += `&cursor=${cursor}`;
      url += `&sortBy=${sortBy}&sortOrder=${sortOrder}`;

      // Add filters to the URL
      if (debouncedSearchTerm)
        url += `&search=${encodeURIComponent(debouncedSearchTerm)}`;
      if (selectedRiskLevels.length > 0)
        url += `&riskLevels=${selectedRiskLevels.join(",")}`;
      if (selectedAssetTypes.length > 0)
        url += `&assetTypes=${selectedAssetTypes.join(",")}`;

      fetch(url, { credentials: "include" })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Failed to fetch data");
        })
        .then(({ data, nextCursor, totalCount }) => {
          setVulnerabilities(data);
          setTotalItems(totalCount);

          // If we have a next cursor, store it for the next page
          if (nextCursor) {
            setCursors((prev) => ({
              ...prev,
              [page]: nextCursor,
            }));
          }
        })
        .catch((error) => {
          console.error("Error fetching overdue vulnerabilities:", error);
          notifications.show({
            title: "Error",
            message: "Failed to fetch overdue vulnerabilities",
            color: "red",
          });
        })
        .finally(() => {
          setLoading(false);
        });
    } catch (error) {
      console.error("Error in refresh:", error);
      setLoading(false);
    }
  }, [
    selectedCompanyId,
    page,
    itemsPerPage,
    sortBy,
    sortOrder,
    debouncedSearchTerm,
    selectedRiskLevels,
    selectedAssetTypes,
    cursors,
  ]);

  useEffect(() => {
    if (selectedCompanyId) {
      handleRefresh();
    }
  }, [selectedCompanyId]);

  // Fetch vulnerabilities when filters change
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedCompanyId) return;

      setLoading(true);
      try {
        // Determine the cursor for this page (if not the first page)
        const cursor = page > 1 ? cursors[page - 1] : undefined;

        // Build the URL with query parameters
        let url = `/api/vuln/overdue?companyId=${selectedCompanyId}&limit=${itemsPerPage}`;
        if (cursor) url += `&cursor=${cursor}`;
        url += `&sortBy=${sortBy}&sortOrder=${sortOrder}`;

        // Add filters to the URL
        if (debouncedSearchTerm)
          url += `&search=${encodeURIComponent(debouncedSearchTerm)}`;
        if (selectedRiskLevels.length > 0)
          url += `&riskLevels=${selectedRiskLevels.join(",")}`;
        if (selectedAssetTypes.length > 0)
          url += `&assetTypes=${selectedAssetTypes.join(",")}`;

        const res = await fetch(url, {
          credentials: "include",
        });

        if (res.ok) {
          const { data, nextCursor, totalCount } = await res.json();
          setVulnerabilities(data);
          setTotalItems(totalCount);

          // If we have a next cursor, store it for the next page
          if (nextCursor) {
            setCursors((prev) => ({
              ...prev,
              [page]: nextCursor,
            }));
          }
        } else {
          notifications.show({
            title: "Error",
            message: "Failed to fetch overdue vulnerabilities",
            color: "red",
          });
        }
      } catch (error) {
        console.error("Error fetching overdue vulnerabilities:", error);
        notifications.show({
          title: "Error",
          message: "Failed to fetch overdue vulnerabilities",
          color: "red",
        });
      } finally {
        setLoading(false);
      }
    };

    if (selectedCompanyId) {
      fetchData();
    }
  }, [
    selectedCompanyId,
    page,
    itemsPerPage,
    sortBy,
    sortOrder,
    debouncedSearchTerm,
    selectedRiskLevels,
    selectedAssetTypes,
    // No function dependency here - this was causing the infinite loop
  ]);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
    setCursors({});
  }, [
    selectedCompanyId,
    itemsPerPage,
    sortBy,
    sortOrder,
    debouncedSearchTerm,
    selectedRiskLevels,
    selectedAssetTypes,
  ]);

  // Calculate total pages
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Get badge color based on risk level
  const getRiskBadgeColor = (riskLevel: string) => {
    const colorMap: Record<string, string> = {
      Critical: "red",
      High: "orange",
      Medium: "yellow",
      Low: "blue",
      None: "gray",
    };
    return colorMap[riskLevel] || "gray";
  };

  // Get badge color based on SLA status
  const getSLABadgeColor = (daysPastSLA: number) => {
    if (daysPastSLA > 14) return "red";
    if (daysPastSLA > 7) return "orange";
    return "yellow";
  };

  // Get sort icon for column headers
  const getSortIcon = (field: string) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? (
      <IconArrowBadgeUp size={16} />
    ) : (
      <IconArrowBadgeDown size={16} />
    );
  };

  // Handle risk level filter change
  const handleRiskLevelChange = (values: string[]) => {
    setSelectedRiskLevels(values);
    setPage(1);
    setCursors({});
  };

  // Handle asset type filter change
  const handleAssetTypeChange = (values: string[]) => {
    setSelectedAssetTypes(values);
    setPage(1);
    setCursors({});
  };

  return (
    <Container fluid>
      <Paper p="md" shadow="xs" mb="md">
        <Flex justify="space-between" align="center" mb="md">
          <Box>
            <Title order={2}>Overdue Vulnerabilities</Title>
            <Text c="dimmed">
              Vulnerabilities that have exceeded their remediation SLA based on
              risk level
            </Text>
          </Box>
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
        </Flex>

        <Flex
          gap="md"
          direction={{ base: "column", md: "row" }}
          mb="md"
          wrap="wrap"
          justify="space-around"
        >
          {/* Company selector (for admins) */}
          {userRole === "Admin" && (
            <Select
              label="Company"
              placeholder="Select company"
              data={companies.map((c) => ({
                value: c.id.toString(),
                label: c.name,
              }))}
              value={selectedCompanyId}
              onChange={(value) => {
                setSelectedCompanyId(value);
                setPage(1);
                setCursors({});
              }}
              w={{ base: "100%", md: "200px" }}
              disabled={loading}
            />
          )}

          {/* Search bar */}
          <TextInput
            label="Search"
            placeholder="Search by title or IP"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            w={{ base: "100%", md: "250px" }}
            disabled={loading}
          />

          {/* Risk level filter */}
          <MultiSelect
            label="Risk Level"
            placeholder="Filter by risk level"
            data={[
              { value: "Critical", label: "Critical" },
              { value: "High", label: "High" },
              { value: "Medium", label: "Medium" },
              { value: "Low", label: "Low" },
            ]}
            value={selectedRiskLevels}
            onChange={handleRiskLevelChange}
            w={{ base: "100%", md: "200px" }}
            disabled={loading}
          />

          {/* Asset type filter */}
          <MultiSelect
            label="Asset Type"
            placeholder="Filter by asset type"
            data={[
              { value: "Internet", label: "Internet" },
              { value: "Intranet", label: "Intranet" },
              { value: "Endpoint", label: "Endpoint" },
            ]}
            value={selectedAssetTypes}
            onChange={handleAssetTypeChange}
            w={{ base: "100%", md: "200px" }}
            disabled={loading}
          />
          <Select
            label="Items per page"
            data={itemsPerPageOptions}
            value={itemsPerPage.toString()}
            onChange={(value) => {
              setItemsPerPage(Number(value));
              setPage(1);
              setCursors({});
            }}
            w={120}
            disabled={loading}
          />
        </Flex>
      </Paper>

      {loading ? (
        <Flex justify="center" align="center" h="200px">
          <Loader size="lg" />
        </Flex>
      ) : vulnerabilities.length === 0 ? (
        <Card p="xl" withBorder>
          <Text ta="center" fw={500} size="lg">
            No overdue vulnerabilities found
          </Text>
        </Card>
      ) : (
        <>
          <Card withBorder shadow="sm" mb="md">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Title</Table.Th>
                  <Table.Th>Asset IP</Table.Th>
                  <Table.Th>OS</Table.Th>
                  <Table.Th
                    onClick={() => toggleSortOrder("riskLevel")}
                    style={{ cursor: "pointer" }}
                  >
                    <Group gap="xs">
                      Risk Level
                      {getSortIcon("riskLevel")}
                    </Group>
                  </Table.Th>
                  <Table.Th>Asset Type</Table.Th>
                  <Table.Th>Discovery Date</Table.Th>
                  <Table.Th
                    onClick={() => toggleSortOrder("daysPastSLA")}
                    style={{ cursor: "pointer" }}
                  >
                    <Group gap="xs">
                      Days Past SLA
                      {getSortIcon("daysPastSLA")}
                    </Group>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {vulnerabilities.map((vuln) => (
                  <Table.Tr key={vuln.id}>
                    <Table.Td>{vuln.title}</Table.Td>
                    <Table.Td>{vuln.assetIp}</Table.Td>
                    <Table.Td>{vuln.assetOS || "N/A"}</Table.Td>
                    <Table.Td>
                      <Badge color={getRiskBadgeColor(vuln.riskLevel)}>
                        {vuln.riskLevel}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{vuln.assetType}</Table.Td>
                    <Table.Td>
                      {new Date(vuln.fileUploadDate).toLocaleDateString()}
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={getSLABadgeColor(vuln.daysPastSLA)}
                        leftSection={<IconClock size={14} />}
                      >
                        {vuln.daysPastSLA} days overdue
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>

          {/* Pagination controls */}
          <Flex justify="space-between" align="center" mb="md">
            {totalPages > 1 && (
              <Pagination
                total={totalPages}
                value={page}
                onChange={setPage}
                withEdges
                disabled={loading}
              />
            )}

            <Text c="dimmed" size="sm" ta="right">
              Showing {Math.min(itemsPerPage, vulnerabilities.length)} of{" "}
              {totalItems} overdue vulnerabilities
            </Text>
          </Flex>
        </>
      )}
    </Container>
  );
}
