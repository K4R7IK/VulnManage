"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  const [isUploading, setIsUploading] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(() => {
    // Check localStorage for saved operationId on component mount
    if (typeof window !== "undefined") {
      return localStorage.getItem("uploadOperationId");
    }
    return null;
  });
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  // Reference for polling interval - using number type instead of NodeJS.Timeout
  const pollingIntervalRef = useRef<number | null>(null);
  const pollFailCount = useRef(0);
  const MAX_POLL_FAILS = 10; // Maximum number of consecutive poll failures before giving up

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

  // Setup or cleanup polling interval
  useEffect(() => {
    // Start polling if we have an operationId
    if (operationId) {
      startProgressPolling();
    } else {
      // If no operationId, reset uploading state
      setIsUploading(false);
    }

    // Cleanup function
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [operationId]);

  // Function to start polling for progress
  const startProgressPolling = useCallback(() => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Reset poll failure counter
    pollFailCount.current = 0;

    // Save operationId to localStorage
    if (operationId && typeof window !== "undefined") {
      localStorage.setItem("uploadOperationId", operationId);
    }

    // Set initial loading state
    setIsUploading(true);

    // Start a new polling interval using window.setInterval instead of NodeJS.Timeout
    pollingIntervalRef.current = window.setInterval(fetchProgress, 2000);

    // Do an immediate fetch
    fetchProgress();
  }, [operationId]);

  // Function to fetch progress
  const fetchProgress = useCallback(async () => {
    if (!operationId) return;

    try {
      const res = await fetch(`/api/upload/progress?id=${operationId}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch progress: ${res.status}`);
      }

      const data = await res.json();
      console.log("Progress update:", data);
      setProgressData(data);

      // Reset the failure counter on successful fetch
      pollFailCount.current = 0;

      // Update uploading state
      setIsUploading(data.status === "pending" || data.status === "processing");

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

          // Clear operation ID from localStorage
          if (typeof window !== "undefined") {
            localStorage.removeItem("uploadOperationId");
          }

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

        // Immediately clear the interval
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error("Error fetching progress:", error);

      // Increment the failure counter
      pollFailCount.current += 1;

      // If too many consecutive failures, stop polling
      if (pollFailCount.current >= MAX_POLL_FAILS) {
        console.error("Too many polling failures, stopping polling");

        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        // Clear the operation ID and uploading state
        setOperationId(null);
        setIsUploading(false);

        // Show error notification
        notifications.show({
          title: "Connection Lost",
          message:
            "Lost connection to the server. The upload may still be processing in the background.",
          color: "red",
          icon: <IconX />,
        });
      }

      // Don't stop polling on fetch errors yet, as the server might just be temporarily unavailable
      // We'll stop only after MAX_POLL_FAILS consecutive failures
    }
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

      // Set uploading state immediately
      setIsUploading(true);
      setIsLoading(true);

      const uploadData = new FormData();
      uploadData.append("companyId", formData.companyId);
      uploadData.append("quarter", formData.quarter);
      uploadData.append(
        "fileUploadDate",
        formData.fileUploadDate.toISOString(),
      );
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
      console.log("Upload started with operation ID:", data.operationId);

      // Start polling for progress updates
      // This will be triggered by the useEffect that watches operationId

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
      setIsUploading(false);
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
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
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

  // Check if quarters are available for selection
  const isQuartersDisabled = quarters.length === 0 || isLoading || isUploading;

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
            disabled={isLoading || isUploading}
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
            disabled={isLoading || isUploading}
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
          >
            <Group mt="xs">
              <Radio
                value="new"
                label="New Quarter"
                disabled={isLoading || isUploading}
              />
              <Radio
                value="existing"
                label="Existing Quarter"
                disabled={isQuartersDisabled}
              />
            </Group>
          </Radio.Group>

          {formData.quarterType === "new" ? (
            <TextInput
              disabled={isLoading || isUploading}
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
              disabled={isLoading || isUploading}
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
            disabled={isLoading || isUploading}
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
            disabled={isLoading || isUploading}
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
            loading={isLoading}
            disabled={isLoading || isUploading}
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
