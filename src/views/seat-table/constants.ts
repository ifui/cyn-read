/**
 * 会场座位排布 - 默认数据与常量
 */
import type { Level, Department } from "./types";

export const STORAGE_KEY = "cyn-seat-table-state-v2";

/** 默认级别（按权重升序，数字越小级别越高） */
export const DEFAULT_LEVELS: Level[] = [
  { id: "lv-1", name: "正厅级", order: 1, color: "#c0392b" },
  { id: "lv-2", name: "副厅级", order: 2, color: "#d35400" },
  { id: "lv-3", name: "正处级", order: 3, color: "#b8860b" },
  { id: "lv-4", name: "副处级", order: 4, color: "#2c7a7b" },
  { id: "lv-5", name: "正科级", order: 5, color: "#5b6c8f" },
  { id: "lv-6", name: "科员", order: 6, color: "#7d7d7d" },
];

/** 默认部门（业务规则：1 正职 + 多副职，支持多级嵌套） */
export const DEFAULT_DEPTS: Department[] = [
  {
    id: "dept-1",
    name: "办公室",
    mainTitle: "主任",
    deputyTitle: "副主任",
    order: 1,
  },
  {
    id: "dept-1-1",
    parentId: "dept-1",
    name: "秘书科",
    mainTitle: "科长",
    deputyTitle: "副科长",
    order: 0,
  },
  {
    id: "dept-1-2",
    parentId: "dept-1",
    name: "行政科",
    mainTitle: "科长",
    deputyTitle: "副科长",
    order: 1,
  },
  {
    id: "dept-2",
    name: "人事处",
    mainTitle: "处长",
    deputyTitle: "副处长",
    order: 2,
  },
  {
    id: "dept-3",
    name: "财务处",
    mainTitle: "处长",
    deputyTitle: "副处长",
    order: 3,
  },
  {
    id: "dept-3-1",
    parentId: "dept-3",
    name: "预算科",
    mainTitle: "科长",
    deputyTitle: "副科长",
    order: 0,
  },
  {
    id: "dept-4",
    name: "业务一处",
    mainTitle: "处长",
    deputyTitle: "副处长",
    order: 4,
  },
  {
    id: "dept-5",
    name: "业务二处",
    mainTitle: "处长",
    deputyTitle: "副处长",
    order: 5,
  },
];

/** 默认画布尺寸 */
export const DEFAULT_ROWS = 10;
export const DEFAULT_COLS = 14;
export const MIN_DIM = 2;
export const MAX_DIM = 40;

/** 单元格尺寸（px） */
export const CELL_W = 76;
export const CELL_H = 64;

/** 缩放范围 */
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.1;
