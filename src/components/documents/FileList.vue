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
    backgroundColor: "rgba(201, 168, 108, 0.15)",
    border: "1px solid rgba(201, 168, 108, 0.5)",
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
    class="file-list-container flex-1 overflow-auto p-4 md:p-6 relative h-full"
    @contextmenu="emit('handleBackgroundContextMenu', $event)"
    @mousedown="handleMouseDown"
  >
    <div v-if="isSelecting" :style="selectionStyle"></div>

    <n-spin :show="loading" class="h-full w-full">
      <div
        class="absolute flex items-center justify-center h-full w-full"
        v-if="files.length === 0 && !loading"
      >
        <n-empty description="暂无文件" size="large">
          <template #icon>
            <i class="ri-folder-open-line text-56xl empty-icon"></i>
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
          class="file-card group p-4 md:p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 ease-out relative"
          :class="{
            'selected-file': isFileSelected(file),
            'hover-selected': !isFileSelected(file),
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
                class="extension-badge absolute -bottom-1 -right-1 w-6 h-6 rounded-full shadow-md flex items-center justify-center"
              >
                <span class="text-[10px] font-bold">
                  {{ file.extension.toUpperCase().substring(0, 3) }}
                </span>
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
              class="file-name text-sm text-center font-medium truncate w-full"
              :title="file.name"
            >
              {{ file.name }}
            </div>
            <div class="file-meta text-xs mt-1">
              {{ file.isDirectory ? "文件夹" : formatFileSize(file.size) }}
            </div>
          </div>
        </div>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="file in files"
          :key="file.path"
          class="file-list-item group p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ease-out flex items-center gap-4 relative"
          :class="{
            'selected-file': isFileSelected(file),
            'hover-selected': !isFileSelected(file),
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
            <div v-else class="file-name font-medium text-base truncate">
              {{ file.name }}
            </div>
            <div class="file-meta text-sm mt-1 flex items-center gap-2">
              <span>{{ formatDate(file.modified) }}</span>
              <span class="meta-divider">·</span>
              <span>{{
                file.isDirectory ? "文件夹" : formatFileSize(file.size)
              }}</span>
            </div>
          </div>
          <div
            v-if="!file.isDirectory"
            class="extension-badge-list hidden sm:flex items-center gap-2 px-3 py-1 rounded-full"
          >
            <span class="text-xs font-medium">{{
              file.extension.toUpperCase()
            }}</span>
          </div>
        </div>
      </div>
    </n-spin>
  </div>
</template>

<style scoped>
.file-list-container {
  background-color: var(--color-bg-secondary);
}

.empty-icon {
  color: var(--color-text-muted);
}

.file-card,
.file-list-item {
  user-select: none;
  border-color: transparent;
  background-color: var(--color-bg);
  backdrop-filter: blur(10px);
}

.hover-selected:hover {
  border-color: var(--color-accent);
  box-shadow: 0 4px 12px var(--color-shadow);
  transform: scale(1.02);
}

.file-list-item.hover-selected:hover {
  transform: translateX(4px);
}

.selected-file {
  background: linear-gradient(
    135deg,
    rgba(201, 168, 108, 0.1) 0%,
    rgba(201, 168, 108, 0.05) 100%
  );
  border-color: var(--color-accent) !important;
  box-shadow: 0 4px 12px rgba(201, 168, 108, 0.2);
}

.file-name {
  color: var(--color-text);
}

.file-meta {
  color: var(--color-text-muted);
}

.meta-divider {
  color: var(--color-border);
}

.extension-badge {
  background-color: var(--color-bg);
  color: var(--color-text-secondary);
}

.extension-badge-list {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.rename-input :deep(.n-input__input-el) {
  font-weight: 500;
}
</style>
