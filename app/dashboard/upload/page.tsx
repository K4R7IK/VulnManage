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
  Progress,
  Alert,
  Box,
  Badge,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconX,
  IconUpload,
  IconAlertCircle,
  IconFileUpload,
} from "@tabler/icons-react";
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
  fileUploadDate: Date | null;
  file: File | null;
  assetOS: string;
  quarterType: "new" | "existing";
}

interface ProgressData {
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  message: string;
  error?: string;
  startTime: number;
  lastUpdateTime: number;
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
    fileUploadDate: null,
    file: null,
    assetOS: "",
    quarterType: "new",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

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
        notifications.show({
          title: "Error",
          message: "Failed to load companies",
          color: "red",
          icon: <IconX />,
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
        notifications.show({
          title: "Error",
          message: "Failed to load quarters",
          color: "red",
          icon: <IconX />,
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchQuarters();
  }, [formData.companyId]);

  // Poll for progress updates when operation is in progress
  useEffect(() => {
    if (!operationId) return;

    const fetchProgress = async () => {
      try {
        const res = await fetch(`/api/upload/progress?id=${operationId}`);
        if (!res.ok) {
          if (res.status === 404) {
            // Operation not found, stop polling
            setOperationId(null);
            return;
          }
          throw new Error("Failed to fetch progress");
        }

        const data = await res.json();
        setProgressData(data);

        // Stop polling if completed or error
        if (data.status === "completed" || data.status === "error") {
          if (data.status === "completed") {
            notifications.show({
              title: "Success",
              message: "File processed successfully!",
              color: "green",
              icon: <IconCheck />,
            });
            // Reset form on completion
            setFormData({
              companyId: "",
              quarter: "",
              fileUploadDate: null,
              file: null,
              assetOS: "",
              quarterType: "new",
            });
            router.refresh();
          }

          if (data.status === "error") {
            notifications.show({
              title: "Error",
              message: "Processing failed. See details in the upload page.",
              color: "red",
              icon: <IconX />,
            });
            setErrorDetails(data.error || "Unknown error occurred");
          }

          // Clear operation ID to stop polling
          setOperationId(null);
        }
      } catch (error) {
        console.error("Error fetching progress:", error);
      }
    };

    // Immediately fetch progress
    fetchProgress();

    // Then poll every 2 seconds
    const interval = setInterval(fetchProgress, 2000);

    return () => clearInterval(interval);
  }, [operationId, router]);

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
      // Reset any previous errors
      setErrorDetails(null);

      // Validate inputs
      if (!formData.companyId) {
        notifications.show({
          title: "Error",
          message: "Please select a company.",
          color: "red",
          icon: <IconX />,
        });
        return;
      }
      if (!formData.quarter) {
        notifications.show({
          title: "Error",
          message: "Quarter is required.",
          color: "red",
          icon: <IconX />,
        });
        return;
      }
      if (!formData.fileUploadDate) {
        notifications.show({
          title: "Error",
          message: "Upload date is required.",
          color: "red",
          icon: <IconX />,
        });
        return;
      }
      if (!formData.assetOS) {
        notifications.show({
          title: "Error",
          message: "Asset OS is required.",
          color: "red",
          icon: <IconX />,
        });
        return;
      }
      const fileError = validateFile(formData.file);
      if (fileError) {
        notifications.show({
          title: "Error",
          message: fileError,
          color: "red",
          icon: <IconX />,
        });
        return;
      }

      setIsLoading(true);

      const uploadData = new FormData();
      uploadData.append("companyId", formData.companyId);
      uploadData.append("quarter", formData.quarter);
      uploadData.append("fileUploadDate", formData.fileUploadDate.toISOString());
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

      // Get operation ID from response
      const data = await res.json();
      setOperationId(data.operationId);

      // Show initial notification
      notifications.show({
        title: "Upload Started",
        message: "Your file has been uploaded and is now being processed.",
        color: "blue",
        icon: <IconUpload />,
      });
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      notifications.show({
        title: "Error uploading the file",
        message: err instanceof Error ? err.message : "File upload failed.",
        color: "red",
        icon: <IconX />,
      });
    }
  };

  // Format elapsed time in a human-readable way
  const formatElapsedTime = (startTime: number): string => {
    const elapsedMs = Date.now() - startTime;
    const seconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  // Determine the progress bar color based on status
  const getProgressColor = (status: string): string => {
    switch (status) {
      case "completed":
        return "green";
      case "error":
        return "red";
      case "processing":
        return "blue";
      default:
        return "gray";
    }
  };

  return (
    <Flex justify="center" align="center" p="md">
      <Paper
        shadow="md"
        p="xl"
        radius="md"
        withBorder
        w={{ base: "95%", sm: "80%", md: "60%", lg: "45%" }}
        maw={700}
      >
        <Center mb="md">
          <Title order={2} fw={700}>
            Upload Vulnerability Report
          </Title>
        </Center>

        {/* Progress section */}
        {progressData && (
          <Box mb="xl">
            <Group justify="space-between" mb="xs">
              <Text fw={500}>Processing Status</Text>
              <Badge color={getProgressColor(progressData.status)}>
                {progressData.status === "pending"
                  ? "Pending"
                  : progressData.status === "processing"
                    ? "Processing"
                    : progressData.status === "completed"
                      ? "Completed"
                      : "Error"}
              </Badge>
            </Group>
            <Progress
              value={progressData.progress}
              color={getProgressColor(progressData.status)}
              size="md"
              mb="xs"
              striped={progressData.status === "processing"}
              animated={progressData.status === "processing"}
            />
            <Group justify="space-between">
              <Text size="sm">{progressData.message}</Text>
              <Text size="sm" c="dimmed">
                Elapsed: {formatElapsedTime(progressData.startTime)}
              </Text>
            </Group>

            {progressData.status === "error" && errorDetails && (
              <Alert
                variant="light"
                color="red"
                title="Error Details"
                icon={<IconAlertCircle />}
                mt="md"
              >
                <Text size="sm">{errorDetails}</Text>
              </Alert>
            )}
          </Box>
        )}

        {/* Upload form */}
        <Stack>
          <Select
            disabled={isLoading || !!operationId}
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
            searchable
            clearable
          />

          <Select
            disabled={isLoading || !!operationId}
            label="Asset OS"
            placeholder="Select operating system"
            data={assetOSOptions}
            value={formData.assetOS}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, assetOS: value || "" }))
            }
            required
            searchable
            clearable
          />

          <Radio.Group
            value={formData.quarterType}
            onChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                quarterType: value as "new" | "existing",
                quarter: "",
              }))
            }
            label="Quarter Type"
            required
            // disabled={isLoading || !!operationId}
          >
            <Group mt="xs">
              <Radio value="new" label="New Quarter" />
              <Radio
                value="existing"
                label="Existing Quarter"
                disabled={quarters.length === 0 || isLoading || !!operationId}
              />
            </Group>
          </Radio.Group>

          {formData.quarterType === "new" ? (
            <TextInput
              disabled={isLoading || !!operationId}
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
              disabled={isLoading || !!operationId}
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
              searchable
              clearable
            />
          )}

          <DateInput
            disabled={isLoading || !!operationId}
            label="Date"
            placeholder="Set File Upload Date"
            clearable
            maxDate={new Date()}
            value={formData.fileUploadDate}
            onChange={(date) =>
              setFormData((prev) => ({
                ...prev,
                fileUploadDate: date,
              }))
            }
          />

          <FileInput
            disabled={isLoading || !!operationId}
            label="Select File"
            placeholder="Select .csv or .xlsx file"
            accept=".csv,.xlsx"
            value={formData.file}
            onChange={(file) => setFormData((prev) => ({ ...prev, file }))}
            required
            clearable
            leftSection={<IconFileUpload size={18} />}
          />

          <Text size="xs" c="dimmed">
            Accepted formats: .csv, .xlsx (max 500MB)
          </Text>

          <Button
            onClick={handleUpload}
            loading={isLoading && !operationId}
            disabled={isLoading || !!operationId}
            color="blue"
            leftSection={<IconUpload size={16} />}
          >
            Upload Report
          </Button>
        </Stack>
      </Paper>
    </Flex>
  );
}
