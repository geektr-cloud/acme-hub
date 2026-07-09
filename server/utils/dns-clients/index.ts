import {
  type Provider,
  cloudflareCreds,
  alicloudCreds,
} from "@server/core/dns-credentials/creds";
import { createCloudflareDnsClient } from "./cloudflare";
import { createAliyunDnsClient } from "./aliyun";
import type { DnsClient } from "./base";

export type { DnsClient, TxtRecord } from "./base";

const factories: Record<Provider, (creds: unknown) => DnsClient> = {
  cloudflare: (creds) =>
    createCloudflareDnsClient(cloudflareCreds.parse(creds)),
  alicloud: (creds) => createAliyunDnsClient(alicloudCreds.parse(creds)),
};

export function createDnsClient(provider: Provider, creds: unknown): DnsClient {
  const factory = factories[provider];
  if (!factory) throw new Error(`Unknown DNS provider: ${provider}`);
  return factory(creds);
}
