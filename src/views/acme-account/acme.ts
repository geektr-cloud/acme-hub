// ACME 目录类型判定。非 Let's Encrypt 统一视为需要 EAB。

const LE_URLS = new Set([
  "https://acme-v02.api.letsencrypt.org/directory",
  "https://acme-staging-v02.api.letsencrypt.org/directory",
]);

export const isLetsEncrypt = (url: string | undefined | null) =>
  url ? LE_URLS.has(url) : false;

export const isEab = (url: string | undefined | null) => !isLetsEncrypt(url);
