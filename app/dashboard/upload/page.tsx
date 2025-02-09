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
  LoadingOverlay,
  Center,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { showNotification } from "@mantine/notifications";
import { IconCheck, IconX } from "@tabler/icons-react";

// Types
interface Company {
  id: number; // Using normal integer ID
  name: string;
}

interface UploadFormData {
  companyId: string;
  quarter: string;
  creationDate: Date | null;
  file: File | null;
}

export default function UploadPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState<UploadFormData>({
    companyId: "",
    quarter: "",
    creationDate: null,
    file: null,
  });
  const [isLoading, setIsLoading] = useState(false);

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
          color: "red",
          icon: <IconX size={20} />,
          position: "bottom-right",
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchCompanies();
  }, []);

  const validateFile = (file: File | null) => {
    if (!file) return "File is required.";
    if (file.size > 40 * 1024 * 1024)
      return "File size must be less than 40MB.";
    const validExtensions = [".csv", ".xlsx"];
    if (!validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      return "Only .csv and .xlsx files are allowed.";
    }
    return null;
  };

  // Handle Upload Submission
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

      console.log(uploadData);

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
  };

  return (
    <Flex justify="center" align="center" p="md">
      <Paper withBorder shadow="md" p="xl" radius="md" style={{ width: "45%", maxWidth: "701px" }}>
        <LoadingOverlay visible={isLoading} />

        <Center>
          <Title size="h2" fw={700} mb="md">
            Upload Vulnerability Report
          </Title>
        </Center>
        <Stack>
          <Select
            variant="filled"
            label="Select Company"
            placeholder="Choose a company"
            data={companies.map((company) => ({
              value: company.id.toString(),
              label: company.name,
            }))}
            value={formData.companyId}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, companyId: value || "" }))
            }
            required
            checkIconPosition="right"
            comboboxProps={{ shadow: "md" }}
          />

          <TextInput
            variant="filled"
            label="Quarter"
            placeholder="Enter any quarter name"
            value={formData.quarter}
            onChange={(event) =>
              setFormData((prev) => ({
                ...prev,
                quarter: event.target.value || "",
              }))
            }
            required
          />

          <DateInput
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

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            loading={isLoading}
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
