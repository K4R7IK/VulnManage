// hooks/useNotification.tsx
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconX,
  IconInfoCircle,
  IconAlertCircle,
} from "@tabler/icons-react";
import React from "react";

type NotificationType = "success" | "error" | "info" | "warning";

interface NotificationOptions {
  title?: string;
  message: string;
  type: NotificationType;
  autoClose?: number | boolean;
  withCloseButton?: boolean;
}

export const useNotification = () => {
  const showNotification = ({
    title,
    message,
    type = "info",
    autoClose = 5000,
    withCloseButton = true,
  }: NotificationOptions) => {
    // Set color based on notification type
    const color =
      type === "success"
        ? "green"
        : type === "error"
          ? "red"
          : type === "warning"
            ? "yellow"
            : "blue";

    // Configure the icon for Mantine notifications
    // The correct way is to provide an icon property that Mantine can use
    const notificationOptions = {
      title,
      message,
      color,
      autoClose,
      withCloseButton,
    };

    // Add the appropriate icon based on type
    if (type === "success") {
      notifications.show({
        ...notificationOptions,
        icon: <IconCheck size={18} />,
      });
    } else if (type === "error") {
      notifications.show({
        ...notificationOptions,
        icon: <IconX size={18} />,
      });
    } else if (type === "warning") {
      notifications.show({
        ...notificationOptions,
        icon: <IconAlertCircle size={18} />,
      });
    } else {
      notifications.show({
        ...notificationOptions,
        icon: <IconInfoCircle size={18} />,
      });
    }
  };

  // Convenience methods for common notification types
  const successNotification = (message: string, title?: string) => {
    showNotification({ message, title, type: "success" });
  };

  const errorNotification = (message: string, title?: string) => {
    showNotification({ message, title, type: "error" });
  };

  const infoNotification = (message: string, title?: string) => {
    showNotification({ message, title, type: "info" });
  };

  const warningNotification = (message: string, title?: string) => {
    showNotification({ message, title, type: "warning" });
  };

  return {
    showNotification,
    successNotification,
    errorNotification,
    infoNotification,
    warningNotification,
  };
};
