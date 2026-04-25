<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from "vue";
import { NEmpty, NSpin, NInput, NCheckbox } from "naive-ui";
import type { FileItem } from "../../types/file";
import { getFileIcon, getFileColor } from "../../types/file";
import { formatFileSize, formatDate } from "../../utils/fileSystem";

interface Props {
  files: FileItem[];
  loading: boolean;
  viewMode: "grid" | "list";
  selectedFile: FileItem | null;
  selectedFiles: Set<string>;
  selectionMode: boolean;
}

interface Emits {
  (e: "handleFileClick", file: FileItem, event: MouseEvent): void;
  (e: "handleFileDoubleClick", file: FileItem): void;
  (e: "handleFileContextMenu", event: MouseEvent, file: FileItem): void;
  (e: "handleBackgroundContextMenu", event: MouseEvent): void;
  (e: "handleRename", file: FileItem, newName: string): void;
  (e: "toggleFileSelection", file: FileItem): void;
  (e: "selectFiles", paths: string[]): void;
  (e: "clearSelection"): void;
  (e: "clearSingleSelection"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const editingFile = ref<FileItem | null>(null);
const editingName = ref("");
const inputRef = ref<InstanceType<typeof NInput> | null>(null);
const containerRef = ref<HTMLElement | null>(null);

const isSelecting = ref(false);
const selectionBox = ref({
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
});

const startRename = (file: FileItem) => {
  editingFile.value = file;
  editingName.value = file.name;
  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
};

const confirmRename = () => {
  if (
    editingFile.value &&
    editingName.value.trim() &&
    editingName.value !== editingFile.value.name
  ) {
    emit("handleRename", editingFile.value, editingName.value.trim());
  }
  cancelRename();
};

const cancelRename = () => {
  editingFile.value = null;
  editingName.value = "";
};

const isFileSelected = (file: FileItem) => {
  return (
    props.selectedFiles.has(file.path) || props.selectedFile?.path === file.path
  );
};

const handleCheckboxClick = (file: FileItem, event: MouseEvent) => {
  event.stopPropagation();
  emit("toggleFileSelection", file);
};

const handleMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return;
  if (
    (e.target as HTMLElement).closest(
      ".file-card, .file-list-item, .n-checkbox, .n-input",
    )
  )
    return;

  isSelecting.value = true;
  selectionBox.value = {
    startX: e.clientX,
    startY: e.clientY,
    endX: e.clientX,
    endY: e.clientY,
  };

  emit("clearSingleSelection");
  if (!e.ctrlKey && !e.metaKey) {
    emit("clearSelection");
  }
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isSelecting.value) return;

  selectionBox.value.endX = e.clientX;
  selectionBox.value.endY = e.clientY;
};

const handleMouseUp = () => {
  if (!isSelecting.value) return;

  const box = selectionBox.value;
  const left = Math.min(box.startX, box.endX);
  const right = Math.max(box.startX, box.endX);
  const top = Math.min(box.startY, box.endY);
  const bottom = Math.max(box.startY, box.endY);

  if (right - left > 10 || bottom - top > 10) {
    const selectedPaths: string[] = [];
    const fileElements = containerRef.value?.querySelectorAll(
      ".file-card, .file-list-item",
    );

    fileElements?.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      if (
        rect.left < right &&
        rect.right > left &&
        rect.top < bottom &&
        rect.bottom > top
      ) {
        if (props.files[index]) {
          selectedPaths.push(props.files[index].path);
        }
      }
    });

    if (selectedPaths.length > 0) {
      emit("selectFiles", selectedPaths);
    }
  }

  isSelecting.value = false;
};

const selectionStyle = ref({});

const updateSelectionStyle = () => {
  if (!isSelecting.value) {
    selectionStyle.value = { display: "none" };
    return;
  }

  const box = selectionBox.value;
  const left = Math.min(box.startX, box.endX);
  const width = Math.abs(box.endX - box.startX);
  const top = Math.min(box.startY, box.endY);
  const height = Math.abs(box.endY - box.startY);

  selectionStyle.value = {
    position: "fixed",
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    border: "1px solid rgba(59, 130, 246, 0.5)",
    borderRadius: "4px",
    pointerEvents: "none",
    zIndex: 1000,
  };
};

onMounted(() => {
  document.addEventListener("mousemove", (e) => {
    handleMouseMove(e);
    updateSelectionStyle();
  });
  document.addEventListener("mouseup", handleMouseUp);
});

onUnmounted(() => {
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseup", handleMouseUp);
});

defineExpose({
  startRename,
});
</script>

<template>
  <div
    ref="containerRef"
    class="flex-1 overflow-auto p-4 md:p-6 bg-gradient-to-br from-gray-50 to-gray-100 relative"
    @contextmenu="emit('handleBackgroundContextMenu', $event)"
    @mousedown="handleMouseDown"
  >
    <div v-if="isSelecting" :style="selectionStyle"></div>

    <n-spin :show="loading">
      <div
        v-if="files.length === 0 && !loading"
        class="absolute inset-0 flex items-center justify-center"
      >
        <n-empty description="暂无文件" size="large">
          <template #icon>
            <i class="ri-folder-open-line text-6xl text-gray-300"></i>
          </template>
        </n-empty>
      </div>

      <div
        v-else-if="viewMode === 'grid'"
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4"
      >
        <div
          v-for="file in files"
          :key="file.path"
          class="file-card group bg-white p-4 md:p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 ease-out relative"
          :class="{
            'selected-file': isFileSelected(file),
            'hover:border-blue-300 hover:shadow-lg': !isFileSelected(file),
            'hover:scale-[1.02]': editingFile?.path !== file.path,
          }"
          @click="emit('handleFileClick', file, $event)"
          @dblclick="emit('handleFileDoubleClick', file)"
          @contextmenu.stop="emit('handleFileContextMenu', $event, file)"
        >
          <div
            v-if="selectionMode"
            class="absolute top-2 left-2 z-10"
            @click.stop
          >
            <n-checkbox
              :checked="isFileSelected(file)"
              @update:checked="handleCheckboxClick(file, $event)"
            />
          </div>

          <div class="flex flex-col items-center">
            <div class="relative mb-3">
              <i
                :class="[
                  getFileIcon(file),
                  getFileColor(file),
                  'text-5xl md:text-6xl transition-transform duration-300 group-hover:scale-110',
                ]"
              ></i>
              <div
                v-if="!file.isDirectory"
                class="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center"
              >
                <span class="text-[10px] font-bold text-gray-500">{{
                  file.extension.toUpperCase()
                }}</span>
              </div>
            </div>
            <div
              v-if="editingFile?.path === file.path"
              class="w-full"
              @click.stop
            >
              <n-input
                ref="inputRef"
                v-model:value="editingName"
                size="small"
                placeholder="文件名"
                class="rename-input"
                @blur="confirmRename"
                @keyup.enter="confirmRename"
                @keyup.escape="cancelRename"
              />
            </div>
            <div
              v-else
              class="text-sm text-center font-medium truncate w-full"
              :title="file.name"
            >
              {{ file.name }}
            </div>
            <div class="text-xs text-gray-400 mt-1">
              {{ file.isDirectory ? "文件夹" : formatFileSize(file.size) }}
            </div>
          </div>
        </div>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="file in files"
          :key="file.path"
          class="file-list-item group bg-white p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ease-out flex items-center gap-4 relative"
          :class="{
            'selected-file': isFileSelected(file),
            'hover:border-blue-300 hover:shadow-md': !isFileSelected(file),
            'hover:translate-x-1': editingFile?.path !== file.path,
          }"
          @click="emit('handleFileClick', file, $event)"
          @dblclick="emit('handleFileDoubleClick', file)"
          @contextmenu.stop="emit('handleFileContextMenu', $event, file)"
        >
          <div v-if="selectionMode" class="flex-shrink-0" @click.stop>
            <n-checkbox
              :checked="isFileSelected(file)"
              @update:checked="handleCheckboxClick(file, $event)"
            />
          </div>

          <div class="relative">
            <i
              :class="[
                getFileIcon(file),
                getFileColor(file),
                'text-4xl md:text-5xl transition-transform duration-300 group-hover:scale-110',
              ]"
            ></i>
          </div>
          <div class="flex-1 min-w-0">
            <div v-if="editingFile?.path === file.path" @click.stop>
              <n-input
                ref="inputRef"
                v-model:value="editingName"
                size="small"
                placeholder="文件名"
                class="rename-input"
                @blur="confirmRename"
                @keyup.enter="confirmRename"
                @keyup.escape="cancelRename"
              />
            </div>
            <div v-else class="font-medium text-base truncate">
              {{ file.name }}
            </div>
            <div class="text-sm text-gray-400 mt-1 flex items-center gap-2">
              <span>{{ formatDate(file.modified) }}</span>
              <span class="text-gray-300">·</span>
              <span>{{
                file.isDirectory ? "文件夹" : formatFileSize(file.size)
              }}</span>
            </div>
          </div>
          <div
            v-if="!file.isDirectory"
            class="hidden sm:flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full"
          >
            <span class="text-xs font-medium text-gray-500">{{
              file.extension.toUpperCase()
            }}</span>
          </div>
        </div>
      </div>
    </n-spin>
  </div>
</template>

<style scoped>
.file-card,
.file-list-item {
  user-select: none;
  border-color: transparent;
  background: white;
}

.rename-input :deep(.n-input__input-el) {
  font-weight: 500;
}

.file-card {
  backdrop-filter: blur(10px);
}

.file-list-item {
  backdrop-filter: blur(10px);
}

.selected-file {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-color: #3b82f6 !important;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}
</style>
