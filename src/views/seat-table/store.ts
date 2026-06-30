/**
 * 会场座位排布 - 集中式状态管理
 * 视图组件应通过该 store 访问/修改数据，避免直接操作 refs
 */
import { defineStore } from "pinia";
import { ref, reactive, computed, watch } from "vue";
import { cloneDeep, debounce } from "lodash-es";
import type {
  Cell,
  CellType,
  Department,
  LayoutSnapshot,
  Level,
  Person,
  PersonStatus,
  Seat,
  SwapLog,
} from "./types";
import {
  DEFAULT_COLS,
  DEFAULT_DEPTS,
  DEFAULT_LEVELS,
  DEFAULT_ROWS,
  MAX_DIM,
  MAX_ZOOM,
  MIN_DIM,
  MIN_ZOOM,
  STORAGE_KEY,
  ZOOM_STEP,
} from "./constants";
import { saveText } from "@/utils/saveFile";

/* ============================================================
 * 工具
 * ============================================================ */
const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/* ============================================================
 * 自动排座算法：行内"中间向外"
 * 奇数 n = 2k+1：#1 居中，#2 居左，#3 居右，#4 左外，#5 右外...
 * 偶数 n = 2k  ：#1 居右（位置 k），#2 居左（位置 k-1），
 *                #3 在 #1 之右，#4 在 #2 之左，依此类推
 * 这符合中文会议"以右为尊"：偶数时贵者靠右。
 * ============================================================ */
export const rowCenterOutOrder = (n: number): number[] => {
  if (n <= 0) return [];
  if (n === 1) return [0];
  if (n % 2 === 1) {
    // 奇数：中间向外
    const k = (n - 1) / 2;
    const order: number[] = [k];
    for (let i = 1; k - i >= 0 || k + i < n; i++) {
      if (k - i >= 0) order.push(k - i);
      if (k + i < n) order.push(k + i);
    }
    return order;
  } else {
    // 偶数：中心两位，#1 右 #2 左，然后向外
    const k = n / 2;
    const order: number[] = [k, k - 1]; // #1 右, #2 左
    for (let i = 1; k + i < n || k - 1 - i >= 0; i++) {
      if (k + i < n) order.push(k + i); // #3, #5, ... 在右
      if (k - 1 - i >= 0) order.push(k - 1 - i); // #4, #6, ... 在左
    }
    return order;
  }
};

/* ============================================================
 * 自动排座算法：行内"左为先"（备用策略，左为大）
 * ============================================================ */
export const rowLeftFirstOrder = (n: number): number[] => {
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => i);
};

/* ============================================================
 * 人员排序：按 部门权重 > 级别 > 职务正副 > 同部门 order > 同部门原顺序
 * ============================================================ */
const sortPersonsByRank = (
  persons: Person[],
  levelMap: Map<string, Level>,
  deptMap: Map<string, Department>,
) => {
  return [...persons].sort((a, b) => {
    // 部门权重（数字越小越靠前；未设置视为最大）
    const oa = deptMap.get(a.department)?.order ?? 9999;
    const ob = deptMap.get(b.department)?.order ?? 9999;
    if (oa !== ob) return oa - ob;
    // 同部门：先按用户手动 order 排（这是用户拖动/上下按钮调整过的结果，必须优先）
    // 之前是最后 tiebreaker，结果 level/role 不同时会被覆盖掉，手动排序失效。
    const ao = a.order ?? 9999;
    const bo = b.order ?? 9999;
    if (ao !== bo) return ao - bo;
    // 再按级别权重（更 senior 靠前）—— 初次添加时所有 order 相同，回退到 rank
    const la = levelMap.get(a.level)?.order ?? 999;
    const lb = levelMap.get(b.level)?.order ?? 999;
    if (la !== lb) return la - lb;
    // 同级：含"正"/"长"/"主任"等放前面
    const aIsMain = /正|长|主任|书记|主席/.test(a.title);
    const bIsMain = /正|长|主任|书记|主席/.test(b.title);
    if (aIsMain && !bIsMain) return -1;
    if (!aIsMain && bIsMain) return 1;
    return 0;
  });
};

/* ============================================================
 * Store
 * ============================================================ */
export const useSeatTableStore = defineStore("seatTable", () => {
  /* ---------- 基础状态 ---------- */
  const rows = ref(DEFAULT_ROWS);
  const cols = ref(DEFAULT_COLS);
  const cells = ref<Cell[]>([]);
  const seats = ref<Seat[]>([]);
  const persons = ref<Person[]>([]);
  const levels = ref<Level[]>(cloneDeep(DEFAULT_LEVELS));
  const departments = ref<Department[]>(cloneDeep(DEFAULT_DEPTS));
  const swapLogs = ref<SwapLog[]>([]);

  /* ---------- 画布视图状态 ---------- */
  const zoom = ref(1);
  const panX = ref(0);
  const panY = ref(0);

  /* ---------- 选区状态（鼠标） ---------- */
  const selection = reactive({
    active: false,
    startRow: -1,
    startCol: -1,
    endRow: -1,
    endCol: -1,
    isMouseDown: false,
  });

  /* ---------- 高亮：从人员列表点击某个人后，在画布上高亮其座位 ---------- */
  const highlightedPersonId = ref<string | null>(null);
  /**
   * 查找某人员当前所在的 cell（返回 cellId 和 slotIndex）。
   * 找不到返回 null。
   */
  const getSeatOfPerson = (personId: string) => {
    for (const s of seats.value) {
      if (s.personId === personId) {
        return { cellId: s.cellId, slotIndex: s.slotIndex };
      }
    }
    return null;
  };
  /**
   * 由人员列表点击触发：把该人员的座位高亮。
   * 如果该人员未就座，仅设置 highlightedPersonId（无视觉高亮）。
   */
  const highlightPersonSeat = (personId: string | null) => {
    highlightedPersonId.value = personId;
  };

  /* ---------- 派生数据 ---------- */
  const cellMap = computed(() => {
    const m = new Map<string, Cell>();
    for (const c of cells.value) m.set(`${c.row}_${c.col}`, c);
    return m;
  });
  const masterCells = computed(() =>
    cells.value.filter(
      (c) =>
        c.master &&
        // 防御性：脏数据里可能有 row/col 超出当前网格的格子
        // （老版本导出/导入遗留，或历史 bug 残留）。
        // 渲染时只保留网格内的，避免出现底部/右侧的"幽灵行"。
        c.row < rows.value &&
        c.col < cols.value,
    ),
  );
  const personMap = computed(() => {
    const m = new Map<string, Person>();
    for (const p of persons.value) m.set(p.id, p);
    return m;
  });
  const deptMap = computed(() => {
    const m = new Map<string, Department>();
    for (const d of departments.value) m.set(d.id, d);
    return m;
  });
  const levelMap = computed(() => {
    const m = new Map<string, Level>();
    for (const l of levels.value) m.set(l.id, l);
    return m;
  });
  const unseatedPersons = computed(() => {
    const seated = new Set(
      seats.value.map((s) => s.personId).filter(Boolean) as string[],
    );
    return persons.value.filter((p) => !seated.has(p.id));
  });

  /** 可用于自动排座的人员：未就座 + 参会 + 按部门/级别/职务排序 */
  const arrangeablePersons = computed(() => {
    const seated = new Set(
      seats.value.map((s) => s.personId).filter(Boolean) as string[],
    );
    return sortPersonsByRank(
      persons.value.filter(
        (p) => !seated.has(p.id) && p.status === "attending",
      ),
      levelMap.value,
      deptMap.value,
    );
  });

  /** 人员列表（按部门权重 → 级别 → 同部门 order 排序） */
  const sortedPersons = computed(() =>
    sortPersonsByRank(persons.value, levelMap.value, deptMap.value),
  );

  /** 部门列表（按 order 排序；同父部门下相邻） */
  const sortedDepartments = computed(() =>
    [...departments.value].sort((a, b) => {
      const pa = a.parentId || "";
      const pb = b.parentId || "";
      if (pa !== pb) return pa.localeCompare(pb);
      return (a.order ?? 9999) - (b.order ?? 9999);
    }),
  );

  /** 部门树（按 order 排序） */
  const deptTree = computed(() => {
    const all = sortedDepartments.value;
    const map = new Map<string, Department & { children: Department[] }>();
    for (const d of all) map.set(d.id, { ...d, children: [] });
    const roots: (Department & { children: Department[] })[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  });

  /** 已就座但状态为不参会的人员（用于提示重新排座） */
  const absentSeatedPersons = computed(() => {
    const seatedIds = new Set(
      seats.value.filter((s) => s.personId).map((s) => s.personId) as string[],
    );
    return persons.value.filter(
      (p) => seatedIds.has(p.id) && p.status === "absent",
    );
  });

  /** 参会但未就座的人员数量 */
  const unseatedAttendingCount = computed(
    () => arrangeablePersons.value.length,
  );
  /** 全部人员（用于人员列表显示） */
  const allPersons = computed(() => persons.value);
  const canMergeSelection = computed(() => {
    if (!selection.active) return false;
    const r1 = Math.min(selection.startRow, selection.endRow);
    const r2 = Math.max(selection.startRow, selection.endRow);
    const c1 = Math.min(selection.startCol, selection.endCol);
    const c2 = Math.max(selection.startCol, selection.endCol);
    if (r1 === r2 && c1 === c2) return false;
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const cell = cellMap.value.get(`${r}_${c}`);
        if (!cell || !cell.master || cell.rowSpan !== 1 || cell.colSpan !== 1)
          return false;
      }
    }
    return true;
  });

  /* ---------- 画布操作 ---------- */
  const initCanvas = (
    r: number = rows.value,
    c: number = cols.value,
    keepExisting = false,
  ) => {
    if (!keepExisting) {
      cells.value = [];
      seats.value = [];
    }
    for (let i = 0; i < r; i++) {
      for (let j = 0; j < c; j++) {
        if (!cellMap.value.get(`${i}_${j}`)) {
          cells.value.push(createEmptyCell(i, j));
        }
      }
    }
    rebuildSeats();
  };

  const createEmptyCell = (row: number, col: number): Cell => ({
    id: `cell-${row}-${col}`,
    row,
    col,
    rowSpan: 1,
    colSpan: 1,
    master: true,
    text: "",
    bgColor: "",
    textColor: "",
    type: "seat",
  });

  /**
   * 交换两个单元格的位置（row/col）。
   * 仅支持 1×1 的非合并单元格；合并格不参与拖拽移动。
   * 座位、人员等绑定到 cell.id 上的数据保持原归属，仅位置互换。
   */
  const swapCells = (aId: string, bId: string) => {
    const a = cells.value.find((c) => c.id === aId);
    const b = cells.value.find((c) => c.id === bId);
    if (!a || !b) return { ok: false, reason: "单元格不存在" };
    if (a.rowSpan > 1 || a.colSpan > 1 || b.rowSpan > 1 || b.colSpan > 1) {
      return { ok: false, reason: "合并单元格不支持拖拽移动" };
    }
    if (a.id === b.id) return { ok: false, reason: "源与目标相同" };
    const tmpRow = a.row;
    const tmpCol = a.col;
    a.row = b.row;
    a.col = b.col;
    b.row = tmpRow;
    b.col = tmpCol;
    return { ok: true };
  };

  const rebuildSeats = () => {
    const next: Seat[] = [];
    for (const cell of cells.value) {
      if (!cell.master) continue;
      // 只有座位格才生成子位；标识格/留白格不参与排座
      if (cell.type !== "seat") continue;
      const oldSeats = seats.value.filter((s) => s.cellId === cell.id);
      const total = cell.rowSpan * cell.colSpan;
      for (let i = 0; i < total; i++) {
        next.push({
          cellId: cell.id,
          slotIndex: i,
          personId: oldSeats[i]?.personId,
        });
      }
    }
    seats.value = next;
  };

  const changeRows = (delta: number) => {
    const newRows = Math.max(MIN_DIM, Math.min(MAX_DIM, rows.value + delta));
    if (newRows === rows.value) return;
    if (delta > 0) {
      for (let r = rows.value; r < newRows; r++) {
        for (let c = 0; c < cols.value; c++) {
          cells.value.push(createEmptyCell(r, c));
        }
      }
    } else {
      cells.value = cells.value.filter((c) => c.row < newRows);
      for (const cell of [...cells.value]) {
        if (cell.master && cell.row + cell.rowSpan > newRows) {
          cell.rowSpan = newRows - cell.row;
          if (cell.rowSpan < 1) cell.rowSpan = 1;
          cells.value = cells.value.filter(
            (c) =>
              !(
                c.row > cell.row &&
                c.row < cell.row + cell.rowSpan &&
                c.col >= cell.col &&
                c.col < cell.col + cell.colSpan
              ),
          );
        }
      }
    }
    rows.value = newRows;
    rebuildSeats();
  };

  const changeCols = (delta: number) => {
    const newCols = Math.max(MIN_DIM, Math.min(MAX_DIM, cols.value + delta));
    if (newCols === cols.value) return;
    if (delta > 0) {
      for (let r = 0; r < rows.value; r++) {
        for (let c = cols.value; c < newCols; c++) {
          cells.value.push(createEmptyCell(r, c));
        }
      }
    } else {
      cells.value = cells.value.filter((c) => c.col < newCols);
      for (const cell of [...cells.value]) {
        if (cell.master && cell.col + cell.colSpan > newCols) {
          cell.colSpan = newCols - cell.col;
          if (cell.colSpan < 1) cell.colSpan = 1;
          cells.value = cells.value.filter(
            (c2) =>
              !(
                c2.col > cell.col &&
                c2.col < cell.col + cell.colSpan &&
                c2.row >= cell.row &&
                c2.row < cell.row + cell.rowSpan
              ),
          );
        }
      }
    }
    cols.value = newCols;
    rebuildSeats();
  };

  /* ---------- 合并 / 拆分 ---------- */
  const mergeSelection = () => {
    if (!canMergeSelection.value) return { ok: false, reason: "选区不合法" };
    const r1 = Math.min(selection.startRow, selection.endRow);
    const r2 = Math.max(selection.startRow, selection.endRow);
    const c1 = Math.min(selection.startCol, selection.endCol);
    const c2 = Math.max(selection.startCol, selection.endCol);
    const master = cellMap.value.get(`${r1}_${c1}`)!;
    master.rowSpan = r2 - r1 + 1;
    master.colSpan = c2 - c1 + 1;
    const removed = new Set<string>();
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (r === r1 && c === c1) continue;
        const cell = cellMap.value.get(`${r}_${c}`)!;
        cell.master = false;
        cell.masterId = master.id;
        removed.add(cell.id);
      }
    }
    cells.value = cells.value.filter((c) => !removed.has(c.id));
    rebuildSeats();
    resetSelection();
    return { ok: true, count: master.rowSpan * master.colSpan };
  };

  const splitCell = (cell: Cell) => {
    if (cell.rowSpan === 1 && cell.colSpan === 1)
      return { ok: false, reason: "单元格未合并" };
    const r = cell.row;
    const c = cell.col;
    const newCells: Cell[] = [];
    for (let i = 0; i < cell.rowSpan; i++) {
      for (let j = 0; j < cell.colSpan; j++) {
        if (i === 0 && j === 0) continue;
        newCells.push(createEmptyCell(r + i, c + j));
      }
    }
    cell.rowSpan = 1;
    cell.colSpan = 1;
    cells.value.push(...newCells);
    rebuildSeats();
    return { ok: true };
  };

  const resetSelection = () => {
    selection.active = false;
    selection.startRow = selection.startCol = -1;
    selection.endRow = selection.endCol = -1;
  };

  const startSelection = (row: number, col: number) => {
    selection.isMouseDown = true;
    selection.active = true;
    selection.startRow = selection.endRow = row;
    selection.startCol = selection.endCol = col;
  };

  const updateSelection = (row: number, col: number) => {
    if (!selection.isMouseDown) return;
    selection.endRow = row;
    selection.endCol = col;
  };

  const endSelection = () => {
    selection.isMouseDown = false;
  };

  const isCellInSelection = (cell: Cell) => {
    if (!selection.active) return false;
    const r1 = Math.min(selection.startRow, selection.endRow);
    const r2 = Math.max(selection.startRow, selection.endRow);
    const c1 = Math.min(selection.startCol, selection.endCol);
    const c2 = Math.max(selection.startCol, selection.endCol);
    return cell.row >= r1 && cell.row <= r2 && cell.col >= c1 && cell.col <= c2;
  };

  /**
   * 获取选区内所有主单元格 id。
   * 注：合并后的主单元格在选区中按其 row/col 判定即可。
   */
  const getSelectionMasterCells = (): Cell[] => {
    if (!selection.active) return [];
    const r1 = Math.min(selection.startRow, selection.endRow);
    const r2 = Math.max(selection.startRow, selection.endRow);
    const c1 = Math.min(selection.startCol, selection.endCol);
    const c2 = Math.max(selection.startCol, selection.endCol);
    const out: Cell[] = [];
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const cell = cellMap.value.get(`${r}_${c}`);
        if (cell) out.push(cell);
      }
    }
    return out;
  };

  /**
   * 批量将选区内的单元格设为指定类型。
   * 合并的主单元格整块变更；被它覆盖的从属 cell 会自动跟随。
   * 选区为空时回退到对单格操作。
   */
  const setSelectionCellType = (
    type: CellType,
  ): { ok: boolean; count: number } => {
    const cells = selection.active ? getSelectionMasterCells() : [];
    if (cells.length === 0) return { ok: false, count: 0 };
    let count = 0;
    for (const cell of cells) {
      if (cell.type === type) continue;
      // 标识格 / 留白格无座位：清空座位占用
      if (type !== "seat") {
        for (const s of seats.value) {
          if (s.cellId === cell.id) s.personId = undefined;
        }
        seats.value = [...seats.value];
      }
      cell.type = type;
      count++;
    }
    // 重建座位（座位格的座位结构需刷新）
    rebuildSeats();
    return { ok: true, count };
  };

  /* ---------- 单元格内容编辑 ---------- */
  const setCellType = (cell: Cell, type: CellType) => {
    cell.type = type;
  };

  const updateCell = (cell: Cell, patch: Partial<Cell>) => {
    Object.assign(cell, patch);
  };

  const clearCellContent = (cell: Cell) => {
    for (const s of seats.value) {
      if (s.cellId === cell.id) s.personId = undefined;
    }
    seats.value = [...seats.value];
  };

  /* ---------- 人员 CRUD ---------- */
  const addPerson = (
    p: Omit<Person, "id" | "status"> & { id?: string; status?: PersonStatus },
  ): Person => {
    // 自动设置同部门内的 order：当前同部门人数即为新位置
    const sameDept = persons.value.filter(
      (x) => x.department === p.department,
    ).length;
    const person: Person = {
      ...p,
      id: p.id || uid(),
      status: p.status || "attending",
      order: p.order ?? sameDept,
    };
    persons.value.push(person);
    return person;
  };
  const updatePerson = (p: Person) => {
    const idx = persons.value.findIndex((x) => x.id === p.id);
    if (idx >= 0) persons.value[idx] = p;
  };
  const removePerson = (id: string) => {
    persons.value = persons.value.filter((x) => x.id !== id);
    for (const s of seats.value) {
      if (s.personId === id) s.personId = undefined;
    }
    seats.value = [...seats.value];
  };

  /**
   * 清空所有人员。会同步清空所有座位占用。
   * 与 removePerson 不同：批量操作一次性触发一次持久化。
   */
  const clearAllPersons = () => {
    persons.value = [];
    let cleared = 0;
    for (const s of seats.value) {
      if (s.personId) {
        s.personId = undefined;
        cleared++;
      }
    }
    if (cleared > 0) seats.value = [...seats.value];
    return { cleared };
  };

  /**
   * 重排人员顺序：根据新 id 列表重写 persons 数组的顺序。
   * 同时按新顺序更新每人同部门内的 order 字段，确保持久化排序生效。
   */
  const reorderPersons = (ids: string[]) => {
    const map = new Map(persons.value.map((p) => [p.id, p]));
    const next: Person[] = [];
    // 维持原顺序、不在传入列表中的项按原顺序追加在尾部
    const idSet = new Set(ids);
    for (const id of ids) {
      const p = map.get(id);
      if (p) next.push(p);
    }
    for (const p of persons.value) {
      if (!idSet.has(p.id)) next.push(p);
    }
    // 写入 order 字段（同部门内按当前数组下标重置）
    const counter = new Map<string, number>();
    for (const p of next) {
      const k = p.department || "";
      const c = counter.get(k) || 0;
      p.order = c;
      counter.set(k, c + 1);
    }
    persons.value = next;
  };

  /* ---------- 人员状态 ---------- */
  const setPersonStatus = (id: string, status: PersonStatus) => {
    const p = persons.value.find((x) => x.id === id);
    if (p) p.status = status;
  };
  const setPersonsStatus = (ids: string[], status: PersonStatus) => {
    const idSet = new Set(ids);
    for (const p of persons.value) {
      if (idSet.has(p.id)) p.status = status;
    }
  };
  const togglePersonStatus = (id: string) => {
    const p = persons.value.find((x) => x.id === id);
    if (p) p.status = p.status === "attending" ? "absent" : "attending";
  };

  /* ---------- 宾客标记 ---------- */
  const setPersonGuest = (id: string, isGuest: boolean) => {
    const p = persons.value.find((x) => x.id === id);
    if (p) p.isGuest = isGuest;
  };
  const setPersonsGuest = (ids: string[], isGuest: boolean) => {
    const idSet = new Set(ids);
    for (const p of persons.value) {
      if (idSet.has(p.id)) p.isGuest = isGuest;
    }
  };
  const togglePersonGuest = (id: string) => {
    const p = persons.value.find((x) => x.id === id);
    if (p) p.isGuest = !p.isGuest;
  };

  /* ---------- 字典 CRUD ---------- */
  const addDepartment = (d: Omit<Department, "id"> & { id?: string }) => {
    const order =
      d.order ??
      // 同父部门下，默认追加到末尾
      Math.max(
        -1,
        ...departments.value
          .filter((x) => (x.parentId || "") === (d.parentId || ""))
          .map((x) => x.order ?? 0),
      ) + 1;
    const dept: Department = { ...d, id: d.id || uid(), order };
    departments.value.push(dept);
    return dept;
  };
  const updateDepartment = (d: Department) => {
    // 防止将父级设为自己或自己的后代（避免循环）
    if (d.parentId) {
      if (d.parentId === d.id) {
        return { ok: false, reason: "不能将自己设为父部门" };
      }
      const descIds = collectDescendantIds(d.id);
      if (descIds.has(d.parentId)) {
        return { ok: false, reason: "不能将后代部门设为父部门" };
      }
    }
    const idx = departments.value.findIndex((x) => x.id === d.id);
    if (idx >= 0) departments.value[idx] = d;
    return { ok: true };
  };
  const removeDepartment = (id: string) => {
    // 存在子部门时不允许删除
    if (departments.value.some((d) => d.parentId === id)) {
      return { ok: false, reason: "该部门下仍有子部门" };
    }
    if (persons.value.some((p) => p.department === id)) {
      return { ok: false, reason: "该部门下仍有人员" };
    }
    departments.value = departments.value.filter((x) => x.id !== id);
    return { ok: true };
  };

  /**
   * 重排部门：根据新 id 列表重写顺序并刷新 order 字段。
   */
  const reorderDepartments = (ids: string[]) => {
    const map = new Map(departments.value.map((d) => [d.id, d]));
    const next: Department[] = [];
    const idSet = new Set(ids);
    for (const id of ids) {
      const d = map.get(id);
      if (d) next.push(d);
    }
    for (const d of departments.value) {
      if (!idSet.has(d.id)) next.push(d);
    }
    // 同父部门下按当前数组下标重置 order
    const counter = new Map<string, number>();
    for (const d of next) {
      const k = d.parentId || "";
      const c = counter.get(k) || 0;
      d.order = c;
      counter.set(k, c + 1);
    }
    departments.value = next;
  };

  /** 收集一个部门的所有后代 id（含直接子级、孙级……） */
  const collectDescendantIds = (deptId: string): Set<string> => {
    const out = new Set<string>();
    const stack = [deptId];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const d of departments.value) {
        if (d.parentId === cur && !out.has(d.id)) {
          out.add(d.id);
          stack.push(d.id);
        }
      }
    }
    return out;
  };

  /** 取部门的完整路径名（拼接所有上级部门名） */
  const getDeptFullName = (deptId: string, separator = " / "): string => {
    if (!deptId) return "未分配";
    const names: string[] = [];
    let cur: string | undefined = deptId;
    const guard = new Set<string>();
    while (cur && !guard.has(cur)) {
      guard.add(cur);
      const d = departments.value.find((x) => x.id === cur);
      if (!d) break;
      names.unshift(d.name);
      cur = d.parentId;
    }
    return names.join(separator) || "未分配";
  };

  /** 取某部门下所有子级 id（含自身） */
  const getDeptSubtreeIds = (deptId: string): Set<string> => {
    const out = new Set<string>([deptId]);
    const stack = [deptId];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const d of departments.value) {
        if (d.parentId === cur && !out.has(d.id)) {
          out.add(d.id);
          stack.push(d.id);
        }
      }
    }
    return out;
  };
  const addLevel = (l: Omit<Level, "id"> & { id?: string }) => {
    const lv: Level = { ...l, id: l.id || uid() };
    levels.value.push(lv);
    levels.value.sort((a, b) => a.order - b.order);
    return lv;
  };
  const updateLevel = (l: Level) => {
    const idx = levels.value.findIndex((x) => x.id === l.id);
    if (idx >= 0) levels.value[idx] = l;
    levels.value.sort((a, b) => a.order - b.order);
  };
  const removeLevel = (id: string) => {
    if (persons.value.some((p) => p.level === id))
      return { ok: false, reason: "该级别下仍有人员" };
    levels.value = levels.value.filter((x) => x.id !== id);
    return { ok: true };
  };

  /* ---------- 交换日志 ---------- */
  const addSwapLog = (log: Omit<SwapLog, "id" | "timestamp">) => {
    swapLogs.value.unshift({
      ...log,
      id: uid(),
      timestamp: Date.now(),
    });
    if (swapLogs.value.length > 200)
      swapLogs.value = swapLogs.value.slice(0, 200);
  };
  const clearSwapLogs = () => {
    swapLogs.value = [];
  };

  /* ---------- 拖拽：座位互换 ---------- */
  const swapSeats = (
    a: { cellId: string; slotIndex: number },
    b: { cellId: string; slotIndex: number },
  ): { ok: boolean; reason?: string } => {
    if (a.cellId === b.cellId && a.slotIndex === b.slotIndex)
      return { ok: false, reason: "源座位与目标座位相同" };
    const seatA = seats.value.find(
      (s) => s.cellId === a.cellId && s.slotIndex === a.slotIndex,
    );
    const seatB = seats.value.find(
      (s) => s.cellId === b.cellId && s.slotIndex === b.slotIndex,
    );
    if (!seatA || !seatB) return { ok: false, reason: "座位不存在" };
    const pidA = seatA.personId;
    const pidB = seatB.personId;
    seatA.personId = pidB;
    seatB.personId = pidA;
    seats.value = [...seats.value];
    if (pidA && pidB) {
      const pa = personMap.value.get(pidA);
      const pb = personMap.value.get(pidB);
      if (pa && pb) {
        const cellA = cells.value.find((c) => c.id === a.cellId);
        const cellB = cells.value.find((c) => c.id === b.cellId);
        addSwapLog({
          type: "swap",
          personAId: pa.id,
          personALabel: pa.name,
          personBId: pb.id,
          personBLabel: pb.name,
          desc: `「${pa.name}」与「${pb.name}」互换座位（行${(cellA?.row ?? 0) + 1}·列${(cellA?.col ?? 0) + 1} ↔ 行${(cellB?.row ?? 0) + 1}·列${(cellB?.col ?? 0) + 1}）`,
        });
      }
    }
    return { ok: true };
  };

  const moveSeatToEmpty = (a: { cellId: string; slotIndex: number }) => {
    const seatA = seats.value.find(
      (s) => s.cellId === a.cellId && s.slotIndex === a.slotIndex,
    );
    if (!seatA) return;
    seatA.personId = undefined;
    seats.value = [...seats.value];
  };

  /**
   * 把人员放置到目标座位。
   * - 目标为空：直接放
   * - 目标有人：弹窗确认替换
   * - 该人员已在别的座位：先清掉原座位（不留空记录，避免误以为"凭空消失"）
   * 返回 ok/是否被替换/原因。
   */
  const placePersonToSeat = (
    personId: string,
    target: { cellId: string; slotIndex: number },
  ): {
    ok: boolean;
    replaced?: boolean;
    reason?: string;
    prevSeat?: { cellId: string; slotIndex: number };
  } => {
    const person = personMap.value.get(personId);
    if (!person) return { ok: false, reason: "人员不存在" };
    // 不参会人员禁止排座
    if (person.status === "absent")
      return { ok: false, reason: "不参会人员不能排座" };
    const targetSeat = seats.value.find(
      (s) => s.cellId === target.cellId && s.slotIndex === target.slotIndex,
    );
    if (!targetSeat) return { ok: false, reason: "目标座位不存在" };
    // 该人员原座位（如有）
    const prevSeat = seats.value.find((s) => s.personId === personId);
    // 目标已有人：仅记录，不直接替换（由调用方弹窗确认后二次调用 replace）
    if (targetSeat.personId && targetSeat.personId !== personId) {
      return { ok: false, reason: "OCCUPIED" };
    }
    if (prevSeat) prevSeat.personId = undefined;
    targetSeat.personId = personId;
    seats.value = [...seats.value];
    return {
      ok: true,
      replaced: false,
      prevSeat: prevSeat
        ? { cellId: prevSeat.cellId, slotIndex: prevSeat.slotIndex }
        : undefined,
    };
  };

  /**
   * 强制替换目标座位上的人员（用于 placePersonToSeat 返回 OCCUPIED 后的二次确认）
   * 老人员会被移到调用方指定的备用位置（由原人员列表暂时保留，本函数只清掉老座位）
   */
  const replaceSeatPerson = (
    personId: string,
    target: { cellId: string; slotIndex: number },
  ): { ok: boolean; reason?: string; evictedPersonId?: string } => {
    const person = personMap.value.get(personId);
    if (!person) return { ok: false, reason: "人员不存在" };
    const targetSeat = seats.value.find(
      (s) => s.cellId === target.cellId && s.slotIndex === target.slotIndex,
    );
    if (!targetSeat) return { ok: false, reason: "目标座位不存在" };
    const evictedPersonId = targetSeat.personId;
    const prevSeat = seats.value.find((s) => s.personId === personId);
    if (prevSeat) prevSeat.personId = undefined;
    targetSeat.personId = personId;
    seats.value = [...seats.value];
    return { ok: true, evictedPersonId };
  };

  const clearAllSeats = () => {
    for (const s of seats.value) s.personId = undefined;
    seats.value = [...seats.value];
  };

  /* ---------- 自动排座 ---------- */
  /**
   * 自动排座主入口
   * 统一采用"行内居中向外"策略：按行分组，行内按中心向外排座。
   * isGuest 标记的人员放到最后；尽量让主方先落座。
   */
  const autoArrange = () => {
    if (persons.value.length === 0)
      return { ok: false, reason: "请先导入或新增人员" };

    // 1. 排序并分流：hosts（参会方）/ guests（宾客方）
    const arrangeable = arrangeablePersons.value;
    const hostPersons = sortPersonsByRank(
      arrangeable.filter((p) => !p.isGuest),
      levelMap.value,
      deptMap.value,
    );
    const guestPersons = sortPersonsByRank(
      arrangeable.filter((p) => p.isGuest),
      levelMap.value,
      deptMap.value,
    );
    if (hostPersons.length === 0 && guestPersons.length === 0)
      return { ok: false, reason: "没有可排座的参会人员（请检查人员状态）" };

    // 2. 收集空座位 + 关联 cell
    const slotInfos: { seat: Seat; cell: Cell }[] = [];
    for (const s of seats.value) {
      if (s.personId) continue;
      const cell = cells.value.find((c) => c.id === s.cellId);
      if (cell && cell.type === "seat") slotInfos.push({ seat: s, cell });
    }
    if (slotInfos.length === 0)
      return { ok: false, reason: "当前没有可用的空座位格" };

    // 行内中间向外：按行分组，行内按中心向外
    // 关键：留白格（cell.type === "empty"）不进入 slotInfos（前面已过滤 cell.type === "seat"），
    // 因此 byRow 里每个 row 数组就是"该行真实可用的座位"（已横向压缩）。
    // 排序用 cell.col（横向视觉位置），然后按 rowCenterOutOrder 套用中心向外索引。
    // 例子：9 列、列 2/列 8 留白 → 7 个有效座位 → 中心向外按 7 个位计算。
    const byRow = new Map<number, { seat: Seat; cell: Cell }[]>();
    for (const info of slotInfos) {
      if (!byRow.has(info.cell.row)) byRow.set(info.cell.row, []);
      byRow.get(info.cell.row)!.push(info);
    }
    const rowKeys = [...byRow.keys()].sort((a, b) => a - b);
    const seatOrder: Seat[] = [];
    for (const r of rowKeys) {
      // 按视觉列号升序排（留白格已不在列中，相当于"横向补齐"）
      const row = byRow
        .get(r)!
        .slice()
        .sort((a, b) => a.cell.col - b.cell.col);
      const order = rowCenterOutOrder(row.length);
      for (const i of order) seatOrder.push(row[i].seat);
    }

    /**
     * 落座：
     *  - 先用主方按"中心向外"的座位顺序填座
     *  - 剩余主方溢出到末尾空位；宾客也按相同顺序填剩余位
     */
    const allPersons = [...hostPersons, ...guestPersons];
    const overflowMessages: string[] = [];
    let seated = 0;
    const fillCount = Math.min(seatOrder.length, allPersons.length);
    for (let i = 0; i < fillCount; i++) {
      seatOrder[i].personId = allPersons[i].id;
      seated++;
    }
    if (allPersons.length > seatOrder.length) {
      overflowMessages.push(
        `还有 ${allPersons.length - seatOrder.length} 人未就座`,
      );
    }

    seats.value = [...seats.value];
    const reason =
      overflowMessages.length > 0 ? overflowMessages.join("；") : undefined;
    return reason
      ? { ok: true as const, count: seated, reason }
      : { ok: true as const, count: seated };
  };

  /**
   * 检测并处理"已就座但不参会"的人员。
   * - 默认操作：仅清空其座位（不让其占用位置）
   * - 不再执行"重新排座"（避免误覆盖其他已就座人员），由 UI 提示用户决定
   * 返回被清空的人员数量
   */
  const freeAbsentSeats = (): { cleared: number; names: string[] } => {
    const cleared: string[] = [];
    const names: string[] = [];
    for (const s of seats.value) {
      if (!s.personId) continue;
      const p = personMap.value.get(s.personId);
      if (p && p.status === "absent") {
        cleared.push(s.personId);
        names.push(p.name);
        s.personId = undefined;
      }
    }
    if (cleared.length > 0) seats.value = [...seats.value];
    return { cleared: cleared.length, names };
  };

  /* ---------- 缩放/平移 ---------- */
  const setZoom = (z: number, focusX?: number, focusY?: number) => {
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
    if (newZoom === zoom.value) return;
    // 围绕焦点缩放
    if (focusX !== undefined && focusY !== undefined && canvasRef.value) {
      const rect = canvasRef.value.getBoundingClientRect();
      const cx = focusX - rect.left;
      const cy = focusY - rect.top;
      const ratio = newZoom / zoom.value;
      panX.value = cx - (cx - panX.value) * ratio;
      panY.value = cy - (cy - panY.value) * ratio;
    }
    zoom.value = newZoom;
  };
  const zoomIn = () => setZoom(zoom.value + ZOOM_STEP);
  const zoomOut = () => setZoom(zoom.value - ZOOM_STEP);
  const resetView = () => {
    zoom.value = 1;
    panX.value = 0;
    panY.value = 0;
  };
  const pan = (dx: number, dy: number) => {
    panX.value += dx;
    panY.value += dy;
  };

  // canvas DOM 引用（用于缩放/平移和导出）
  const canvasRef = ref<HTMLElement | null>(null);

  /* ---------- 清空/重置 ---------- */
  const resetCanvas = () => {
    rows.value = DEFAULT_ROWS;
    cols.value = DEFAULT_COLS;
    initCanvas();
    resetView();
  };

  /* ---------- 持久化 ---------- */
  const persist = debounce(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          rows: rows.value,
          cols: cols.value,
          cells: cells.value,
          seats: seats.value,
          persons: persons.value,
          levels: levels.value,
          departments: departments.value,
          swapLogs: swapLogs.value.slice(0, 50),
        }),
      );
    } catch (err) {
      console.warn("持久化失败", err);
    }
  }, 600);

  const loadFromStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // 尝试加载老版本数据
        const oldRaw = localStorage.getItem("cyn-seat-table-state-v1");
        if (oldRaw) {
          const data = JSON.parse(oldRaw);
          return applySnapshot(data);
        }
        return false;
      }
      const data = JSON.parse(raw);
      return applySnapshot(data);
    } catch (err) {
      console.warn("加载本地数据失败", err);
      return false;
    }
  };

  const applySnapshot = (data: any) => {
    if (!data.rows || !data.cols || !Array.isArray(data.cells)) return false;
    rows.value = data.rows;
    cols.value = data.cols;
    // 兼容老数据：仅保留必要字段，丢弃已废弃的 tableType / tableGroupId
    cells.value = data.cells
      .map((c: any) => ({
        id: c.id,
        row: c.row,
        col: c.col,
        rowSpan: c.rowSpan || 1,
        colSpan: c.colSpan || 1,
        master: c.master !== false,
        masterId: c.masterId,
        text: c.text || "",
        bgColor: c.bgColor || "",
        textColor: c.textColor || "",
        type: c.type || "seat",
      }))
      // 关键：把"超出当前网格"的格子（包括 master 和 slave）一律丢掉。
      // 否则 masterCells 会渲染出 grid 之外的幽灵行/列，污染视图和性能。
      .filter(
        (c: any) =>
          c.row < data.rows &&
          c.col < data.cols &&
          c.row + (c.rowSpan || 1) <= data.rows &&
          c.col + (c.colSpan || 1) <= data.cols,
      );
    // 人员兼容老数据：补充 status 字段，去除老字段 phone/email
    persons.value = (data.persons || []).map((p: any, idx: number) => {
      const next: any = {
        id: p.id,
        name: p.name,
        department: p.department || "",
        level: p.level || "",
        title: p.title || "",
        remark: p.remark || "",
        status: p.status || "attending",
        isGuest: p.isGuest === true,
        order: p.order ?? idx,
      };
      // 兼容旧版字段（如有 phone/email 自动忽略）
      if (p.order !== undefined) next.order = p.order;
      return next;
    });
    seats.value = data.seats || [];
    // 清理孤立座位：标识格/留白格上的座位一律移除
    seats.value = seats.value.filter((s: Seat) => {
      const cell = cells.value.find((c) => c.id === s.cellId);
      return cell && cell.type === "seat";
    });
    levels.value = data.levels?.length
      ? data.levels
      : cloneDeep(DEFAULT_LEVELS);
    departments.value = data.departments?.length
      ? data.departments
      : cloneDeep(DEFAULT_DEPTS);
    swapLogs.value = (data.swapLogs || []).map((l: any) => ({
      id: l.id || uid(),
      timestamp: l.timestamp || Date.now(),
      type: l.type || "swap",
      personAId: l.personAId,
      personALabel: l.personALabel,
      personBId: l.personBId,
      personBLabel: l.personBLabel,
      desc: l.desc || "",
    }));
    return true;
  };

  /**
   * 清理超出当前网格的格子。
   * 老数据 / 历史 bug 残留的 cell-17-5 之类的"幽灵行"会被一次性清理掉。
   * applySnapshot 加载时会自动过滤；这里也暴露成 action 供手动触发。
   */
  const cleanupOutOfBoundsCells = () => {
    const before = cells.value.length;
    cells.value = cells.value.filter(
      (c) =>
        c.row < rows.value &&
        c.col < cols.value &&
        c.row + (c.rowSpan || 1) <= rows.value &&
        c.col + (c.colSpan || 1) <= cols.value,
    );
    // 同步清理指向幽灵 cell 的座位记录
    const validIds = new Set(cells.value.map((c) => c.id));
    seats.value = seats.value.filter((s) => {
      if (!validIds.has(s.cellId)) return false;
      const cell = cells.value.find((c) => c.id === s.cellId);
      return cell && cell.type === "seat";
    });
    const removed = before - cells.value.length;
    if (removed > 0) {
      console.info(`[seat-table] 清理了 ${removed} 个越界格子`);
      rebuildSeats();
      persist();
    }
  };

  // 监听变化自动保存
  watch(
    [rows, cols, cells, seats, persons, levels, departments],
    () => persist(),
    { deep: true },
  );

  /* ---------- 导出/导入 JSON 布局 ---------- */
  const exportLayoutJSON = async () => {
    const snapshot: LayoutSnapshot = {
      rows: rows.value,
      cols: cols.value,
      cells: cloneDeep(cells.value),
      seats: cloneDeep(seats.value),
      version: "2.0",
    };
    const text = JSON.stringify(snapshot, null, 2);
    const filename = `会场布局-${formatTime(Date.now()).slice(0, 10)}.json`;
    return await saveText(text, filename, "导出会场布局", "application/json");
  };

  const importLayoutJSON = async (file: File) => {
    try {
      const text = await file.text();
      const data: LayoutSnapshot = JSON.parse(text);
      if (!data.cells || !Array.isArray(data.cells))
        return { ok: false, reason: "格式错误" };
      rows.value = data.rows;
      cols.value = data.cols;
      cells.value = cloneDeep(
        data.cells.map((c) => ({
          id: c.id,
          row: c.row,
          col: c.col,
          rowSpan: c.rowSpan || 1,
          colSpan: c.colSpan || 1,
          master: c.master !== false,
          masterId: c.masterId,
          text: c.text || "",
          bgColor: c.bgColor || "",
          textColor: c.textColor || "",
          type: c.type || "seat",
        })),
      );
      seats.value = cloneDeep(data.seats || []);
      // 清理非座位格的座位
      seats.value = seats.value.filter((s) => {
        const cell = cells.value.find((c) => c.id === s.cellId);
        return cell && cell.type === "seat";
      });
      return { ok: true };
    } catch (err) {
      console.error(err);
      return { ok: false, reason: "布局文件解析失败" };
    }
  };

  /* ---------- 导入/导出 ----------
   * - 人员/部门/级别等数据：见 useImportExport composable
   * - 布局 JSON：exportLayoutJSON / importLayoutJSON
   * - A4 图片导出 / 打印：见 useSeatTablePrint composable（不在 store 里）
   */

  return {
    /* state */
    rows,
    cols,
    cells,
    seats,
    persons,
    levels,
    departments,
    swapLogs,
    addSwapLog,
    clearSwapLogs,
    zoom,
    panX,
    panY,
    selection,
    canvasRef,
    /* computed */
    cellMap,
    masterCells,
    personMap,
    deptMap,
    levelMap,
    unseatedPersons,
    arrangeablePersons,
    unseatedAttendingCount,
    absentSeatedPersons,
    allPersons,
    sortedPersons,
    sortedDepartments,
    deptTree,
    canMergeSelection,
    /* canvas */
    initCanvas,
    changeRows,
    changeCols,
    resetCanvas,
    swapCells,
    setZoom,
    zoomIn,
    zoomOut,
    resetView,
    pan,
    /* cells */
    mergeSelection,
    splitCell,
    resetSelection,
    startSelection,
    updateSelection,
    endSelection,
    isCellInSelection,
    setSelectionCellType,
    getSelectionMasterCells,
    /* highlight from person list */
    highlightedPersonId,
    getSeatOfPerson,
    highlightPersonSeat,
    setCellType,
    updateCell,
    clearCellContent,
    /* person */
    addPerson,
    updatePerson,
    removePerson,
    clearAllPersons,
    reorderPersons,
    setPersonStatus,
    setPersonsStatus,
    togglePersonStatus,
    setPersonGuest,
    setPersonsGuest,
    togglePersonGuest,
    /* dict */
    addDepartment,
    updateDepartment,
    removeDepartment,
    reorderDepartments,
    collectDescendantIds,
    getDeptFullName,
    getDeptSubtreeIds,
    addLevel,
    updateLevel,
    removeLevel,
    /* seats */
    swapSeats,
    moveSeatToEmpty,
    placePersonToSeat,
    replaceSeatPerson,
    clearAllSeats,
    /* arrange */
    autoArrange,
    freeAbsentSeats,
    /* io */
    exportLayoutJSON,
    importLayoutJSON,
    /* persistence */
    persist,
    loadFromStorage,
    /* 维护 */
    cleanupOutOfBoundsCells,
    /* utils */
    formatTime,
  };
});
