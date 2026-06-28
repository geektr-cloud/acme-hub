import { createRouter, createWebHistory } from "vue-router";
import LoginPage from "../views/auth/LoginPage.vue";
import CertificatePage from "../views/certificate/CertificatePage.vue";
import CertificateDetailPage from "../views/certificate/CertificateDetailPage.vue";
import ClientPage from "../views/client/ClientPage.vue";
import ClientDetailPage from "../views/client/ClientDetailPage.vue";
import AcmeAccountPage from "../views/acme-account/AcmeAccountPage.vue";
import AcmeAccountDetailPage from "../views/acme-account/AcmeAccountDetailPage.vue";
import DnsCredentialPage from "../views/dns-credential/DnsCredentialPage.vue";
import DnsCredentialDetailPage from "../views/dns-credential/DnsCredentialDetailPage.vue";
import DomainPage from "../views/domain/DomainPage.vue";
import DomainDetailPage from "../views/domain/DomainDetailPage.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/login",
      name: "login",
      component: LoginPage,
      meta: { public: true },
    },
    {
      path: "/",
      redirect: "/clients",
    },
    {
      path: "/certificates",
      name: "certificates",
      component: CertificatePage,
    },
    {
      path: "/certificates/:id",
      name: "certificate-detail",
      component: CertificateDetailPage,
    },
    {
      path: "/clients",
      name: "clients",
      component: ClientPage,
    },
    {
      path: "/clients/:id",
      name: "client-detail",
      component: ClientDetailPage,
    },
    {
      path: "/acme-accounts",
      name: "acme-accounts",
      component: AcmeAccountPage,
    },
    {
      path: "/acme-accounts/:id",
      name: "acme-account-detail",
      component: AcmeAccountDetailPage,
    },
    {
      path: "/dns-credentials",
      name: "dns-credentials",
      component: DnsCredentialPage,
    },
    {
      path: "/dns-credentials/:id",
      name: "dns-credential-detail",
      component: DnsCredentialDetailPage,
    },
    {
      path: "/domains",
      name: "domains",
      component: DomainPage,
    },
    {
      path: "/domains/:id",
      name: "domain-detail",
      component: DomainDetailPage,
    },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.public) return true;
  const { useAuthStore } = await import("@/stores/auth");
  const auth = useAuthStore();
  if (!auth.ready) await auth.check();
  if (!auth.authenticated) {
    return { name: "login", query: { next: to.fullPath } };
  }
  return true;
});

export default router;
