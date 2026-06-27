<script setup lang="ts">
/**
 * 右栏 - 人员列表
 *  顶部：仅显示搜索框，点击筛选图标展开筛选区
 *  全选：右上角图标按钮，悬停显示批量操作下拉
 *  底部：紧凑统计信息（数字）
 *  支持：列表/分组视图、搜索、筛选、批量操作
 */
import {
  ref,
  computed,
  watch,
  h,
  type VNode,
  onMounted,
  onUnmounted,
} from "vue";
import {
  NCard,
  NInput,
  NSelect,
  NButton,
  NEmpty,
  NCheckbox,
  NTooltip,
  NPopover,
  NTree,
  NIconWrapper,
  NDropdown,
  type DropdownOption,
  useDialog,
  useMessage,
  type TreeOption,
} from "naive-ui";
import { storeToRefs } from "pinia";
import { useSeatTableStore } from "../store";
import PersonCard from "./PersonCard.vue";
import type { Person } from "../types";

const emit = defineEmits<{
  (e: "add-person"): void;
  (e: "edit-person", p: Person): void;
}>();

const store = useSeatTableStore();
const dialog = useDialog();
const message = useMessage();
const { persons, seats } = storeToRefs(store);

/* ---------- 筛选状态 ---------- */
const searchText = ref("");
const filterDept = ref("");
const filterLevel = ref("");
const filterStatus = ref<"" | "attending" | "absent" | "seated" | "unseated">(
  "",
);
const filterGuest = ref<"" | "guest" | "host">("");
const selectedIds = ref<Set<string>>(new Set());

/* ---------- 视图状态 ----------
 *  - tree:    全部人员，按部门树状分组（可折叠）
 *  - unseated: 仅显示未排座人员（平铺，不分树）
 */
type ViewMode = "tree" | "unseated";
const viewMode = ref<ViewMode>("tree");
const collapsedDeptIds = ref<Set<string>>(new Set());
const showFilter = ref(false);
const showBatchMenu = ref(false);
/* 多选模式开关：关闭时隐藏勾选框 + 隐藏批量按钮；开启后才显示 */
const multiSelectMode = ref(false);

/* ---------- 派生数据 ---------- */
const seatedIdSet = computed(
  () => new Set(seats.value.map((s) => s.personId).filter(Boolean) as string[]),
);
const sortedAllPersons = computed(() => store.sortedPersons);

const deptOptions = computed(() => [
  { label: "全部部门", value: "" },
  ...store.sortedDepartments.map((d) => ({
    label: store.getDeptFullName(d.id),
    value: d.id,
  })),
]);
const levelOptions = computed(() => [
  { label: "全部级别", value: "" },
  ...store.levels.map((l) => ({ label: l.name, value: l.id })),
]);
const statusOptions = [
  { label: "全部状态", value: "" },
  { label: "参会", value: "attending" },
  { label: "不参会", value: "absent" },
  { label: "已就座", value: "seated" },
  { label: "未就座", value: "unseated" },
];
const guestOptions = [
  { label: "全部身份", value: "" },
  { label: "主方", value: "host" },
  { label: "宾客", value: "guest" },
];

const hasActiveFilter = computed(
  () =>
    !!searchText.value.trim() ||
    !!filterDept.value ||
    !!filterLevel.value ||
    !!filterStatus.value ||
    !!filterGuest.value,
);

const filteredPersons = computed(() => {
  const k = searchText.value.trim();
  let list = sortedAllPersons.value;
  if (filterDept.value) {
    const subtree = store.getDeptSubtreeIds(filterDept.value);
    list = list.filter((p) => p.department && subtree.has(p.department));
  }
  if (filterLevel.value)
    list = list.filter((p) => p.level === filterLevel.value);
  if (filterStatus.value) {
    if (filterStatus.value === "seated") {
      list = list.filter((p) => seatedIdSet.value.has(p.id));
    } else if (filterStatus.value === "unseated") {
      list = list.filter((p) => !seatedIdSet.value.has(p.id));
    } else {
      list = list.filter((p) => p.status === filterStatus.value);
    }
  }
  if (filterGuest.value) {
    if (filterGuest.value === "guest") {
      list = list.filter((p) => p.isGuest === true);
    } else {
      list = list.filter((p) => p.isGuest !== true);
    }
  }
  if (k) {
    list = list.filter(
      (p) =>
        p.name.includes(k) ||
        p.title.includes(k) ||
        (store.deptMap.get(p.department)?.name || "").includes(k) ||
        store.getDeptFullName(p.department).includes(k),
    );
  }
  return list;
});

/* ---------- 部门树（tree 模式使用） ----------
 * 按部门层级构建嵌套树，每个节点持有该部门（及子部门）下的人员。
 *  - parentId 缺失 → 顶级
 *  - 仅渲染"至少含 1 个可见人员"的节点
 */
type DeptTreeNode = {
  id: string;
  name: string;
  fullName: string;
  persons: Person[];
  total: number;
  children: DeptTreeNode[];
};
const deptTree = computed<DeptTreeNode[]>(() => {
  // 把可见人员按部门 id 分桶
  const bucket = new Map<string, Person[]>();
  for (const p of filteredPersons.value) {
    const key = p.department || "__none__";
    if (!bucket.has(key)) bucket.set(key, []);
    bucket.get(key)!.push(p);
  }
  // 递归：构建节点
  const build = (parentId: string | undefined): DeptTreeNode[] => {
    const depts = store.departments
      .filter((d) => (d.parentId || undefined) === parentId)
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    const out: DeptTreeNode[] = [];
    for (const d of depts) {
      const children = build(d.id);
      const ownPersons = bucket.get(d.id) || [];
      const childTotal = children.reduce((s, c) => s + c.total, 0);
      const total = ownPersons.length + childTotal;
      if (total === 0) continue;
      out.push({
        id: d.id,
        name: d.name,
        fullName: store.getDeptFullName(d.id),
        persons: ownPersons,
        total,
        children,
      });
    }
    if (parentId === undefined) {
      const unassigned = bucket.get("__none__");
      if (unassigned && unassigned.length > 0) {
        out.push({
          id: "__none__",
          name: "未分配",
          fullName: "未分配",
          persons: unassigned,
          total: unassigned.length,
          children: [],
        });
      }
    }
    return out;
  };
  return build(undefined);
});

/* ---------- n-tree 数据 ----------
 * 将 DeptTreeNode 转为 n-tree 的 TreeOption[]：
 *  - 部门节点：可展开，children 为子部门 + 人员
 *  - 人员节点：leaf，挂载 person 数据用于自定义渲染
 *  - 用 type 字段区分渲染
 */
type CustomTreeOption = TreeOption & {
  type: "dept" | "person";
  deptNode?: DeptTreeNode;
  person?: Person;
};
const treeData = computed<CustomTreeOption[]>(() => {
  const build = (node: DeptTreeNode): CustomTreeOption[] => {
    const deptOpt: CustomTreeOption = {
      key: `dept:${node.id}`,
      label: node.name,
      type: "dept",
      deptNode: node,
      // 部门可选中（用于批量勾选/级联），但不会触发画布高亮
      children: [
        ...node.children.flatMap(build),
        ...node.persons.map<CustomTreeOption>((p) => ({
          key: `person:${p.id}`,
          label: p.name, // 搜索用
          type: "person",
          person: p,
          isLeaf: true,
          disabled: false,
        })),
      ],
    };
    return [deptOpt];
  };
  return deptTree.value.flatMap(build);
});

/** 展开/收起 同步到 collapsedDeptIds（n-tree 用 key 数组） */
const expandedKeys = computed(() => {
  const allDeptIds = new Set<string>();
  const collect = (nodes: DeptTreeNode[]) => {
    for (const n of nodes) {
      allDeptIds.add(`dept:${n.id}`);
      collect(n.children);
    }
  };
  collect(deptTree.value);
  return [...allDeptIds].filter((k) => {
    const id = k.slice(5);
    return !collapsedDeptIds.value.has(id);
  });
});
const onUpdateExpandedKeys = (keys: Array<string | number>) => {
  const next = new Set<string>();
  const allDeptIds = new Set<string>();
  const collect = (nodes: DeptTreeNode[]) => {
    for (const n of nodes) {
      allDeptIds.add(n.id);
      collect(n.children);
    }
  };
  collect(deptTree.value);
  // 所有部门 id 中，没在 keys 里的就是被收起的
  for (const id of allDeptIds) {
    if (!keys.includes(`dept:${id}`)) next.add(id);
  }
  collapsedDeptIds.value = next;
};

/* ---------- 勾选 / selectedIds 同步 ----------
 * n-tree 的 checked-keys 是 key 数组（部门 key + 人员 key），
 * 用 cascade 时勾选部门会自动勾选子节点；这里只关心人员 key。
 */
const checkedTreeKeys = computed<Array<string | number>>(() => {
  const keys: Array<string | number> = [];
  for (const dept of treeData.value) collectCheckedKeys(dept, keys);
  return keys;
});
const collectCheckedKeys = (
  node: CustomTreeOption | TreeOption,
  out: Array<string | number>,
) => {
  const opt = node as CustomTreeOption;
  if (
    opt.type === "person" &&
    opt.person &&
    selectedIds.value.has(opt.person.id)
  ) {
    out.push(opt.key as string);
  }
  if (opt.children) for (const c of opt.children) collectCheckedKeys(c, out);
};
const onUpdateCheckedKeys = (keys: Array<string | number>) => {
  // 仅从人员 key 反推 selectedIds（部门级勾选由级联自动同步人员 key）
  const next = new Set<string>();
  for (const k of keys) {
    if (typeof k === "string" && k.startsWith("person:")) {
      next.add(k.slice(7));
    }
  }
  selectedIds.value = next;
};

/* ---------- 选中人员时联动高亮画布座位 ----------
 * n-tree 的 selected-keys 用来驱动 NTree 自身的勾选/选中 UI（部门/人员）。
 * 画布的高亮由 store.highlightedPersonId 独立维护：
 *  - 只有当新选中有 person 时才更新高亮
 *  - 选部门 / 清空 / 取消时，保留之前的人员高亮
 */
const localSelectedKeys = ref<Array<string | number>>([]);
const onUpdateSelectedKeys = (keys: Array<string | number>) => {
  localSelectedKeys.value = [...keys];
  // 仅当有 person 被选中时联动画布高亮
  let lastPid: string | null = null;
  for (let i = keys.length - 1; i >= 0; i--) {
    const k = keys[i];
    if (typeof k === "string" && k.startsWith("person:")) {
      lastPid = k.slice(7);
      break;
    }
  }
  if (lastPid) {
    store.highlightPersonSeat(lastPid);
  }
  // 其它情况（只选部门 / 全空）：保留高亮不变
};
const indeterminateTreeKeys = computed<Array<string | number>>(() => {
  // 部门下人员部分被勾选时显示半选
  const result: Array<string | number> = [];
  for (const dept of treeData.value) {
    walkIndeterminate(dept, result);
  }
  return result;
});
const walkIndeterminate = (
  node: CustomTreeOption | TreeOption,
  out: Array<string | number>,
) => {
  const opt = node as CustomTreeOption;
  if (opt.type === "dept" && opt.deptNode) {
    const personIds = collectNodePersonIds(opt.deptNode);
    const sel = personIds.filter((id) => selectedIds.value.has(id));
    if (sel.length > 0 && sel.length < personIds.length) {
      out.push(opt.key as string);
    }
    if (opt.children) for (const c of opt.children) walkIndeterminate(c, out);
  }
};

/* ---------- 树过滤（搜索） ----------
 * - 部门节点：true if 子树里有匹配的人员
 * - 人员节点：true if 命中搜索关键词
 */
const treePattern = ref("");
watch(searchText, (v) => {
  treePattern.value = v.trim();
});
const treeFilter = (pattern: string, node: TreeOption): boolean => {
  if (!pattern) return true;
  const opt = node as CustomTreeOption;
  if (opt.type === "person" && opt.person) {
    return personMatches(opt.person, pattern);
  }
  if (opt.type === "dept" && opt.deptNode) {
    return deptHasMatch(opt.deptNode, pattern);
  }
  return true;
};
function personMatches(p: Person, k: string): boolean {
  return (
    p.name.includes(k) ||
    p.title.includes(k) ||
    (store.deptMap.get(p.department)?.name || "").includes(k) ||
    store.getDeptFullName(p.department).includes(k)
  );
}
function deptHasMatch(node: DeptTreeNode, k: string): boolean {
  for (const p of node.persons) if (personMatches(p, k)) return true;
  for (const c of node.children) if (deptHasMatch(c, k)) return true;
  return false;
}

/** 未排座视图使用的人员列表（扁平） */
const unseatedDisplay = computed(() => {
  return filteredPersons.value.filter((p) => !seatedIdSet.value.has(p.id));
});

/** 当前模式下显示的人员（用于顶部计数 + 空态判断） */
const displayPersons = computed(() => {
  if (viewMode.value === "unseated") return unseatedDisplay.value;
  return filteredPersons.value;
});

/* ---------- 上下移动（tree 视图 compact 模式使用） ----------
 * 让 listForDrag 跟踪 displayPersons，moveUp/moveDown 在过滤后的可见列表内交换。
 * 注意：store.reorderPersons 是基于"全量人员 id 列表"的全序重排。
 */
const listForDrag = ref<Person[]>([]);
watch(
  displayPersons,
  (v) => {
    listForDrag.value = [...v];
  },
  { immediate: true },
);
const handleMoveUp = (p: Person) => {
  const list = listForDrag.value;
  const idx = list.findIndex((x) => x.id === p.id);
  if (idx < 0) {
    message.warning("人员不在当前列表中");
    return;
  }
  if (idx === 0) {
    message.info("「" + p.name + "」已在最顶部");
    return;
  }
  // 跨部门边界：不移动，避免破坏部门分组
  if (list[idx - 1].department !== p.department) {
    message.info(
      "已到部门「" + (store.deptMap.get(p.department)?.name || "") + "」顶部",
    );
    return;
  }
  [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
  listForDrag.value = [...list];
  // 把新顺序写回 store
  const visibleIds = listForDrag.value.map((x) => x.id);
  const storeIds = store.persons.map((x) => x.id);
  const merged = [
    ...visibleIds.filter((id) => storeIds.includes(id)),
    ...storeIds.filter((id) => !visibleIds.includes(id)),
  ];
  store.reorderPersons(merged);
  message.success("「" + p.name + "」已上移");
};
const handleMoveDown = (p: Person) => {
  const list = listForDrag.value;
  const idx = list.findIndex((x) => x.id === p.id);
  if (idx < 0) {
    message.warning("人员不在当前列表中");
    return;
  }
  if (idx >= list.length - 1) {
    message.info("「" + p.name + "」已在最底部");
    return;
  }
  if (list[idx + 1].department !== p.department) {
    message.info(
      "已到部门「" + (store.deptMap.get(p.department)?.name || "") + "」底部",
    );
    return;
  }
  [list[idx + 1], list[idx]] = [list[idx], list[idx + 1]];
  listForDrag.value = [...list];
  const visibleIds = listForDrag.value.map((x) => x.id);
  const storeIds = store.persons.map((x) => x.id);
  const merged = [
    ...visibleIds.filter((id) => storeIds.includes(id)),
    ...storeIds.filter((id) => !visibleIds.includes(id)),
  ];
  store.reorderPersons(merged);
  message.success("「" + p.name + "」已下移");
};

const filteredIds = computed(() => displayPersons.value.map((p) => p.id));
const selectedCount = computed(() => selectedIds.value.size);
const allFilteredSelected = computed(
  () =>
    filteredIds.value.length > 0 &&
    filteredIds.value.every((id) => selectedIds.value.has(id)),
);
const someFilteredSelected = computed(
  () =>
    !allFilteredSelected.value &&
    filteredIds.value.some((id) => selectedIds.value.has(id)),
);

/* ---------- 底部统计 ---------- */
const stats = computed(() => {
  const attending = persons.value.filter(
    (p) => p.status === "attending",
  ).length;
  const absent = persons.value.length - attending;
  const seated = persons.value.filter((p) =>
    seatedIdSet.value.has(p.id),
  ).length;
  const guests = persons.value.filter((p) => p.isGuest === true).length;
  return { attending, absent, seated, guests };
});

/* ---------- 操作 ---------- */
const handleRemove = (p: Person) => {
  dialog.warning({
    title: "删除人员",
    content: `确认删除「${p.name}」？`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: () => {
      store.removePerson(p.id);
      selectedIds.value.delete(p.id);
      message.success("已删除");
    },
  });
};

const handleClearAll = () => {
  if (persons.value.length === 0) {
    message.warning("当前没有人员可清空");
    return;
  }
  const n = persons.value.length;
  const seatedCount = stats.value.seated;
  dialog.warning({
    title: "清空所有人员",
    content: `将删除全部 ${n} 名人员${seatedCount > 0 ? `（含 ${seatedCount} 个已就座）` : ""}。此操作不可撤销，是否继续？`,
    positiveText: "清空",
    negativeText: "取消",
    onPositiveClick: () => {
      const r = store.clearAllPersons();
      selectedIds.value = new Set();
      message.success(
        r.cleared > 0
          ? `已清空 ${n} 名人员（释放 ${r.cleared} 个座位）`
          : `已清空 ${n} 名人员`,
      );
    },
  });
};

const handleResetFilters = () => {
  searchText.value = "";
  filterDept.value = "";
  filterLevel.value = "";
  filterStatus.value = "";
  filterGuest.value = "";
};

const handleToggleSelect = (p: Person, v: boolean) => {
  if (v) selectedIds.value.add(p.id);
  else selectedIds.value.delete(p.id);
  selectedIds.value = new Set(selectedIds.value);
};

const handleToggleAll = (v: boolean) => {
  if (v) {
    for (const id of filteredIds.value) selectedIds.value.add(id);
  } else {
    for (const id of filteredIds.value) selectedIds.value.delete(id);
  }
  selectedIds.value = new Set(selectedIds.value);
  showBatchMenu.value = false;
};

/** 递归收集树节点（含子部门）的所有人员 id（用于半选判断） */
const collectNodePersonIds = (node: DeptTreeNode): string[] => {
  const out = node.persons.map((p) => p.id);
  for (const c of node.children) out.push(...collectNodePersonIds(c));
  return out;
};

const handleToggleStatus = (p: Person) => {
  store.togglePersonStatus(p.id);
};
const handleToggleGuest = (p: Person) => {
  store.togglePersonGuest(p.id);
  message.success(
    p.isGuest ? `已取消「${p.name}」的宾客标记` : `已将「${p.name}」标记为宾客`,
  );
};

const handleBatchSetStatus = (status: "attending" | "absent") => {
  if (selectedCount.value === 0) {
    message.warning("请先选择人员");
    return;
  }
  store.setPersonsStatus([...selectedIds.value], status);
  message.success(
    `已将 ${selectedCount.value} 名人员标记为${status === "attending" ? "参会" : "不参会"}`,
  );
  showBatchMenu.value = false;
};

const handleBatchSetGuest = (isGuest: boolean) => {
  if (selectedCount.value === 0) {
    message.warning("请先选择人员");
    return;
  }
  store.setPersonsGuest([...selectedIds.value], isGuest);
  message.success(
    `已将 ${selectedCount.value} 名人员${isGuest ? "标记为宾客" : "取消宾客标记"}`,
  );
  showBatchMenu.value = false;
};

const handleClearSelection = () => {
  selectedIds.value = new Set();
  showBatchMenu.value = false;
};

/* 切换多选模式：关闭时清空已选项 */
const toggleMultiSelect = () => {
  multiSelectMode.value = !multiSelectMode.value;
  if (!multiSelectMode.value) {
    selectedIds.value = new Set();
    showBatchMenu.value = false;
  }
};

/* 点击外部区域关闭批量下拉菜单 */
const onPageClickAway = (e: MouseEvent) => {
  if (!showBatchMenu.value) return;
  const target = e.target as HTMLElement | null;
  if (!target) return;
  if (target.closest(".batch-menu")) return; // 点击菜单内不关
  if (target.closest(".batch-trigger-btn")) return; // 点击触发按钮不关（按钮自己会 toggle）
  showBatchMenu.value = false;
};
onMounted(() => {
  document.addEventListener("mousedown", onPageClickAway);
});
onUnmounted(() => {
  document.removeEventListener("mousedown", onPageClickAway);
});

/* ---------- 从画布座位拖出人员到列表 ---------- */
const onListDragOver = (e: DragEvent) => {
  e.preventDefault();
};
const handleDropToList = (e: DragEvent) => {
  e.preventDefault();
  const json = e.dataTransfer?.getData("application/json");
  if (json) {
    try {
      const info = JSON.parse(json);
      if (info?.fromCellId !== undefined) {
        store.moveSeatToEmpty({
          cellId: info.fromCellId,
          slotIndex: info.fromSlot,
        });
        message.info("已将人员移出座位");
      }
    } catch {}
  }
};

const isSeated = (p: Person) => seatedIdSet.value.has(p.id);

/* ---------- n-tree 自定义渲染 ---------- */
const getLevelColor = (levelId: string) =>
  store.levelMap.get(levelId)?.color || "#7d7d7d";

/**
 * 部门不再显示前缀图标（按用户要求"部门栏就不要图标了"）。
 * 人员节点：
 *   - 多选模式开启时：前缀第一位是 checkbox
 *   - 否则：仅显示色条
 */
const renderTreePrefix = ({ option }: { option: TreeOption }) => {
  const opt = option as CustomTreeOption;
  if (opt.type === "dept") {
    // 部门节点不显示图标
    return null;
  }
  if (!opt.person) return null;
  const color = getLevelColor(opt.person.level);
  const children: VNode[] = [];
  // 多选模式：渲染 checkbox
  if (multiSelectMode.value) {
    children.push(
      h(NCheckbox, {
        size: "small",
        checked: selectedIds.value.has(opt.person.id),
        onUpdateChecked: (v: boolean) => handleToggleSelect(opt.person!, v),
        onClick: (e: MouseEvent) => e.stopPropagation(),
      }),
    );
  }
  children.push(
    h("span", {
      class: "tree-person-color",
      style: { background: color },
    }),
  );
  return h("span", { class: "tree-person-prefix" }, children);
};

/**
 * 部门后缀：显示总人数。
 * 人员后缀：仅显示"上移/下移"两个小按钮
 *
 * 用 NButton + @mousedown.stop + @click，跟 PersonCard 里的按钮同款套路。
 * 不参会时按钮 disabled。
 */
const renderTreeSuffix = ({ option }: { option: TreeOption }) => {
  const opt = option as CustomTreeOption;
  if (opt.type === "dept" && opt.deptNode) {
    return h("span", { class: "tree-suffix-count" }, `${opt.deptNode.total}`);
  }
  if (opt.type === "person" && opt.person) {
    const p = opt.person;
    return h("span", { class: "tree-suffix-person" }, [
      h(
        NButton,
        {
          size: "tiny",
          quaternary: true,
          circle: true,
          title: "上移",
          onMousedown: (e: MouseEvent) => e.stopPropagation(),
          onClick: (e: MouseEvent) => {
            e.stopPropagation();
            handleMoveUp(p);
          },
        },
        { default: () => h("i", { class: "ri-arrow-up-s-line" }) },
      ),
      h(
        NButton,
        {
          size: "tiny",
          quaternary: true,
          circle: true,
          title: "下移",
          onMousedown: (e: MouseEvent) => e.stopPropagation(),
          onClick: (e: MouseEvent) => {
            e.stopPropagation();
            handleMoveDown(p);
          },
        },
        { default: () => h("i", { class: "ri-arrow-down-s-line" }) },
      ),
    ]);
  }
  return null;
};

const renderTreeLabel = ({ option }: { option: TreeOption }) => {
  const opt = option as CustomTreeOption;
  if (opt.type === "dept" && opt.deptNode) {
    return h(
      "span",
      {
        class: "tree-label-dept",
        title: opt.deptNode.fullName,
      },
      opt.deptNode.name,
    );
  }
  if (opt.type === "person" && opt.person) {
    return h(PersonCard, {
      person: opt.person,
      seated: isSeated(opt.person),
      selectable: false,
      compact: true,
      onEdit: (p: Person) => emit("edit-person", p),
      onRemove: (p: Person) => handleRemove(p),
      onToggleStatus: (p: Person) => handleToggleStatus(p),
      onToggleGuest: (p: Person) => handleToggleGuest(p),
    });
  }
  return null;
};

/** 给节点附加 class，方便 CSS 区分部门/人员节点的视觉 */
const nodeProps = (info: { option: TreeOption }) => {
  const opt = info.option as CustomTreeOption;
  if (opt.type === "person" && opt.person) {
    return {
      class: "person-node",
      onContextmenu: (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        personCtxMenu.value = {
          show: true,
          x: e.clientX,
          y: e.clientY,
          person: opt.person!,
        };
      },
    };
  }
  return {
    class: opt.type === "dept" ? "dept-node" : "",
  };
};

/* ---------- 人员右键菜单 ---------- */
const personCtxMenu = ref<{
  show: boolean;
  x: number;
  y: number;
  person: Person;
}>({ show: false, x: 0, y: 0, person: {} as Person });
const personCtxOptions = computed<DropdownOption[]>(() => {
  const p = personCtxMenu.value.person;
  if (!p || !p.id) return [];
  const isAbsent = p.status === "absent";
  const isGuest = p.isGuest === true;
  return [
    { label: "编辑人员", key: "edit" },
    { type: "divider", key: "d1" },
    { label: "上移", key: "move-up" },
    { label: "下移", key: "move-down" },
    { type: "divider", key: "d2" },
    {
      label: isAbsent ? "标记为参会" : "标记为不参会",
      key: "toggle-status",
    },
    { type: "divider", key: "d3" },
    {
      label: isGuest ? "取消宾客（设为主方）" : "标记为宾客",
      key: "toggle-guest",
    },
  ];
});
const onPersonCtxSelect = (key: string) => {
  const p = personCtxMenu.value.person;
  if (!p || !p.id) return;
  if (key === "edit") emit("edit-person", p);
  else if (key === "move-up") handleMoveUp(p);
  else if (key === "move-down") handleMoveDown(p);
  else if (key === "toggle-status") handleToggleStatus(p);
  else if (key === "toggle-guest") handleToggleGuest(p);
  personCtxMenu.value.show = false;
};
const onPersonCtxClickoutside = () => {
  personCtxMenu.value.show = false;
};
</script>

<template>
  <div class="sidebar-wrap">
    <!-- 人员右键菜单 -->
    <n-dropdown
      :show="personCtxMenu.show"
      :options="personCtxOptions"
      :x="personCtxMenu.x"
      :y="personCtxMenu.y"
      placement="bottom-start"
      trigger="manual"
      @select="onPersonCtxSelect"
      @clickoutside="onPersonCtxClickoutside"
    />
    <n-card
      :bordered="false"
      size="small"
      class="sidebar-card"
      content-class="sidebar-content"
    >
      <template #header>
        <div class="card-header">
          <i class="ri-team-line"></i>
          <span>人员列表</span>
          <span class="count-pill">{{ displayPersons.length }}</span>
          <span class="total-pill" v-if="hasActiveFilter"
            >/ {{ persons.length }}</span
          >
          <span
            v-if="viewMode === 'unseated'"
            class="mode-tag"
            title="当前仅显示未排座人员"
            >未排座</span
          >
        </div>
      </template>
      <template #header-extra>
        <n-popover
          v-if="multiSelectMode"
          v-model:show="showBatchMenu"
          trigger="manual"
          placement="bottom-end"
          :show-arrow="false"
          :keep-alive-on-hover="false"
          style="padding: 0"
          :duration="100"
        >
          <template #trigger>
            <n-button
              class="batch-trigger-btn"
              size="tiny"
              quaternary
              :type="selectedCount > 0 ? 'primary' : 'default'"
              @click="showBatchMenu = !showBatchMenu"
            >
              <i class="ri-checkbox-multiple-line"></i>
              <span v-if="selectedCount > 0" class="batch-badge">{{
                selectedCount
              }}</span>
            </n-button>
          </template>
          <div class="batch-menu">
            <div class="batch-menu-header">
              <n-checkbox
                :checked="allFilteredSelected"
                :indeterminate="someFilteredSelected"
                @update:checked="handleToggleAll"
                :disabled="filteredIds.length === 0"
              >
                <span class="batch-menu-title">
                  {{ allFilteredSelected ? "取消全选" : "全选当前列表" }}
                  <span v-if="filteredIds.length > 0" class="batch-menu-count">
                    ({{ filteredIds.length }})
                  </span>
                </span>
              </n-checkbox>
            </div>
            <div class="batch-menu-divider"></div>
            <div
              class="batch-menu-item"
              :class="{ disabled: selectedCount === 0 }"
              @click="handleBatchSetStatus('attending')"
            >
              <i class="ri-checkbox-circle-line"></i> 标记为参会
            </div>
            <div
              class="batch-menu-item"
              :class="{ disabled: selectedCount === 0 }"
              @click="handleBatchSetStatus('absent')"
            >
              <i class="ri-close-circle-line"></i> 标记为不参会
            </div>
            <div
              class="batch-menu-item"
              :class="{ disabled: selectedCount === 0 }"
              @click="handleBatchSetGuest(true)"
            >
              <i class="ri-vip-crown-line"></i> 标记为宾客
            </div>
            <div
              class="batch-menu-item"
              :class="{ disabled: selectedCount === 0 }"
              @click="handleBatchSetGuest(false)"
            >
              <i class="ri-user-line"></i> 取消宾客标记
            </div>
            <div class="batch-menu-divider"></div>
            <div
              class="batch-menu-item batch-menu-danger"
              @click="handleClearSelection"
            >
              <i class="ri-close-line"></i> 清除选择
            </div>
          </div>
        </n-popover>
      </template>

      <!-- 顶部：搜索 + 筛选切换 + 视图切换 + 新增 -->
      <div class="top-row">
        <n-input
          v-model:value="searchText"
          size="small"
          placeholder="搜索姓名/职务/部门"
          clearable
        >
          <template #prefix><i class="ri-search-line"></i></template>
        </n-input>
        <n-tooltip>
          <template #trigger>
            <n-button
              size="small"
              :type="hasActiveFilter || showFilter ? 'primary' : 'default'"
              quaternary
              @click="showFilter = !showFilter"
            >
              <i class="ri-filter-3-line"></i>
              <n-icon-wrapper v-if="hasActiveFilter" class="dot-badge" />
            </n-button>
          </template>
          筛选
        </n-tooltip>
        <n-tooltip>
          <template #trigger>
            <n-button
              size="small"
              quaternary
              :type="viewMode === 'unseated' ? 'primary' : 'default'"
              @click="viewMode = viewMode === 'unseated' ? 'tree' : 'unseated'"
            >
              <i
                :class="
                  viewMode === 'tree'
                    ? 'ri-user-unfollow-line'
                    : 'ri-folders-line'
                "
              ></i>
            </n-button>
          </template>
          {{
            viewMode === "tree"
              ? "切换：仅看未排座人员（平铺）"
              : "切换：全部人员（按部门树状分组）"
          }}
        </n-tooltip>
        <n-tooltip>
          <template #trigger>
            <n-button
              size="small"
              quaternary
              :type="multiSelectMode ? 'primary' : 'default'"
              @click="toggleMultiSelect"
            >
              <i class="ri-checkbox-multiple-line"></i>
            </n-button>
          </template>
          {{ multiSelectMode ? "关闭多选" : "开启多选" }}
        </n-tooltip>
        <n-button size="small" type="primary" @click="emit('add-person')">
          <i class="ri-user-add-line"></i>
        </n-button>
      </div>

      <!-- 筛选区（默认折叠） -->
      <div v-show="showFilter" class="filter-section">
        <div class="filter-bar">
          <n-select
            v-model:value="filterDept"
            :options="deptOptions"
            size="tiny"
            placeholder="部门"
          />
          <n-select
            v-model:value="filterLevel"
            :options="levelOptions"
            size="tiny"
            placeholder="级别"
          />
          <n-select
            v-model:value="filterStatus"
            :options="statusOptions"
            size="tiny"
            placeholder="状态"
          />
          <n-select
            v-model:value="filterGuest"
            :options="guestOptions"
            size="tiny"
            placeholder="主方/宾客"
          />
          <n-button
            v-if="hasActiveFilter"
            size="tiny"
            quaternary
            block
            @click="handleResetFilters"
          >
            <template #icon><i class="ri-refresh-line"></i></template>
            重置筛选
          </n-button>
        </div>
      </div>

      <!-- 人员列表 -->
      <div
        class="person-list"
        @dragover="onListDragOver"
        @drop="handleDropToList"
      >
        <!-- 模式 A：未排座（平铺，无拖拽排序；卡片整体可拖到画布指定位置） -->
        <div v-if="viewMode === 'unseated'" class="draggable-list-wrap">
          <div v-if="displayPersons.length > 0" class="draggable-list">
            <PersonCard
              v-for="p in displayPersons"
              :key="p.id"
              :person="p"
              :selectable="multiSelectMode"
              :selected="selectedIds.has(p.id)"
              :seated="isSeated(p)"
              @edit="(p) => emit('edit-person', p)"
              @remove="handleRemove"
              @toggle-select="handleToggleSelect"
              @toggle-status="handleToggleStatus"
              @toggle-guest="handleToggleGuest"
            />
          </div>
          <n-empty
            v-else
            size="small"
            :description="
              persons.length === 0
                ? '暂无人员，请先导入或新增'
                : '所有人员均已排座 🎉'
            "
            class="tree-empty"
          />
        </div>

        <!-- 模式 B：全部人员，按部门树状分组（n-tree） -->
        <div v-else class="dept-tree-wrap">
          <n-tree
            v-if="treeData.length > 0"
            :data="treeData"
            :pattern="treePattern"
            :filter="treeFilter"
            :expanded-keys="expandedKeys"
            :checked-keys="checkedTreeKeys"
            :selected-keys="localSelectedKeys"
            :indeterminate-keys="indeterminateTreeKeys"
            :checkable="false"
            block-line
            selectable
            virtual-scroll
            :show-irrelevant-nodes="false"
            :render-label="renderTreeLabel"
            :render-prefix="renderTreePrefix"
            :render-suffix="renderTreeSuffix"
            :node-props="nodeProps"
            @update:expanded-keys="onUpdateExpandedKeys"
            @update:checked-keys="onUpdateCheckedKeys"
            @update:selected-keys="onUpdateSelectedKeys"
            class="person-tree"
          />
          <n-empty
            v-else
            size="small"
            :description="
              persons.length === 0
                ? '暂无人员，请先导入或新增'
                : '无符合筛选条件的人员'
            "
            class="tree-empty"
          />
        </div>
      </div>

      <!-- 底部：紧凑统计 + 清空按钮 -->
      <div class="footer-bar">
        <div class="footer-stats">
          <span>参会</span>
          <span
            class="footer-num"
            :class="{ 'is-zero': stats.attending === 0 }"
          >
            {{ stats.attending }}
          </span>
          <span class="footer-stat-sep">|</span>
          <span>不参</span>
          <span class="footer-num" :class="{ 'is-zero': stats.absent === 0 }">
            {{ stats.absent }}
          </span>
          <span class="footer-stat-sep">|</span>
          <span>就座</span>
          <span class="footer-num" :class="{ 'is-zero': stats.seated === 0 }">
            {{ stats.seated }}
          </span>
          <template v-if="stats.guests > 0">
            <span class="footer-stat-sep">|</span>
            <span>宾客</span>
            <span class="footer-num footer-num-guest">{{ stats.guests }}</span>
          </template>
        </div>
        <n-button
          size="tiny"
          quaternary
          type="error"
          :disabled="persons.length === 0"
          @click="handleClearAll"
        >
          清空
        </n-button>
      </div>
    </n-card>
  </div>
</template>

<style scoped>
.sidebar-wrap {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.sidebar-card {
  background: var(--paper);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--line);
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.sidebar-card :deep(.n-card) {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.sidebar-card :deep(.n-card__content).sidebar-content,
.sidebar-card :deep(.sidebar-content) {
  padding: 10px 12px 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: 8px;
  min-height: 0;
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
.count-pill {
  margin-left: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  min-width: 18px;
  padding: 0 6px;
  border-radius: 9px;
  background: var(--gold);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}
.total-pill {
  font-size: 11px;
  color: #8c8c8c;
  font-weight: 500;
}
.mode-tag {
  margin-left: 4px;
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 6px;
  font-size: 10px;
  font-weight: 600;
  color: #b3590b;
  background: #fff3dc;
  border: 1px solid #f0d597;
  border-radius: 8px;
  letter-spacing: 0.5px;
}

/* 顶部行：搜索 + 筛选 + 视图 + 新增 */
.top-row {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-shrink: 0;
}
.top-row :deep(.n-input) {
  flex: 1;
  min-width: 0;
}
.top-row :deep(.n-button) {
  flex-shrink: 0;
}
.dot-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
  display: block;
}
.batch-badge {
  margin-left: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 14px;
  padding: 0 4px;
  border-radius: 7px;
  background: var(--gold-deep);
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  box-shadow: 0 0 0 1.5px #fff;
}

/* 批量操作下拉 */
.batch-menu {
  min-width: 180px;
  padding: 4px 0;
}
.batch-menu-header {
  padding: 4px 12px;
  font-size: 12px;
}
.batch-menu-title {
  color: var(--ink);
  font-weight: 500;
}
.batch-menu-count {
  color: #8c8c8c;
  font-size: 11px;
  margin-left: 4px;
}
.batch-menu-divider {
  height: 1px;
  background: var(--line);
  margin: 4px 0;
}
.batch-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  font-size: 12px;
  color: var(--ink);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s;
}
.batch-menu-item:hover:not(.disabled) {
  background: rgba(201, 168, 108, 0.1);
}
.batch-menu-item.disabled {
  color: #c8c2b3;
  cursor: not-allowed;
}
.batch-menu-item i {
  font-size: 13px;
  color: var(--gold-deep);
  width: 14px;
  text-align: center;
}
.batch-menu-item.disabled i {
  color: #c8c2b3;
}
.batch-menu-danger {
  color: #d03050;
}
.batch-menu-danger i {
  color: #d03050;
}

/* 筛选区（默认折叠） */
.filter-section {
  flex-shrink: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #faf8f4;
  overflow: hidden;
}
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: #fff;
}

/* 人员列表 */
.person-list {
  flex: 1;
  overflow-y: auto;
  padding-right: 2px;
  min-height: 60px;
}
.draggable-list-wrap {
  min-height: 60px;
  display: flex;
  flex-direction: column;
}
.draggable-list {
  min-height: 60px;
}
.drag-ghost {
  opacity: 0.4;
  background: var(--gold) !important;
  color: #fff !important;
}
.drag-chosen {
  cursor: grabbing !important;
}
.drag-active {
  cursor: grabbing !important;
  z-index: 1000;
}

/* 部门树视图（n-tree） */
.dept-tree-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}
.tree-empty {
  padding: 24px 0;
}
.dept-tree-wrap::before {
  /* 顶部柔和分隔线 */
  content: "";
  position: absolute;
  top: 0;
  left: 8px;
  right: 8px;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--line) 50%,
    transparent 100%
  );
  pointer-events: none;
}
.person-tree {
  flex: 1;
  --n-node-color: var(--ink);
  --n-node-color-hover: var(--ink);
  --n-node-text-color: var(--ink);
  /* 关键：n-tree 的层级缩进 = 内部 indent divs 的宽度（每个 level 一个 div）。
   * 默认 18px，部门多的话缩进爆炸。直接设 0，靠 switcher ▶ 和背景色区分层级。 */
  --n-indent: 0;
  font-size: 12px;
}
/* ===== 节点行基础 ===== */
.person-tree :deep(.n-tree-node-content) {
  padding: 3px 6px 3px 4px;
  border-radius: 6px;
  margin: 1px 4px;
  height: auto;
  min-height: 26px;
  transition:
    background 0.14s,
    box-shadow 0.14s;
}
.person-tree :deep(.n-tree-node-content .n-tree-node-content__text) {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  gap: 4px;
}
/* 节点 hover */
.person-tree :deep(.n-tree-node-content:hover) {
  background: rgba(201, 168, 108, 0.08) !important;
}
/* 节点 selected */
.person-tree :deep(.n-tree-node-content--selected) {
  background: rgba(201, 168, 108, 0.16) !important;
  box-shadow: inset 0 0 0 1px rgba(201, 168, 108, 0.3);
}
/* ===== 部门节点（更突出） ===== */
.person-tree :deep(.n-tree-node-content.dept-node) {
  background: linear-gradient(
    90deg,
    rgba(245, 239, 226, 0.65) 0%,
    rgba(245, 239, 226, 0.2) 100%
  );
  border-left: 2px solid var(--gold);
}
.person-tree :deep(.n-tree-node-content.dept-node:hover) {
  background: linear-gradient(
    90deg,
    rgba(232, 220, 184, 0.7) 0%,
    rgba(232, 220, 184, 0.25) 100%
  ) !important;
  border-left-color: var(--gold-deep);
}
.person-tree
  :deep(.n-tree-node-content.dept-node.n-tree-node-content--selected) {
  background: linear-gradient(
    90deg,
    rgba(218, 199, 142, 0.55) 0%,
    rgba(218, 199, 142, 0.2) 100%
  ) !important;
  border-left-color: var(--gold-deep);
  box-shadow: inset 0 0 0 1px rgba(184, 149, 85, 0.35);
}
/* ===== 人员节点（紧凑） ===== */
.person-tree :deep(.n-tree-node-content.person-node) {
  /* 取消额外的左 padding，让人员节点和部门缩进对齐 */
  padding-left: 2px;
}
.person-tree :deep(.n-tree-node-content.person-node:hover) {
  background: rgba(82, 196, 26, 0.05) !important;
}
.person-tree
  :deep(.n-tree-node-content.person-node.n-tree-node-content--selected) {
  background: rgba(82, 196, 26, 0.1) !important;
  box-shadow: inset 0 0 0 1px rgba(82, 196, 26, 0.3);
}

/* 展开/折叠箭头 */
.person-tree :deep(.n-tree-node-switcher) {
  width: 18px;
  height: 18px;
}
/* 复选框 */
.person-tree :deep(.n-tree-node-checkbox) {
  margin-right: 4px;
}
/* ===== 前缀图标 ===== */
.tree-prefix-icon {
  font-size: 14px;
  color: var(--gold-deep);
  margin-right: 2px;
  flex-shrink: 0;
  transition: color 0.15s;
}
.person-tree :deep(.n-tree-node-content.dept-node) .tree-prefix-icon {
  color: #8a6a1c;
}
.person-tree :deep(.n-tree-node-content.person-node) .tree-prefix-icon,
.tree-person-color {
  margin-right: 4px;
}
/* ===== 人员前缀容器（多选 checkbox + 色条） ===== */
.tree-person-prefix {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-right: 4px;
}
.tree-person-color {
  display: inline-block;
  width: 3px;
  height: 14px;
  border-radius: 2px;
  flex-shrink: 0;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.08);
}
/* ===== 部门文本 ===== */
.tree-label-dept {
  font-weight: 600;
  font-size: 12.5px;
  color: #4a3a14;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  letter-spacing: 0.2px;
}
/* ===== 计数徽标 ===== */
.tree-suffix-count {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: #6b4a13;
  background: #fff;
  border: 1px solid #d8c997;
  border-radius: 9px;
  padding: 0 6px;
  height: 16px;
  min-width: 20px;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 4px;
  font-weight: 600;
  box-shadow: 0 1px 1px rgba(120, 100, 60, 0.06);
}
/* 部门节点 selected 状态下的徽标 */
.person-tree
  :deep(.n-tree-node-content.dept-node.n-tree-node-content--selected)
  .tree-suffix-count {
  background: var(--gold-deep);
  color: #fff;
  border-color: var(--gold-deep);
}
/* ===== 状态徽标（参会/不参会） ===== */
.tree-suffix-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 10px;
  margin-left: 4px;
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
  transition: transform 0.15s;
}
.tree-suffix-status i {
  line-height: 1;
  font-weight: 700;
}
.tree-suffix-status.is-attending {
  color: #fff;
  background: #52c41a;
  border: 1px solid #389e0d;
}
.tree-suffix-status.is-attending i {
  color: #fff;
}
.tree-suffix-status.is-absent {
  color: #fff;
  background: #bfbfbf;
  border: 1px solid #8c8c8c;
}
.tree-suffix-status.is-absent i {
  color: #fff;
}
.tree-suffix-status:hover {
  transform: scale(1.15);
}

/* ===== 宾客徽标 ===== */
.tree-suffix-guest {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 10px;
  margin-left: 4px;
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
  color: #b3590b;
  background: linear-gradient(135deg, #fff3dc, #ffe1a8);
  border: 1px solid #f0d597;
  transition: transform 0.15s;
}
.tree-suffix-guest i {
  line-height: 1;
}
.tree-suffix-guest:hover {
  transform: scale(1.15);
}
/* ===== 人员后缀容器：仅上下移动按钮（左右分） ===== */
.tree-suffix-person {
  display: inline-flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 4px;
  white-space: nowrap;
  /* 确保不被 n-tree 的内部样式覆盖 */
  vertical-align: middle;
}

/* 底部：紧凑统计 + 清空 */
.footer-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 4px 2px;
  border-top: 1px dashed var(--line);
  font-size: 11px;
  color: #8c8c8c;
  user-select: none;
}
.footer-stats {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  flex-wrap: nowrap;
  white-space: nowrap;
  overflow: hidden;
}
.footer-num {
  color: var(--ink);
  font-weight: 600;
  font-size: 12px;
  font-family: "Consolas", monospace;
  margin-right: 2px;
}
.footer-num.is-zero {
  color: #c8c2b3;
  font-weight: 500;
}
.footer-num-guest {
  color: var(--gold-deep);
}
.footer-stat-sep {
  color: #d8d2c4;
  margin: 0 3px;
  user-select: none;
}
</style>
