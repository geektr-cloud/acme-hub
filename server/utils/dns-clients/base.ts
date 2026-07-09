export interface TxtRecord {
  id: string;
  fqdn: string;
  value: string;
  remark?: string;
}

export interface DnsClient {
  listTxt(zone: string, fqdn: string): Promise<TxtRecord[]>;
  ensureTxt(
    zone: string,
    fqdn: string,
    value: string,
    remark?: string,
  ): Promise<void>;
  removeTxt(zone: string, fqdn: string, value: string): Promise<void>;
}

export function fqdnToRr(zone: string, fqdn: string): string {
  if (fqdn === zone) return "@";
  const suffix = `.${zone}`;
  if (!fqdn.endsWith(suffix)) {
    throw new Error(`fqdn "${fqdn}" is not under zone "${zone}"`);
  }
  return fqdn.slice(0, -suffix.length);
}
