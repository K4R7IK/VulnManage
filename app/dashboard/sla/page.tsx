"use client";

import React, { useEffect, useState } from "react";
import {
  Container,
  Card,
  Title,
  Text,
  Table,
  NumberInput,
  Button,
  LoadingOverlay,
  Group,
  Select,
  Paper,
  Divider,
  Badge,
  SegmentedControl,
  Box,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconDeviceDesktop,
  IconGlobe,
  IconNetwork,
  IconCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { useForm } from "@mantine/form";

// Define types
interface Company {
  id: number;
  name: string;
}

enum AssetType {
  Internet = "Internet",
  Intranet = "Intranet",
  Endpoint = "Endpoint",
}

enum RiskLevel {
  Critical = "Critical",
  High = "High",
  Medium = "Medium",
  Low = "Low",
  None = "None",
}

interface RiskSLA {
  id?: number;
  companyId: number;
  riskLevel: RiskLevel;
  sla: number;
  type: AssetType;
}

interface FormValues {
  internet: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  intranet: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  endpoint: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// Default SLA values
const defaultSLAs: FormValues = {
  internet: { critical: 7, high: 14, medium: 30, low: 60 },
  intranet: { critical: 14, high: 30, medium: 60, low: 90 },
  endpoint: { critical: 30, high: 60, medium: 90, low: 120 },
};

export default function SLAManagementPage() {
  // State variables
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null,
  );
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AssetType>(AssetType.Internet);

  // Form setup
  const form = useForm<FormValues>({
    initialValues: defaultSLAs,
    validate: {
      internet: {
        critical: (value) => (value < 1 ? "SLA must be at least 1 day" : null),
        high: (value) => (value < 1 ? "SLA must be at least 1 day" : null),
        medium: (value) => (value < 1 ? "SLA must be at least 1 day" : null),
        low: (value) => (value < 1 ? "SLA must be at least 1 day" : null),
      },
      intranet: {
        critical: (value) => (value < 1 ? "SLA must be at least 1 day" : null),
        high: (value) => (value < 1 ? "SLA must be at least 1 day" : null),
        medium: (value) => (value < 1 ? "SLA must be at least 1 day" : null),
        low: (value) => (value < 1 ? "SLA must be at least 1 day" : null),
      },
      endpoint: {
        critical: (value) => (value < 1 ? "SLA must be at least 1 day" : null),
        high: (value) => (value < 1 ? "SLA must be at least 1 day" : null),
        medium: (value) => (value < 1 ? "SLA must be at least 1 day" : null),
        low: (value) => (value < 1 ? "SLA must be at least 1 day" : null),
      },
    },
  });

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

  // Fetch SLA configuration
  useEffect(() => {
    const fetchSLAConfig = async () => {
      if (!selectedCompanyId) return;

      setLoading(true);
      try {
        const res = await fetch(`/api/sla?companyId=${selectedCompanyId}`, {
          credentials: "include",
        });

        if (res.ok) {
          const data: RiskSLA[] = await res.json();

          // Transform API data to form structure
          const formData: FormValues = { ...defaultSLAs };

          data.forEach((sla) => {
            const riskLevelLower =
              sla.riskLevel.toLowerCase() as keyof typeof formData.internet;
            const typeLower = sla.type.toLowerCase() as keyof typeof formData;

            if (
              typeLower in formData &&
              riskLevelLower in formData[typeLower]
            ) {
              (formData[typeLower] as any)[riskLevelLower] = sla.sla;
            }
          });

          form.setValues(formData);
        } else {
          // If no data exists, reset to defaults
          form.setValues(defaultSLAs);
        }
      } catch (error) {
        console.error("Error fetching SLA configuration:", error);
        notifications.show({
          title: "Error",
          message: "Failed to fetch SLA configuration",
          color: "red",
        });
        // Reset to defaults on error
        form.setValues(defaultSLAs);
      } finally {
        setLoading(false);
      }
    };

    fetchSLAConfig();
  }, [selectedCompanyId]);

  // Handle form submission
  const handleSubmit = async (values: FormValues) => {
    if (!selectedCompanyId) {
      notifications.show({
        title: "Error",
        message: "No company selected",
        color: "red",
      });
      return;
    }

    setSaving(true);
    try {
      // Transform form data to API structure
      const slaData: Omit<RiskSLA, "id">[] = [];

      // Internet SLAs
      Object.entries(values.internet).forEach(([risk, sla]) => {
        slaData.push({
          companyId: parseInt(selectedCompanyId),
          riskLevel: (risk.charAt(0).toUpperCase() +
            risk.slice(1)) as RiskLevel,
          sla,
          type: AssetType.Internet,
        });
      });

      // Intranet SLAs
      Object.entries(values.intranet).forEach(([risk, sla]) => {
        slaData.push({
          companyId: parseInt(selectedCompanyId),
          riskLevel: (risk.charAt(0).toUpperCase() +
            risk.slice(1)) as RiskLevel,
          sla,
          type: AssetType.Intranet,
        });
      });

      // Endpoint SLAs
      Object.entries(values.endpoint).forEach(([risk, sla]) => {
        slaData.push({
          companyId: parseInt(selectedCompanyId),
          riskLevel: (risk.charAt(0).toUpperCase() +
            risk.slice(1)) as RiskLevel,
          sla,
          type: AssetType.Endpoint,
        });
      });

      // Save SLA data
      const res = await fetch("/api/sla", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          companyId: parseInt(selectedCompanyId),
          slaData,
        }),
      });

      if (res.ok) {
        notifications.show({
          title: "Success",
          message: "SLA configuration saved successfully",
          color: "green",
          icon: <IconCheck size={16} />,
        });
      } else {
        throw new Error("Failed to save SLA configuration");
      }
    } catch (error) {
      console.error("Error saving SLA configuration:", error);
      notifications.show({
        title: "Error",
        message: "Failed to save SLA configuration",
        color: "red",
        icon: <IconAlertTriangle size={16} />,
      });
    } finally {
      setSaving(false);
    }
  };

  // Helper to get icon for asset type
  const getAssetTypeIcon = (type: AssetType) => {
    switch (type) {
      case AssetType.Internet:
        return <IconGlobe size={16} />;
      case AssetType.Intranet:
        return <IconNetwork size={16} />;
      case AssetType.Endpoint:
        return <IconDeviceDesktop size={16} />;
    }
  };

  // Helper to get risk level badge color
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

  return (
    <Container fluid>
      <Paper p="md" shadow="xs" mb="md">
        <Title order={2} mb="md">
          SLA Configuration
        </Title>
        <Text c="dimmed" mb="md">
          Configure remediation SLAs (in days) for different risk levels and
          asset types
        </Text>

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
            mb="md"
          />
        )}
      </Paper>

      <Card withBorder shadow="sm" pos="relative">
        <LoadingOverlay
          visible={loading || saving}
          overlayProps={{ radius: "sm", blur: 2 }}
        />

        <form onSubmit={form.onSubmit(handleSubmit)}>
          {/* Asset Type Selector */}
          <SegmentedControl
            value={activeTab}
            onChange={(value) => setActiveTab(value as AssetType)}
            data={[
              {
                value: AssetType.Internet,
                label: (
                  <Group gap="xs">
                    <IconGlobe size={16} />
                    <Text size="sm">Internet</Text>
                  </Group>
                ),
              },
              {
                value: AssetType.Intranet,
                label: (
                  <Group gap="xs">
                    <IconNetwork size={16} />
                    <Text size="sm">Intranet</Text>
                  </Group>
                ),
              },
              {
                value: AssetType.Endpoint,
                label: (
                  <Group gap="xs">
                    <IconDeviceDesktop size={16} />
                    <Text size="sm">Endpoint</Text>
                  </Group>
                ),
              },
            ]}
            mb="lg"
            fullWidth
          />

          <Divider mb="md" />

          {/* SLA Configuration Form */}
          <Box mb="lg">
            <Title order={4} mb="md">
              <Group gap="xs">
                {getAssetTypeIcon(activeTab)}
                <Text>{activeTab} Vulnerability SLAs</Text>
              </Group>
            </Title>

            <Table withTableBorder mb="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Risk Level</Table.Th>
                  <Table.Th style={{ width: "50%" }}>
                    Remediation SLA (Days)
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td>
                    <Badge color={getRiskBadgeColor("Critical")} size="lg">
                      Critical
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      min={1}
                      max={365}
                      {...form.getInputProps(
                        `${activeTab.toLowerCase()}.critical`,
                      )}
                      w="100%"
                    />
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>
                    <Badge color={getRiskBadgeColor("High")} size="lg">
                      High
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      min={1}
                      max={365}
                      {...form.getInputProps(`${activeTab.toLowerCase()}.high`)}
                      w="100%"
                    />
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>
                    <Badge color={getRiskBadgeColor("Medium")} size="lg">
                      Medium
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      min={1}
                      max={365}
                      {...form.getInputProps(
                        `${activeTab.toLowerCase()}.medium`,
                      )}
                      w="100%"
                    />
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>
                    <Badge color={getRiskBadgeColor("Low")} size="lg">
                      Low
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      min={1}
                      max={365}
                      {...form.getInputProps(`${activeTab.toLowerCase()}.low`)}
                      w="100%"
                    />
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Box>

          <Divider mb="md" />

          {/* Submit Button */}
          <Group justify="flex-end">
            <Button
              type="submit"
              loading={saving}
              disabled={!selectedCompanyId}
            >
              Save SLA Configuration
            </Button>
          </Group>
        </form>
      </Card>
    </Container>
  );
}
