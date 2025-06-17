"use client";

import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  TextInput,
  Group,
  LoadingOverlay,
  Text,
  ActionIcon,
  Space,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconPlus, IconEdit, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { CompanySchema } from "@/types/schema"; // Assuming this path is correct
import { z } from "zod";

// Define Company type based on CompanySchema
type Company = z.infer<typeof CompanySchema>;

// Placeholder for server actions (to be implemented later)
const fetchCompanies = async (): Promise<Company[]> => {
  // Simulate API call
  console.log("Fetching companies...");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  // Sample data - replace with actual API call
  return [
    { id: "1", name: "Tech Corp", createdAt: new Date(), updatedAt: new Date() },
    { id: "2", name: "Innovate LLC", createdAt: new Date(), updatedAt: new Date() },
  ];
};

const createCompany = async (data: { name: string }): Promise<Company | null> => {
  console.log("Creating company:", data);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  // Simulate successful creation
  return { id: Math.random().toString(), ...data, createdAt: new Date(), updatedAt: new Date() };
  // Simulate error:
  // return null;
};

const updateCompany = async (id: string, data: { name: string }): Promise<Company | null> => {
  console.log("Updating company:", id, data);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  // Simulate successful update
  return { id, ...data, createdAt: new Date(), updatedAt: new Date() }; // createdAt would not change in reality
  // Simulate error:
  // return null;
};

const deleteCompany = async (id: string): Promise<boolean> => {
  console.log("Deleting company:", id);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  // Simulate successful deletion
  return true;
  // Simulate error:
  // return false;
};


export default function CompanyManagementTab() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const addForm = useForm({
    initialValues: { name: "" },
    validate: {
      name: (value) => (value.trim().length > 0 ? null : "Company name is required"),
    },
  });

  const editForm = useForm({
    initialValues: { id: "", name: "" },
    validate: {
      name: (value) => (value.trim().length > 0 ? null : "Company name is required"),
    },
  });

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const data = await fetchCompanies();
      setCompanies(data);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to fetch companies.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleAddCompany = async (values: { name: string }) => {
    setLoading(true);
    const newCompany = await createCompany(values);
    if (newCompany) {
      setCompanies([...companies, newCompany]);
      notifications.show({
        title: "Success",
        message: "Company added successfully.",
        color: "green",
      });
      setAddModalOpen(false);
      addForm.reset();
    } else {
      notifications.show({
        title: "Error",
        message: "Failed to add company.",
        color: "red",
      });
    }
    setLoading(false);
  };

  const handleEditCompany = async (values: { id: string; name: string }) => {
    if (!selectedCompany) return;
    setLoading(true);
    const updatedCompany = await updateCompany(values.id, { name: values.name });
    if (updatedCompany) {
      setCompanies(
        companies.map((c) => (c.id === values.id ? updatedCompany : c))
      );
      notifications.show({
        title: "Success",
        message: "Company updated successfully.",
        color: "green",
      });
      setEditModalOpen(false);
    } else {
      notifications.show({
        title: "Error",
        message: "Failed to update company.",
        color: "red",
      });
    }
    setLoading(false);
  };

  const handleDeleteCompany = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const success = await deleteCompany(selectedCompany.id);
    if (success) {
      setCompanies(companies.filter((c) => c.id !== selectedCompany.id));
      notifications.show({
        title: "Success",
        message: "Company deleted successfully.",
        color: "green",
      });
      setDeleteModalOpen(false);
      setSelectedCompany(null);
    } else {
      notifications.show({
        title: "Error",
        message: "Failed to delete company.",
        color: "red",
      });
    }
    setLoading(false);
  };

  const openEditModal = (company: Company) => {
    setSelectedCompany(company);
    editForm.setValues({ id: company.id, name: company.name });
    setEditModalOpen(true);
  };

  const openDeleteModal = (company: Company) => {
    setSelectedCompany(company);
    setDeleteModalOpen(true);
  };

  const rows = companies.map((company) => (
    <Table.Tr key={company.id}>
      <Table.Td>{company.name}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon
            variant="light"
            onClick={() => openEditModal(company)}
            aria-label={`Edit ${company.name}`}
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            color="red"
            onClick={() => openDeleteModal(company)}
            aria-label={`Delete ${company.name}`}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <div>
      <LoadingOverlay visible={loading} />
      <Group justify="space-between" mb="md">
        <Text>Manage your companies.</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setAddModalOpen(true)}>
          Add Company
        </Button>
      </Group>

      {companies.length === 0 && !loading ? (
          <Text>No companies found. Add your first company.</Text>
      ) : (
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      )}


      {/* Add Company Modal */}
      <Modal
        opened={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add New Company"
      >
        <form onSubmit={addForm.onSubmit(handleAddCompany)}>
          <TextInput
            label="Company Name"
            placeholder="Enter company name"
            {...addForm.getInputProps("name")}
            required
          />
          <Space h="md" />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Company</Button>
          </Group>
        </form>
      </Modal>

      {/* Edit Company Modal */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Company"
      >
        <form onSubmit={editForm.onSubmit(handleEditCompany)}>
          <TextInput
            label="Company Name"
            placeholder="Enter company name"
            {...editForm.getInputProps("name")}
            required
          />
          <Space h="md" />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </Group>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Delete"
        size="sm"
      >
        <Text>Are you sure you want to delete "{selectedCompany?.name}"?</Text>
        <Space h="md" />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDeleteCompany}>
            Delete Company
          </Button>
        </Group>
      </Modal>
    </div>
  );
}
