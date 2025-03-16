"use client";

import { useState, useEffect, useActionState } from "react";
import {
  Card,
  Table,
  Button,
  Modal,
  TextInput,
  Flex,
  Group,
  Title,
  Loader,
  Select,
  PasswordInput,
} from "@mantine/core";
import { IconPlus, IconEdit, IconTrash } from "@tabler/icons-react";
import { z } from "zod";
import { UserSchema, CompanySchema } from "@/types/schema";
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
} from "@/actions/users";
import { useDisclosure } from "@mantine/hooks";
import { useNotification } from "@/hooks/useNotification";
import { fetchCompanies } from "@/actions/companies";
import { deleteSession } from "@/lib/session";

type User = z.infer<typeof UserSchema>;
type Company = z.infer<typeof CompanySchema>;

export default function UserManagementTab({ user }: { user: User }) {
  console.log("User Tab User", user);
  const { successNotification, errorNotification, infoNotification } =
    useNotification();
  const [createUserState, createUserAction, createPending] = useActionState(
    createUser,
    undefined,
  );
  const [updateUserState, updateUserAction, updatePending] = useActionState(
    updateUser,
    undefined,
  );
  const [editUser, setEditUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const [addButtonState, addButtonHandler] = useDisclosure(false);
  const [editButtonState, editButtonHandler] = useDisclosure(false);
  const [confirmState, confirmHandler] = useDisclosure(false);
  const [registerOpen, { open: openRegister, close: closeRegister }] =
    useDisclosure(false);

  const fetchUsersData = async () => {
    try {
      let userList: User[] | null = null;
      userList = await fetchUsers();
      setUsers(userList ?? []);
    } catch (_error) {
      errorNotification("Error fetching user details", "Server Down");
    }
  };

  const fetchCompaniesData = async () => {
    try {
      const { error, success, data } = await fetchCompanies();
      if (!success || !data) {
        let message = error?.message ?? "";
        errorNotification(message, "Error fetching Companies");
      }
      setCompanies(data ?? []);
    } catch (_error) {
      errorNotification("Error fetching user details", "Server Down");
    }
  };

  const createUserData = async (formData: FormData) => {
    try {
      setLoading(true);
      createUserAction(formData);
      let userList: User[] | null = null;
      userList = await fetchUsers();
      setUsers(userList ?? []);
      successNotification("New User create", "Success");
    } catch (_error) {
      errorNotification("Error fetching user details", "Server Down");
    } finally {
      setLoading(false);
      addButtonHandler.close();
    }
  };

  const updateUserData = async (formData: FormData) => {
    try {
      setLoading(true);
      updateUserAction(formData);
      let userList: User[] | null = null;
      userList = await fetchUsers();
      setUsers(userList ?? []);
      successNotification("Saved Sucessfully", "Success");
    } catch (_error) {
      errorNotification("Error editing user details", "Server Down");
    } finally {
      setLoading(false);
      editButtonHandler.close();
      setEditUser(null);
      if (Number(formData.get("id")) === user.id) {
        infoNotification(
          "As your user details have changed, we are logging you out.",
          "Login Again!",
        );
        await deleteSession();
      }
    }
  };

  const handleDelete = async (id: number | null) => {
    if (!id) {
      errorNotification(
        "We can't seem to find the user for now.",
        "User not found",
      );
      return;
    }
    await deleteUser(id);
    successNotification("User Deleted Sucesssfully", "Deleted");
    await fetchUsersData();
  };

  const handleEditUser = async (id: number) => {
    let u = users.find((ele) => ele.id === id);
    setEditUser(u || null);
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        await Promise.all([fetchUsersData(), fetchCompaniesData()]);
      } catch (_) {
        errorNotification("Something went wrong!!", "Server Down");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading)
    return (
      <Flex direction="column" justify="center" align="center" h="200px">
        <Loader type="dots" size="xl" />
      </Flex>
    );

  return (
    <>
      <Group mb="md" justify="space-between">
        <Title order={3}>User Management</Title>

        <Group justify="flex-end">
          <Button
            leftSection={<IconPlus />}
            onClick={() => {
              addButtonHandler.open();
            }}
          >
            Add User
          </Button>
          <Button
          // onClick={}
          >
            Register New User
          </Button>
        </Group>
      </Group>

      <Modal
        title="Add User"
        opened={addButtonState}
        onClose={() => {
          addButtonHandler.close();
        }}
        centered
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
      >
        <form action={createUserData}>
          <TextInput
            name="name"
            label="Name"
            required
            mb="sm"
            disabled={createPending}
          />
          <TextInput
            name="email"
            label="Email"
            required
            mb="sm"
            disabled={createPending}
          />
          <PasswordInput
            name="password"
            label="Password"
            required
            mb="sm"
            disabled={createPending}
          />
          <Select
            name="role"
            label="Role"
            data={[
              { value: "User", label: "User" },
              { value: "Editor", label: "Editor" },
              { value: "Admin", label: "Admin" },
            ]}
            required
            mb="sm"
            disabled={createPending}
          />
          <Select
            label="Company"
            data={companies.map((company) => ({
              value: company.id.toString(),
              label: company.name,
            }))}
            name="companyId"
            mb="md"
            defaultValue={null}
            disabled={createPending}
          />
          <Button
            type="submit"
            loading={createPending}
            disabled={createPending}
          >
            Add User
          </Button>
        </form>
      </Modal>
      {/* Edit User Information */}
      <Modal
        title="Edit User"
        opened={editButtonState}
        onClose={() => {
          editButtonHandler.close();
        }}
        centered
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
      >
        <form action={updateUserData}>
          <input type="hidden" name="id" defaultValue={editUser?.id} />
          <TextInput
            name="name"
            label="Name"
            mb="sm"
            defaultValue={editUser?.name}
            disabled={updatePending}
          />
          <TextInput
            name="email"
            label="Email"
            mb="sm"
            defaultValue={editUser?.email}
            disabled={updatePending}
          />
          <PasswordInput
            name="password"
            label="Password"
            mb="sm"
            disabled={updatePending}
          />
          <Select
            name="role"
            label="Role"
            data={[
              { value: "User", label: "User" },
              { value: "Editor", label: "Editor" },
              { value: "Admin", label: "Admin" },
            ]}
            mb="sm"
            defaultValue={editUser?.role}
            disabled={updatePending}
          />
          <Select
            label="Company"
            data={companies.map((company) => ({
              value: company.id.toString(),
              label: company.name,
            }))}
            name="companyId"
            mb="md"
            defaultValue={editUser?.companyId?.toString() || null}
            disabled={updatePending}
          />
          <Button
            type="submit"
            loading={updatePending}
            disabled={updatePending}
          >
            Edit User Data
          </Button>
        </form>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        opened={confirmState}
        onClose={() => {
          confirmHandler.close();
        }}
        centered
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        withCloseButton={false}
      >
        <Title order={4} ta="center">
          Are you sure you want to delete this user?
        </Title>
        <Group mt={10} grow>
          <Button
            size="sm"
            variant="light"
            onClick={async () => {
              handleDelete(editUser?.id ?? null);
              setEditUser(null);
              confirmHandler.close();
            }}
          >
            Yes
          </Button>
          <Button
            size="sm"
            variant="light"
            color="red"
            onClick={() => {
              confirmHandler.close();
            }}
          >
            No
          </Button>
        </Group>
      </Modal>

      {/* TODO: Make Registeration Modal */}
      {/* Register User Modal */}
      {/* <Modal */}
      {/*   opened={registerOpen} */}
      {/*   onClose={closeRegister} */}
      {/*   title="Register New User" */}
      {/* > */}
      {/*   <TextInput */}
      {/*     label="User Email" */}
      {/*     value={registerEmail} */}
      {/*     onChange={(e) => setRegisterEmail(e.target.value)} */}
      {/*     required */}
      {/*     mb="sm" */}
      {/*   /> */}
      {/*   <Select */}
      {/*     label="Select Company" */}
      {/*     placeholder="Choose a company" */}
      {/*     data={companies.map((company) => ({ */}
      {/*       value: company.id.toString(), */}
      {/*       label: company.name, */}
      {/*     }))} */}
      {/*     required */}
      {/*     name="companyId" */}
      {/*     mb="md" */}
      {/*   /> */}
      {/*   <Button */}
      {/*     onClick={generateToken} */}
      {/*     disabled={!registerEmail || !registerCompanyId} */}
      {/*     mb="md" */}
      {/*   > */}
      {/*     Generate Token */}
      {/*   </Button> */}
      {/*   {registerToken && ( */}
      {/*     <Notification> */}
      {/*       Token: {registerToken}{" "} */}
      {/*       <Button */}
      {/*         leftSection={<IconCopy />} */}
      {/*         onClick={() => navigator.clipboard.writeText(registerToken)} */}
      {/*       > */}
      {/*         Copy */}
      {/*       </Button> */}
      {/*     </Notification> */}
      {/*   )} */}
      {/* </Modal> */}

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
            {users?.map((user) => (
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
                      onClick={() => {
                        handleEditUser(user.id);
                        editButtonHandler.open();
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="light"
                      color="red"
                      leftSection={<IconTrash size={16} />}
                      onClick={() => {
                        confirmHandler.open();
                        setEditUser(user);
                      }}
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
    </>
  );
}
