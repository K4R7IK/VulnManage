"use client";

import { useState, useEffect } from "react";
import {
  Container,
  Card,
  Table,
  Button,
  Modal,
  TextInput,
  Flex,
  Group,
  Title,
  Loader,
  Notification,
} from "@mantine/core";
import { IconPlus, IconEdit, IconTrash, IconX, IconCopy } from "@tabler/icons-react";

// User and Company Types
interface User {
  id: number;
  name: string;
  email: string;
  role: "Admin" | "User";
  companyId?: number;
}

interface Company {
  id: number;
  name: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States for managing Add/Edit User modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({
    name: "",
    email: "",
    role: "User",
    companyId: undefined,
  });

  // States for Register Token modal
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerToken, setRegisterToken] = useState("");

  // Fetch users and companies
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const usersRes = await fetch("/api/users", { credentials: "include" });
        if (usersRes.status === 401) {
          setError("Unauthorized: Please log in.");
          setLoading(false);
          return;
        }

        const usersData = await usersRes.json();
        setUsers(usersData);

        const companiesRes = await fetch("/api/companies", { credentials: "include" });
        const companiesData = await companiesRes.json();
        setCompanies(companiesData);
      } catch (error) {
        setError("Failed to fetch data.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Handle opening user modal (Add/Edit)
  const openUserModal = (user?: User) => {
    setEditingUser(user || null);
    setFormData(user || { name: "", email: "", role: "User", companyId: undefined });
    setUserModalOpen(true);
  };

  // Handle input changes for Add/Edit user modal
  const handleChange = (field: keyof User, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle form submission (Add/Edit user)
  const handleSubmitUser = async () => {
    try {
      const method = editingUser ? "PUT" : "POST";
      const res = await fetch("/api/users", {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (res.status === 401) {
        setError("Unauthorized: Please log in.");
        return;
      }

      if (!res.ok) throw new Error("Failed to save user");

      const updatedUser = await res.json();
      setUsers((prev) =>
        editingUser
          ? prev.map((user) => (user.id === updatedUser.id ? updatedUser : user))
          : [...prev, updatedUser]
      );

      setUserModalOpen(false);
    } catch (error) {
      setError("Error saving user.");
    }
  };

  // Handle delete user
  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/users?id=${userId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.status === 401) {
        setError("Unauthorized: Please log in.");
        return;
      }

      if (!res.ok) throw new Error("Failed to delete user");

      setUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (error) {
      setError("Error deleting user.");
    }
  };

  // Generate register token
  const generateToken = async () => {
    try {
      const res = await fetch("/api/auth/register-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: registerEmail }),
      });

      if (!res.ok) throw new Error("Failed to generate token");

      const data = await res.json();
      setRegisterToken(data.token);
    } catch (error) {
      setError("Error generating token.");
    }
  };

  if (loading)
    return (
      <Flex direction="column" justify="center" align="center" mih="100vh">
        <Loader type="dots" size="xl" />
      </Flex>
    );

  return (
    <Container>
      <Title order={2} mb="md">
        User Management
      </Title>

      {error && (
        <Notification color="red" icon={<IconX />} onClose={() => setError(null)} mb="md">
          {error}
        </Notification>
      )}

      {/* Buttons */}
      <Group mb="md">
        <Button leftSection={<IconPlus />} onClick={() => openUserModal()}>
          Add User
        </Button>
        <Button onClick={() => setRegisterModalOpen(true)}>Register New User</Button>
      </Group>

      {/* Register User Modal */}
      <Modal opened={registerModalOpen} onClose={() => setRegisterModalOpen(false)} title="Register New User">
        <TextInput
          label="User Email"
          value={registerEmail}
          onChange={(e) => setRegisterEmail(e.target.value)}
          required
          mb="sm"
        />
        <Button onClick={generateToken}>Generate Token</Button>
        {registerToken && (
          <Notification>
            Token: {registerToken}{" "}
            <Button
              leftSection={<IconCopy />}
              onClick={() => navigator.clipboard.writeText(registerToken)}
            >
              Copy
            </Button>
          </Notification>
        )}
      </Modal>

      {/* Users Table */}
      <Card withBorder shadow="sm">
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Company</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users.map((user) => (
              <Table.Tr key={user.id}>
                <Table.Td>{user.name}</Table.Td>
                <Table.Td>{user.email}</Table.Td>
                <Table.Td>{user.role}</Table.Td>
                <Table.Td>
                  {companies.find((c) => c.id === user.companyId)?.name || "N/A"}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => openUserModal(user)}>
                      Edit
                    </Button>
                    <Button variant="light" color="red" leftSection={<IconTrash size={16} />} onClick={() => handleDeleteUser(user.id)}>
                      Delete
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </Container>
  );
}
