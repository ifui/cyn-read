<script setup lang="ts">
/**
 * 人员列表中的单个卡片
 * 布局：
 *  ┌────────────────────────────────────────┐
 *  │ ⋮ ☑ │ [姓名 - 单独一行]              │  ✓  ⋈ ✎ 🗑 │
 *  │     │ [宾客] [就座]                    │              │
 *  │     │ 部门 / 级别 · 职务                │              │
 *  └────────────────────────────────────────┘
 */
import { computed } from "vue";
import { NButton, NCheckbox } from "naive-ui";
import { useSeatTableStore } from "../store";
import type { Person } from "../types";

const props = defineProps<{
  person: Person;
  selected?: boolean;
  selectable?: boolean;
  seated?: boolean;
  /** 紧凑模式（用于 n-tree 内）：隐藏拖拽柄/部门级别/职务/操作按钮 */
  compact?: boolean;
}>();

const emit = defineEmits<{
  (e: "edit", p: Person): void;
  (e: "remove", p: Person): void;
  (e: "toggle-select", p: Person, v: boolean): void;
  (e: "toggle-status", p: Person): void;
  (e: "toggle-guest", p: Person): void;
  /** 平铺/非 compact 模式下：从列表拖到画布时触发 */
  (e: "drag-start", p: Person, ev: DragEvent): void;
}>();

const store = useSeatTableStore();
const levelColor = computed(
  () => store.levelMap.get(props.person.level)?.color || "#7d7d7d",
);
const deptName = computed(
  () => store.deptMap.get(props.person.department)?.name || "未分配",
);
const levelName = computed(
  () => store.levelMap.get(props.person.level)?.name || "未分级",
);
const isAbsent = computed(() => props.person.status === "absent");
const isGuest = computed(() => props.person.isGuest === true);

const handleCheck = (v: boolean) => emit("toggle-select", props.person, v);

const handleToggleStatus = (e: MouseEvent) => {
  e.stopPropagation();
  emit("toggle-status", props.person);
};
const handleToggleGuest = (e: MouseEvent) => {
  e.stopPropagation();
  emit("toggle-guest", props.person);
};

/* ---------- HTML5 拖拽：把列表项拖到画布座位 ---------- */
const handleDragStart = (e: DragEvent) => {
  if (props.compact) return;
  if (!e.dataTransfer) return;
  // 标记为从"列表"拖来：canvas 的 drop 用 fromList 来区分
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", props.person.id);
  e.dataTransfer.setData(
    "application/json",
    JSON.stringify({
      fromList: true,
      personId: props.person.id,
    }),
  );
  emit("drag-start", props.person, e);
};
</script>

<template>
  <div
    class="person-card"
    :class="{
      'is-selected': selected,
      'is-absent': isAbsent,
      'is-seated': seated,
      'is-guest': isGuest,
      'is-compact': compact,
      'is-draggable': !compact,
    }"
    :draggable="!compact"
    @dragstart="handleDragStart"
  >
    <div class="person-card-main">
      <span v-if="!compact" class="drag-handle" title="拖动到画布指定位置">
        <i class="ri-drag-drop-line"></i>
      </span>
      <n-checkbox
        v-if="selectable && !compact"
        :checked="!!selected"
        @update:checked="handleCheck"
        @click.stop
        class="person-card-check"
      />
      <div class="person-color-bar" :style="{ background: levelColor }"></div>
      <div class="person-card-info">
        <div class="person-card-name" :title="person.name">
          {{ person.name }}
        </div>
        <!-- 紧凑模式：在名字下面一行展示参会/不参、宾客等小标识 -->
        <div v-if="compact" class="compact-badges">
          <span
            class="status-icon"
            :class="[
              isAbsent ? 'is-absent' : 'is-attending',
              isAbsent ? 'is-locked' : '',
            ]"
            :title="isAbsent ? '不参会' : '参会'"
          >
            <i :class="isAbsent ? 'ri-close-line' : 'ri-check-line'"></i>
          </span>
          <span
            v-if="isGuest"
            class="guest-tag"
            :class="isAbsent ? 'is-locked' : ''"
            title="宾客"
          >
            <i class="ri-vip-crown-line"></i>
          </span>
          <span v-if="compact && seated" class="seated-tag" title="已就座">
            <i class="ri-armchair-line"></i>
          </span>
        </div>
        <template v-if="!compact">
          <div class="person-card-tags">
            <span
              v-if="isGuest"
              class="guest-tag"
              title="宾客：长条桌/四边形会议中将排到宾桌"
            >
              <i class="ri-vip-crown-line"></i>
            </span>
            <span v-if="seated" class="seated-tag" title="已就座">
              <i class="ri-armchair-line"></i>
            </span>
            <span
              class="status-icon"
              :class="isAbsent ? 'is-absent' : 'is-attending'"
              :title="isAbsent ? '不参会' : '参会'"
              @click="handleToggleStatus"
            >
              <i :class="isAbsent ? 'ri-close-line' : 'ri-check-line'"></i>
            </span>
          </div>
          <div class="person-card-meta">
            <span class="meta-dept">{{ deptName }}</span>
            <span class="meta-sep">·</span>
            <span class="meta-level">{{ levelName }}</span>
            <template v-if="person.title">
              <span class="meta-sep">·</span>
              <span class="meta-title">{{ person.title }}</span>
            </template>
          </div>
        </template>
      </div>
    </div>
    <div v-if="!compact" class="person-card-actions">
      <n-button
        quaternary
        size="tiny"
        :type="isGuest ? 'warning' : 'default'"
        :title="isGuest ? '取消宾客标记' : '标记为宾客'"
        @click="handleToggleGuest"
        @mousedown.stop
      >
        <i :class="isGuest ? 'ri-vip-crown-line' : 'ri-user-line'"></i>
      </n-button>
      <n-button
        quaternary
        size="tiny"
        :title="isAbsent ? '标记为参会' : '标记为不参会'"
        @click="handleToggleStatus"
        @mousedown.stop
      >
        <i
          :class="isAbsent ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'"
        ></i>
      </n-button>
      <n-button
        quaternary
        size="tiny"
        @click="emit('edit', person)"
        @mousedown.stop
      >
        <i class="ri-edit-line"></i>
      </n-button>
      <n-button
        quaternary
        size="tiny"
        type="error"
        @click="emit('remove', person)"
        @mousedown.stop
      >
        <i class="ri-delete-bin-line"></i>
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.person-card {
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  margin-bottom: 10px;
  padding: 8px 10px;
  transition: all 0.18s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.person-card:hover {
  border-color: var(--gold);
  box-shadow: 0 2px 6px rgba(201, 168, 108, 0.12);
}
.person-card.is-selected {
  border-color: var(--gold-deep);
  background: rgba(201, 168, 108, 0.08);
  box-shadow: 0 0 0 1px var(--gold-deep);
}
.person-card.is-absent {
  opacity: 0.78;
  background: #faf8f4;
}
.person-card.is-seated {
  background: #f5f3ed;
  border-style: dashed;
}
.person-card-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.person-card-actions {
  display: flex;
  gap: 0;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s;
}

.drag-handle {
  color: #c8c2b3;
  cursor: grab;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 3px;
  transition: all 0.15s;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.drag-handle i {
  font-size: 18px;
}
.drag-handle:hover {
  color: var(--gold-deep);
  background: rgba(201, 168, 108, 0.1);
}
.drag-handle:active {
  cursor: grabbing;
  background: rgba(201, 168, 108, 0.18);
}

.person-card-check {
  flex-shrink: 0;
}

.person-color-bar {
  width: 3px;
  height: 36px;
  border-radius: 2px;
  flex-shrink: 0;
}

.person-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 名字独立成行，可截断 */
.person-card-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* 标签行 */
.person-card-tags {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  line-height: 1;
}

/* 元信息 */
.person-card-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #8c8c8c;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.meta-dept {
  color: #8c8c8c;
}
.meta-sep {
  color: #d8d2c4;
}
.meta-level {
  color: var(--gold-deep);
  font-weight: 500;
}
.meta-title {
  color: #595959;
}

/* 状态图标（参会 ✓ / 不参 ✕）—— 统一低调灰色，去掉彩色 */
.status-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  font-size: 9px;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  line-height: 1;
  border: 1px solid transparent;
  transition: opacity 0.15s;
}
.status-icon i {
  line-height: 1;
  font-weight: 700;
}
/* 参会：绿对勾，但只是字体色，不加彩色背景 */
.status-icon.is-attending {
  color: #52c41a;
  background: transparent;
  border-color: transparent;
}
.status-icon.is-attending i {
  color: #52c41a;
}
/* 不参会：灰色 X，字体色也是灰 */
.status-icon.is-absent {
  color: #bfbfbf;
  background: transparent;
  border-color: transparent;
}
.status-icon.is-absent i {
  color: #bfbfbf;
}
.status-icon:hover {
  opacity: 0.7;
}

/* 标签 —— 就座/未就座，低调灰色 */
.seated-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  font-size: 9px;
  font-weight: 500;
  background: transparent;
  color: #8c8c8c;
  flex-shrink: 0;
  border: 1px solid transparent;
  line-height: 1;
}
.seated-tag i {
  font-size: 9px;
  line-height: 1;
  color: #8c8c8c;
}
/* 宾客标签 —— 低调灰色，去掉金色 */
.guest-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  font-size: 9px;
  font-weight: 600;
  background: transparent;
  color: #8c8c8c;
  flex-shrink: 0;
  border: 1px solid transparent;
  line-height: 1;
  transition: opacity 0.15s;
}
.guest-tag i {
  font-size: 9px;
  line-height: 1;
  color: #8c8c8c;
}
.guest-tag:hover {
  opacity: 0.7;
}
.person-card.is-guest {
  border-left: 3px solid #c9a36b;
  background: linear-gradient(to right, #fdf6e3 0%, #fff 30%);
}

/* 紧凑模式（n-tree 内）：去掉卡片外观，只显示名字+色条 */
.person-card.is-compact {
  border: none;
  border-radius: 0;
  background: transparent;
  margin: 0;
  padding: 0;
  box-shadow: none;
  gap: 6px;
  flex: 1;
  min-width: 0;
  cursor: default;
}
.person-card.is-compact:hover {
  border: none;
  box-shadow: none;
  background: transparent;
}
.person-card.is-compact .person-card-main {
  gap: 6px;
  width: 100%;
  min-width: 0;
}
.person-card.is-compact .person-color-bar {
  width: 3px;
  height: 28px;
  border-radius: 2px;
  flex-shrink: 0;
  align-self: center;
}
.person-card.is-compact .person-card-info {
  gap: 1px;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  flex: 1;
}
.person-card.is-compact .person-card-name {
  font-size: 12.5px;
  line-height: 1.3;
  color: var(--ink);
  flex: 0 0 auto;
  min-width: 0;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 紧凑模式：名字下面的小标识行（参会/宾客/就座） */
.compact-badges {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  line-height: 1;
  margin-top: 2px;
}
.compact-badges .status-icon,
.compact-badges .guest-tag,
.compact-badges .seated-tag {
  width: 14px;
  height: 14px;
  font-size: 9px;
}
.compact-badges .status-icon i,
.compact-badges .guest-tag i,
.compact-badges .seated-tag i {
  font-size: 9px;
  line-height: 1;
}
/* 宾客在 n-tree 中的样式微调 */
.person-card.is-compact.is-guest .person-card-name {
  font-weight: 600;
}
/* 不参会人员在 n-tree 中：保持原色，不加灰不加删除线
 * 仅靠名字下方的 ✕ 图标标识不参会状态 */
.person-card.is-compact.is-absent {
  opacity: 1;
}
.person-card.is-compact.is-absent .person-color-bar {
  /* 保持色条原色，不变灰 */
  opacity: 1;
}
.person-card.is-compact.is-absent .person-card-name {
  color: var(--ink);
  text-decoration: none;
}

/* 不参会时：所有操作按钮锁定（不可点击） */
.compact-badges .is-locked {
  cursor: not-allowed !important;
  opacity: 0.55;
}
.compact-badges .is-locked:hover {
  transform: none !important;
}
</style>
