<script setup lang="ts">
/**
 * 画布组件 - 渲染表格、处理框选/缩放/平移/拖拽
 * 左键拖拽：框选单元格
 * 鼠标中键拖动：平移视图
 * Ctrl/Cmd + 滚轮：缩放视图
 * 拖动人员方块：与其他位置互换
 * 右键单元格：上下文菜单（编辑 / 合并 / 拆分 / 切换类型 / 清空 / 人员状态）
 */
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  nextTick,
  watch,
  type ComponentPublicInstance,
} from "vue";
import {
  NPopover,
  NButton,
  NText,
  NDropdown,
  useMessage,
  useDialog,
  type DropdownOption,
} from "naive-ui";
import { storeToRefs } from "pinia";
import { useSeatTableStore } from "../store";
import { useCanvasZoomPan } from "../composables/useCanvasZoomPan";
import { CELL_H, CELL_W } from "../constants";
import type { Cell } from "../types";

const emit = defineEmits<{
  (e: "edit-cell", cell: Cell): void;
}>();

const store = useSeatTableStore();
const message = useMessage();
const dialog = useDialog();
const { rows, cols, seats, masterCells, personMap, zoom, panX, panY } =
  storeToRefs(store);

const { highlightedPersonId } = storeToRefs(store);

/** 由人员列表点击触发的高亮单元格的 cellId（未就座则为 null） */
const highlightCellId = computed<string | null>(() => {
  const pid = highlightedPersonId.value;
  if (!pid) return null;
  const seat = store.getSeatOfPerson(pid);
  return seat ? seat.cellId : null;
});

const {
  onWheel,
  onMouseDown: onPanMouseDown,
  onMouseMove: onPanMouseMove,
  bindPanCallbacks,
} = useCanvasZoomPan();

const frameRef = ref<HTMLElement | null>(null);
const isSelecting = ref(false);

/** 拖选时的可视化矩形（屏幕坐标） */
const dragRect = ref<{ x: number; y: number; w: number; h: number } | null>(
  null,
);
let dragStart = { x: 0, y: 0 };

/* ---------- 拖拽：人员方块 ---------- */
const dragInfo = ref<{
  personId: string;
  fromCellId: string;
  fromSlot: number;
} | null>(null);

const handleDragStart = (
  e: DragEvent,
  personId: string,
  cellId: string,
  slotIndex: number,
) => {
  // 长按触发的"移动单元格"手势中：忽略 HTML5 拖拽，避免人员拖拽与单元格拖拽打架
  if (moveStarted) {
    e.preventDefault();
    return;
  }
  // 重要：dragstart 一旦触发，立即取消长按计时器。
  // 浏览器在鼠标移动 ~5px 时就会触发 dragstart，比 250ms 长按早得多。
  // 如果不清掉，250ms 后会把格子又"切"成 move 模式，体验混乱。
  cancelLongPress();
  dragInfo.value = { personId, fromCellId: cellId, fromSlot: slotIndex };
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", personId);
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ personId, fromCellId: cellId, fromSlot: slotIndex }),
    );
  }
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
};

const handleDrop = (e: DragEvent, cellId: string, slotIndex: number) => {
  e.preventDefault();
  e.stopPropagation();
  // 先尝试解析 dataTransfer：支持"画布上互换"和"列表拖到画布"两种来源
  const json = e.dataTransfer?.getData("application/json") || "";
  let info: {
    fromList?: boolean;
    personId?: string;
    fromCellId?: string;
    fromSlot?: number;
  } | null = null;
  if (json) {
    try {
      info = JSON.parse(json);
    } catch {
      info = null;
    }
  }

  /* ----- 来源 A：人员列表（平铺/未排座视图） ----- */
  if (info?.fromList && info.personId) {
    const personId = info.personId;
    const target = { cellId, slotIndex };
    const targetSeat = store.seats.find(
      (s) => s.cellId === cellId && s.slotIndex === slotIndex,
    );
    const targetPerson = targetSeat?.personId
      ? store.personMap.get(targetSeat.personId)
      : null;
    const person = store.personMap.get(personId);

    const doPlace = (replace: boolean) => {
      if (replace) {
        const r = store.replaceSeatPerson(personId, target);
        if (!r.ok) {
          message.warning(r.reason || "排座失败");
          return;
        }
        if (person && targetPerson) {
          const cellB = store.cells.find((c) => c.id === cellId);
          const posB = `行${(cellB?.row ?? 0) + 1}·列${(cellB?.col ?? 0) + 1}`;
          store.addSwapLog({
            type: "swap",
            personAId: person.id,
            personALabel: person.name,
            personBId: targetPerson.id,
            personBLabel: targetPerson.name,
            desc: `「${person.name}」替换了「${targetPerson.name}」（${posB}）`,
          });
        }
        message.success(
          `已替换：${person?.name} 替换 ${targetPerson?.name || ""}`,
        );
      } else {
        const r = store.placePersonToSeat(personId, target);
        if (!r.ok) {
          message.warning(r.reason || "排座失败");
          return;
        }
        if (person) {
          const cellB = store.cells.find((c) => c.id === cellId);
          const posB = `行${(cellB?.row ?? 0) + 1}·列${(cellB?.col ?? 0) + 1}`;
          const oldPos = r.prevSeat
            ? `（原位置 行${(store.cells.find((c) => c.id === r.prevSeat!.cellId)?.row ?? 0) + 1}·列${(store.cells.find((c) => c.id === r.prevSeat!.cellId)?.col ?? 0) + 1}）`
            : "";
          store.addSwapLog({
            type: "move",
            personAId: person.id,
            personALabel: person.name,
            desc: `「${person.name}」排至 ${posB}${oldPos}`,
          });
        }
        message.success(`已排座：${person?.name}`);
      }
    };
    if (targetPerson) {
      dialog.warning({
        title: "替换该位置人员？",
        content: `目标位置「${targetPerson.name}」将被替换为「${person?.name || "未知"}」，原位置上的人员将变为未排座。是否继续？`,
        positiveText: "替换",
        negativeText: "取消",
        onPositiveClick: () => doPlace(true),
      });
    } else {
      doPlace(false);
    }
    return;
  }

  /* ----- 来源 B：画布内部人员方块（已有逻辑） ----- */
  if (!dragInfo.value) return;
  const fromInfo = {
    cellId: dragInfo.value.fromCellId,
    slotIndex: dragInfo.value.fromSlot,
  };
  const toInfo = { cellId, slotIndex };
  // 同一个 slot：直接返回
  if (
    fromInfo.cellId === toInfo.cellId &&
    fromInfo.slotIndex === toInfo.slotIndex
  ) {
    dragInfo.value = null;
    return;
  }
  // 查找目标 slot 的人
  const targetSeat = store.seats.find(
    (s) => s.cellId === toInfo.cellId && s.slotIndex === toInfo.slotIndex,
  );
  const targetPerson2 = targetSeat?.personId
    ? store.personMap.get(targetSeat.personId)
    : null;
  const fromSeat = store.seats.find(
    (s) => s.cellId === fromInfo.cellId && s.slotIndex === fromInfo.slotIndex,
  );
  const fromPerson = fromSeat?.personId
    ? store.personMap.get(fromSeat.personId)
    : null;

  const doSwap = () => {
    const r = store.swapSeats(fromInfo, toInfo);
    dragInfo.value = null;
    if (!r.ok) {
      message.warning(r.reason || "无法移动到该位置");
      return;
    }
    // 写入交换日志
    const fromLabel = fromPerson
      ? `${fromPerson.name}（${store.getDeptFullName(fromPerson.department)}）`
      : "空位";
    const toLabel = targetPerson2
      ? `${targetPerson2.name}（${store.getDeptFullName(targetPerson2.department)}）`
      : "空位";
    const cellA = store.cells.find((c) => c.id === fromInfo.cellId);
    const cellB = store.cells.find((c) => c.id === toInfo.cellId);
    const posA = `行${(cellA?.row ?? 0) + 1}·列${(cellA?.col ?? 0) + 1}`;
    const posB = `行${(cellB?.row ?? 0) + 1}·列${(cellB?.col ?? 0) + 1}`;
    if (targetPerson2 && fromPerson) {
      store.addSwapLog({
        type: "swap",
        personAId: fromPerson.id,
        personALabel: fromPerson.name,
        personBId: targetPerson2.id,
        personBLabel: targetPerson2.name,
        desc: `「${fromLabel}」与「${toLabel}」互换（${posA} ⇄ ${posB}）`,
      });
    } else if (fromPerson) {
      store.addSwapLog({
        type: "move",
        personAId: fromPerson.id,
        personALabel: fromPerson.name,
        desc: `「${fromLabel}」移至 ${posB}（原位置 ${posA}）`,
      });
    }
    message.success(
      targetPerson2
        ? `已交换：${fromPerson?.name || "空"} ⇄ ${targetPerson2.name}`
        : `已将 ${fromPerson?.name || "人员"} 移至该位置`,
    );
  };

  if (targetPerson2) {
    dialog.warning({
      title: "替换该位置人员？",
      content: `目标位置「${targetPerson2.name}」将被替换为「${fromPerson?.name || "空"}」，是否继续？`,
      positiveText: "替换",
      negativeText: "取消",
      onPositiveClick: doSwap,
    });
  } else {
    doSwap();
  }
};

/* ---------- 左键：移动（长按 0.25s）/ 框选 / 选中 ---------- */
const onCellMouseDown = (e: MouseEvent, cell: Cell) => {
  // 只响应左键；右键交给 contextmenu
  if (e.button !== 0) return;
  // Shift+左键：直接进入框选
  if (e.shiftKey) {
    isSelecting.value = true;
    if (frameRef.value) {
      const rect = frameRef.value.getBoundingClientRect();
      dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      dragRect.value = { x: dragStart.x, y: dragStart.y, w: 0, h: 0 };
    }
    store.startSelection(cell.row, cell.col);
    setMode("box-select");
    return;
  }
  // 在标识格/留白格上点击：直接选中（不开始框选，也不移动）
  if (cell.type !== "seat") {
    store.resetSelection();
    store.startSelection(cell.row, cell.col);
    store.endSelection();
    return;
  }
  // 可移动座位格：长按 0.25s 才进入移动（避免误触 & 与人员 HTML5 拖拽冲突）
  if (isMovableCell(cell)) {
    e.preventDefault();
    e.stopPropagation();
    cancelLongPress();
    pressStart = { x: e.clientX, y: e.clientY };
    pressingCellId.value = cell.id;
    pressTimer = window.setTimeout(() => {
      pressTimer = null;
      if (pressingCellId.value !== cell.id) return;
      pressingCellId.value = null;
      movingCellId.value = cell.id;
      moveOverCellId.value = cell.id;
      moveStarted = true;
      setMode("move");
    }, LONG_PRESS_MS);
    return;
  }
  // 其他情况（合并座位格等）：进入框选
  isSelecting.value = true;
  if (frameRef.value) {
    const rect = frameRef.value.getBoundingClientRect();
    dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dragRect.value = { x: dragStart.x, y: dragStart.y, w: 0, h: 0 };
  }
  store.startSelection(cell.row, cell.col);
  setMode("box-select");
};

const onCellMouseEnter = (cell: Cell) => {
  if (isSelecting.value) {
    store.updateSelection(cell.row, cell.col);
  }
};

/** 由 frameRef.mousemove 持续更新拖选矩形（黏手流畅） */
const onFrameMouseMove = (e: MouseEvent) => {
  if (!isSelecting.value || !frameRef.value) return;
  const fr = frameRef.value.getBoundingClientRect();
  const x = e.clientX - fr.left;
  const y = e.clientY - fr.top;
  dragRect.value = {
    x: Math.min(dragStart.x, x),
    y: Math.min(dragStart.y, y),
    w: Math.abs(x - dragStart.x),
    h: Math.abs(y - dragStart.y),
  };
};

const onMouseUpAnywhere = () => {
  // 释放鼠标时清掉长按态（不管是否到 0.25s）
  cancelLongPress();
  onMouseUpCommitMove();
  if (isSelecting.value) {
    isSelecting.value = false;
    store.endSelection();
    dragRect.value = null;
    resetMode();
  }
};

const onCellDblClick = (cell: Cell) => {
  if (cell.type === "label") emit("edit-cell", cell);
};

/* ---------- 右键菜单 ---------- */
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  cellId: "" as string,
});

/** 当前右键单元格内的所有人员 id（合并格可能含多人） */
const cellPersonIds = computed<string[]>(() => {
  if (!contextMenu.value.cellId) return [];
  return seats.value
    .filter((s) => s.cellId === contextMenu.value.cellId && s.personId)
    .map((s) => s.personId!) as string[];
});

/** 右键操作的目标：选区存在且包含右键格时作用于整个选区，否则只作用于右键格 */
const targetCellIds = computed<string[]>(() => {
  const target = contextMenu.value.cellId;
  if (!target) return [];
  const selCells = store.getSelectionMasterCells();
  if (selCells.length > 0 && selCells.some((c) => c.id === target)) {
    return selCells.map((c) => c.id);
  }
  return [target];
});

const targetLabel = computed(() => {
  const n = targetCellIds.value.length;
  return n > 1 ? `（作用于选区共 ${n} 格）` : "";
});

const contextMenuOptions = computed<DropdownOption[]>(() => {
  const cell = store.cells.find((c) => c.id === contextMenu.value.cellId);
  if (!cell) return [];
  const isMulti = targetCellIds.value.length > 1;
  const opts: DropdownOption[] = [
    {
      label: `编辑文字 / 样式${targetLabel.value}`,
      key: "edit",
    },
  ];
  if (cell.rowSpan > 1 || cell.colSpan > 1) {
    opts.push({ label: "拆分单元格", key: "split" });
  }
  // 合并：选区 >= 2 且可合并时显示
  if (isMulti && store.canMergeSelection) {
    opts.push({ label: "合并单元格", key: "merge" });
  }
  opts.push({ type: "divider", key: "d1" } as DropdownOption);
  opts.push({
    label: isMulti
      ? `将选区设为标识格 (${targetCellIds.value.length})`
      : "切换为标识格",
    key: "type-label",
  });
  opts.push({
    label: isMulti
      ? `将选区设为留白格 (${targetCellIds.value.length})`
      : "切换为留白格",
    key: "type-empty",
  });
  opts.push({
    label: isMulti
      ? `将选区设为座位格 (${targetCellIds.value.length})`
      : "切换为座位格",
    key: "type-seat",
  });
  opts.push({ type: "divider", key: "d2" } as DropdownOption);
  opts.push({
    label: isMulti
      ? `清空选区人员 (${cellPersonIds.value.length})`
      : "清空该区域人员",
    key: "clear",
  });
  // 仅当单元格内有人时显示人员状态快捷设置
  if (cellPersonIds.value.length > 0) {
    opts.push({ type: "divider", key: "d4" } as DropdownOption);
    opts.push({
      label: `标记为参会 (${cellPersonIds.value.length})`,
      key: "status-attending",
    });
    opts.push({
      label: `标记为不参会 (${cellPersonIds.value.length})`,
      key: "status-absent",
    });
  }
  return opts;
});

const onContextMenu = (e: MouseEvent, cell: Cell) => {
  // 正在用右键拖动移动 → 不弹菜单
  if (moveStarted) {
    e.preventDefault();
    return;
  }
  e.preventDefault();
  contextMenu.value.show = true;
  contextMenu.value.x = e.clientX;
  contextMenu.value.y = e.clientY;
  contextMenu.value.cellId = cell.id;
};

const onContextMenuSelect = (key: string) => {
  const cell = store.cells.find((c) => c.id === contextMenu.value.cellId);
  if (!cell) return;
  if (key === "edit") emit("edit-cell", cell);
  else if (key === "split") {
    const r = store.splitCell(cell);
    if (!r.ok) message.warning(r.reason || "拆分失败");
  } else if (key === "merge") {
    const r = store.mergeSelection();
    if (!r.ok) message.warning(r.reason || "合并失败");
    else message.success("已合并单元格");
  } else if (key === "clear") {
    if (targetCellIds.value.length > 1) {
      for (const id of targetCellIds.value) {
        const c = store.cells.find((x) => x.id === id);
        if (c) store.clearCellContent(c);
      }
    } else {
      store.clearCellContent(cell);
    }
    message.success("已清空该区域人员");
  } else if (
    key === "type-label" ||
    key === "type-empty" ||
    key === "type-seat"
  ) {
    const t = key.replace("type-", "") as Cell["type"];
    if (targetCellIds.value.length > 1) {
      // 通过选区批设
      const r = store.setSelectionCellType(t);
      if (r.ok) {
        const map: Record<string, string> = {
          label: "标识格",
          empty: "留白格",
          seat: "座位格",
        };
        message.success(`已将 ${r.count} 个单元格设为${map[t]}`);
      } else {
        message.warning("批设失败");
      }
    } else {
      // 单格：变更类型前先清空人员
      if (t !== "seat") store.clearCellContent(cell);
      store.setCellType(cell, t);
    }
  } else if (key === "status-attending" || key === "status-absent") {
    const status = key === "status-attending" ? "attending" : "absent";
    store.setPersonsStatus(cellPersonIds.value, status);
    message.success(
      `已将 ${cellPersonIds.value.length} 名人员标记为${status === "attending" ? "参会" : "不参会"}`,
    );
  }
  contextMenu.value.show = false;
};

const onContextMenuClickoutside = () => {
  contextMenu.value.show = false;
};

/* ---------- 画布模式（用于顶部状态指示） ---------- */
type CanvasMode = "idle" | "pan" | "box-select" | "move";
const currentMode = ref<CanvasMode>("idle");
const setMode = (m: CanvasMode) => {
  currentMode.value = m;
};
const resetMode = () => {
  currentMode.value = "idle";
};

/** 模式指示器元数据：图标 + 标题 + 说明 */
const modeMeta: Record<
  CanvasMode,
  { icon: string; label: string; desc: string }
> = {
  idle: {
    icon: "🖐",
    label: "默认",
    desc: "左键拖动：移动单元格 · Shift+左键：框选",
  },
  pan: {
    icon: "✋",
    label: "平移",
    desc: "中键拖动平移视图（进行中）",
  },
  "box-select": {
    icon: "▢",
    label: "框选",
    desc: "Shift+左键拖动：框选单元格",
  },
  move: {
    icon: "↔",
    label: "移动",
    desc: "左键长按 0.25s 后拖动单元格",
  },
};

/** 把平移 composable 的 onPanStart/onPanEnd 接入 setMode/resetMode */
bindPanCallbacks(
  () => setMode("pan"),
  () => {
    // 仅在"平移"模式时复位（避免覆盖正在进行的 move/box-select）
    if (currentMode.value === "pan") resetMode();
  },
);

/* ---------- 单元格移动（长按 0.25s 触发，左键拖动 = 移动；Shift+左键 = 框选） ---------- */
const movingCellId = ref<string | null>(null);
const moveOverCellId = ref<string | null>(null);
let moveStarted = false;

/** 长按状态：0.25s 倒计时中（视觉提示用户"再按住一下就能拖动"） */
const pressingCellId = ref<string | null>(null);
let pressTimer: number | null = null;
let pressStart = { x: 0, y: 0 };
const LONG_PRESS_MS = 250;
// 移动阈值从 6 提到 10：容忍按下期间手轻微抖动；
// 浏览器 dragstart 阈值通常也是 5-10px，所以这里配合 handleDragStart 里
// 的 cancelLongPress()，可以做到：抖一点没事 → 长按成功；真的拖 → dragstart 取消长按。
const LONG_PRESS_MOVE_THRESHOLD = 10;

const isMovableCell = (cell: Cell) =>
  cell.master &&
  cell.rowSpan === 1 &&
  cell.colSpan === 1 &&
  cell.type === "seat";

/** 清除长按计时 + 取消按压态 */
const cancelLongPress = () => {
  if (pressTimer !== null) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
  pressingCellId.value = null;
};

const onFrameMouseMoveMove = (e: MouseEvent) => {
  // 长按未到 0.25s：若用户移动鼠标超过阈值，视为普通点击/拖人，取消长按
  if (pressTimer !== null) {
    const dx = e.clientX - pressStart.x;
    const dy = e.clientY - pressStart.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_THRESHOLD) {
      cancelLongPress();
    }
  }
  if (!moveStarted) return;
  // 通过 clientX/Y 命中测试找当前 cell
  if (!frameRef.value) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el) return;
  const cellEl = (el as HTMLElement).closest(
    ".canvas-cell",
  ) as HTMLElement | null;
  if (!cellEl) return;
  const cellId = cellEl.dataset.cellId;
  if (!cellId || cellId === movingCellId.value) return;
  // 必须存在于 store 且可移动
  const target = store.cells.find((c) => c.id === cellId);
  if (!target || !isMovableCell(target)) return;
  moveOverCellId.value = cellId;
};

const onMouseUpCommitMove = () => {
  if (!moveStarted) return;
  moveStarted = false;
  resetMode();
  const fromId = movingCellId.value;
  const toId = moveOverCellId.value;
  movingCellId.value = null;
  moveOverCellId.value = null;
  if (!fromId || !toId || toId === fromId) return;

  // 检查目标格是否存在
  const targetCell = store.cells.find((c) => c.id === toId);
  if (!targetCell) return;
  const targetSeats = store.seats.filter(
    (s) => s.cellId === toId && s.personId,
  );
  const sourceSeats = store.seats.filter(
    (s) => s.cellId === fromId && s.personId,
  );

  /** 真正执行：互换单元格 + 写日志（仅当目标格有人时记录） */
  const doSwap = (writeLog: boolean) => {
    const r = store.swapCells(fromId, toId);
    if (!r.ok) {
      message.warning(r.reason || "移动失败");
      return;
    }
    if (!writeLog) return;
    const fromCellA = store.cells.find((c) => c.id === toId); // swap 后原 fromId 位置现在是目标
    const fromCellB = store.cells.find((c) => c.id === fromId);
    const posA = `行${(fromCellA?.row ?? 0) + 1}·列${(fromCellA?.col ?? 0) + 1}`;
    const posB = `行${(fromCellB?.row ?? 0) + 1}·列${(fromCellB?.col ?? 0) + 1}`;
    if (targetSeats.length > 0 && sourceSeats.length > 0) {
      // 双人互换
      const targetPerson = store.personMap.get(targetSeats[0].personId!);
      const sourcePerson = store.personMap.get(sourceSeats[0].personId!);
      if (targetPerson && sourcePerson) {
        store.addSwapLog({
          type: "swap",
          personAId: targetPerson.id,
          personALabel: targetPerson.name,
          personBId: sourcePerson.id,
          personBLabel: sourcePerson.name,
          desc: `「${sourcePerson.name}」与「${targetPerson.name}」互换单元格（${posB} ⇄ ${posA}）`,
        });
      }
    } else if (targetSeats.length > 0) {
      // 目标格有人被移到源格（空位 → 占位）
      const targetPerson = store.personMap.get(targetSeats[0].personId!);
      if (targetPerson) {
        store.addSwapLog({
          type: "move",
          personAId: targetPerson.id,
          personALabel: targetPerson.name,
          desc: `「${targetPerson.name}」从 ${posA} 移至 ${posB}`,
        });
      }
    }
  };

  // 仅当目标格有人时才弹确认 + 写日志
  if (targetSeats.length > 0) {
    const targetNames = targetSeats
      .map((s) => store.personMap.get(s.personId!)?.name || "?")
      .join("、");
    const sourceNames = sourceSeats
      .map((s) => store.personMap.get(s.personId!)?.name || "?")
      .join("、");
    const lines: string[] = [];
    if (sourceNames) lines.push(`源格人员：${sourceNames}`);
    lines.push(`目标格人员：${targetNames}`);
    dialog.warning({
      title: "确认移动单元格？",
      content: `${lines.join("\n")}\n两个单元格将互换位置，相关人员随格移动。`,
      positiveText: "互换",
      negativeText: "取消",
      onPositiveClick: () => doSwap(true),
    });
  } else {
    // 目标格为空：直接互换，不提示、不写日志
    doSwap(false);
  }
};

/* ---------- 画布容器事件 ---------- */
const onContainerMouseDown = (e: MouseEvent) => {
  // 中键平移
  if (e.button === 1) {
    onPanMouseDown(e);
    return;
  }
  // 左键点击空白处：清除选区
  if (e.button === 0 && e.target === frameRef.value) {
    store.resetSelection();
    isSelecting.value = false;
  }
};

const onContainerMouseMove = (e: MouseEvent) => {
  onFrameMouseMove(e);
  onPanMouseMove(e);
  onFrameMouseMoveMove(e);
};

const onContainerWheel = (e: WheelEvent) => {
  onWheel(e);
};

/* ---------- 缩放控件 ---------- */
const onZoomIn = () => store.zoomIn();
const onZoomOut = () => store.zoomOut();
const onResetView = () => store.resetView();
const zoomPercent = computed(() => Math.round(zoom.value * 100));

/* ---------- 人员方块颜色 / 名称 ---------- */
const getLevelColor = (personId: string) => {
  const p = personMap.value.get(personId);
  return p ? store.levelMap.get(p.level)?.color || "#7d7d7d" : "#7d7d7d";
};
const getPersonName = (personId: string) =>
  personMap.value.get(personId)?.name || "";
const getPersonTitle = (personId: string) =>
  personMap.value.get(personId)?.title || "";
const getDeptName = (deptId: string) =>
  store.deptMap.get(deptId)?.name || "未分配";
const getLevelName = (levelId: string) =>
  store.levelMap.get(levelId)?.name || "未分级";
const getPersonById = (id: string) => personMap.value.get(id);
const isPersonAbsent = (personId: string) =>
  personMap.value.get(personId)?.status === "absent";

const findSeat = (cellId: string, slotIndex: number) =>
  seats.value.find((s) => s.cellId === cellId && s.slotIndex === slotIndex);

const totalSlots = computed(() => seats.value.length);
const usedSlots = computed(() => seats.value.filter((s) => s.personId).length);

/* ---------- 模板 ref 回调 ----------
 * 暴露给 store.canvasRef，用于 html2canvas 截图。
 * 必须通过 :ref 绑定的函数式 ref，否则模板里 ref="..." 是字符串 ref，会被忽略。
 */
const setCanvasRef = (el: Element | ComponentPublicInstance | null) => {
  store.canvasRef = (el as HTMLElement) || null;
};

/* ---------- 生命周期 ---------- */
onMounted(() => {
  window.addEventListener("mouseup", onMouseUpAnywhere);
  nextTick(() => {
    fitAllPersonNames();
    setupNameResizeObserver();
  });
});
onBeforeUnmount(() => {
  window.removeEventListener("mouseup", onMouseUpAnywhere);
  if (nameResizeObserver.value) {
    nameResizeObserver.value.disconnect();
    nameResizeObserver.value = null;
  }
});

/* ---------- 名字自适应缩放 ----------
 * 关键修复：之前用 transform: scale 缩视觉 + 父级 overflow:hidden，
 * 导致 layout box（不缩）超过父级时被切掉一半。改用 font-size 调整后，
 * layout box 跟着缩，居中和裁剪都正确。
 */
const nameResizeObserver = ref<ResizeObserver | null>(null);
/* 锁：fitName 过程中临时改 font-size/display，会触发 ResizeObserver；
 * 加个锁避免无限循环 */
let fitting = false;
const BASE_FONT_PX = 12;
const fitName = (el: HTMLElement | null) => {
  if (!el) return;
  const inner = el.parentElement; // .person-inner
  if (!inner) return;
  fitting = true;
  try {
    // 先重置为基准字号，测自然换行后的真实尺寸
    const prevDisplay = el.style.display;
    el.style.fontSize = `${BASE_FONT_PX}px`;
    // 临时 inline-block 让 scrollWidth/scrollHeight 反映自然换行尺寸
    el.style.display = "inline-block";
    const realW = el.scrollWidth;
    const realH = el.scrollHeight;
    // 还原 display：父是 flex，子作为 flex item 由 align-items/justify-content 自动居中
    // 不要 fallback 到 "block"，否则在 flex 父级里会拉伸变形
    el.style.display = prevDisplay;
    const innerW = inner.clientWidth;
    const innerH = inner.clientHeight;
    if (innerW <= 0 || innerH <= 0) return;
    if (realW <= innerW && realH <= innerH) {
      // 已能完整显示，无需缩放
      el.style.fontSize = `${BASE_FONT_PX}px`;
      return;
    }
    // 用等比缩放：保持纵横比，按较小维度计算
    const scale = Math.min(innerW / realW, innerH / realH, 1);
    el.style.fontSize = `${BASE_FONT_PX * scale}px`;
  } finally {
    // 用 rAF 延后解锁，确保本次样式变化触发的 ResizeObserver 已被忽略
    requestAnimationFrame(() => {
      fitting = false;
    });
  }
};
const fitAllPersonNames = () => {
  const names = document.querySelectorAll<HTMLElement>(".person-name");
  names.forEach((el) => fitName(el));
};
const setupNameResizeObserver = () => {
  if (typeof ResizeObserver === "undefined") return;
  if (nameResizeObserver.value) {
    nameResizeObserver.value.disconnect();
  }
  const ro = new ResizeObserver(() => {
    // 锁期间忽略回调，避免循环
    if (fitting) return;
    fitAllPersonNames();
  });
  // 观察所有 .person-block 容器
  const blocks = document.querySelectorAll<HTMLElement>(".person-block");
  blocks.forEach((el) => ro.observe(el));
  nameResizeObserver.value = ro;
};

// 排座/换人时重新适配
watch(
  () => seats.value,
  () => {
    nextTick(() => {
      fitAllPersonNames();
      setupNameResizeObserver();
    });
  },
  { deep: true },
);
</script>

<template>
  <div class="seat-center">
    <!-- 缩放控制条 -->
    <div class="zoom-bar">
      <n-button size="tiny" quaternary @click="onZoomOut" title="缩小">
        <i class="ri-subtract-line"></i>
      </n-button>
      <span class="zoom-pct" @click="onResetView" title="点击重置"
        >{{ zoomPercent }}%</span
      >
      <n-button size="tiny" quaternary @click="onZoomIn" title="放大">
        <i class="ri-add-line"></i>
      </n-button>
      <n-button size="tiny" quaternary @click="onResetView" title="重置视图">
        <i class="ri-restart-line"></i>
      </n-button>
      <n-text depth="3" style="font-size: 11px; margin-left: 12px">
        左键长按 0.25s 拖动：移动单元格 · Shift+左键：框选合并 · 中键：平移 ·
        Ctrl+滚轮：缩放
      </n-text>
    </div>

    <div
      ref="frameRef"
      class="canvas-frame"
      @mousedown="onContainerMouseDown"
      @mousemove="onContainerMouseMove"
      @wheel="onContainerWheel"
      @contextmenu.prevent
    >
      <!-- 顶部左侧：模式状态指示器 -->
      <div
        class="mode-indicator"
        :class="`mode-${currentMode}`"
        :title="modeMeta[currentMode].desc"
      >
        <div class="mode-icon">{{ modeMeta[currentMode].icon }}</div>
        <div class="mode-info">
          <div class="mode-label">{{ modeMeta[currentMode].label }}</div>
          <div class="mode-desc">{{ modeMeta[currentMode].desc }}</div>
        </div>
      </div>
      <!-- 拖选矩形（柔和蓝色虚线框） -->
      <div
        v-if="dragRect"
        class="drag-rect"
        :style="{
          left: dragRect.x + 'px',
          top: dragRect.y + 'px',
          width: dragRect.w + 'px',
          height: dragRect.h + 'px',
        }"
      ></div>

      <div
        :ref="setCanvasRef"
        class="seat-canvas"
        :style="{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          gridTemplateColumns: `32px repeat(${cols}, ${CELL_W}px)`,
          gridTemplateRows: `22px repeat(${rows}, ${CELL_H}px)`,
        }"
      >
        <!-- 左上角空格 -->
        <div class="coord-corner" />
        <!-- 顶部列号 -->
        <div v-for="c in cols" :key="`col-h-${c}`" class="coord-col-header">
          {{ c }}
        </div>
        <!-- 左侧行号 -->
        <div v-for="r in rows" :key="`row-h-${r}`" class="coord-row-header">
          {{ r }}
        </div>
        <!-- 主体表格 -->
        <div
          class="canvas-stage"
          :style="{
            gridTemplateColumns: `repeat(${cols}, ${CELL_W}px)`,
            gridTemplateRows: `repeat(${rows}, ${CELL_H}px)`,
            width: `calc(${cols} * ${CELL_W}px + 2px)`,
            height: `calc(${rows} * ${CELL_H}px + 2px)`,
          }"
        >
          <template v-for="cell in masterCells" :key="cell.id">
            <div
              class="canvas-cell"
              :class="{
                'cell-label': cell.type === 'label',
                'cell-empty': cell.type === 'empty',
                'cell-selected': store.isCellInSelection(cell),
                'cell-moving': movingCellId === cell.id,
                'cell-move-over': moveOverCellId === cell.id,
                'cell-movable': isMovableCell(cell),
                'cell-pressing': pressingCellId === cell.id,
                'cell-person-highlight': highlightCellId === cell.id,
              }"
              :data-cell-id="cell.id"
              :style="{
                gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
                gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
                background: cell.bgColor || undefined,
                color: cell.textColor || undefined,
              }"
              @mousedown="(e) => onCellMouseDown(e, cell)"
              @mouseenter="onCellMouseEnter(cell)"
              @dblclick="onCellDblClick(cell)"
              @contextmenu="(e) => onContextMenu(e, cell)"
            >
              <template v-if="cell.type === 'seat'">
                <div
                  class="slot-grid"
                  :style="{
                    gridTemplateColumns: `repeat(${cell.colSpan}, 1fr)`,
                    gridTemplateRows: `repeat(${cell.rowSpan}, 1fr)`,
                  }"
                >
                  <div
                    v-for="i in cell.rowSpan * cell.colSpan"
                    :key="i - 1"
                    class="seat-slot"
                    :class="{
                      'has-person': findSeat(cell.id, i - 1)?.personId,
                    }"
                    @dragover="handleDragOver"
                    @drop="(e) => handleDrop(e, cell.id, i - 1)"
                  >
                    <template v-if="findSeat(cell.id, i - 1)?.personId">
                      <div
                        class="person-block"
                        :class="{
                          'is-absent': isPersonAbsent(
                            findSeat(cell.id, i - 1)!.personId!,
                          ),
                        }"
                        :style="{
                          background: getLevelColor(
                            findSeat(cell.id, i - 1)!.personId!,
                          ),
                        }"
                        :draggable="!pressingCellId && movingCellId !== cell.id"
                        @dragstart="
                          (e) =>
                            handleDragStart(
                              e,
                              findSeat(cell.id, i - 1)!.personId!,
                              cell.id,
                              i - 1,
                            )
                        "
                      >
                        <n-popover
                          trigger="hover"
                          :show-arrow="true"
                          placement="top"
                          :keep-alive-on-hover="true"
                          :delay="150"
                          :duration="100"
                        >
                          <template #trigger>
                            <div class="person-inner">
                              <div class="person-name">
                                {{
                                  getPersonName(
                                    findSeat(cell.id, i - 1)!.personId!,
                                  )
                                }}
                              </div>
                            </div>
                          </template>
                          <div
                            class="person-detail"
                            v-if="
                              getPersonById(findSeat(cell.id, i - 1)!.personId!)
                            "
                          >
                            <div class="detail-name">
                              {{
                                getPersonName(
                                  findSeat(cell.id, i - 1)!.personId!,
                                )
                              }}
                            </div>
                            <div class="detail-row detail-status">
                              <span class="detail-label">状态</span>
                              <span
                                class="status-pill"
                                :class="
                                  getPersonById(
                                    findSeat(cell.id, i - 1)!.personId!,
                                  )?.status === 'attending'
                                    ? 'status-attending'
                                    : 'status-absent'
                                "
                              >
                                {{
                                  getPersonById(
                                    findSeat(cell.id, i - 1)!.personId!,
                                  )?.status === "attending"
                                    ? "● 参会"
                                    : "○ 不参会"
                                }}
                              </span>
                            </div>
                            <div class="detail-row">
                              <span class="detail-label">部门</span>
                              <span>{{
                                getDeptName(
                                  getPersonById(
                                    findSeat(cell.id, i - 1)!.personId!,
                                  )!.department,
                                )
                              }}</span>
                            </div>
                            <div class="detail-row">
                              <span class="detail-label">级别</span>
                              <span>{{
                                getLevelName(
                                  getPersonById(
                                    findSeat(cell.id, i - 1)!.personId!,
                                  )!.level,
                                )
                              }}</span>
                            </div>
                            <div
                              v-if="
                                getPersonById(
                                  findSeat(cell.id, i - 1)!.personId!,
                                )?.title
                              "
                              class="detail-row"
                            >
                              <span class="detail-label">职务</span>
                              <span>{{
                                getPersonTitle(
                                  findSeat(cell.id, i - 1)!.personId!,
                                )
                              }}</span>
                            </div>
                            <div
                              v-if="
                                getPersonById(
                                  findSeat(cell.id, i - 1)!.personId!,
                                )?.remark
                              "
                              class="detail-row detail-remark"
                            >
                              <span class="detail-label">备注</span>
                              <span>{{
                                getPersonById(
                                  findSeat(cell.id, i - 1)!.personId!,
                                )?.remark
                              }}</span>
                            </div>
                          </div>
                        </n-popover>
                      </div>
                    </template>
                    <template v-else>
                      <div class="seat-empty-hint">
                        <i class="ri-drag-drop-line"></i>
                      </div>
                    </template>
                  </div>
                </div>
              </template>
              <template v-else-if="cell.type === 'label'">
                <div class="cell-label-text">
                  {{ cell.text || "标识格" }}
                </div>
              </template>
              <template v-else>
                <div class="cell-empty-area"></div>
              </template>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 底部信息 -->
    <div class="canvas-foot">
      <n-text depth="3" style="font-size: 12px">
        <i class="ri-information-line"></i>
        左键长按 0.25s 拖动：移动单元格 · Shift+左键：框选合并 ·
        拖动人员方块：互换座位 · 中键：平移 · Ctrl+滚轮：缩放
      </n-text>
      <n-text depth="3" style="font-size: 12px">
        座位使用：<b>{{ usedSlots }}</b> / {{ totalSlots }}
      </n-text>
    </div>

    <!-- 右键菜单 -->
    <n-dropdown
      :show="contextMenu.show"
      :options="contextMenuOptions"
      :x="contextMenu.x"
      :y="contextMenu.y"
      placement="bottom-start"
      @clickoutside="onContextMenuClickoutside"
      @select="onContextMenuSelect"
    />
  </div>
</template>

<style scoped>
.seat-center {
  display: flex;
  flex-direction: column;
  background: var(--paper);
  border-radius: 8px;
  border: 1px solid var(--line);
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  height: 100%;
  position: relative;
}
.zoom-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-bottom: 1px solid var(--line);
  background: #faf8f4;
  flex-shrink: 0;
  z-index: 5;
}
.zoom-pct {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  height: 22px;
  padding: 0 6px;
  font-size: 12px;
  font-family: "Consolas", monospace;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}
.zoom-pct:hover {
  background: rgba(201, 168, 108, 0.12);
  color: var(--gold-deep);
}
.canvas-frame {
  flex: 1;
  overflow: auto;
  position: relative;
  background:
    linear-gradient(45deg, #f0ece2 25%, transparent 25%),
    linear-gradient(-45deg, #f0ece2 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #f0ece2 75%),
    linear-gradient(-45deg, transparent 75%, #f0ece2 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    10px 0;
  background-color: #faf8f4;
  cursor: default;
}
.seat-canvas {
  position: absolute;
  top: 30px;
  left: 30px;
  transition: transform 0.05s;
  will-change: transform;
  display: grid;
  /* 列宽：第一列 32px（行号槽位），其余 col 列各 CELL_W */
  /* 行高：第一行 22px（列号槽位），其余 row 行各 CELL_H */
}
/* 坐标头（行/列号） */
.coord-corner {
  grid-column: 1;
  grid-row: 1;
  background: transparent;
}
.coord-col-header {
  grid-row: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-family: "JetBrains Mono", Consolas, monospace;
  color: #8c8c8c;
  background: rgba(201, 168, 108, 0.06);
  border-bottom: 1px solid #e3dcc7;
  user-select: none;
  pointer-events: none;
  font-weight: 500;
}
.coord-row-header {
  grid-column: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-family: "JetBrains Mono", Consolas, monospace;
  color: #8c8c8c;
  background: rgba(201, 168, 108, 0.06);
  border-right: 1px solid #e3dcc7;
  user-select: none;
  pointer-events: none;
  font-weight: 500;
}
.canvas-stage {
  grid-column: 2 / -1;
  grid-row: 2 / -1;
  display: grid;
  background: #fbfaf5;
  border: 1px solid #c9bfa7;
  border-radius: 6px;
  user-select: none;
  position: relative;
  box-shadow: 0 2px 8px rgba(120, 100, 60, 0.08);
}
.canvas-cell {
  border: 1px solid #d8d2c4;
  background: linear-gradient(180deg, #ffffff 0%, #faf7f0 100%);
  position: relative;
  overflow: hidden;
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    background 0.15s,
    opacity 0.15s;
  border-radius: 2px;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
}
/* 默认背景仅在用户没自定义时生效：未写入 inline style 才使用 */
.canvas-cell:not([style*="background"]) {
  background: linear-gradient(180deg, #ffffff 0%, #faf7f0 100%);
}
.canvas-cell.cell-movable {
  cursor: grab;
}
.canvas-cell.cell-movable:hover {
  cursor: grab;
}
.canvas-cell.cell-movable:active {
  cursor: grabbing;
}
/* 长按 0.25s 倒计时中：金色脉冲 + 底部进度条，提示"再按住一下就能拖动" */
.canvas-cell.cell-pressing {
  border-color: var(--gold-deep);
  box-shadow: 0 0 0 2px rgba(201, 168, 108, 0.4);
  z-index: 2;
}
.canvas-cell.cell-pressing::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  width: 100%;
  background: linear-gradient(90deg, var(--gold) 0%, var(--gold-deep) 100%);
  transform-origin: left center;
  animation: cell-press-progress 0.25s linear forwards;
  pointer-events: none;
  z-index: 5;
  border-radius: 0 0 2px 2px;
}
@keyframes cell-press-progress {
  0% {
    transform: scaleX(0);
    opacity: 0.9;
  }
  100% {
    transform: scaleX(1);
    opacity: 1;
  }
}
.canvas-cell:hover {
  border-color: var(--gold);
  z-index: 1;
}
/* 选区高亮 - 柔和高亮，不画中间内嵌框 */
.canvas-cell.cell-selected {
  border-color: #5b8def;
  background: rgba(91, 141, 239, 0.05);
  z-index: 3;
}
.canvas-cell.cell-moving {
  opacity: 0.45;
  border-style: dashed;
  border-color: var(--gold-deep);
  z-index: 2;
}
.canvas-cell.cell-move-over {
  border-color: var(--gold-deep);
  border-style: solid;
  box-shadow: 0 0 0 2px rgba(184, 149, 85, 0.35);
  z-index: 4;
  background: rgba(201, 168, 108, 0.08);
}
/* 从人员列表点击触发的单元格外发光（金色脉冲，契合主题） */
.canvas-cell.cell-person-highlight {
  border-color: var(--gold-deep);
  box-shadow:
    0 0 0 2px rgba(201, 168, 108, 0.55),
    0 0 14px 2px rgba(201, 168, 108, 0.4);
  z-index: 5;
  animation: cell-highlight-pulse 1.4s ease-in-out infinite;
}
@keyframes cell-highlight-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 2px rgba(201, 168, 108, 0.55),
      0 0 8px 1px rgba(201, 168, 108, 0.28);
  }
  50% {
    box-shadow:
      0 0 0 3px rgba(184, 149, 85, 0.75),
      0 0 20px 4px rgba(201, 168, 108, 0.55);
  }
}
/* 标识格：默认渐变背景；用户可在弹窗中自定义 bgColor/textColor */
.canvas-cell.cell-label {
  background: linear-gradient(180deg, #f5efe2 0%, #ede4ce 100%);
  border-color: #b8a87a;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px rgba(184, 168, 122, 0.18);
}
/* 当用户没有自定义颜色时，inline style 不会写入 background，
 * 此时让 .cell-label 的渐变生效；用户自定义了颜色就以 inline 为准。
 * 通过 :not([style*="background"]) 选择器实现"没自定义才用默认"。*/
.canvas-cell.cell-label:not([style*="background"]) {
  background: linear-gradient(180deg, #f5efe2 0%, #ede4ce 100%);
}
.cell-label-text {
  font-family: "Noto Serif SC", "Songti SC", serif;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 2px;
  cursor: pointer;
  text-align: center;
  padding: 0 6px;
  word-break: break-all;
  /* 优先使用父级 .canvas-cell 的 color（即用户自定义的 textColor），
   * 未自定义时 fallback 到默认 #6b5a30 */
  color: inherit;
}
/* 导出时：html2canvas 1.x 渲染文字时会比浏览器显示低约 7px（14px 字号下）。
 * 标识格的 flex 居中渲染是准的（参考 person-name 的成功经验），
 * 唯一的问题是文字本身下偏，所以用 margin-top 负值往上挪即可。
 * 注意：不要改成 table-cell / absolute，那两种方式在 html2canvas 1.x
 * 反而会让偏移更严重（实测从 ~7px 变成 ~15-20px）。*/
.seat-canvas.is-exporting .cell-label-text {
  margin-top: -15px;
}
.canvas-cell.cell-label:not([style*="color"]) .cell-label-text {
  color: #6b5a30;
}
.canvas-cell.cell-empty {
  background: repeating-linear-gradient(
    45deg,
    #f5f2ec,
    #f5f2ec 6px,
    #ece8de 6px,
    #ece8de 12px
  );
  border-color: #d8d2c4;
}
.canvas-cell.cell-empty:not([style*="background"]) {
  background: repeating-linear-gradient(
    45deg,
    #f5f2ec,
    #f5f2ec 6px,
    #ece8de 6px,
    #ece8de 12px
  );
}
/* 导出时：html2canvas 1.x 对 repeating-linear-gradient 渲染有 bug（条纹错位/消失）。
 * 改用 base64 内嵌的 SVG 平铺图——html2canvas 对 <img> 背景渲染稳定可靠。
 * 12×12 瓦片 + 6px 宽的 45° 条纹，视觉与预览完全一致。*/
.seat-canvas.is-exporting .canvas-cell.cell-empty,
.seat-canvas.is-exporting .canvas-cell.cell-empty:not([style*="background"]) {
  background-color: #f5f2ec;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><path d='M-1,1 l2,-2 M0,12 l12,-12 M11,13 l2,-2' stroke='%23ece8de' stroke-width='6' fill='none' stroke-linecap='square'/></svg>");
  background-size: 12px 12px;
  background-repeat: repeat;
  background-position: 0 0;
  border-color: #d8d2c4;
}
.cell-empty-area {
  width: 100%;
  height: 100%;
}

.slot-grid {
  display: grid;
  width: 100%;
  height: 100%;
  gap: 1px;
  background: #ece8de;
}
.seat-slot {
  background: #fcfaf6;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.15s;
}
.seat-slot:hover {
  background: #fff;
}
.seat-slot.has-person {
  background: #fff;
  padding: 3px;
  transition: all 0.2s;
}
.seat-empty-hint {
  color: #d4c8a8;
  font-size: 18px;
  opacity: 0.5;
}
/* 导出时隐藏空座位的拖拽提示图标（ri-drag-drop-line）—— 印出来没用 */
.seat-canvas.is-exporting .seat-empty-hint {
  display: none !important;
}
.seat-slot:hover .seat-empty-hint {
  opacity: 1;
  color: var(--gold);
  transform: scale(1.1);
}

.person-block {
  width: 100%;
  height: 100%;
  /* 不用 flex/table 居中：html2canvas 1.x 对 flex 居中、table-cell 居中
   * 都有 7-8px 垂直偏差（实测）。改用 absolute + top/left + transform 居中。 */
  display: block;
  border-radius: 3px;
  color: #fff;
  cursor: grab;
  position: relative;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  transition: all 0.18s;
  background: #7d7d7d;
  padding: 2px 3px;
  box-sizing: border-box;
}
.person-block::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: rgba(255, 255, 255, 0.5);
}
.person-block:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.18);
  z-index: 2;
}
.person-block:active {
  cursor: grabbing;
  transform: scale(0.97);
}
.person-block.is-absent {
  filter: grayscale(0.6);
  opacity: 0.7;
}
.person-block.is-absent::after {
  content: "○";
  position: absolute;
  top: 2px;
  right: 3px;
  font-size: 9px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
.person-inner {
  /* flex 居中：html2canvas 1.x 对 flex 的 align-items: center 渲染准确。
   * 子级 .person-name 用 margin-top: -6px 抵消 html2canvas 的文字下偏。*/
  position: absolute;
  inset: 0;
  padding: 0;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}
.person-name {
  /* html2canvas 1.x 渲染文字时会比浏览器显示低约 6px（scale=2 时约 12px = 1 字符高），
   * 视觉上"中间靠下"。预览时浏览器渲染是正常的，所以默认 margin-top: 0；
   * 仅在导出（.seat-canvas.is-exporting）时把文字往上挪抵消。
   *
   * 实测（html2canvas 1.4.1, scale=2, 单 block 截图）：
   *   margin-top:  0   → 文字偏下 6.6px
   *   margin-top: -6   → 文字偏下 3.6px
   *   margin-top: -10  → 文字偏下 1.6px
   *   margin-top: -12  → 文字偏下 0.6px（用户视觉上仍感觉"中间靠下 1 字符"）
   *   margin-top: -14  → 文字偏上 0.4px（视觉上完全居中）
   *   margin-top: -18  → 文字偏上 2.4px
   * 选 -14：略偏上 0.4px 抵消 line-box 内字形偏下 + text-shadow 视觉下沉，
   * 人眼对"略偏上"宽容，比"略偏下"更"居中"。
   *
   * 注意：不能用 position:absolute + top/bottom + margin:auto 的居中方式
   * （margin-top 会把元素顶到块顶部），所以改用 display:flex 父级居中 + 子级 margin-top 偏移。*/
  line-height: 1.15;
  font-size: 12px;
  font-weight: 600;
  white-space: normal;
  word-break: break-all;
  letter-spacing: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  text-align: center;
  box-sizing: border-box;
  padding: 0 2px;
  /* 默认（预览）：浏览器原生居中即可 */
  margin-top: 0;
  /* 默认 12px；超长时由 JS 改小（保持 box 大小 = 视觉大小） */
}
/* 仅在导出时（useSeatTablePrint 给 .seat-canvas 加 .is-exporting）
 * 把 .person-name 上挪 14px 抵消 html2canvas 1.x 文字下偏的 bug。*/
.seat-canvas.is-exporting .person-name {
  margin-top: -14px;
}

.person-detail {
  min-width: 220px;
}
.detail-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line);
}
.detail-row {
  display: flex;
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink);
}
.detail-label {
  width: 50px;
  color: #8c8c8c;
  flex-shrink: 0;
}
.detail-remark {
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px dashed var(--line);
}
.detail-status {
  margin-bottom: 6px;
}
.status-pill {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 500;
}
.status-pill.status-attending {
  background: rgba(82, 196, 26, 0.12);
  color: #389e0d;
}
.status-pill.status-absent {
  background: rgba(0, 0, 0, 0.06);
  color: #8c8c8c;
}

.canvas-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-top: 1px solid var(--line);
  background: #faf8f4;
  flex-shrink: 0;
}

/* 拖选矩形：柔和蓝色高对比，不再突兀 */
.drag-rect {
  position: absolute;
  pointer-events: none;
  background: rgba(91, 141, 239, 0.08);
  border: 1.5px dashed #5b8def;
  z-index: 50;
  border-radius: 4px;
  transition:
    width 0.05s,
    height 0.05s;
}

/* 顶部左侧：画布交互模式指示器 */
.mode-indicator {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 8px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--line);
  border-radius: 999px;
  box-shadow: 0 2px 6px rgba(60, 50, 20, 0.08);
  user-select: none;
  pointer-events: none;
  backdrop-filter: blur(2px);
  transition:
    border-color 0.18s,
    box-shadow 0.18s,
    background 0.18s;
  min-width: 132px;
}
.mode-indicator .mode-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 16px;
  line-height: 1;
  border-radius: 50%;
  background: var(--paper);
  border: 1px solid var(--line);
  color: var(--gold-deep);
  flex-shrink: 0;
}
.mode-indicator .mode-info {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  min-width: 0;
}
.mode-indicator .mode-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.5px;
}
.mode-indicator .mode-desc {
  font-size: 10px;
  color: #8c8c8c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}
.mode-indicator.mode-pan {
  background: #fff7e0;
  border-color: #e6c476;
  box-shadow: 0 2px 8px rgba(201, 168, 108, 0.25);
}
.mode-indicator.mode-pan .mode-icon {
  background: #fbecc4;
  border-color: #e6c476;
  color: #8a6a1c;
}
.mode-indicator.mode-box-select {
  background: #ecf2ff;
  border-color: #aac4f6;
  box-shadow: 0 2px 8px rgba(91, 141, 239, 0.22);
}
.mode-indicator.mode-box-select .mode-icon {
  background: #dde7ff;
  border-color: #aac4f6;
  color: #2e5cb8;
}
.mode-indicator.mode-move {
  background: #eafaf0;
  border-color: #95d6a9;
  box-shadow: 0 2px 8px rgba(82, 196, 26, 0.22);
}
.mode-indicator.mode-move .mode-icon {
  background: #d6f3df;
  border-color: #95d6a9;
  color: #2f8a3f;
}
</style>
