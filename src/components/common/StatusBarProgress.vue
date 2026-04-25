<script setup lang="ts">
import { computed } from "vue";
import { NPopover, NProgress } from "naive-ui";
import { useProgress, type ProgressItem } from "../../hooks/useProgress";

const { progressItems, hide } = useProgress();

const hasProgress = computed(() => progressItems.value.length > 0);

const getPercentage = (item: ProgressItem) => {
  if (item.total === 0) return 0;
  return Math.round((item.current / item.total) * 100);
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "#10b981";
    case "error":
      return "#ef4444";
    default:
      return "#3b82f6";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return "ri-check-line text-green-500";
    case "error":
      return "ri-error-warning-line text-red-500";
    default:
      return "ri-loader-4-line text-blue-500 animate-spin";
  }
};

const totalProgress = computed(() => {
  if (progressItems.value.length === 0) return 0;
  const total = progressItems.value.reduce((sum, item) => sum + item.total, 0);
  const current = progressItems.value.reduce(
    (sum, item) => sum + item.current,
    0,
  );
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
});
</script>

<template>
  <div v-if="hasProgress" class="flex items-center gap-2">
    <n-popover trigger="hover" placement="top" :width="320">
      <template #trigger>
        <div
          class="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full cursor-pointer hover:bg-gray-200 transition-colors"
        >
          <div class="relative w-5 h-5">
            <svg class="w-5 h-5 transform -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#e5e7eb"
                stroke-width="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                :stroke="
                  progressItems[0]?.status === 'error'
                    ? '#ef4444'
                    : progressItems[0]?.status === 'completed'
                      ? '#10b981'
                      : '#3b82f6'
                "
                stroke-width="3"
                :stroke-dasharray="`${totalProgress} 100`"
                stroke-linecap="round"
              />
            </svg>
            <i
              :class="getStatusIcon(progressItems[0]?.status || 'processing')"
              class="absolute inset-0 flex items-center justify-center text-xs"
            ></i>
          </div>
          <span class="text-xs text-gray-600">
            {{
              progressItems.length > 1
                ? `${progressItems.length} 个任务`
                : progressItems[0]?.title
            }}
          </span>
        </div>
      </template>

      <div class="space-y-3 max-h-64 overflow-y-auto">
        <div
          v-for="item in progressItems"
          :key="item.id"
          class="p-2 rounded-lg hover:bg-gray-50 transition-colors group"
        >
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-sm font-medium text-gray-700">
              {{ item.title }}
            </span>
            <button
              v-if="item.status !== 'processing'"
              class="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-gray-200 rounded"
              @click="hide(item.id)"
            >
              <i class="ri-close-line text-gray-400 text-sm"></i>
            </button>
          </div>
          <n-progress
            type="line"
            :percentage="getPercentage(item)"
            :color="getStatusColor(item.status)"
            :rail-color="'#e5e7eb'"
            :height="4"
            :show-indicator="false"
          />
          <div class="flex items-center justify-between mt-1">
            <span
              v-if="item.currentFile"
              class="text-xs text-gray-400 truncate max-w-[180px]"
            >
              {{ item.currentFile }}
            </span>
            <span v-else class="text-xs text-gray-400">-</span>
            <span class="text-xs text-gray-500">
              {{ item.current }} / {{ item.total }}
            </span>
          </div>
        </div>
      </div>
    </n-popover>
  </div>
</template>
