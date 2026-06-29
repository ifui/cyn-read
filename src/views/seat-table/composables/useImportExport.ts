/**
 * 导入/导出相关 composable
 * 注意：fileInputRef / jsonInputRef 在模块级共享，保证不同组件调用
 * useImportExport() 时拿到的是同一组 ref（避免 triggerExcelImport 触发空 ref）
 */
import { ref } from "vue";
import { useMessage } from "naive-ui";
import { utils, read, write } from "xlsx";
import { useSeatTableStore } from "../store";
import { saveBlob } from "@/utils/saveFile";
import type { Level, PersonStatus } from "../types";

const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** 状态字段归一化：支持"参会 / 不参会 / 出席 / 缺席 / 1 / 0 / true / false"等 */
const normalizeStatus = (raw: any): PersonStatus => {
  const v = String(raw ?? "").trim();
  if (!v) return "attending";
  if (/否|不参|缺席|请假|不在|缺|absent|false|0|no|否到/i.test(v))
    return "absent";
  return "attending";
};

/**
 * 解析层级部门名（如 "办公室/秘书科"），自动建出中间父级并返回最末级 id。
 * 分隔符支持："/" "／" ">" "->" "—"
 */
const ensureDeptPath = (
  store: ReturnType<typeof useSeatTableStore>,
  path: string,
): string => {
  const cleaned = String(path || "").trim();
  if (!cleaned) return "";
  const parts = cleaned
    .split(/[\/／>\->—]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  let parentId: string | undefined;
  let leafId = "";
  for (const name of parts) {
    let node = store.departments.find(
      (d) => d.name === name && d.parentId === parentId,
    );
    if (!node) {
      // 退化：同名但 parent 不一致时也允许重用
      node = store.departments.find(
        (d) => d.name === name && (d.parentId || "") === (parentId || ""),
      );
    }
    if (!node) {
      // 创建新部门
      const created = store.addDepartment({
        name,
        parentId,
        mainTitle: "正职",
        deputyTitle: "副职",
      });
      node = created;
    }
    parentId = node.id;
    leafId = node.id;
  }
  return leafId;
};

/* ---------- 模块级共享的 input 引用 ----------
 * 多次调用 useImportExport() 时，拿到的是同一组 ref。
 * 真实 DOM 在 index.vue 中渲染：ref="fileInputRef" / ref="jsonInputRef"
 */
const fileInputRef = ref<HTMLInputElement | null>(null);
const jsonInputRef = ref<HTMLInputElement | null>(null);

export function useImportExport() {
  const store = useSeatTableStore();
  const message = useMessage();

  const triggerExcelImport = () => {
    if (!fileInputRef.value) {
      // 兜底：动态创建一个 input
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".xlsx,.xls";
      input.style.display = "none";
      input.addEventListener("change", (e) => onExcelFile(e));
      document.body.appendChild(input);
      fileInputRef.value = input;
    }
    fileInputRef.value.click();
  };
  const triggerLayoutImport = () => {
    if (!jsonInputRef.value) {
      // 兜底：动态创建一个 input
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.style.display = "none";
      input.addEventListener("change", (e) => onLayoutFile(e));
      document.body.appendChild(input);
      jsonInputRef.value = input;
    }
    jsonInputRef.value.click();
  };

  const onExcelFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rowsData = utils.sheet_to_json<any>(ws, { defval: "" });
      const first = rowsData[0] || {};
      const keys = Object.keys(first);
      const pickKey = (regex: RegExp, fallback: string) =>
        keys.find((k) => regex.test(k)) || fallback;
      const nameKey = pickKey(/姓名|名字|name/i, "姓名");
      const deptKey = pickKey(/部门|department/i, "部门");
      const levelKey = pickKey(/级别|level|职务级别/i, "级别");
      const titleKey = pickKey(/职务|职位|title/i, "职务");
      const remarkKey = pickKey(/备注|remark/i, "备注");
      const statusKey = pickKey(/状态|参会|是否参会|attendance|status/i, "");

      let added = 0;
      for (const r of rowsData) {
        const name = String(r[nameKey] || "").trim();
        if (!name) continue;
        const deptPath = String(r[deptKey] || "").trim();
        const levelName = String(r[levelKey] || "").trim();
        // 支持 "办公室/秘书科" 这种层级写法
        const deptId = ensureDeptPath(store, deptPath);
        let levelId = store.levels.find((l) => l.name === levelName)?.id;
        if (!levelId && levelName) {
          const nl: Level = {
            id: uid(),
            name: levelName,
            order: 99,
            color: "#7d7d7d",
          };
          store.addLevel(nl);
          levelId = nl.id;
        }
        const status: PersonStatus = statusKey
          ? normalizeStatus(r[statusKey])
          : "attending";
        store.addPerson({
          name,
          department: deptId || "",
          level: levelId || "",
          title: String(r[titleKey] || "").trim(),
          remark: String(r[remarkKey] || "").trim(),
          status,
        });
        added++;
      }
      message.success(`已导入 ${added} 人`);
    } catch (err) {
      console.error(err);
      message.error("Excel 解析失败，请检查文件格式");
    } finally {
      input.value = "";
    }
  };

  const onLayoutFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const r = await store.importLayoutJSON(file);
    if (r.ok) message.success("布局已加载");
    else message.error(r.reason || "加载失败");
    input.value = "";
  };

  const downloadExcelTemplate = async () => {
    const ws = utils.aoa_to_sheet([
      ["姓名", "部门", "级别", "职务", "状态", "备注"],
      ["张三", "办公室/秘书科", "正处级", "主任", "参会", ""],
      ["李四", "办公室/秘书科", "副处级", "副主任", "参会", ""],
      ["王五", "财务处/预算科", "正科级", "科长", "不参会", "请假"],
    ]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "人员列表");
    const buf = write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const r = await saveBlob(blob, "人员导入模板.xlsx", "下载人员导入模板");
    if (r.ok) message.success("模板已下载");
  };

  return {
    fileInputRef,
    jsonInputRef,
    triggerExcelImport,
    triggerLayoutImport,
    onExcelFile,
    onLayoutFile,
    downloadExcelTemplate,
  };
}
