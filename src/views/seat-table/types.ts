/**
 * 会场座位排布 - 共享类型定义
 */

/** 人员出席状态 */
export type PersonStatus = "attending" | "absent";

/** 人员 */
export interface Person {
  id: string;
  name: string;
  department: string; // 部门 id
  level: string; // 级别 id
  title: string; // 职务（正职 / 副职 / 其他）
  remark: string;
  status: PersonStatus; // 参会 / 不参会
  /**
   * 是否为宾客（区别于主桌/参会方）。
   * 在长条桌/四边形会议中：
   *  - 主桌（北/东/西）= 参会人员（isGuest = false）
   *  - 宾桌（南）      = 宾客（isGuest = true）
   * 未设置或 false 均视为主方。
   */
  isGuest?: boolean;
  /**
   * 同部门内的人员顺序权重，数字越小越靠前。
   * 不填时按加入顺序追加。
   */
  order?: number;
}

/** 部门 */
export interface Department {
  id: string;
  name: string;
  /** 上级部门 id（支持多级嵌套） */
  parentId?: string;
  mainTitle: string; // 正职领导称谓
  deputyTitle: string; // 副职领导称谓
  /**
   * 排序权重：数字越小越靠前。
   * 主要用于：自动排座时按部门优先级排布；人员列表按部门排序。
   */
  order?: number;
}

/** 级别 */
export interface Level {
  id: string;
  name: string;
  order: number; // 排序权重：数字越小级别越高
  color: string;
}

/** 单元格 */
export interface Cell {
  id: string;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  master: boolean; // 是否为主单元格
  masterId?: string; // 被覆盖时指向主单元格
  text: string; // 自定义文字
  bgColor: string;
  textColor: string;
  type: CellType;
}

export type CellType = "seat" | "label" | "empty";

/** 座位（cell 内一个子位） */
export interface Seat {
  cellId: string;
  slotIndex: number;
  personId?: string;
}

/** 座位交换日志 */
export interface SwapLog {
  id: string;
  timestamp: number;
  /** 操作类型：swap 互换 / move 移动 / arrange 自动排座 / clear 清空 */
  type: "swap" | "move" | "arrange" | "clear";
  /** 源位置/人员（人员拖动时为拖动源；自动排座时为被排座的人） */
  personAId?: string;
  personALabel?: string;
  /** 目标位置/人员（移动到该位置或被替换的人） */
  personBId?: string;
  personBLabel?: string;
  /** 描述 */
  desc: string;
}

/** 布局快照（用于 JSON 持久化） */
export interface LayoutSnapshot {
  rows: number;
  cols: number;
  cells: Cell[];
  seats: Seat[];
  version: string;
}

/** 自动排座策略 */
export type ArrangeStrategy = "row-center-out" | "auto";

/** 自动排座配置 */
export interface AutoArrangeConfig {
  strategy: ArrangeStrategy;
  /** 是否覆盖已就座人员 */
  override: boolean;
}
