/**
 * 导入/导出相关 composable
 * 注意：jsonInputRef 在模块级共享，保证不同组件调用
 * useImportExport() 时拿到的是同一组 ref
 */
import { ref } from "vue";
import { useMessage } from "naive-ui";
import { utils, read } from "xlsx";
import { open } from "@tauri-apps/api/dialog";
import { invoke } from "@tauri-apps/api/tauri";
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
 * 真实 DOM 在 index.vue 中渲染：ref="jsonInputRef"
 */
const jsonInputRef = ref<HTMLInputElement | null>(null);

export function useImportExport() {
  const store = useSeatTableStore();
  const message = useMessage();

  const triggerExcelImport = async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [
          { name: "CSV", extensions: ["csv"] },
          { name: "Excel", extensions: ["xlsx", "xls"] },
        ],
      });
      if (!filePath || typeof filePath !== "string") return;
      await importTableFile(filePath);
    } catch (err) {
      console.error(err);
    }
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

  /** 从行数据中提取人员信息并存入 store */
  const importRowsData = (rowsData: any[]) => {
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
    return added;
  };

  const importTableFile = async (filePath: string) => {
    const isCsv = filePath.toLowerCase().endsWith(".csv");

    try {
      let rowsData: any[];

      if (isCsv) {
        // CSV 纯文本，加密系统不会加密
        const text: string = await invoke("read_file_as_text", {
          path: filePath,
        });
        const wb = read(text, { type: "string" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rowsData = utils.sheet_to_json<any>(ws, { defval: "" });
      } else {
        // Excel 二进制，加密系统可能加密文件内容
        const bytes: number[] = await invoke("read_file_as_bytes", {
          path: filePath,
        });
        const buf = new Uint8Array(bytes);
        const wb = read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rowsData = utils.sheet_to_json<any>(ws, { defval: "" });
      }

      const added = importRowsData(rowsData);
      if (added === 0) {
        throw new Error("未识别到有效数据");
      }
      message.success(`已导入 ${added} 人`);
    } catch (err) {
      console.error("表格解析失败", err);
      if (isCsv) {
        message.error("CSV 解析失败，请检查文件格式和编码（需 UTF-8）");
      } else {
        message.warning(
          "Excel 解析失败（可能因加密系统导致），正在用系统默认程序打开...",
        );
        try {
          await invoke("open_file_with_system", { path: filePath });
        } catch (openErr) {
          console.error("打开文件失败", openErr);
          message.error(
            "打开文件失败，建议另存为 CSV 后再导入",
          );
        }
      }
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

  const downloadTemplate = async () => {
    const csvContent =
      "姓名,部门,级别,职务,状态,备注\n张三,办公室/秘书科,正处级,主任,参会,\n李四,办公室/秘书科,副处级,副主任,参会,\n王五,财务处/预算科,正科级,科长,不参会,请假\n";
    // 添加 BOM 以确保 Excel/WPS 正确识别 UTF-8 编码
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], {
      type: "text/csv;charset=utf-8",
    });
    const r = await saveBlob(blob, "人员导入模板.csv", "下载人员导入模板");
    if (r.ok) message.success("模板已下载");
  };

  return {
    jsonInputRef,
    triggerExcelImport,
    triggerLayoutImport,
    onLayoutFile,
    downloadTemplate,
  };
}
