import { defineStore } from "pinia";
import { ref, computed } from "vue";

export type StatusMessageType = "info" | "success" | "warning" | "error";

export const useStatusStore = defineStore("status", () => {
  const message = ref("");
  const messageType = ref<StatusMessageType>("info");
  const messageIcon = ref("");

  let messageTimer: ReturnType<typeof setTimeout> | null = null;

  const messageClass = computed(() => {
    switch (messageType.value) {
      case "success":
        return "text-green-500";
      case "warning":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  });

  const showMessage = (
    msg: string,
    type: StatusMessageType = "info",
    icon?: string,
    duration: number = 1500,
  ) => {
    if (messageTimer) {
      clearTimeout(messageTimer);
    }

    message.value = msg;
    messageType.value = type;
    messageIcon.value = icon || getDefaultIcon(type);

    if (duration > 0) {
      messageTimer = setTimeout(() => {
        clearMessage();
      }, duration);
    }
  };

  const clearMessage = () => {
    message.value = "";
    messageIcon.value = "";
  };

  const getDefaultIcon = (type: StatusMessageType): string => {
    switch (type) {
      case "success":
        return "ri-check-line";
      case "warning":
        return "ri-alert-line";
      case "error":
        return "ri-error-warning-line";
      default:
        return "ri-information-line";
    }
  };

  return {
    message,
    messageType,
    messageIcon,
    messageClass,
    showMessage,
    clearMessage,
  };
});
