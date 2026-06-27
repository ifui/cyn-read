<script setup lang="ts">
/**
 * 左栏 - 画布设置 / 字典配置 / 级别图例
 */
import { computed } from "vue";
import {
  NCard,
  NButton,
  NInputNumber,
  NButtonGroup,
  NTabs,
  NTabPane,
  NTag,
  useDialog,
  useMessage,
} from "naive-ui";
import { storeToRefs } from "pinia";
import { useSeatTableStore } from "../store";
import type { Department, Level } from "../types";

const emit = defineEmits<{
  (e: "add-dept"): void;
  (e: "edit-dept", d: Department): void;
  (e: "add-level"): void;
  (e: "edit-level", l: Level): void;
}>();

const store = useSeatTableStore();
const dialog = useDialog();
const message = useMessage();
const { rows, cols, levels, departments, deptTree } = storeToRefs(store);

/** 部门下人员数（含子部门） */
const deptPersonCount = computed(() => {
  const map = new Map<string, number>();
  for (const d of departments.value) map.set(d.id, 0);
  for (const p of store.persons) {
    if (p.department) {
      map.set(p.department, (map.get(p.department) || 0) + 1);
    }
  }
  return map;
});
const getDeptCount = (id: string) => deptPersonCount.value.get(id) || 0;

const handleReset = () => {
  dialog.warning({
    title: "重置画布",
    content: "将重置画布为默认 10×14，并清空所有座位分配，是否继续？",
    positiveText: "重置",
    negativeText: "取消",
    onPositiveClick: () => store.resetCanvas(),
  });
};

const handleClearSeats = () => {
  dialog.warning({
    title: "清空座位",
    content: "将清空所有人员座位分配（不删除人员数据），是否继续？",
    positiveText: "清空",
    negativeText: "取消",
    onPositiveClick: () => store.clearAllSeats(),
  });
};

const handleRemoveDept = (d: Department) => {
  dialog.warning({
    title: "删除部门",
    content: `确认删除部门「${d.name}」？`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: () => {
      const r = store.removeDepartment(d.id);
      if (!r.ok) message.error(r.reason || "删除失败");
    },
  });
};

const handleRemoveLevel = (l: Level) => {
  dialog.warning({
    title: "删除级别",
    content: `确认删除级别「${l.name}」？`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: () => {
      const r = store.removeLevel(l.id);
      if (!r.ok) message.error(r.reason || "删除失败");
    },
  });
};
</script>

<template>
  <div class="canvas-sidebar">
    <n-card :bordered="false" size="small" class="sidebar-card">
      <template #header>
        <div class="card-header">
          <i class="ri-layout-grid-line"></i>
          <span>画布设置</span>
        </div>
      </template>
      <div class="canvas-control">
        <div class="control-row">
          <span class="control-label">行数</span>
          <n-input-number
            :value="rows"
            :min="2"
            :max="40"
            size="small"
            style="flex: 1"
            @update:value="
              (v: number | null) => v && store.initCanvas(v, cols, true)
            "
          />
          <n-button-group size="tiny">
            <n-button @click="store.changeRows(-1)">
              <i class="ri-subtract-line"></i>
            </n-button>
            <n-button @click="store.changeRows(1)">
              <i class="ri-add-line"></i>
            </n-button>
          </n-button-group>
        </div>
        <div class="control-row">
          <span class="control-label">列数</span>
          <n-input-number
            :value="cols"
            :min="2"
            :max="40"
            size="small"
            style="flex: 1"
            @update:value="
              (v: number | null) => v && store.initCanvas(rows, v, true)
            "
          />
          <n-button-group size="tiny">
            <n-button @click="store.changeCols(-1)">
              <i class="ri-subtract-line"></i>
            </n-button>
            <n-button @click="store.changeCols(1)">
              <i class="ri-add-line"></i>
            </n-button>
          </n-button-group>
        </div>
        <n-button size="tiny" block @click="handleReset">
          <template #icon><i class="ri-restart-line"></i></template>
          重置画布
        </n-button>
        <n-button
          size="tiny"
          block
          type="warning"
          ghost
          @click="handleClearSeats"
        >
          <template #icon><i class="ri-eraser-line"></i></template>
          清空所有座位
        </n-button>
      </div>
    </n-card>

    <n-card :bordered="false" size="small" class="sidebar-card">
      <template #header>
        <div class="card-header">
          <i class="ri-book-2-line"></i>
          <span>字典配置</span>
        </div>
      </template>
      <n-tabs type="segment" size="small">
        <n-tab-pane name="dept" tab="部门">
          <div class="dict-list">
            <div v-if="deptTree.length === 0" class="dict-empty">
              暂无部门，点击下方新增
            </div>
            <!-- 树形显示部门 -->
            <template v-for="root in deptTree" :key="root.id">
              <div class="dept-node dept-root">
                <div class="dept-row">
                  <i class="ri-building-2-line dept-icon"></i>
                  <span class="dept-name">{{ root.name }}</span>
                  <n-tag size="tiny" :bordered="false" type="info">
                    {{ getDeptCount(root.id) }} 人
                  </n-tag>
                  <div class="dept-actions">
                    <n-button
                      quaternary
                      size="tiny"
                      @click="emit('edit-dept', root)"
                    >
                      <i class="ri-edit-line"></i>
                    </n-button>
                    <n-button
                      quaternary
                      size="tiny"
                      type="error"
                      @click="handleRemoveDept(root)"
                    >
                      <i class="ri-delete-bin-line"></i>
                    </n-button>
                  </div>
                </div>
                <div v-if="root.children.length > 0" class="dept-children">
                  <div
                    v-for="child in root.children"
                    :key="child.id"
                    class="dept-node dept-child"
                  >
                    <div class="dept-row">
                      <i class="ri-arrow-right-s-line dept-arrow"></i>
                      <i class="ri-team-line dept-icon"></i>
                      <span class="dept-name">{{ child.name }}</span>
                      <n-tag size="tiny" :bordered="false" type="info">
                        {{ getDeptCount(child.id) }} 人
                      </n-tag>
                      <div class="dept-actions">
                        <n-button
                          quaternary
                          size="tiny"
                          @click="emit('edit-dept', child)"
                        >
                          <i class="ri-edit-line"></i>
                        </n-button>
                        <n-button
                          quaternary
                          size="tiny"
                          type="error"
                          @click="handleRemoveDept(child)"
                        >
                          <i class="ri-delete-bin-line"></i>
                        </n-button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <n-button block size="tiny" dashed @click="emit('add-dept')">
              <template #icon><i class="ri-add-line"></i></template>
              新增部门
            </n-button>
          </div>
        </n-tab-pane>
        <n-tab-pane name="level" tab="级别">
          <div class="dict-list">
            <div v-for="l in levels" :key="l.id" class="dict-item">
              <div class="level-tag" :style="{ background: l.color }">
                <span class="level-order">{{ l.order }}</span>
              </div>
              <div class="dict-info">
                <div class="dict-name">{{ l.name }}</div>
                <div class="dict-sub">排序权重：{{ l.order }}</div>
              </div>
              <div class="dict-actions">
                <n-button quaternary size="tiny" @click="emit('edit-level', l)">
                  <i class="ri-edit-line"></i>
                </n-button>
                <n-button
                  quaternary
                  size="tiny"
                  type="error"
                  @click="handleRemoveLevel(l)"
                >
                  <i class="ri-delete-bin-line"></i>
                </n-button>
              </div>
            </div>
            <n-button block size="tiny" dashed @click="emit('add-level')">
              <template #icon><i class="ri-add-line"></i></template>
              新增级别
            </n-button>
          </div>
        </n-tab-pane>
      </n-tabs>
    </n-card>

    <n-card :bordered="false" size="small" class="sidebar-card legend-card">
      <template #header>
        <div class="card-header">
          <i class="ri-palette-line"></i>
          <span>级别图例</span>
        </div>
      </template>
      <div class="legend-list">
        <div v-for="l in levels" :key="l.id" class="legend-row">
          <div class="legend-dot" :style="{ background: l.color }"></div>
          <span class="legend-name">{{ l.name }}</span>
        </div>
      </div>
    </n-card>
  </div>
</template>

<style scoped>
.canvas-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  height: 100%;
  padding-right: 2px;
}
.sidebar-card {
  background: var(--paper);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--line);
}
.sidebar-card :deep(.n-card__content) {
  padding: 12px;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}
.card-header i {
  color: var(--gold);
  font-size: 16px;
}
.canvas-control {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.control-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.control-label {
  width: 40px;
  font-size: 13px;
  color: var(--ink);
  flex-shrink: 0;
}
.dict-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 280px;
  overflow-y: auto;
}
.dict-empty {
  font-size: 12px;
  color: #8c8c8c;
  text-align: center;
  padding: 12px 0;
}
.dept-node {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dept-root {
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fcfaf6;
  margin-bottom: 6px;
}
.dept-root:hover {
  border-color: var(--gold);
}
.dept-children {
  margin-top: 4px;
  margin-left: 8px;
  border-left: 2px dashed var(--line);
  padding-left: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dept-child {
  padding: 4px 6px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
}
.dept-child:hover {
  border-color: var(--gold);
  background: #fff;
}
.dept-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.dept-icon {
  color: var(--gold-deep);
  font-size: 14px;
  flex-shrink: 0;
}
.dept-arrow {
  color: #c8c2b3;
  font-size: 12px;
  flex-shrink: 0;
}
.dept-name {
  font-weight: 600;
  color: var(--ink);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dept-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.dict-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fcfaf6;
  transition: all 0.2s;
}
.dict-item:hover {
  border-color: var(--gold);
  background: #fff;
}
.dict-info {
  flex: 1;
  min-width: 0;
}
.dict-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dict-sub {
  font-size: 11px;
  color: #8c8c8c;
  margin-top: 2px;
}
.dict-actions {
  display: flex;
  gap: 2px;
}
.level-tag {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.level-order {
  font-family: "Noto Serif SC", serif;
}
.legend-card {
  flex-shrink: 0;
}
.legend-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--ink);
}
.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
</style>
