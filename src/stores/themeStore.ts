import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { configManager } from "../utils/config";
import type { ThemeMode } from "../types/config";

export const useThemeStore = defineStore("theme", () => {
  const themeMode = ref<ThemeMode>("light");

  const isDark = computed(() => themeMode.value === "dark");

  const themeOverrides = computed(() => ({
    common: {
      primaryColor: isDark.value ? "#c9a86c" : "#5c5c5c",
      primaryColorHover: isDark.value ? "#dbb978" : "#4a4a4a",
      primaryColorPressed: isDark.value ? "#b89555" : "#3a3a3a",
      primaryColorSuppl: isDark.value ? "#c9a86c" : "#5c5c5c",
      fontFamily:
        "'Noto Serif SC', 'Source Han Serif SC', 'Microsoft YaHei', serif",
      borderRadius: "6px",
      borderRadiusSmall: "4px",
      textColorBase: isDark.value ? "#e8e4dc" : "#2c2c2c",
      textColor1: isDark.value ? "#e8e4dc" : "#2c2c2c",
      textColor2: isDark.value ? "#b8b4ac" : "#5c5c5c",
      textColor3: isDark.value ? "#8a8680" : "#8c8c8c",
      textColorDisabled: isDark.value ? "#5c5852" : "#c0c0c0",
      placeholderColor: isDark.value ? "#6a6660" : "#a8a8a8",
      placeholderColorDisabled: isDark.value ? "#4a4640" : "#d0d0d0",
      borderColor: isDark.value ? "#3a3632" : "#e0dcd4",
      dividerColor: isDark.value ? "#3a3632" : "#e8e4dc",
      backgroundColor: isDark.value ? "#1a1816" : "#faf8f4",
      backgroundColorHover: isDark.value ? "#2a2826" : "#f5f2ec",
      backgroundColorModal: isDark.value ? "#242220" : "#ffffff",
      backgroundColorPopover: isDark.value ? "#2a2826" : "#ffffff",
      boxShadow1: isDark.value
        ? "0 2px 8px rgba(0, 0, 0, 0.4)"
        : "0 2px 8px rgba(0, 0, 0, 0.08)",
      boxShadow2: isDark.value
        ? "0 4px 16px rgba(0, 0, 0, 0.5)"
        : "0 4px 16px rgba(0, 0, 0, 0.1)",
      boxShadow3: isDark.value
        ? "0 8px 24px rgba(0, 0, 0, 0.6)"
        : "0 8px 24px rgba(0, 0, 0, 0.12)",
    },
    Card: {
      color: isDark.value ? "#242220" : "#ffffff",
      colorModal: isDark.value ? "#2a2826" : "#ffffff",
      textColor: isDark.value ? "#e8e4dc" : "#2c2c2c",
      titleTextColor: isDark.value ? "#e8e4dc" : "#2c2c2c",
      borderColor: isDark.value ? "#3a3632" : "#e0dcd4",
      borderRadius: "8px",
    },
    Button: {
      textColor: isDark.value ? "#e8e4dc" : "#2c2c2c",
      textColorHover: isDark.value ? "#e8e4dc" : "#2c2c2c",
      textColorPressed: isDark.value ? "#e8e4dc" : "#2c2c2c",
      textColorFocus: isDark.value ? "#e8e4dc" : "#2c2c2c",
      color: isDark.value ? "#2a2826" : "#f5f2ec",
      colorHover: isDark.value ? "#3a3836" : "#e8e4dc",
      colorPressed: isDark.value ? "#242220" : "#e0dcd4",
      colorFocus: isDark.value ? "#2a2826" : "#f5f2ec",
      border: isDark.value ? "1px solid #3a3632" : "1px solid #e0dcd4",
      borderHover: isDark.value ? "1px solid #c9a86c" : "1px solid #5c5c5c",
      borderPressed: isDark.value ? "1px solid #b89555" : "1px solid #3a3a3a",
      borderFocus: isDark.value ? "1px solid #c9a86c" : "1px solid #5c5c5c",
      borderRadiusMedium: "6px",
    },
    Input: {
      textColor: isDark.value ? "#e8e4dc" : "#2c2c2c",
      textColorDisabled: isDark.value ? "#5c5852" : "#c0c0c0",
      placeholderColor: isDark.value ? "#6a6660" : "#a8a8a8",
      placeholderColorDisabled: isDark.value ? "#4a4640" : "#d0d0d0",
      color: isDark.value ? "#1a1816" : "#ffffff",
      colorDisabled: isDark.value ? "#242220" : "#f5f2ec",
      colorFocus: isDark.value ? "#1a1816" : "#ffffff",
      border: isDark.value ? "1px solid #3a3632" : "1px solid #e0dcd4",
      borderHover: isDark.value ? "1px solid #5c5c5c" : "1px solid #8c8c8c",
      borderFocus: isDark.value ? "1px solid #c9a86c" : "1px solid #5c5c5c",
      borderRadius: "6px",
    },
    Menu: {
      color: isDark.value ? "#1a1816" : "#faf8f4",
      colorHover: isDark.value ? "#2a2826" : "#f5f2ec",
      colorActive: isDark.value ? "#2a2826" : "#e8e4dc",
      textColor: isDark.value ? "#b8b4ac" : "#5c5c5c",
      textColorHover: isDark.value ? "#e8e4dc" : "#2c2c2c",
      textColorActive: isDark.value ? "#c9a86c" : "#5c5c5c",
      arrowColor: isDark.value ? "#6a6660" : "#8c8c8c",
      arrowColorHover: isDark.value ? "#b8b4ac" : "#5c5c5c",
      arrowColorActive: isDark.value ? "#c9a86c" : "#5c5c5c",
      itemColorActive: isDark.value
        ? "rgba(201, 168, 108, 0.1)"
        : "rgba(92, 92, 92, 0.08)",
      itemColorActiveHover: isDark.value
        ? "rgba(201, 168, 108, 0.15)"
        : "rgba(92, 92, 92, 0.12)",
    },
    Message: {
      textColor: isDark.value ? "#e8e4dc" : "#2c2c2c",
      backgroundColor: isDark.value
        ? "rgba(36, 34, 32, 0.95)"
        : "rgba(255, 253, 250, 0.95)",
      boxShadow: isDark.value
        ? "0 4px 20px rgba(0, 0, 0, 0.5), 0 0 1px rgba(201, 168, 108, 0.2)"
        : "0 4px 20px rgba(0, 0, 0, 0.08), 0 0 1px rgba(92, 92, 92, 0.1)",
      borderRadius: "8px",
      padding: "12px 20px",
      fontSize: "14px",
      iconMargin: "0 12px 0 0",
      closeMargin: "0 0 0 12px",
      closeSize: "18px",
      successTextColor: isDark.value ? "#7cb87c" : "#52c41a",
      warningTextColor: isDark.value ? "#d4a82a" : "#d48806",
      errorTextColor: isDark.value ? "#e85c5c" : "#cf1322",
      infoTextColor: isDark.value ? "#6ca8c9" : "#1890ff",
      loadingColor: isDark.value ? "#c9a86c" : "#5c5c5c",
    },
    Dialog: {
      color: isDark.value ? "#242220" : "#ffffff",
      textColor: isDark.value ? "#e8e4dc" : "#2c2c2c",
      titleTextColor: isDark.value ? "#e8e4dc" : "#2c2c2c",
      borderRadius: "12px",
    },
    Empty: {
      textColor: isDark.value ? "#6a6660" : "#a8a8a8",
    },
    Spin: {
      color: isDark.value ? "#c9a86c" : "#5c5c5c",
    },
    Divider: {
      color: isDark.value ? "#3a3632" : "#e8e4dc",
    },
    Layout: {
      color: isDark.value ? "#1a1816" : "#faf8f4",
      siderColor: isDark.value ? "#1a1816" : "#faf8f4",
      siderBorderColor: isDark.value ? "#3a3632" : "#e0dcd4",
      headerColor: isDark.value ? "#242220" : "#ffffff",
      footerColor: isDark.value ? "#242220" : "#ffffff",
    },
    Checkbox: {
      colorChecked: isDark.value ? "#c9a86c" : "#5c5c5c",
      borderChecked: isDark.value ? "1px solid #c9a86c" : "1px solid #5c5c5c",
      checkMarkColor: isDark.value ? "#1a1816" : "#ffffff",
    },
  }));

  const toggleTheme = async () => {
    themeMode.value = isDark.value ? "light" : "dark";
    await saveThemeToConfig();
  };

  const setTheme = async (mode: ThemeMode) => {
    themeMode.value = mode;
    await saveThemeToConfig();
  };

  const saveThemeToConfig = async () => {
    try {
      await configManager.update({ themeMode: themeMode.value });
    } catch (error) {
      console.error("保存主题配置失败:", error);
    }
  };

  const loadThemeFromConfig = async () => {
    try {
      await configManager.init();
      const config = configManager.get();
      themeMode.value = config.themeMode;
    } catch (error) {
      console.error("加载主题配置失败:", error);
    }
  };

  watch(
    themeMode,
    (newMode) => {
      if (newMode === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    },
    { immediate: true },
  );

  return {
    themeMode,
    isDark,
    themeOverrides,
    toggleTheme,
    setTheme,
    loadThemeFromConfig,
  };
});
