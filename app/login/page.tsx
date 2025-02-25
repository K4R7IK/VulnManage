// app/login/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  TextInput,
  PasswordInput,
  Button,
  Checkbox,
  Title,
  Paper,
  Group,
  Text,
  Center,
  Alert,
  Flex,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle } from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, user } = useAuth();

  const form = useForm<LoginForm>({
    initialValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : "Invalid email"),
    },
  });

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const handleSubmit = async (values: LoginForm) => {
    try {
      await login(values.email, values.password);
      router.push("/dashboard");
    } catch (error) {
      // Error handling is managed by the useAuth hook
      console.error("Login error:", error);
    }
  };

  return (
    <Flex direction="column" justify="center" align="center" mih="100vh">
      <Paper shadow="xl" p={30} radius="md" w="30%" maw="500px" withBorder>
        <Center>
          <Title size="h1">Welcome</Title>
        </Center>

        <Text c="dimmed" size="sm" ta="center" mt={5}>
          Enter your credentials to log in
        </Text>

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Login Failed"
            color="red"
            mb="md"
          >
            {error}
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput
            label="Email"
            placeholder="you@example.com"
            {...form.getInputProps("email")}
            required
          />

          <PasswordInput
            label="Password"
            placeholder="Your password"
            mt="md"
            {...form.getInputProps("password")}
            required
          />

          <Group justify="space-between" mt="md">
            <Checkbox
              label="Longer session"
              {...form.getInputProps("rememberMe", { type: "checkbox" })}
            />
            <Text
              size="sm"
              c="blue"
              style={{ cursor: "pointer" }}
              onClick={() => router.push("/forgot-password")}
            >
              Forgot password?
            </Text>
          </Group>

          <Button fullWidth mt="xl" type="submit" loading={isLoading}>
            Sign in
          </Button>
        </form>

        <Button
          fullWidth
          variant="light"
          mt="sm"
          component={Link}
          href="/register"
        >
          Register
        </Button>
      </Paper>
    </Flex>
  );
}
