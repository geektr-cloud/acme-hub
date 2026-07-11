<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { ModalsContainer } from "vue-final-modal";
import { LogOut } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const navLinkClass = (active: boolean) =>
  [
    "no-underline transition-colors",
    active ? "text-cyan-400" : "text-zinc-400 hover:text-cyan-400",
  ].join(" ");
const isActive = (prefix: string) =>
  computed(() => route.path === prefix || route.path.startsWith(prefix + "/"));
const consumersActive = isActive("/consumers");
const accountsActive = isActive("/acme-accounts");
const certsActive = isActive("/certificates");
const dnsCredentialsActive = isActive("/dns-credentials");
const domainsActive = isActive("/domains");

const onLogout = async () => {
  await auth.logout();
  router.push("/login");
};
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-100">
    <ModalsContainer />
    <header
      v-if="auth.authenticated"
      class="sticky top-0 z-10 flex h-14 items-center gap-6 border-b border-zinc-800/80 bg-zinc-950/95 px-4 backdrop-blur supports-backdrop-filter:bg-zinc-950/80"
    >
      <RouterLink
        to="/"
        class="text-lg font-semibold tracking-tight text-zinc-100 no-underline transition-colors hover:text-cyan-400"
      >
        ACME Hub
      </RouterLink>
      <nav class="flex items-center gap-4 text-sm">
        <RouterLink to="/consumers" :class="navLinkClass(consumersActive)">
          消费方
        </RouterLink>
        <RouterLink to="/acme-accounts" :class="navLinkClass(accountsActive)">
          ACME 账户
        </RouterLink>
        <RouterLink to="/certificates" :class="navLinkClass(certsActive)">
          证书
        </RouterLink>
        <RouterLink
          to="/dns-credentials"
          :class="navLinkClass(dnsCredentialsActive)"
        >
          DNS 凭据
        </RouterLink>
        <RouterLink to="/domains" :class="navLinkClass(domainsActive)">
          域名
        </RouterLink>
      </nav>
      <div class="ml-auto">
        <Button
          v-if="auth.authenticated && route.name !== 'login'"
          variant="ghost"
          size="icon"
          title="登出"
          @click="onLogout"
        >
          <LogOut />
        </Button>
      </div>
    </header>
    <main class="bg-zinc-950">
      <RouterView v-if="auth.authenticated || route.name === 'login'" />
    </main>
  </div>
</template>
