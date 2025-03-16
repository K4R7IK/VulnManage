"use client";

import { useState, useEffect } from "react";
import {
  Container,
  Title,
  Tabs,
  Paper,
  Text,
  Badge,
  Box,
  Alert,
  Group,
  Loader,
} from "@mantine/core";
import {
  IconUserCog,
  IconUpload,
  IconRuler,
  IconAlertCircle,
  IconSettings,
} from "@tabler/icons-react";
import dynamic from "next/dynamic";
import { verifySession } from "@/lib/session";
import { UserSchema } from "@/types/schema";
import { z } from "zod";

const UserManagementTab = dynamic(
  () => import("@/app/dashboard/setting/_components/UserManagementTab"),
  { loading: () => <Loader /> },
);

const UploadTab = dynamic(
  () => import("@/app/dashboard/setting/_components/UploadTab"),
  { loading: () => <Loader /> },
);

const SLATab = dynamic(
  () => import("@/app/dashboard/setting/_components/SLATab"),
  { loading: () => <Loader /> },
);

type User = z.infer<typeof UserSchema>;

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<string | null>("user-management");
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        setIsLoading(true);
        const { success, user } = await verifySession(true);
        if (success) {
          setUser(user);
        }
      } catch (_error) {
        console.error("Error verifySession");
      } finally {
        setIsLoading(false);
      }
    }
    fetchUser();
  }, []);

  if (isLoading) {
    return (
      <Container py="xl">
        <Paper p="md" withBorder>
          <Group justify="center">
            <Loader size="lg" />
            <Text>Loading settings...</Text>
          </Group>
        </Paper>
      </Container>
    );
  }

  if (user?.role !== "Admin") {
    return (
      <Container py="xl">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Access Restricted"
          color="red"
        >
          You don't have permission to access system settings. Please contact
          your administrator.
        </Alert>
      </Container>
    );
  }

  console.log("Seeting Page", user);
  return (
    <Container fluid>
      <Paper p="md" shadow="xs" mb="md">
        <Group justify="space-between" mb="xs">
          <Box>
            <Title order={2}>
              <Group gap="xs">
                <IconSettings size={28} />
                <Text>System Settings</Text>
              </Group>
            </Title>
            <Text c="dimmed" size="sm">
              Configure system-wide settings and manage platform resources
            </Text>
          </Box>
          <Badge size="lg" radius="sm" variant="light">
            Administrator Access
          </Badge>
        </Group>
      </Paper>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab
            value="user-management"
            leftSection={<IconUserCog size={16} />}
          >
            User Management
          </Tabs.Tab>
          <Tabs.Tab value="upload" leftSection={<IconUpload size={16} />}>
            Upload Data
          </Tabs.Tab>
          <Tabs.Tab value="sla" leftSection={<IconRuler size={16} />}>
            SLA Configuration
          </Tabs.Tab>
        </Tabs.List>

        <Box pt="md">
          <Tabs.Panel value="user-management">
            <UserManagementTab user={user} />
          </Tabs.Panel>

          <Tabs.Panel value="upload">
            <UploadTab />
          </Tabs.Panel>

          <Tabs.Panel value="sla">
            <SLATab />
          </Tabs.Panel>
        </Box>
      </Tabs>
    </Container>
  );
}
