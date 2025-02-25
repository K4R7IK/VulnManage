"use client";
import { useState, useEffect } from "react";
import {
  Paper,
  Title,
  Text,
  Select,
  TextInput,
  FileInput,
  Button,
  Stack,
  Flex,
  Center,
  Group,
  Radio,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { showNotification } from "@mantine/notifications";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

// Types
interface Company {
  id: number;
  name: string;
}

interface Quarter {
  quarter: string;
  quarterDate: string;
}

interface UploadFormData {
  companyId: string;
  quarter: string;
  creationDate: Date | null;
  file: File | null;
  assetOS: string;
  quarterType: "new" | "existing";
}

// Asset OS options
const assetOSOptions = [
  { value: "windows", label: "Windows" },
  { value: "linux", label: "Linux" },
  { value: "vm", label: "Virtual Machine" },
  { value: "network_device", label: "Network Device" },
  { value: "security_solution", label: "Security Solution" },
];

export default function UploadPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [formData, setFormData] = useState<UploadFormData>({
    companyId: "",
    quarter: "",
    creationDate: null,
    file: null,
    assetOS: "",
    quarterType: "new",
  });
  const [isLoading, setIsLoading] = useState(false);

  // Fetch companies
  useEffect(() => {
    async function fetchCompanies() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/companies");
        if (!res.ok) throw new Error("Failed to fetch companies");
        const data = await res.json();
        setCompanies(data);
      } catch (err) {
        console.error(err);
        showNotification({
          title: "Error",
          message: "Failed to load companies",
          position: "bottom-right",
          color: "red",
          icon: <IconX size={20} />,
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchCompanies();
  }, []);

  // Fetch quarters when company is selected
  useEffect(() => {
    async function fetchQuarters() {
      if (!formData.companyId) {
        setQuarters([]);
        return;
      }

      try {
        setIsLoading(true);
        const res = await fetch(
          `/api/quarters?companyId=${formData.companyId}`,
        );

        if (!res.ok) throw new Error("Failed to fetch quarters");
        const data = await res.json();
        setQuarters(data);
      } catch (err) {
        console.error(err);
        showNotification({
          title: "Error",
          message: "Failed to load quarters",
          position: "bottom-right",
          color: "red",
          icon: <IconX size={20} />,
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchQuarters();
  }, [formData.companyId]);

  const validateFile = (file: File | null) => {
    if (!file) return "File is required.";
    if (file.size > 500 * 1024 * 1024)
      return "File size must be less than 500MB.";
    const validExtensions = [".csv", ".xlsx"];
    if (!validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      return "Only .csv and .xlsx files are allowed.";
    }
    return null;
  };

  const handleUpload = async () => {
    try {
      // Validate inputs
      if (!formData.companyId) {
        showNotification({
          title: "Error",
          message: "Please select a company.",
          color: "red",
          icon: <IconX size={20} />,
          position: "bottom-right",
        });
        return;
      }
      if (!formData.quarter) {
        showNotification({
          title: "Error",
          message: "Quarter is required.",
          color: "red",
          icon: <IconX size={20} />,
          position: "bottom-right",
        });
        return;
      }
      if (!formData.creationDate) {
        showNotification({
          title: "Error",
          message: "Creation date is required.",
          color: "red",
          icon: <IconX size={20} />,
          position: "bottom-right",
        });
        return;
      }
      if (!formData.assetOS) {
        showNotification({
          title: "Error",
          message: "Asset OS is required.",
          color: "red",
          icon: <IconX size={20} />,
          position: "bottom-right",
        });
        return;
      }
      const fileError = validateFile(formData.file);
      if (fileError) {
        showNotification({
          title: "Error",
          message: fileError,
          color: "red",
          icon: <IconX size={20} />,
          position: "bottom-right",
        });
        return;
      }

      setIsLoading(true);

      const uploadData = new FormData();
      uploadData.append("companyId", formData.companyId);
      uploadData.append("quarter", formData.quarter);
      uploadData.append("creationDate", formData.creationDate.toISOString());
      uploadData.append("file", formData.file as File);
      uploadData.append("assetOS", formData.assetOS);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: uploadData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed.");
      }

      showNotification({
        title: "Success",
        message: "File uploaded successfully!",
        color: "green",
        icon: <IconCheck size={20} />,
        position: "bottom-right",
      });

      // Reset form
      setFormData({
        companyId: "",
        quarter: "",
        creationDate: null,
        file: null,
        assetOS: "",
        quarterType: "new",
      });
    } catch (err) {
      console.error(err);
      showNotification({
        title: "Error uploading the file",
        message: err instanceof Error ? err.message : "File upload failed.",
        color: "red",
        icon: <IconX size={20} />,
        position: "bottom-right",
      });
    } finally {
      setIsLoading(false);
    }
    router.refresh();
  };

  return (
    <Flex justify="center" align="center" p="md">
      <Paper
        withBorder
        shadow="md"
        p="xl"
        radius="md"
        style={{ width: "45%", maxWidth: "701px" }}
      >
        <Center>
          <Title size="h2" fw={700} mb="md">
            Upload Vulnerability Report
          </Title>
        </Center>
        <Stack>
          <Select
            disabled={isLoading}
            variant="filled"
            label="Select Company"
            placeholder="Choose a company"
            data={companies.map((company) => ({
              value: company.id.toString(),
              label: company.name,
            }))}
            value={formData.companyId}
            onChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                companyId: value || "",
                quarter: "", // Reset quarter when company changes
              }))
            }
            required
            checkIconPosition="right"
            comboboxProps={{ shadow: "md" }}
          />

          <Select
            disabled={isLoading}
            variant="filled"
            label="Asset OS"
            placeholder="Select operating system"
            data={assetOSOptions}
            value={formData.assetOS}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, assetOS: value || "" }))
            }
            required
            checkIconPosition="right"
            comboboxProps={{ shadow: "md" }}
          />

          <Radio.Group
            value={formData.quarterType}
            onChange={(value: "new" | "existing") =>
              setFormData((prev) => ({
                ...prev,
                quarterType: value,
                quarter: "",
              }))
            }
            label="Quarter Type"
            required
          >
            <Group mt="xs">
              <Radio value="new" label="New Quarter" />
              <Radio
                value="existing"
                label="Existing Quarter"
                disabled={quarters.length === 0}
              />
            </Group>
          </Radio.Group>

          {formData.quarterType === "new" ? (
            <TextInput
              disabled={isLoading}
              variant="filled"
              label="New Quarter Name"
              placeholder="Enter quarter name"
              value={formData.quarter}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  quarter: event.target.value || "",
                }))
              }
              required
            />
          ) : (
            <Select
              disabled={isLoading}
              variant="filled"
              label="Select Existing Quarter"
              placeholder="Choose a quarter"
              data={quarters.map((q) => ({
                value: q.quarter,
                label: q.quarter,
              }))}
              value={formData.quarter}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, quarter: value || "" }))
              }
              required
              checkIconPosition="right"
              comboboxProps={{ shadow: "md" }}
            />
          )}

          <DateInput
            disabled={isLoading}
            variant="filled"
            label="Date"
            placeholder="Set Creation Date"
            clearable
            maxDate={new Date()}
            value={formData.creationDate}
            onChange={(date) =>
              setFormData((prev) => ({
                ...prev,
                creationDate: date,
              }))
            }
          />

          <FileInput
            disabled={isLoading}
            variant="filled"
            label="Select File"
            placeholder="Select .csv or .xlsx file"
            accept=".csv,.xlsx"
            value={formData.file}
            onChange={(file) => setFormData((prev) => ({ ...prev, file }))}
            required
            clearable
          />

          <Text size="xs" c="dimmed">
            Accepted formats: .csv, .xlsx (max 40MB)
          </Text>

          <Button
            onClick={handleUpload}
            loading={isLoading}
            loaderProps={{ type: "dots" }}
            disabled={isLoading}
            color="blue"
          >
            Upload Report
          </Button>
        </Stack>
      </Paper>
    </Flex>
  );
}
