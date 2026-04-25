<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from "vue";
import type { FileItem } from "../../types/file";
import { readDirectory } from "../../utils/fileSystem";
import { configManager } from "../../utils/config";
import type { ViewMode, SortBy, SortOrder } from "../../types/config";
import { clipboardManager, useClipboard } from "../../hooks/useClipboard";
import { useFileSelection } from "../../hooks/useFileSelection";
import { useFileNavigation } from "../../hooks/useFileNavigation";
import { useFileOperations } from "../../hooks/useFileOperations";
import FileToolbar from "../../components/documents/FileToolbar.vue";
import FileList from "../../components/documents/FileList.vue";
import FilePreview from "../../components/documents/FilePreview.vue";
import FileContextMenu from "../../components/documents/FileContextMenu.vue";
import CreateDocumentModal from "../../components/documents/CreateDocumentModal.vue";
import RenameModal from "../../components/documents/RenameModal.vue";

const { hasItem: hasClipboardItem, firstItem: clipboardItem } = useClipboard();
const {
  selectedFiles,
  selectedFile,
  selectionMode,
  selectedCount,
  toggleFileSelection,
  handleFileClick: handleFileClickSelection,
  toggleSelectionMode,
  clearSelection,
  selectFiles,
  selectAll,
} = useFileSelection();

const {
  currentPath,
  canGoBack,
  canGoForward,
  goBack,
  goForward,
  navigateTo,
  initPath,
} = useFileNavigation();

const {
  copyFiles,
  moveFiles,
  deleteFiles,
  renameFile,
  createFolder,
  createDocument,
  openFile,
  openFileWith,
} = useFileOperations();

const files = ref<FileItem[]>([]);
const loading = ref(false);
const viewMode = ref<ViewMode>("grid");
const sortBy = ref<SortBy>("name");
const sortOrder = ref<SortOrder>("asc");
const showPreview = ref(false);
const selectedFileForPreview = ref<FileItem | null>(null);

const showContextMenu = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const isBackgroundContextMenu = ref(false);

const showCreateModal = ref(false);
const createMode = ref<"folder" | "document">("folder");

const showRenameModal = ref(false);
const renameFileItem = ref<FileItem | null>(null);

const sortFiles = (fileList: FileItem[]): FileItem[] => {
  return [...fileList].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }

    let comparison = 0;
    switch (sortBy.value) {
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "size":
        comparison = a.size - b.size;
        break;
      case "modified":
        comparison = a.modified - b.modified;
        break;
      case "type":
        comparison = a.extension.localeCompare(b.extension);
        break;
    }

    return sortOrder.value === "asc" ? comparison : -comparison;
  });
};

watch(currentPath, () => {
  clearSelection();
  loadFiles();
});

const loadFiles = async () => {
  if (!currentPath.value) return;

  loading.value = true;
  try {
    const result = await readDirectory({ path: currentPath.value });
    files.value = sortFiles(result);
  } catch (error) {
    console.error("加载文件失败:", error);
  } finally {
    loading.value = false;
  }
};

const handleFileClick = (file: FileItem, event: MouseEvent) => {
  handleFileClickSelection(file, event);
  selectedFileForPreview.value = file;
};

const getSelectedFileItems = (): FileItem[] => {
  if (selectedFiles.value.size > 0) {
    return Array.from(selectedFiles.value)
      .map((path) => files.value.find((f) => f.path === path))
      .filter(Boolean) as FileItem[];
  }
  return selectedFile.value ? [selectedFile.value] : [];
};

const handleCopySelected = () => {
  const filesToCopy = getSelectedFileItems();
  if (filesToCopy.length === 0) return;

  clipboardManager.setMultiple(
    filesToCopy.map((f) => ({
      sourcePath: f.path,
      action: "copy" as const,
      name: f.name,
      isDirectory: f.isDirectory,
    })),
  );
};

const handleCutSelected = () => {
  const filesToCut = getSelectedFileItems();
  if (filesToCut.length === 0) return;

  clipboardManager.setMultiple(
    filesToCut.map((f) => ({
      sourcePath: f.path,
      action: "cut" as const,
      name: f.name,
      isDirectory: f.isDirectory,
    })),
  );
};

const handleKeyDown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "a") {
    e.preventDefault();
    selectAll(files.value);
  } else if ((e.ctrlKey || e.metaKey) && e.key === "c") {
    e.preventDefault();
    handleCopySelected();
  } else if ((e.ctrlKey || e.metaKey) && e.key === "x") {
    e.preventDefault();
    handleCutSelected();
  } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
    e.preventDefault();
    handlePaste();
  } else if (e.key === "Delete") {
    e.preventDefault();
    handleDelete();
  } else if (e.key === "Escape") {
    if (selectionMode.value) {
      toggleSelectionMode();
    }
    clearSelection();
  }
};

onMounted(async () => {
  window.addEventListener("keydown", handleKeyDown);

  await configManager.init();
  const config = configManager.get();

  viewMode.value = config.viewMode;
  sortBy.value = config.sortBy;
  sortOrder.value = config.sortOrder;

  if (config.defaultPath) {
    initPath(config.defaultPath);
    await loadFiles();
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
});

const handleFileDoubleClick = async (file: FileItem) => {
  if (file.isDirectory) {
    navigateTo(file.path);
  } else {
    await openFile(file.path);
  }
};

const handleFileContextMenu = (e: MouseEvent, file: FileItem) => {
  e.preventDefault();
  if (!selectedFiles.value.has(file.path)) {
    clearSelection();
    selectedFile.value = file;
    selectedFileForPreview.value = file;
  }
  isBackgroundContextMenu.value = false;
  contextMenuX.value = e.clientX;
  contextMenuY.value = e.clientY;
  showContextMenu.value = true;
};

const handleBackgroundContextMenu = (e: MouseEvent) => {
  e.preventDefault();
  selectedFile.value = null;
  isBackgroundContextMenu.value = true;
  contextMenuX.value = e.clientX;
  contextMenuY.value = e.clientY;
  showContextMenu.value = true;
};

const handleContextMenuSelect = async (key: string) => {
  showContextMenu.value = false;

  if (isBackgroundContextMenu.value) {
    switch (key) {
      case "paste":
        await handlePaste();
        break;
      case "cut":
        await handleMoveToHere();
        break;
      case "newFolder":
        createMode.value = "folder";
        showCreateModal.value = true;
        break;
      case "newDocument":
        createMode.value = "document";
        showCreateModal.value = true;
        break;
      case "refresh":
        await loadFiles();
        break;
    }
    return;
  }

  const filesToOperate = getSelectedFileItems();
  if (filesToOperate.length === 0) return;

  switch (key) {
    case "open":
      if (filesToOperate.length === 1 && filesToOperate[0].isDirectory) {
        navigateTo(filesToOperate[0].path);
      } else if (filesToOperate.length === 1) {
        await openFile(filesToOperate[0].path);
      }
      break;
    case "openWith":
      if (filesToOperate.length === 1) {
        await openFileWith(filesToOperate[0]);
      }
      break;
    case "copy":
      clipboardManager.setMultiple(
        filesToOperate.map((f) => ({
          sourcePath: f.path,
          action: "copy" as const,
          name: f.name,
          isDirectory: f.isDirectory,
        })),
      );
      break;
    case "cut":
      clipboardManager.setMultiple(
        filesToOperate.map((f) => ({
          sourcePath: f.path,
          action: "cut" as const,
          name: f.name,
          isDirectory: f.isDirectory,
        })),
      );
      break;
    case "rename":
      if (filesToOperate.length === 1) {
        renameFileItem.value = filesToOperate[0];
        showRenameModal.value = true;
      }
      break;
    case "delete":
      await handleDelete();
      break;
  }
};

const handleDelete = async () => {
  const filesToDelete = getSelectedFileItems();
  if (filesToDelete.length === 0) return;

  await deleteFiles(filesToDelete, () => {
    clearSelection();
    loadFiles();
  });
};

const handleRename = async (file: FileItem, newName: string) => {
  await renameFile(file, newName, loadFiles);
};

const handlePaste = async () => {
  const items = clipboardManager.getAll();
  if (items.length === 0) return;

  await copyFiles(items, currentPath.value, loadFiles);
};

const handleMoveToHere = async () => {
  const items = clipboardManager.getAll();
  if (items.length === 0) return;

  await moveFiles(items, currentPath.value, loadFiles);
};

const handleCreate = async (name: string, documentType?: string) => {
  if (createMode.value === "folder") {
    await createFolder(currentPath.value, name, loadFiles);
  } else {
    await createDocument(currentPath.value, name, documentType, loadFiles);
  }
};

const toggleViewMode = () => {
  viewMode.value = viewMode.value === "grid" ? "list" : "grid";
  configManager.update({ viewMode: viewMode.value });
};

const handleSortChange = (key: string) => {
  if (sortBy.value === key) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    sortBy.value = key as SortBy;
    sortOrder.value = "asc";
  }

  configManager.update({
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  });

  files.value = sortFiles(files.value);
};

const handleBreadcrumbClick = (path: string) => {
  navigateTo(path);
};

const togglePreview = () => {
  showPreview.value = !showPreview.value;
};

const showCreateModalHandler = () => {
  createMode.value = "folder";
  showCreateModal.value = true;
};

const clearSingleSelection = () => {
  selectedFile.value = null;
  selectedFileForPreview.value = null;
};
</script>

<template>
  <div class="h-full flex flex-col">
    <FileToolbar
      :current-path="currentPath"
      :can-go-back="canGoBack"
      :can-go-forward="canGoForward"
      :sort-by="sortBy"
      :sort-order="sortOrder"
      :view-mode="viewMode"
      :show-preview="showPreview"
      :selection-mode="selectionMode"
      :selected-count="selectedCount"
      @go-back="goBack"
      @go-forward="goForward"
      @toggle-view-mode="toggleViewMode"
      @toggle-preview="togglePreview"
      @toggle-selection-mode="toggleSelectionMode"
      @handle-sort-change="handleSortChange"
      @handle-breadcrumb-click="handleBreadcrumbClick"
      @show-create-modal="showCreateModalHandler"
      @clear-selection="clearSelection"
    />

    <div class="flex-1 flex overflow-hidden">
      <FileList
        ref="fileListRef"
        :files="files"
        :loading="loading"
        :view-mode="viewMode"
        :selected-file="selectedFileForPreview"
        :selected-files="selectedFiles"
        :selection-mode="selectionMode"
        @handle-file-click="handleFileClick"
        @handle-file-double-click="handleFileDoubleClick"
        @handle-file-context-menu="handleFileContextMenu"
        @handle-background-context-menu="handleBackgroundContextMenu"
        @handle-rename="handleRename"
        @toggle-file-selection="toggleFileSelection"
        @select-files="selectFiles"
        @clear-selection="clearSelection"
        @clear-single-selection="clearSingleSelection"
      />

      <FilePreview
        v-if="showPreview && selectedFileForPreview"
        :file="selectedFileForPreview"
        @open-file="openFile"
      />
    </div>

    <FileContextMenu
      v-model:show="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :selected-file="selectedFile"
      :has-clipboard-item="hasClipboardItem"
      :clipboard-action="clipboardItem?.action"
      :is-background="isBackgroundContextMenu"
      :selected-count="selectedFiles.size"
      @select="handleContextMenuSelect"
    />

    <CreateDocumentModal
      v-model:show="showCreateModal"
      :mode="createMode"
      @create="handleCreate"
    />

    <RenameModal
      v-model:show="showRenameModal"
      :file="renameFileItem"
      @confirm="handleRename"
    />
  </div>
</template>
