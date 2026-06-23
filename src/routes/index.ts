import { createMemoryHistory, createRouter } from "vue-router";

const routes = [
  {
    path: "/",
    component: () => import("../views/home/index.vue"),
    name: "home",
  },
  {
    path: "/about",
    component: () => import("../views/about/index.vue"),
    name: "about",
  },
  {
    path: "/documents",
    component: () => import("../views/documents/index.vue"),
    name: "documents",
  },
  {
    path: "/settings",
    component: () => import("../views/settings/index.vue"),
    name: "settings",
  },
  {
    path: "/ocr",
    component: () => import("../views/ocr/index.vue"),
    name: "ocr",
  },
  {
    path: "/pdf-editor",
    component: () => import("../views/pdf-editor/index.vue"),
    name: "pdf-editor",
  },
  {
    path: "/trash",
    component: () => import("../views/trash/index.vue"),
    name: "trash",
  },
  {
    path: "/seat-table",
    component: () => import("../views/seat-table/index.vue"),
    name: "seat-table",
  },
];

const router = createRouter({
  history: createMemoryHistory(),
  routes,
});

export default router;
