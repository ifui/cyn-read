<script setup lang="ts">
/**
 * 弹窗集合 - 人员 / 单元格 / 部门 / 级别 / 交换日志
 */
import { ref, watch, computed } from "vue";
import {
  NModal,
  NForm,
  NFormItem,
  NFormItemGi,
  NGrid,
  NInput,
  NSelect,
  NColorPicker,
  NInputNumber,
  NSpace,
  NButton,
  NScrollbar,
  NEmpty,
  NText,
  NCheckbox,
} from "naive-ui";
import { useSeatTableStore } from "../store";
import type { Cell, Department, Level, Person, PersonStatus } from "../types";

const props = defineProps<{
  showPerson: boolean;
  showCell: boolean;
  showDept: boolean;
  showLevel: boolean;
  showLog: boolean;
  editingPerson: Person | null;
  editingCell: Cell | null;
  editingDept: Department | null;
  editingLevel: Level | null;
}>();

const emit = defineEmits<{
  (e: "update:showPerson", v: boolean): void;
  (e: "update:showCell", v: boolean): void;
  (e: "update:showDept", v: boolean): void;
  (e: "update:showLevel", v: boolean): void;
  (e: "update:showLog", v: boolean): void;
  (e: "save-person", p: Person): void;
  (e: "save-cell", c: Cell): void;
  (e: "save-dept", d: Department): void;
  (e: "save-level", l: Level): void;
  (e: "error", msg: string): void;
}>();

const store = useSeatTableStore();

const localPerson = ref<Person | null>(null);
const localCell = ref<Cell | null>(null);
const localDept = ref<Department | null>(null);
const localLevel = ref<Level | null>(null);

watch(
  () => props.editingPerson,
  (v) => (localPerson.value = v ? { ...v } : null),
  { immediate: true },
);
watch(
  () => props.editingCell,
  (v) => (localCell.value = v ? { ...v } : null),
  { immediate: true },
);
watch(
  () => props.editingDept,
  (v) => (localDept.value = v ? { ...v } : null),
  { immediate: true },
);
watch(
  () => props.editingLevel,
  (v) => (localLevel.value = v ? { ...v } : null),
  { immediate: true },
);

const deptOptions = () =>
  store.departments.map((d) => ({
    label: store.getDeptFullName(d.id),
    value: d.id,
  }));
const parentDeptOptions = computed(() => {
  // 新建部门时可任意选；编辑时需排除自己及自己的后代（避免循环）
  const cur = localDept.value;
  const exclude = new Set<string>();
  if (cur) {
    exclude.add(cur.id);
    for (const id of store.collectDescendantIds(cur.id)) exclude.add(id);
  }
  return [
    { label: "（无）", value: "" },
    ...store.departments
      .filter((d) => !exclude.has(d.id))
      .map((d) => ({ label: store.getDeptFullName(d.id), value: d.id })),
  ];
});
const levelOptions = () =>
  store.levels.map((l) => ({ label: l.name, value: l.id }));
const statusOptions = [
  { label: "参会", value: "attending" as PersonStatus },
  { label: "不参会", value: "absent" as PersonStatus },
];

const submitPerson = () => {
  if (!localPerson.value) return;
  if (!localPerson.value.name.trim()) {
    emit("error", "请输入姓名");
    return;
  }
  emit("save-person", localPerson.value);
};
const submitCell = () => {
  if (!localCell.value) return;
  emit("save-cell", localCell.value);
};
const submitDept = () => {
  if (!localDept.value) return;
  if (!localDept.value.name.trim()) {
    emit("error", "请输入部门名");
    return;
  }
  emit("save-dept", localDept.value);
};
const submitLevel = () => {
  if (!localLevel.value) return;
  if (!localLevel.value.name.trim()) {
    emit("error", "请输入级别名");
    return;
  }
  emit("save-level", localLevel.value);
};
</script>

<template>
  <!-- 人员编辑 -->
  <n-modal
    :show="showPerson"
    preset="card"
    title="人员信息"
    style="max-width: 560px"
    @update:show="(v) => emit('update:showPerson', v)"
  >
    <n-form
      v-if="localPerson"
      label-placement="left"
      label-width="80"
      size="small"
    >
      <n-grid :cols="2" :x-gap="16">
        <n-form-item-gi label="姓名">
          <n-input v-model:value="localPerson.name" placeholder="请输入姓名" />
        </n-form-item-gi>
        <n-form-item-gi label="职务">
          <n-input
            v-model:value="localPerson.title"
            placeholder="如：主任 / 副主任"
          />
        </n-form-item-gi>
        <n-form-item-gi label="部门">
          <n-select
            v-model:value="localPerson.department"
            :options="deptOptions()"
            placeholder="选择部门"
          />
        </n-form-item-gi>
        <n-form-item-gi label="级别">
          <n-select
            v-model:value="localPerson.level"
            :options="levelOptions()"
            placeholder="选择级别"
          />
        </n-form-item-gi>
        <n-form-item-gi label="参会状态">
          <n-select
            v-model:value="localPerson.status"
            :options="statusOptions"
            placeholder="选择状态"
          />
        </n-form-item-gi>
        <n-form-item-gi v-if="localPerson" label="宾客身份">
          <n-checkbox
            :checked="localPerson.isGuest === true"
            @update:checked="(v) => (localPerson!.isGuest = v)"
          >
            标记为宾客
          </n-checkbox>
        </n-form-item-gi>
        <n-form-item-gi :span="2" label="备注">
          <n-input
            v-model:value="localPerson.remark"
            type="textarea"
            :rows="2"
          />
        </n-form-item-gi>
      </n-grid>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="emit('update:showPerson', false)">取消</n-button>
        <n-button type="primary" @click="submitPerson">保存</n-button>
      </n-space>
    </template>
  </n-modal>

  <!-- 单元格编辑 -->
  <n-modal
    :show="showCell"
    preset="card"
    title="单元格编辑"
    style="max-width: 480px"
    @update:show="(v) => emit('update:showCell', v)"
  >
    <n-form
      v-if="localCell"
      label-placement="left"
      label-width="80"
      size="small"
    >
      <n-form-item label="文字内容">
        <n-input
          v-model:value="localCell.text"
          placeholder="如：VIP区 / 主桌 / 嘉宾席"
        />
      </n-form-item>
      <n-form-item label="背景色">
        <n-color-picker
          v-model:value="localCell.bgColor"
          :show-alpha="false"
          :modes="['hex']"
        />
      </n-form-item>
      <n-form-item label="文字色">
        <n-color-picker
          v-model:value="localCell.textColor"
          :show-alpha="false"
          :modes="['hex']"
        />
      </n-form-item>
      <n-form-item label="类型">
        <n-select
          v-model:value="localCell.type"
          :options="[
            { label: '座位格', value: 'seat' },
            { label: '标识格', value: 'label' },
            { label: '留白格', value: 'empty' },
          ]"
        />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="emit('update:showCell', false)">取消</n-button>
        <n-button type="primary" @click="submitCell">保存</n-button>
      </n-space>
    </template>
  </n-modal>

  <!-- 部门编辑 -->
  <n-modal
    :show="showDept"
    preset="card"
    title="部门编辑"
    style="max-width: 460px"
    @update:show="(v) => emit('update:showDept', v)"
  >
    <n-form
      v-if="localDept"
      label-placement="left"
      label-width="100"
      size="small"
    >
      <n-form-item label="部门名称">
        <n-input v-model:value="localDept.name" placeholder="如：办公室" />
      </n-form-item>
      <n-form-item label="父部门">
        <n-select
          v-model:value="localDept.parentId"
          :options="parentDeptOptions"
          placeholder="（无）"
          clearable
        />
      </n-form-item>
      <n-form-item label="排序权重">
        <n-input-number
          v-model:value="localDept.order"
          :min="0"
          :max="9999"
          placeholder="数字越小越靠前"
        />
      </n-form-item>
      <n-form-item label="正职称谓">
        <n-input
          v-model:value="localDept.mainTitle"
          placeholder="如：主任 / 局长"
        />
      </n-form-item>
      <n-form-item label="副职称谓">
        <n-input
          v-model:value="localDept.deputyTitle"
          placeholder="如：副主任 / 副局长"
        />
      </n-form-item>
      <n-text depth="3" style="font-size: 12px">
        <i class="ri-information-line"></i>
        业务规则：每个部门标配 1 名正职领导、多名副职领导。支持多级嵌套。
      </n-text>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="emit('update:showDept', false)">取消</n-button>
        <n-button type="primary" @click="submitDept">保存</n-button>
      </n-space>
    </template>
  </n-modal>

  <!-- 级别编辑 -->
  <n-modal
    :show="showLevel"
    preset="card"
    title="级别编辑"
    style="max-width: 460px"
    @update:show="(v) => emit('update:showLevel', v)"
  >
    <n-form
      v-if="localLevel"
      label-placement="left"
      label-width="100"
      size="small"
    >
      <n-form-item label="级别名称">
        <n-input v-model:value="localLevel.name" placeholder="如：正处级" />
      </n-form-item>
      <n-form-item label="排序权重">
        <n-input-number v-model:value="localLevel.order" :min="1" :max="99" />
      </n-form-item>
      <n-form-item label="配色">
        <n-color-picker
          v-model:value="localLevel.color"
          :show-alpha="false"
          :modes="['hex']"
        />
      </n-form-item>
      <n-text depth="3" style="font-size: 12px">
        <i class="ri-information-line"></i>
        数字越小级别越高，自动排座时优先排布。
      </n-text>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="emit('update:showLevel', false)">取消</n-button>
        <n-button type="primary" @click="submitLevel">保存</n-button>
      </n-space>
    </template>
  </n-modal>

  <!-- 交换日志 -->
  <n-modal
    :show="showLog"
    preset="card"
    title="座位交换日志"
    style="max-width: 640px"
    @update:show="(v) => emit('update:showLog', v)"
  >
    <n-empty v-if="store.swapLogs.length === 0" description="暂无交换记录" />
    <n-scrollbar v-else style="max-height: 50vh">
      <div class="log-list">
        <div v-for="log in store.swapLogs" :key="log.id" class="log-item">
          <div class="log-time">{{ store.formatTime(log.timestamp) }}</div>
          <div class="log-desc">{{ log.desc }}</div>
        </div>
      </div>
    </n-scrollbar>
    <template #footer>
      <n-space justify="space-between">
        <n-button
          size="small"
          quaternary
          type="warning"
          @click="store.clearSwapLogs()"
          v-if="store.swapLogs.length > 0"
        >
          <template #icon><i class="ri-delete-bin-line"></i></template>
          清空日志
        </n-button>
        <n-button size="small" @click="emit('update:showLog', false)"
          >关闭</n-button
        >
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
.log-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.log-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 10px;
  background: #faf8f4;
  border-left: 3px solid var(--gold);
  border-radius: 4px;
}
.log-time {
  font-size: 11px;
  color: #8c8c8c;
  white-space: nowrap;
  flex-shrink: 0;
  font-family: "Consolas", "Monaco", monospace;
}
.log-desc {
  font-size: 12px;
  color: var(--ink);
  flex: 1;
}
</style>
