<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { NButton, NBreadcrumb, NBreadcrumbItem, NDropdown } from "naive-ui";
import type { SortBy, SortOrder } from "../../types/config";
import { os } from "@tauri-apps/api";

interface Props {
  currentPath: string;
  canGoBack: boolean;
  canGoForward: boolean;
  sortBy: SortBy;
  sortOrder: SortOrder;
  viewMode: "grid" | "list";
  showPreview: boolean;
  selectionMode: boolean;
  selectedCount: number;
}

interface Emits {
  (e: "goBack"): void;
  (e: "goForward"): void;
  (e: "handlePaste"): void;
  (e: "toggleViewMode"): void;
  (e: "togglePreview"): void;
  (e: "toggleSelectionMode"): void;
  (e: "handleSortChange", key: string): void;
  (e: "handleBreadcrumbClick", path: string): void;
  (e: "showCreateModal"): void;
  (e: "clearSelection"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const platformName = ref<string>("");

onMounted(async () => {
  platformName.value = await os.platform();
});

const breadcrumbs = computed(() => {
  if (!props.currentPath) return [];

  const parts = props.currentPath.split(/[/\\]/).filter(Boolean);
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

const sortOptions = [
  { label: "按名称排序", key: "name" },
  { label: "按大小排序", key: "size" },
  { label: "按修改时间排序", key: "modified" },
  { label: "按类型排序", key: "type" },
];
</script>

<template>
  <div class="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 bg-white">
    <div
      class="flex flex-col md:flex-row md:items-center md:justify-between gap-3"
    >
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <div class="flex items-center gap-1 flex-shrink-0">
          <n-button
            quaternary
            circle
            size="small"
            :disabled="!canGoBack"
            @click="emit('goBack')"
          >
            <template #icon>
              <i class="ri-arrow-left-line"></i>
            </template>
          </n-button>

          <n-button
            quaternary
            circle
            size="small"
            :disabled="!canGoForward"
            @click="emit('goForward')"
          >
            <template #icon>
              <i class="ri-arrow-right-line"></i>
            </template>
          </n-button>
        </div>

        <i class="ri-folder-line text-gray-400 text-lg hidden sm:block"></i>

        <div class="flex-1 min-w-0 overflow-x-auto items-center">
          <n-breadcrumb v-if="breadcrumbs.length > 0" class="text-sm">
            <n-breadcrumb-item
              v-for="item in breadcrumbs"
              :key="item.path"
              @click="emit('handleBreadcrumbClick', item.path)"
              class="mt-1"
            >
              <span class="truncate max-w-[120px] md:max-w-[200px]">
                {{ item.name }}</span
              >
            </n-breadcrumb-item>
          </n-breadcrumb>
          <span v-else class="text-gray-400 text-sm"
            >请先在设置中配置默认文件夹</span
          >
        </div>
      </div>

      <div class="flex items-center gap-1 md:gap-2 flex-shrink-0">
        <div
          v-if="selectedCount > 0"
          class="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-lg mr-2"
        >
          <span class="text-sm text-blue-600 font-medium">
            已选择 {{ selectedCount }} 项
          </span>
          <n-button
            quaternary
            circle
            size="tiny"
            @click="emit('clearSelection')"
          >
            <template #icon>
              <i class="ri-close-line text-blue-600"></i>
            </template>
          </n-button>
        </div>

        <n-button
          quaternary
          circle
          size="small"
          :type="selectionMode ? 'primary' : 'default'"
          @click="emit('toggleSelectionMode')"
          :title="selectionMode ? '退出选择模式' : '进入选择模式'"
        >
          <template #icon>
            <i class="ri-checkbox-multiple-line"></i>
          </template>
        </n-button>

        <n-button
          quaternary
          circle
          size="small"
          @click="emit('showCreateModal')"
        >
          <template #icon>
            <i class="ri-add-line"></i>
          </template>
        </n-button>

        <n-button quaternary circle size="small" @click="emit('togglePreview')">
          <template #icon>
            <i :class="showPreview ? 'ri-eye-line' : 'ri-eye-off-line'"></i>
          </template>
        </n-button>

        <n-button
          quaternary
          circle
          size="small"
          @click="emit('toggleViewMode')"
        >
          <template #icon>
            <i
              :class="viewMode === 'grid' ? 'ri-list-check' : 'ri-grid-fill'"
            ></i>
          </template>
        </n-button>

        <n-dropdown
          :options="sortOptions"
          @select="(key) => emit('handleSortChange', key)"
        >
          <n-button quaternary circle size="small">
            <template #icon>
              <i class="ri-sort-desc"></i>
            </template>
          </n-button>
        </n-dropdown>
      </div>
    </div>
  </div>
</template>
