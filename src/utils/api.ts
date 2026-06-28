import { type ClientResponse, hc } from "hono/client";
import type { AppType } from "@server/index";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { setResponseInterceptor } from "@acrux/core";

export const client = hc<AppType>("/");
export type AppResponse<T> = Promise<
  ClientResponse<T, ContentfulStatusCode, "json">
>;

// 401 → 清登录态并跳转 /login（带 next）。fire-and-forget：拦截器是同步的，动态导入异步执行。
const handleUnauthorized = () => {
  void Promise.all([import("@/stores/auth"), import("@/router")]).then(
    ([{ useAuthStore }, { default: router }]) => {
      useAuthStore().authenticated = false;
      if (router.currentRoute.value.path !== "/login") {
        void router.push({
          path: "/login",
          query: { next: router.currentRoute.value.fullPath },
        });
      }
    },
  );
};

// 把 401 处理注入 @acrux/core 的 useHonoApi，使所有 store 调用统一享有重定向行为。
setResponseInterceptor(({ status }) => {
  if (status === 401) {
    handleUnauthorized();
    return true;
  }
});

export async function rpc<T>(
  call: Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>,
): Promise<T> {
  const res = await call;
  if (res.status === 204) return undefined as T;
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
