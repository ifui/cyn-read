<script setup lang="ts">
import { useConfigStore } from "@/stores/config";
import { open } from "@tauri-apps/api/dialog";
import { useMessage } from "naive-ui";

const configStore = useConfigStore();
const message = useMessage();

const selectFolder = async () => {
  try {
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: "选择文档管理路径",
    });

    if (selectedPath && typeof selectedPath === "string") {
      await configStore.update({
        document: {
          defaultPath: selectedPath,
          trashPath: "trash",
        },
      });
      message.success("配置默认路径成功");
    }
  } catch (error) {
    console.error("选择文件夹失败:", error);
    message.error("配置默认路径失败");
  }
};
</script>

<template>
  <div class="flex flex-col items-center justify-center h-full gap-4">
    <div class="ri-folder-open-line text-6xl text-gray-400"></div>
    <div class="text-center">
      <div class="text-sm text-gray-500 mb-2">
        请选择一个文件夹作为文档管理路径
      </div>
      <div class="text-xs text-gray-400">选择后将在此文件夹中管理您的文档</div>
    </div>
    <n-button type="primary" @click="selectFolder">
      <template #icon>
        <span class="ri-folder-add-line"></span>
      </template>
      选择文件夹
    </n-button>
  </div>
</template>

<style scoped></style>
