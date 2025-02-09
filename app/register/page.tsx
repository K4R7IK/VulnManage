"use client";

import { useState } from "react";
import {
  Text,
  Button,
  TextInput,
  PasswordInput,
  Notification,
  Paper,
  Flex,
  Center,
  Title,
} from "@mantine/core";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRegister = async () => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register");

      setSuccess("Registration successful! You can now log in.");
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <Flex direction="column" justify="center" align="center" mih="100vh">
      <Paper shadow="xl" p={30} radius="md" w="30%" maw="500px" withBorder>
        <Center>
          <Title size="h1">Registration</Title>
        </Center>

        <Text c="dimmed" size="sm" ta="center" my={5}>
          Contact you Admin to get the Token.
        </Text>
        <TextInput
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextInput
          label="Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
          mt="md"
        />
        <PasswordInput
          label="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          mt="md"
        />
        <Button mt="md" fullWidth onClick={handleRegister}>Register</Button>
        {error && <Notification color="red">{error}</Notification>}
        {success && <Notification color="green">{success}</Notification>}
      </Paper>
    </Flex>
  );
}
