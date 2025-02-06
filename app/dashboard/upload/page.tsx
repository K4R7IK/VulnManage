"use client";
import { useState, useEffect } from "react";
import {
  Paper,
  Text,
  Select,
  TextInput,
  FileInput,
  Button,
  Stack,
  Notification,
  Flex,
  LoadingOverlay,
} from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";

// Types
interface Company {
  id: number; // Using normal integer ID
  name: string;
}

interface UploadFormData {
  companyId: string;
  quarter: string;
  file: File | null;
}

export default function UploadPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState<UploadFormData>({
    companyId: "",
    quarter: "",
    file: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
        setError("Failed to load companies");
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
        setError("Please select a company.");
        return;
      }
      if (!formData.quarter) {
        setError("Quarter is required.");
        return;
      }
      const fileError = validateFile(formData.file);
      if (fileError) {
        setError(fileError);
        return;
      }

      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const uploadData = new FormData();
      uploadData.append("companyId", formData.companyId);
      uploadData.append("quarter", formData.quarter); // Allow any string for quarter
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

      setSuccess("File uploaded successfully!");

      // Reset form
      setFormData({
        companyId: "",
        quarter: "",
        file: null,
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "File upload failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Flex justify="center" align="center" mih="100vh" p="md">
      <Paper
        withBorder
        shadow="md"
        p="xl"
        radius="md"
        style={{ width: 500 }}
        pos="relative"
      >
        <LoadingOverlay visible={isLoading} />

        <Text size="xl" fw={700} mb="md">
          Upload Vulnerability Report
        </Text>

        {error && (
          <Notification
            icon={<IconX size="1.2rem" />}
            color="red"
            title="Error"
            mb="md"
            onClose={() => setError(null)}
          >
            {error}
          </Notification>
        )}

        {success && (
          <Notification
            icon={<IconCheck size="1.2rem" />}
            color="green"
            title="Success"
            mb="md"
            onClose={() => setSuccess(null)}
          >
            {success}
          </Notification>
        )}

        <Stack>
          {/* Company Selection */}
          <Select
            label="Select Company"
            placeholder="Choose a company"
            data={companies.map((company) => ({
              value: company.id.toString(),
              label: company.name,
            }))}
            searchable
            value={formData.companyId}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, companyId: value || "" }))
            }
            required
          />

          <TextInput
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

          {/* File Upload */}
          <FileInput
            label="Upload File"
            placeholder="Select .csv or .xlsx file"
            accept=".csv,.xlsx"
            value={formData.file}
            onChange={(file) => setFormData((prev) => ({ ...prev, file }))}
            required
          />

          <Text size="sm" c="dimmed">
            Accepted formats: .csv, .xlsx (max 10MB)
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
