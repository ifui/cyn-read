<script setup lang="ts">
/**
 * 会场座位排布可视化管理 - 主页面
 * 仅负责组合子组件和管理弹窗状态
 */
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useMessage, useDialog } from "naive-ui";
import { useSeatTableStore } from "./store";
import { useImportExport } from "./composables/useImportExport";
import SeatToolbar from "./components/SeatToolbar.vue";
import CanvasSidebar from "./components/CanvasSidebar.vue";
import PersonSidebar from "./components/PersonSidebar.vue";
import SeatCanvas from "./components/SeatCanvas.vue";
import Modals from "./components/Modals.vue";
import type { Cell, Department, Level, Person } from "./types";

const store = useSeatTableStore();
const message = useMessage();
const dialog = useDialog();

/* ---------- 侧栏宽度（可拖拽调节） ---------- */
const leftCollapsed = ref(false);
const rightCollapsed = ref(false);
const leftWidth = ref(280);
const rightWidth = ref(320);
const MIN_SIDEBAR = 220;
const MAX_SIDEBAR = 520;
const COLLAPSED_W = 0;

let resizing: null | "left" | "right" = null;
let resizeStartX = 0;
let resizeStartW = 0;

const onResizeStart = (
  e: MouseEvent,
  side: "left" | "right",
  startW: number,
) => {
  resizing = side;
  resizeStartX = e.clientX;
  resizeStartW = startW;
  e.preventDefault();
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
};
const onResizeMove = (e: MouseEvent) => {
  if (!resizing) return;
  const delta = e.clientX - resizeStartX;
  if (resizing === "left") {
    const next = Math.max(
      MIN_SIDEBAR,
      Math.min(MAX_SIDEBAR, resizeStartW + delta),
    );
    leftWidth.value = next;
    if (next > COLLAPSED_W) leftCollapsed.value = false;
  } else if (resizing === "right") {
    const next = Math.max(
      MIN_SIDEBAR,
      Math.min(MAX_SIDEBAR, resizeStartW - delta),
    );
    rightWidth.value = next;
    if (next > COLLAPSED_W) rightCollapsed.value = false;
  }
};
const onResizeEnd = () => {
  if (!resizing) return;
  resizing = null;
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
};
onMounted(() => {
  window.addEventListener("mousemove", onResizeMove);
  window.addEventListener("mouseup", onResizeEnd);
});
onUnmounted(() => {
  window.removeEventListener("mousemove", onResizeMove);
  window.removeEventListener("mouseup", onResizeEnd);
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
});

const toggleLeft = () => {
  leftCollapsed.value = !leftCollapsed.value;
};
const toggleRight = () => {
  rightCollapsed.value = !rightCollapsed.value;
};

/* ---------- 弹窗状态 ---------- */
const showPerson = ref(false);
const showCell = ref(false);
const showDept = ref(false);
const showLevel = ref(false);
const showLog = ref(false);
const editingPerson = ref<Person | null>(null);
const editingCell = ref<Cell | null>(null);
const editingDept = ref<Department | null>(null);
const editingLevel = ref<Level | null>(null);

/* ---------- 人员操作 ---------- */
const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const openAddPerson = () => {
  editingPerson.value = {
    id: uid(),
    name: "",
    department: store.departments[0]?.id || "",
    level: store.levels[0]?.id || "",
    title: "",
    remark: "",
    status: "attending",
    isGuest: false,
  };
  showPerson.value = true;
};
const openEditPerson = (p: Person) => {
  editingPerson.value = { ...p };
  showPerson.value = true;
};
const handleSavePerson = (p: Person) => {
  const old = store.persons.find((x) => x.id === p.id);
  const exists = !!old;
  if (exists) store.updatePerson(p);
  else store.addPerson(p);
  showPerson.value = false;
  editingPerson.value = null;
  message.success("已保存人员");
  // 检测"已就座但被改为不参会"的情况
  if (exists && old && old.status === "attending" && p.status === "absent") {
    const seated = store.seats.some((s) => s.personId === p.id);
    if (seated) promptAbsentRearrange([p]);
  }
};

/** 缺席提示 + 询问是否重新排座（清除其座位 + 自动补空位） */
const promptAbsentRearrange = (persons: Person[]) => {
  if (!persons.length) return;
  const names = persons.map((p) => p.name).join("、");
  dialog.warning({
    title: "检测到已就座的不参会人员",
    content: `「${names}」已就座但被标记为不参会，是否清空其座位并自动补排？`,
    positiveText: "清空并重排",
    negativeText: "暂不处理",
    onPositiveClick: () => {
      const r = store.freeAbsentSeats();
      if (r.cleared > 0) {
        message.success(`已清空 ${r.cleared} 个不参会人员的座位`);
      }
      // 重新排座：将未就座的参会人员补到空位
      const arr = store.autoArrange();
      if (arr.ok) {
        message.success(`已自动补排 ${arr.count} 人`);
      } else if (arr.reason) {
        message.info(arr.reason);
      }
    },
  });
};

/* ---------- 单元格操作 ---------- */
const openEditCell = (cell: Cell) => {
  editingCell.value = { ...cell };
  showCell.value = true;
};
const handleSaveCell = (c: Cell) => {
  const cell = store.cells.find((x) => x.id === c.id);
  if (cell) store.updateCell(cell, c);
  showCell.value = false;
  editingCell.value = null;
  message.success("已保存单元格");
};

/* ---------- 部门操作 ---------- */
const openAddDept = () => {
  editingDept.value = {
    id: uid(),
    name: "",
    parentId: undefined,
    mainTitle: "正职",
    deputyTitle: "副职",
    order: 0,
  };
  showDept.value = true;
};
const openEditDept = (d: Department) => {
  editingDept.value = { ...d };
  showDept.value = true;
};
const handleSaveDept = (d: Department) => {
  const exists = store.departments.find((x) => x.id === d.id);
  if (exists) {
    const r = store.updateDepartment(d);
    if (!r.ok) {
      message.error(r.reason || "更新失败");
      return;
    }
  } else {
    store.addDepartment(d);
  }
  showDept.value = false;
  editingDept.value = null;
  message.success("已保存部门");
};

/* ---------- 级别操作 ---------- */
const openAddLevel = () => {
  editingLevel.value = {
    id: uid(),
    name: "",
    order: store.levels.length + 1,
    color: "#8c8c8c",
  };
  showLevel.value = true;
};
const openEditLevel = (l: Level) => {
  editingLevel.value = { ...l };
  showLevel.value = true;
};
const handleSaveLevel = (l: Level) => {
  const exists = store.levels.find((x) => x.id === l.id);
  if (exists) store.updateLevel(l);
  else store.addLevel(l);
  showLevel.value = false;
  editingLevel.value = null;
  message.success("已保存级别");
};

/* ---------- 弹窗错误提示 ---------- */
const handleModalError = (msg: string) => message.warning(msg);

/* ---------- 导入文件输入 ---------- */
const { jsonInputRef, onLayoutFile } = useImportExport();

/* ---------- 全局：检测缺席却已就座的人员（兜底提醒） ---------- */
let promptCooldown = 0;
watch(
  () => store.absentSeatedPersons.length,
  (n) => {
    if (n === 0) return;
    // 同一秒钟内只提示一次（避免状态批量变化时重复弹窗）
    const now = Date.now();
    if (now - promptCooldown < 1500) return;
    promptCooldown = now;
    const list = store.absentSeatedPersons;
    promptAbsentRearrange(list);
  },
);

/* ---------- 生命周期 ---------- */
onMounted(() => {
  const loaded = store.loadFromStorage();
  if (!loaded) store.initCanvas();
  // 防御性：清理历史遗留的越界格子（幽灵行/列）。
  // 这一步幂等，没脏数据时啥也不做。
  store.cleanupOutOfBoundsCells();
});
</script>

<template>
  <div class="seat-page">
    <SeatToolbar @open-log="showLog = true" />

    <!-- 隐藏文件输入 -->
    <input
      ref="jsonInputRef"
      type="file"
      accept=".json"
      style="display: none"
      @change="onLayoutFile"
    />

    <!-- 主体三栏（可拖拽调宽度 + 折叠） -->
    <div
      class="seat-main"
      :class="{
        'left-collapsed': leftCollapsed,
        'right-collapsed': rightCollapsed,
        'is-resizing': resizing !== null,
      }"
    >
      <!-- 左折叠展开按钮 -->
      <button
        v-if="leftCollapsed"
        class="expand-handle expand-handle-left"
        title="展开侧栏"
        @click="toggleLeft"
      >
        <i class="ri-arrow-right-s-line"></i>
      </button>
      <button
        v-else
        class="collapse-btn collapse-btn-left"
        title="折叠侧栏"
        @click="toggleLeft"
      >
        <i class="ri-arrow-left-s-line"></i>
      </button>

      <CanvasSidebar
        v-show="!leftCollapsed"
        @add-dept="openAddDept"
        @edit-dept="openEditDept"
        @add-level="openAddLevel"
        @edit-level="openEditLevel"
      />

      <!-- 左分隔条 -->
      <div
        v-show="!leftCollapsed"
        class="resizer resizer-left"
        @mousedown="(e) => onResizeStart(e, 'left', leftWidth)"
        title="拖动调节宽度"
      ></div>

      <div class="canvas-print-host">
        <SeatCanvas @edit-cell="openEditCell" />
      </div>

      <!-- 右分隔条 -->
      <div
        v-show="!rightCollapsed"
        class="resizer resizer-right"
        @mousedown="(e) => onResizeStart(e, 'right', rightWidth)"
        title="拖动调节宽度"
      ></div>

      <PersonSidebar
        v-show="!rightCollapsed"
        @add-person="openAddPerson"
        @edit-person="openEditPerson"
      />

      <!-- 右折叠展开按钮 -->
      <button
        v-if="rightCollapsed"
        class="expand-handle expand-handle-right"
        title="展开侧栏"
        @click="toggleRight"
      >
        <i class="ri-arrow-left-s-line"></i>
      </button>
      <button
        v-else
        class="collapse-btn collapse-btn-right"
        title="折叠侧栏"
        @click="toggleRight"
      >
        <i class="ri-arrow-right-s-line"></i>
      </button>
    </div>

    <!-- 弹窗集合 -->
    <Modals
      :show-person="showPerson"
      :show-cell="showCell"
      :show-dept="showDept"
      :show-level="showLevel"
      :show-log="showLog"
      :editing-person="editingPerson"
      :editing-cell="editingCell"
      :editing-dept="editingDept"
      :editing-level="editingLevel"
      @update:show-person="(v) => (showPerson = v)"
      @update:show-cell="(v) => (showCell = v)"
      @update:show-dept="(v) => (showDept = v)"
      @update:show-level="(v) => (showLevel = v)"
      @update:show-log="(v) => (showLog = v)"
      @save-person="handleSavePerson"
      @save-cell="handleSaveCell"
      @save-dept="handleSaveDept"
      @save-level="handleSaveLevel"
      @error="handleModalError"
    />
  </div>
</template>

<style>
/* 页面级 CSS 变量（供子组件使用） */
.seat-page {
  --gold: #c9a86c;
  --gold-deep: #b89555;
  --ink: #2c2c2c;
  --paper: #ffffff;
  --line: #e6dfd2;
  --cell-w: 76px;
  --cell-h: 64px;
}

/* 打印/导出走 useSeatTablePrint composable：html2canvas 截图 → 隐藏 iframe 打印。
 * 这里不需要任何 @media print 兜底样式。 */
</style>

<style scoped>
.seat-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #faf8f4 0%, #f5f2ec 100%);
}
.seat-main {
  flex: 1;
  display: grid;
  /* 列定义保持 5 列稳定：
   *   左侧栏宽 | 6px 分隔条 | 1fr 画布 | 6px 分隔条 | 右侧栏宽
   * 折叠时只通过 v-show 隐藏侧栏和分隔条，grid 列宽不变 → 画布始终在原位
   * （画布不会"被折叠进去"） */
  grid-template-columns:
    v-bind("`${leftWidth}px`")
    6px
    1fr
    6px
    v-bind("`${rightWidth}px`");
  gap: 0;
  padding: 12px;
  overflow: hidden;
  min-height: 0;
  position: relative;
}
.seat-main.is-resizing {
  transition: none;
}

/* 拖动调节条 */
.resizer {
  background: transparent;
  cursor: col-resize;
  position: relative;
  z-index: 5;
  transition: background 0.15s;
}
.resizer::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  background: transparent;
  border-radius: 1px;
  transform: translateX(-50%);
  transition: background 0.15s;
}
.resizer:hover::before,
.seat-main.is-resizing .resizer::before {
  background: var(--gold);
}
.resizer:hover {
  background: rgba(201, 168, 108, 0.06);
}

/* 折叠按钮 */
.collapse-btn,
.expand-handle {
  position: absolute;
  top: 12px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 38px;
  border: 1px solid var(--line);
  background: var(--paper);
  color: #8c8c8c;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  transition: all 0.15s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.collapse-btn:hover,
.expand-handle:hover {
  color: var(--gold-deep);
  background: #fdfaf2;
  border-color: var(--gold);
}
.collapse-btn-left,
.expand-handle-left {
  /* 折叠态时：展开按钮贴在侧栏原位右侧（侧栏宽度处），方便用户看到并展开 */
  left: v-bind("`${leftWidth - 18}px`");
  top: 18px;
  border-radius: 0 4px 4px 0;
  border-left: none;
}
.collapse-btn-left {
  /* 展开态时：始终在侧栏最左边缘 */
  left: 0;
}
.collapse-btn-right,
.expand-handle-right {
  /* 折叠态时：展开按钮贴在侧栏原位左侧 */
  right: v-bind("`${rightWidth - 18}px`");
  top: 18px;
  border-radius: 4px 0 0 4px;
  border-right: none;
}
.collapse-btn-right {
  /* 展开态时：始终在侧栏最右边缘 */
  right: 0;
}
.seat-main.left-collapsed,
.seat-main.right-collapsed,
.seat-main.left-collapsed.right-collapsed {
  /* 列宽已固定（见 .seat-main），折叠时只通过 v-show 隐藏元素，
   * 不再改 grid-template-columns，以保证画布始终在原位 */
}

/* 暗色模式适配 */
:global(.dark) .seat-page {
  --paper: #242220;
  --line: #3a3632;
  --ink: #e8e4dc;
  background: linear-gradient(180deg, #1a1816 0%, #242220 100%);
}

:global(.dark) .seat-page :deep(.n-card) {
  background: var(--paper);
  border-color: var(--line);
}
:global(.dark) .seat-page :deep(.dict-item) {
  background: #2a2826;
  border-color: var(--line);
}
:global(.dark) .seat-page :deep(.person-card) {
  background: #2a2826;
  border-color: var(--line);
}
:global(.dark) .seat-page :deep(.person-card-name),
:global(.dark) .seat-page :deep(.dict-name) {
  color: var(--ink);
}
:global(.dark) .seat-page :deep(.canvas-frame) {
  background-color: #1f1d1b;
}
</style>
