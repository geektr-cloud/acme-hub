import "./assets/main.css";
import "vue-final-modal/style.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import { createVfm } from "vue-final-modal";
import { install as VueMonacoEditorPlugin } from "@guolao/vue-monaco-editor";
import App from "./App.vue";
import router from "./router";

const app = createApp(App);
const vfm = createVfm();

app.use(createPinia());
app.use(router);
app.use(vfm);
app.use(VueMonacoEditorPlugin, {
  paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" },
});

app.mount("#app");
