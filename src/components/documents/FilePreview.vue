<script setup lang="ts">
import { NButton } from "naive-ui";
import type { FileItem } from "../../types/file";
import { getFileIcon, getFileColor } from "../../types/file";
import { formatFileSize, formatDate } from "../../utils/fileSystem";

interface Props {
  file: FileItem | null;
}

interface Emits {
  (e: "openFile", path: string): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<template>
  <div
    v-if="file"
    class="w-full md:w-1/3 lg:w-1/4 border-l border-gray-200 bg-white overflow-auto"
  >
    <div class="p-6">
      <div class="space-y-6">
        <div class="flex flex-col items-center text-center">
          <div class="relative mb-4">
            <i :class="[getFileIcon(file), getFileColor(file), 'text-7xl']"></i>
            <div
              v-if="!file.isDirectory"
              class="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-100"
            >
              <span class="text-xs font-bold text-gray-600">{{
                file.extension.toUpperCase()
              }}</span>
            </div>
          </div>
          <div>
            <h3 class="font-bold text-lg text-gray-800 mb-1">
              {{ file.name }}
            </h3>
            <p class="text-sm text-gray-500">
              {{ file.isDirectory ? "文件夹" : "文件" }}
            </p>
          </div>
        </div>

        <div class="space-y-3 bg-gray-50 rounded-xl p-4">
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-500 flex items-center gap-2">
              <i class="ri-file-size-line"></i>
              大小
            </span>
            <span class="text-sm font-semibold text-gray-700">{{
              file.isDirectory ? "-" : formatFileSize(file.size)
            }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-500 flex items-center gap-2">
              <i class="ri-time-line"></i>
              修改时间
            </span>
            <span class="text-sm font-semibold text-gray-700">{{
              formatDate(file.modified)
            }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-500 flex items-center gap-2">
              <i class="ri-calendar-line"></i>
              创建时间
            </span>
            <span class="text-sm font-semibold text-gray-700">{{
              formatDate(file.created)
            }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-500 flex items-center gap-2">
              <i class="ri-file-text-line"></i>
              类型
            </span>
            <span class="text-sm font-semibold text-gray-700">{{
              file.isDirectory ? "文件夹" : file.extension || "未知"
            }}</span>
          </div>
        </div>

        <div class="bg-gray-50 rounded-xl p-4">
          <p class="text-xs text-gray-400 break-all font-mono leading-relaxed">
            {{ file.path }}
          </p>
        </div>

        <div v-if="!file.isDirectory" class="flex gap-2">
          <n-button
            type="primary"
            block
            size="large"
            @click="emit('openFile', file.path)"
            class="shadow-lg"
          >
            <template #icon>
              <i class="ri-external-link-line"></i>
            </template>
            打开文件
          </n-button>
        </div>
      </div>
    </div>
  </div>
</template>
