import { reactive, computed } from "vue";

export type ClipboardAction = "copy" | "cut";

export interface ClipboardItem {
  sourcePath: string;
  action: ClipboardAction;
  name: string;
  isDirectory: boolean;
}

const state = reactive({
  items: [] as ClipboardItem[],
});

export function useClipboard() {
  const hasItem = computed(() => state.items.length > 0);
  const count = computed(() => state.items.length);
  const firstItem = computed(() =>
    state.items.length > 0 ? state.items[0] : null,
  );
  const allItems = computed(() => state.items);

  const set = (item: ClipboardItem) => {
    state.items = [item];
  };

  const setMultiple = (items: ClipboardItem[]) => {
    state.items = items;
  };

  const clear = () => {
    state.items = [];
  };

  return {
    hasItem,
    count,
    firstItem,
    allItems,
    set,
    setMultiple,
    clear,
  };
}

export const clipboardManager = {
  set: (item: ClipboardItem) => {
    state.items = [item];
  },
  setMultiple: (items: ClipboardItem[]) => {
    state.items = items;
  },
  get: (): ClipboardItem | null => {
    return state.items.length > 0 ? state.items[0] : null;
  },
  getAll: (): ClipboardItem[] => {
    return state.items;
  },
  clear: () => {
    state.items = [];
  },
  hasItem: (): boolean => {
    return state.items.length > 0;
  },
  count: (): number => {
    return state.items.length;
  },
};
