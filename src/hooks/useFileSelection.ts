import { ref, computed } from "vue";
import type { FileItem } from "../types/file";

export function useFileSelection() {
  const selectedFiles = ref<Set<string>>(new Set());
  const selectedFile = ref<FileItem | null>(null);
  const selectionMode = ref(false);

  const selectedCount = computed(() => selectedFiles.value.size);

  const toggleFileSelection = (file: FileItem) => {
    if (selectedFiles.value.has(file.path)) {
      selectedFiles.value.delete(file.path);
    } else {
      selectedFiles.value.add(file.path);
    }
  };

  const handleFileClick = (file: FileItem, event: MouseEvent) => {
    if (selectionMode.value || event.ctrlKey || event.metaKey) {
      if (selectedFiles.value.has(file.path)) {
        selectedFiles.value.delete(file.path);
      } else {
        selectedFiles.value.add(file.path);
      }
      selectedFile.value = null;
    } else {
      selectedFiles.value.clear();
      selectedFile.value = file;
    }
    return file;
  };

  const toggleSelectionMode = () => {
    selectionMode.value = !selectionMode.value;
    if (!selectionMode.value) {
      selectedFiles.value.clear();
    }
  };

  const clearSelection = () => {
    selectedFiles.value.clear();
  };

  const selectFiles = (paths: string[]) => {
    paths.forEach((path) => {
      selectedFiles.value.add(path);
    });
    selectedFile.value = null;
  };

  const selectAll = (files: FileItem[]) => {
    files.forEach((file) => {
      selectedFiles.value.add(file.path);
    });
    selectedFile.value = null;
  };

  return {
    selectedFiles,
    selectedFile,
    selectionMode,
    selectedCount,
    toggleFileSelection,
    handleFileClick,
    toggleSelectionMode,
    clearSelection,
    selectFiles,
    selectAll,
  };
}
