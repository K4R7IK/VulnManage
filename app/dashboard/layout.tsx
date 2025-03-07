"use client";

import { useEffect, useState } from "react";
import {
  AppShell,
  Button,
  Text,
  Image,
  Burger,
  Stack,
  Popover,
  Group,
  Avatar,
  NavLink,
} from "@mantine/core";
import {
  IconUser,
  IconLogout,
  IconUpload,
  IconMail,
  IconUsers,
  IconListDetails,
  IconLayoutDashboard,
  IconHourglassEmpty,
  IconTimeline,
  IconArrowsRightLeft,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useDisclosure } from "@mantine/hooks";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(false);
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(false);
  const [opened, { close, open }] = useDisclosure(false);
  const [user, setUser] = useState<{
    userId: number;
    name: string;
    email: string;
    role: string;
  } | null>(null);
  const [isClient, setIsClient] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
  };

  // Add this useEffect to handle client-side only rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

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
    if (isClient) {
      fetchUser();
    }
  }, [isClient]);

  return (
    <AppShell
      header={{ height: 60 }}
      padding="md"
      navbar={{
        width: 250,
        breakpoint: "sm",
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
    >
      <AppShell.Header
        p="sm"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Group>
          <Burger
            opened={mobileOpened}
            onClick={toggleMobile}
            hiddenFrom="sm"
            size="sm"
          />
          <Burger
            opened={desktopOpened}
            onClick={toggleDesktop}
            visibleFrom="sm"
            size="sm"
          />
          {isClient && (
            <Popover
              width={250}
              position="bottom-start"
              offset={4}
              withArrow
              arrowPosition="side"
              arrowOffset={5}
              opened={opened}
            >
              <Popover.Target>
                <Avatar
                  key={user?.name || "guest"}
                  name={user?.name || "Guest"}
                  color="initials"
                  allowedInitialsColors={["blue", "red", "purple"]}
                  onMouseEnter={open}
                  onMouseLeave={close}
                />
              </Popover.Target>
              <Popover.Dropdown>
                <Button
                  component={Text}
                  rightSection={<IconUser size={14} />}
                  variant="transparent"
                  color="black"
                  fullWidth
                  size="compact-sm"
                  justify="space-between"
                >
                  {user?.name || "Guest"}
                </Button>
                <Button
                  component={Text}
                  rightSection={<IconMail size={14} />}
                  variant="transparent"
                  color="black"
                  fullWidth
                  size="compact-sm"
                  justify="space-between"
                >
                  {user?.email || ""}
                </Button>
              </Popover.Dropdown>
            </Popover>
          )}
        </Group>
        <Image
          src="/etek.svg"
          radius="xs"
          fit="cover"
          w="100"
          alt="Company Logo"
        />
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <Stack mih="100%" justify="space-between">
          <Stack gap={0}>
            <NavLink
              variant="subtle"
              color="black"
              leftSection={<IconLayoutDashboard size={16} />}
              component="a"
              href="/dashboard"
              label="Dashboard"
              active
            ></NavLink>

            <NavLink
              variant="subtle"
              color="black"
              leftSection={<IconListDetails size={16} />}
              component="a"
              href="/dashboard/details"
              active
              label="View Table"
            ></NavLink>
            <NavLink
              variant="subtle"
              color="black"
              leftSection={<IconHourglassEmpty size={16} />}
              component="a"
              href="/dashboard/overdue"
              active
              label="View Overdue"
            ></NavLink>
            <NavLink
              variant="subtle"
              color="black"
              leftSection={<IconArrowsRightLeft size={16} />}
              component="a"
              href="/dashboard/carryforward"
              active
              label="Carry Forward"
            ></NavLink>
          </Stack>
          <Stack gap={0}>
            {isClient && user?.role === "Admin" && (
              <>
                <NavLink
                  variant="subtle"
                  color="black"
                  leftSection={<IconUpload size={16} />}
                  component="a"
                  href="/dashboard/upload"
                  label="Upload Data"
                  active
                ></NavLink>
                <NavLink
                  variant="subtle"
                  color="black"
                  leftSection={<IconTimeline size={16} />}
                  component="a"
                  href="/dashboard/sla"
                  label="Update SLA"
                  active
                ></NavLink>
                <NavLink
                  color="black"
                  leftSection={<IconUsers size={16} />}
                  component="a"
                  href="/dashboard/users"
                  label="User Management"
                  variant="subtle"
                  active
                ></NavLink>
              </>
            )}
            <NavLink
              onClick={handleLogout}
              leftSection={<IconLogout size={16} />}
              label="Logout"
              color="red"
              key="Logout"
              active
            ></NavLink>
          </Stack>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
