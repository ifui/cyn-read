<script setup lang="ts">
import { computed } from "vue";
import { useStatusStore } from "../../stores/statusStore";
import { useProgress } from "../../hooks/useProgress";

const statusStore = useStatusStore();
const { progressItems } = useProgress();

const currentProgress = computed(() => {
  if (progressItems.value.length === 0) return null;
  const item = progressItems.value[0];
  const percent =
    item.total > 0 ? Math.round((item.current / item.total) * 100) : 0;
  return {
    title: item.title,
    percent,
    status: item.status,
  };
});
</script>

<template>
  <div
    class="flex items-center justify-between h-full w-full text-xs text-gray-500 px-4"
  >
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-1.5 text-gray-400">
        <i class="ri-robot-line"></i>
        <span>模型: 未加载</span>
      </div>
    </div>

    <div class="flex items-center gap-4"></div>

    <div class="flex items-center">
      <Transition name="fade" mode="out-in">
        <div
          v-if="currentProgress"
          class="flex items-center gap-2 px-2 py-0.5 rounded-full"
          :class="[
            currentProgress.status === 'processing'
              ? 'bg-blue-50 text-blue-600'
              : currentProgress.status === 'completed'
                ? 'bg-green-50 text-green-600'
                : 'bg-red-50 text-red-600',
          ]"
        >
          <i
            :class="
              currentProgress.status === 'processing'
                ? 'ri-loader-4-line animate-spin'
                : currentProgress.status === 'completed'
                  ? 'ri-check-line'
                  : 'ri-error-warning-line'
            "
          ></i>
          <span class="font-medium">{{ currentProgress.percent }}%</span>
        </div>
        <div
          v-else-if="statusStore.message"
          class="flex items-center gap-1.5"
          :class="statusStore.messageClass"
        >
          <i
            v-if="statusStore.messageIcon"
            :class="statusStore.messageIcon"
          ></i>
          <span>{{ statusStore.message }}</span>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
