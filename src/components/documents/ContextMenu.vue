<script setup lang="ts">
import { computed } from "vue";
import { NDropdown, NModal, NInput, useMessage } from "naive-ui";
import type { FileItem } from "../../types/file";
import { clipboardManager } from "../../hooks/useClipboard";
import { fs, shell } from "@tauri-apps/api";
import { dirname, join } from "@tauri-apps/api/path";

interface Props {
  show: boolean;
  x: number;
  y: number;
  file: FileItem | null;
  currentPath: string;
  hasClipboardItem: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "refresh"): void;
}>();

const message = useMessage();

const showRenameModal = ref(false);
const newFileName = ref("");
const showNewFolderModal = ref(false);
const newFolderName = ref("");
const showNewFileModal = ref(false);
const newFileName2 = ref("");
const selectedFile = ref<FileItem | null>(null);

import { ref } from "vue";

const fileMenuOptions = computed(() => {
  if (!props.file) return [];

  return [
    { label: "打开", key: "open" },
    { label: "打开方式", key: "open-with" },
    { type: "divider", key: "d1" },
    { label: "复制", key: "copy" },
    { label: "剪切", key: "cut" },
    { type: "divider", key: "d2" },
    { label: "重命名", key: "rename" },
    { label: "删除", key: "delete" },
  ];
});

const contextMenuOptions = computed(() => {
  const options: any[] = [];

  if (props.hasClipboardItem) {
    const item = clipboardManager.get();
    options.push({
      label: item?.action === "copy" ? "粘贴" : "移动到此",
      key: "paste",
    });
    options.push({ type: "divider", key: "d1" });
  }

  options.push({ label: "新建文件夹", key: "new-folder" });
  options.push({ label: "新建文档", key: "new-file" });

  return options;
});

const handleSelect = async (key: string) => {
  emit("update:show", false);

  if (
    !props.file &&
    key !== "paste" &&
    key !== "new-folder" &&
    key !== "new-file"
  ) {
    return;
  }

  switch (key) {
    case "open":
      if (props.file) {
        if (props.file.isDirectory) {
          emit("refresh");
        } else {
          await shell.open(props.file.path);
        }
      }
      break;
    case "open-with":
      if (props.file && !props.file.isDirectory) {
        message.info("打开方式功能开发中...");
      }
      break;
    case "copy":
      if (props.file) {
        clipboardManager.set({
          sourcePath: props.file.path,
          action: "copy",
          name: props.file.name,
          isDirectory: props.file.isDirectory,
        });
        message.success("已复制");
      }
      break;
    case "cut":
      if (props.file) {
        clipboardManager.set({
          sourcePath: props.file.path,
          action: "cut",
          name: props.file.name,
          isDirectory: props.file.isDirectory,
        });
        message.success("已剪切");
      }
      break;
    case "rename":
      if (props.file) {
        selectedFile.value = props.file;
        newFileName.value = props.file.name;
        showRenameModal.value = true;
      }
      break;
    case "delete":
      if (props.file) {
        await handleDelete(props.file);
      }
      break;
    case "paste":
      await handlePaste();
      break;
    case "new-folder":
      newFolderName.value = "新建文件夹";
      showNewFolderModal.value = true;
      break;
    case "new-file":
      newFileName2.value = "新建文档.txt";
      showNewFileModal.value = true;
      break;
  }
};

const handleDelete = async (file: FileItem) => {
  try {
    if (file.isDirectory) {
      await fs.removeDir(file.path, { recursive: true });
    } else {
      await fs.removeFile(file.path);
    }
    message.success("删除成功");
    emit("refresh");
  } catch (error) {
    console.error("删除失败:", error);
    message.error("删除失败");
  }
};

const handleRename = async () => {
  if (!selectedFile.value || !newFileName.value.trim()) return;

  try {
    const parentPath = await dirname(selectedFile.value.path);
    const newPath = await join(parentPath, newFileName.value);

    await fs.renameFile(selectedFile.value.path, newPath);
    message.success("重命名成功");
    showRenameModal.value = false;
    emit("refresh");
  } catch (error) {
    console.error("重命名失败:", error);
    message.error("重命名失败");
  }
};

const handlePaste = async () => {
  const item = clipboardManager.get();
  if (!item) return;

  try {
    const destPath = await join(props.currentPath, item.name);

    if (item.action === "copy") {
      message.info("复制功能开发中...");
    } else {
      await fs.renameFile(item.sourcePath, destPath);
      message.success("移动成功");
      clipboardManager.clear();
    }

    emit("refresh");
  } catch (error) {
    console.error("粘贴失败:", error);
    message.error("粘贴失败");
  }
};

const handleNewFolder = async () => {
  if (!newFolderName.value.trim()) return;

  try {
    const folderPath = await join(props.currentPath, newFolderName.value);
    await fs.createDir(folderPath);
    message.success("创建成功");
    showNewFolderModal.value = false;
    emit("refresh");
  } catch (error) {
    console.error("创建文件夹失败:", error);
    message.error("创建文件夹失败");
  }
};

const handleNewFile = async () => {
  if (!newFileName2.value.trim()) return;

  try {
    const filePath = await join(props.currentPath, newFileName2.value);
    await fs.writeTextFile(filePath, "");
    message.success("创建成功");
    showNewFileModal.value = false;
    emit("refresh");
  } catch (error) {
    console.error("创建文件失败:", error);
    message.error("创建文件失败");
  }
};
</script>

<template>
  <div>
    <n-dropdown
      placement="bottom-start"
      trigger="manual"
      :x="x"
      :y="y"
      :options="file ? fileMenuOptions : contextMenuOptions"
      :show="show"
      @select="handleSelect"
      @clickoutside="emit('update:show', false)"
    />

    <n-modal
      v-model:show="showRenameModal"
      preset="dialog"
      title="重命名"
      positive-text="确定"
      negative-text="取消"
      @positive-click="handleRename"
    >
      <n-input
        v-model:value="newFileName"
        placeholder="请输入新文件名"
        @keyup.enter="handleRename"
      />
    </n-modal>

    <n-modal
      v-model:show="showNewFolderModal"
      preset="dialog"
      title="新建文件夹"
      positive-text="确定"
      negative-text="取消"
      @positive-click="handleNewFolder"
    >
      <n-input
        v-model:value="newFolderName"
        placeholder="请输入文件夹名称"
        @keyup.enter="handleNewFolder"
      />
    </n-modal>

    <n-modal
      v-model:show="showNewFileModal"
      preset="dialog"
      title="新建文档"
      positive-text="确定"
      negative-text="取消"
      @positive-click="handleNewFile"
    >
      <n-input
        v-model:value="newFileName2"
        placeholder="请输入文件名（包含扩展名）"
        @keyup.enter="handleNewFile"
      />
    </n-modal>
  </div>
</template>
