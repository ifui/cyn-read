import { ref, computed, onMounted } from "vue";
import { os } from "@tauri-apps/api";

export function useFileNavigation() {
  const currentPath = ref<string>("");
  const pathHistory = ref<string[]>([]);
  const currentHistoryIndex = ref(-1);
  const platformName = ref<string>("");

  onMounted(async () => {
    platformName.value = await os.platform();
  });

  const breadcrumbs = computed(() => {
    if (!currentPath.value) return [];

    const parts = currentPath.value.split(/[/\\]/).filter(Boolean);
    const result: Array<{ name: string; path: string }> = [];

    let path = "";
    parts.forEach((part, index) => {
      if (index === 0 && platformName.value === "win32") {
        path = part + "\\";
      } else {
        path = path ? `${path}/${part}` : `/${part}`;
      }
      result.push({ name: part, path });
    });

    return result;
  });

  const canGoBack = computed(() => {
    return currentHistoryIndex.value > 0 || breadcrumbs.value.length > 1;
  });

  const canGoForward = computed(
    () => currentHistoryIndex.value < pathHistory.value.length - 1,
  );

  const goBack = () => {
    if (currentHistoryIndex.value > 0) {
      currentHistoryIndex.value--;
      currentPath.value = pathHistory.value[currentHistoryIndex.value];
    } else if (breadcrumbs.value.length > 1) {
      const parentPath = breadcrumbs.value[breadcrumbs.value.length - 2].path;
      currentPath.value = parentPath;
    }
  };

  const goForward = () => {
    if (canGoForward.value) {
      currentHistoryIndex.value++;
      currentPath.value = pathHistory.value[currentHistoryIndex.value];
    }
  };

  const navigateTo = (path: string) => {
    currentPath.value = path;
  };

  const initPath = (path: string) => {
    currentPath.value = path;
    pathHistory.value = [path];
    currentHistoryIndex.value = 0;
  };

  return {
    currentPath,
    pathHistory,
    currentHistoryIndex,
    breadcrumbs,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    navigateTo,
    initPath,
  };
}
