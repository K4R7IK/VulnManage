"use client";

import React, { useEffect, useState } from "react";
import {
  Container,
  Card,
  Title,
  Text,
  Table,
  Badge,
  Loader,
  Select,
  Group,
  Paper,
  Flex,
  MultiSelect,
  TextInput,
  Pagination,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconSearch, IconClock } from "@tabler/icons-react";

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
  const [filteredVulnerabilities, setFilteredVulnerabilities] = useState<
    Vulnerability[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRiskLevels, setSelectedRiskLevels] = useState<string[]>([]);
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [userRole, setUserRole] = useState<string | null>(null);

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

  // Fetch overdue vulnerabilities
  useEffect(() => {
    const fetchOverdueVulnerabilities = async () => {
      if (!selectedCompanyId) return;

      setLoading(true);
      try {
        const res = await fetch(
          `/api/vuln/overdue?companyId=${selectedCompanyId}`,
          {
            credentials: "include",
          }
        );
        if (res.ok) {
          const data = await res.json();
          setVulnerabilities(data);
          setFilteredVulnerabilities(data);
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

    fetchOverdueVulnerabilities();
  }, [selectedCompanyId]);

  // Apply filters
  useEffect(() => {
    let filtered = [...vulnerabilities];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (vuln) =>
          vuln.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vuln.assetIp.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by risk level
    if (selectedRiskLevels.length > 0) {
      filtered = filtered.filter((vuln) =>
        selectedRiskLevels.includes(vuln.riskLevel)
      );
    }

    // Filter by asset type
    if (selectedAssetTypes.length > 0) {
      filtered = filtered.filter((vuln) =>
        selectedAssetTypes.includes(vuln.assetType)
      );
    }

    // Sort by risk level (highest to lowest) and then by days past SLA (highest to lowest)
    filtered.sort((a, b) => {
      // First by risk level
      const riskOrder = { Critical: 4, High: 3, Medium: 2, Low: 1, None: 0 };
      const riskDiff =
        riskOrder[b.riskLevel as keyof typeof riskOrder] -
        riskOrder[a.riskLevel as keyof typeof riskOrder];

      if (riskDiff !== 0) return riskDiff;

      // Then by days past SLA
      return b.daysPastSLA - a.daysPastSLA;
    });

    setFilteredVulnerabilities(filtered);
  }, [vulnerabilities, searchTerm, selectedRiskLevels, selectedAssetTypes]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredVulnerabilities.length / itemsPerPage);
  const paginatedVulnerabilities = filteredVulnerabilities.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

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

  // Get unique asset types from vulnerabilities
  const assetTypeOptions = Array.from(
    new Set(vulnerabilities.map((v) => v.assetType))
  ).map((type) => ({ value: type, label: type }));

  return (
    <Container fluid>
      <Paper p="md" shadow="xs" mb="md">
        <Title order={2} mb="md">
          Overdue Vulnerabilities
        </Title>
        <Text c="dimmed" mb="md">
          Vulnerabilities that have exceeded their remediation SLA based on risk
          level
        </Text>

        <Flex gap="md" direction={{ base: "column", md: "row" }} mb="md">
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
              onChange={setSelectedCompanyId}
              w={{ base: "100%", md: "250px" }}
            />
          )}

          {/* Search bar */}
          <TextInput
            label="Search"
            placeholder="Search by title or IP"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            w={{ base: "100%", md: "300px" }}
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
            onChange={setSelectedRiskLevels}
            w={{ base: "100%", md: "250px" }}
          />

          {/* Asset type filter */}
          <MultiSelect
            label="Asset Type"
            placeholder="Filter by asset type"
            data={assetTypeOptions}
            value={selectedAssetTypes}
            onChange={setSelectedAssetTypes}
            w={{ base: "100%", md: "250px" }}
          />
        </Flex>
      </Paper>

      {loading ? (
        <Flex justify="center" align="center" h="200px">
          <Loader size="lg" />
        </Flex>
      ) : filteredVulnerabilities.length === 0 ? (
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
                  <Table.Th>Risk Level</Table.Th>
                  <Table.Th>Asset Type</Table.Th>
                  <Table.Th>Discovery Date</Table.Th>
                  <Table.Th>Days Past SLA</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedVulnerabilities.map((vuln) => (
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

          {/* Pagination */}
          {totalPages > 1 && (
            <Group justify="center" mb="md">
              <Pagination
                total={totalPages}
                value={page}
                onChange={setPage}
                withEdges
              />
            </Group>
          )}

          <Text c="dimmed" size="sm" ta="center">
            Showing {paginatedVulnerabilities.length} of{" "}
            {filteredVulnerabilities.length} overdue vulnerabilities
          </Text>
        </>
      )}
    </Container>
  );
}
