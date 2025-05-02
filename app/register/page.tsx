"use client";

import { useActionState, useState } from "react";
import {
  Text,
  Button,
  TextInput,
  Flex,
  PasswordInput,
  Paper,
  Center,
  Title,
} from "@mantine/core";
import { registerAction } from "@/actions/register";
import { register } from "module";

export default function RegisterPage() {
  //FIX: Change undefined
  const [state, action, pending] = useActionState(registerAction, undefined);

  const patternBackground = {
    backgroundColor: "#ffffff ",
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M9 0h2v20H9V0zm25.134.84l1.732 1-10 17.32-1.732-1 10-17.32zm-20 20l1.732 1-10 17.32-1.732-1 10-17.32zM58.16 4.134l1 1.732-17.32 10-1-1.732 17.32-10zm-40 40l1 1.732-17.32 10-1-1.732 17.32-10zM80 9v2H60V9h20zM20 69v2H0v-2h20zm79.32-55l-1 1.732-17.32-10L82 4l17.32 10zm-80 80l-1 1.732-17.32-10L2 84l17.32 10zm96.546-75.84l-1.732 1-10-17.32 1.732-1 10 17.32zm-100 100l-1.732 1-10-17.32 1.732-1 10 17.32zM38.16 24.134l1 1.732-17.32 10-1-1.732 17.32-10zM60 29v2H40v-2h20zm19.32 5l-1 1.732-17.32-10L62 24l17.32 10zm16.546 4.16l-1.732 1-10-17.32 1.732-1 10 17.32zM111 40h-2V20h2v20zm3.134.84l1.732 1-10 17.32-1.732-1 10-17.32zM40 49v2H20v-2h20zm19.32 5l-1 1.732-17.32-10L42 44l17.32 10zm16.546 4.16l-1.732 1-10-17.32 1.732-1 10 17.32zM91 60h-2V40h2v20zm3.134.84l1.732 1-10 17.32-1.732-1 10-17.32zm24.026 3.294l1 1.732-17.32 10-1-1.732 17.32-10zM39.32 74l-1 1.732-17.32-10L22 64l17.32 10zm16.546 4.16l-1.732 1-10-17.32 1.732-1 10 17.32zM71 80h-2V60h2v20zm3.134.84l1.732 1-10 17.32-1.732-1 10-17.32zm24.026 3.294l1 1.732-17.32 10-1-1.732 17.32-10zM120 89v2h-20v-2h20zm-84.134 9.16l-1.732 1-10-17.32 1.732-1 10 17.32zM51 100h-2V80h2v20zm3.134.84l1.732 1-10 17.32-1.732-1 10-17.32zm24.026 3.294l1 1.732-17.32 10-1-1.732 17.32-10zM100 109v2H80v-2h20zm19.32 5l-1 1.732-17.32-10 1-1.732 17.32 10zM31 120h-2v-20h2v20z' fill='%23c560f6' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E")`,
  };
  return (
    <Flex
      direction="column"
      justify="center"
      align="center"
      mih="100vh"
      style={{
        ...patternBackground,
      }}
    >
      <Paper shadow="xl" p={30} radius="md" w="35%" maw="600px" withBorder>
        <Center>
          <Title size="h1">Welcome</Title>
        </Center>

        <Text c="dimmed" size="sm" ta="center" mt={5}>
          Make sure you have the token to register.
        </Text>

        <form action={action}>
          <TextInput
            name="email"
            label="Email"
            placeholder="you@example.com"
            required
            disabled={pending}
            type="email"
            mt="lg"
          />
          <TextInput
            name="name"
            label="Name"
            placeholder="What would you like us to call you?"
            required
            disabled={pending}
            mt="lg"
          />
          <TextInput
            name="token"
            label="Token"
            placeholder="A really long string"
            required
            disabled={pending}
            mt="lg"
          />
          <PasswordInput
            name="password"
            label="Password"
            placeholder="Your password"
            mt="md"
            required
            disabled={pending}
          />
          <PasswordInput
            name="confirmPassword"
            label="Confirm Password"
            placeholder="Repeat password"
            mt="md"
            required
            disabled={pending}
          />
          <Button
            fullWidth
            mt="xl"
            type="submit"
            loading={pending}
            disabled={pending}
          >
            Register
          </Button>
        </form>
      </Paper>
    </Flex>
  );
}
