"use client";

import { useEffect, useState } from "react";
import { AppShell, Text, Button, Menu } from "@mantine/core";
import {
  IconUser,
  IconLogout,
  IconMail,
  IconAdjustmentsAlt,
  IconMenu2,
  IconUpload,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<{
    userId: number;
    name: string;
    email: string;
    role: string;
  } | null>(null);
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "GET", credentials: "include" });
    router.push("/login");
  };
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/user", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchUser();
  }, []);

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header
        p="sm"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text size="xl" fw={600} component={Link} href="/dashboard">
          Dashboard
        </Text>

        <Menu trigger="click-hover" openDelay={50} closeDelay={100}>
          <Menu.Target>
            <Button variant="subtle" color="black" radius="sm">
              <IconMenu2 size={20} />
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconUpload size={16} />}
              component={Link}
              href="/dashboard/upload"
            >
              Upload Data
            </Menu.Item>
            <Menu.Label>User Info</Menu.Label>
            <Menu.Item leftSection={<IconUser size={16} />}>
              {user?.name}
            </Menu.Item>
            <Menu.Item leftSection={<IconMail size={16} />}>
              {user?.email}
            </Menu.Item>
            <Menu.Item leftSection={<IconAdjustmentsAlt size={16} />}>
              {user?.role}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              leftSection={<IconLogout size={16} />}
              color="red"
              onClick={handleLogout}
            >
              Logout
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </AppShell.Header>

      {/* Main Content */}
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
