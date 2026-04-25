<script setup lang="ts">
import { ref } from "vue";

const searchKeyword = ref("");
const isSearching = ref(false);

const handleSearch = () => {
  if (!searchKeyword.value.trim()) return;
  isSearching.value = true;
  console.log("搜索关键词:", searchKeyword.value);
  setTimeout(() => {
    isSearching.value = false;
  }, 1000);
};
</script>

<template>
  <div class="h-full flex flex-col items-center justify-center p-8">
    <div class="w-full max-w-2xl">
      <div class="text-center mb-8">
        <h1 class="text-5xl font-bold text-gray-800 mb-3">CynRead</h1>
      </div>

      <n-input-group>
        <n-input
          v-model:value="searchKeyword"
          type="text"
          size="large"
          placeholder="搜索文档..."
          clearable
          round
          @keyup.enter="handleSearch"
        >
        </n-input>

        <n-button
          size="large"
          round
          :loading="isSearching"
          @click="handleSearch"
        >
          <template #icon>
            <i class="ri-search-line"></i>
          </template>
        </n-button>
      </n-input-group>
    </div>
  </div>
</template>

<style scoped></style>
