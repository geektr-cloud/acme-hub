import { defineStore } from "pinia";
import { ref } from "vue";
import { client, rpc } from "@/utils/api";

export const useAuthStore = defineStore("auth", () => {
  const authenticated = ref(false);
  const ready = ref(false);

  async function check() {
    try {
      const r = await rpc<{ authenticated: boolean }>(
        client.api.auth.me.$get(),
      );
      authenticated.value = r.authenticated;
    } catch {
      authenticated.value = false;
    } finally {
      ready.value = true;
    }
  }

  async function login(username: string, password: string) {
    await rpc(client.api.auth.login.$post({ json: { username, password } }));
    authenticated.value = true;
  }

  async function logout() {
    try {
      await rpc(client.api.auth.logout.$post());
    } finally {
      authenticated.value = false;
    }
  }

  return { authenticated, ready, check, login, logout };
});
