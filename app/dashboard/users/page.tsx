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
  Select,
} from "@mantine/core";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconX,
  IconCopy,
} from "@tabler/icons-react";

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

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  // Extend formData to include a password field
  const [formData, setFormData] = useState<
    Partial<User & { password: string }>
  >({
    name: "",
    email: "",
    role: "User",
    companyId: undefined,
    password: "",
  });

  // States for Register Token modal (unchanged)
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerCompanyId, setRegisterCompanyId] = useState<string>("");
  const [registerToken, setRegisterToken] = useState("");

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

        const companiesRes = await fetch("/api/companies", {
          credentials: "include",
        });
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

  const openUserModal = (user?: User) => {
    setEditingUser(user || null);
    if (user) {
      setFormData({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        password: "", // Leave password empty during edit
      });
    } else {
      setFormData({
        name: "",
        email: "",
        role: "User",
        companyId: undefined,
        password: "",
      });
    }
    setUserModalOpen(true);
  };

  const handleChange = (
    field: keyof (User & { password: string }),
    value: any
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitUser = async () => {
    try {
      const method = editingUser ? "PUT" : "POST";
      const bodyData = editingUser
        ? { ...formData, id: editingUser.id }
        : formData;
      const res = await fetch("/api/users", {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(bodyData),
      });

      if (res.status === 401) {
        setError("Unauthorized: Please log in.");
        return;
      }

      if (!res.ok) throw new Error("Failed to save user");

      const updatedUser = await res.json();
      setUsers((prev) =>
        editingUser
          ? prev.map((user) =>
              user.id === updatedUser.id ? updatedUser : user
            )
          : [...prev, updatedUser]
      );

      setUserModalOpen(false);
      setEditingUser(null);
      setFormData({
        name: "",
        email: "",
        role: "User",
        companyId: undefined,
        password: "",
      });
    } catch (error) {
      setError("Error saving user.");
    }
  };

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

  const generateToken = async () => {
    try {
      const res = await fetch("/api/auth/register-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: registerEmail,
          companyId: parseInt(registerCompanyId),
        }),
      });

      if (!res.ok) throw new Error("Failed to generate token");

      const data = await res.json();
      setRegisterToken(data.token);
    } catch (error) {
      setError("Error generating token.");
    }
  };

  const handleCloseRegisterModal = () => {
    setRegisterModalOpen(false);
    setRegisterEmail("");
    setRegisterCompanyId("");
    setRegisterToken("");
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
        <Notification
          color="red"
          icon={<IconX />}
          onClose={() => setError(null)}
          mb="md"
        >
          {error}
        </Notification>
      )}

      <Group mb="md">
        <Button leftSection={<IconPlus />} onClick={() => openUserModal()}>
          Add User
        </Button>
        <Button onClick={() => setRegisterModalOpen(true)}>
          Register New User
        </Button>
      </Group>

      {/* Add/Edit User Modal */}
      <Modal
        opened={userModalOpen}
        onClose={() => {
          setUserModalOpen(false);
          setEditingUser(null);
          setFormData({
            name: "",
            email: "",
            role: "User",
            companyId: undefined,
            password: "",
          });
        }}
        title={editingUser ? "Edit User" : "Add User"}
      >
        <TextInput
          label="Name"
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
          required
          mb="sm"
        />
        <TextInput
          label="Email"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          required
          mb="sm"
        />
        {/* Show password input only when adding a new user */}
        {!editingUser && (
          <TextInput
            label="Password"
            type="password"
            value={formData.password || ""}
            onChange={(e) => handleChange("password", e.target.value)}
            required
            mb="sm"
          />
        )}
        <Select
          label="Role"
          data={[
            { value: "User", label: "User" },
            { value: "Admin", label: "Admin" },
          ]}
          value={formData.role}
          onChange={(value) => handleChange("role", value)}
          required
          mb="sm"
        />
        <Select
          label="Company"
          data={companies.map((company) => ({
            value: company.id.toString(),
            label: company.name,
          }))}
          value={formData.companyId?.toString() || ""}
          onChange={(value) =>
            handleChange("companyId", value ? parseInt(value) : undefined)
          }
          required
          mb="md"
        />
        <Button
          onClick={handleSubmitUser}
          disabled={
            !formData.name ||
            !formData.email ||
            !formData.role ||
            !formData.companyId ||
            (!editingUser && !formData.password)
          }
        >
          {editingUser ? "Save Changes" : "Add User"}
        </Button>
      </Modal>

      {/* Register User Modal */}
      <Modal
        opened={registerModalOpen}
        onClose={handleCloseRegisterModal}
        title="Register New User"
      >
        <TextInput
          label="User Email"
          value={registerEmail}
          onChange={(e) => setRegisterEmail(e.target.value)}
          required
          mb="sm"
        />
        <Select
          label="Select Company"
          placeholder="Choose a company"
          data={companies.map((company) => ({
            value: company.id.toString(),
            label: company.name,
          }))}
          value={registerCompanyId}
          onChange={(value) => setRegisterCompanyId(value || "")}
          required
          mb="md"
        />
        <Button
          onClick={generateToken}
          disabled={!registerEmail || !registerCompanyId}
          mb="md"
        >
          Generate Token
        </Button>
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
                  {companies.find((c) => c.id === user.companyId)?.name ||
                    "N/A"}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Button
                      variant="light"
                      leftSection={<IconEdit size={16} />}
                      onClick={() => openUserModal(user)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="light"
                      color="red"
                      leftSection={<IconTrash size={16} />}
                      onClick={() => handleDeleteUser(user.id)}
                    >
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
