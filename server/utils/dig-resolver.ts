import type { DnsResolver } from "@geektr/acme-dns01";

const DEFAULT_ENDPOINT = "https://cloudflare-pal.geektr.cloud";

interface DigAnswer {
  host: string;
  type: string;
  answers: string[];
  rcode?: string;
}

export class DigResolver implements DnsResolver {
  private readonly endpoint: string;

  constructor(opts?: { endpoint?: string }) {
    this.endpoint = opts?.endpoint || DEFAULT_ENDPOINT;
  }

  private async query(hostname: string, type: string): Promise<string[]> {
    const url = `${this.endpoint}/dig?host=${encodeURIComponent(hostname)}&type=${type}&nameserver=authoritative`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`dig ${type} ${hostname}: HTTP ${res.status}`);
    }
    const json: DigAnswer = (await res.json()) as DigAnswer;
    return json.answers;
  }

  async resolveTxt(hostname: string): Promise<string[][]> {
    const answers = await this.query(hostname, "TXT");
    if (answers.length === 0) {
      throw new Error(`dig TXT ${hostname}: no records`);
    }
    return answers.map((v) => [v]);
  }

  async resolveCname(hostname: string): Promise<string[]> {
    const answers = await this.query(hostname, "CNAME");
    if (answers.length === 0) {
      throw new Error(`dig CNAME ${hostname}: no records`);
    }
    return answers;
  }
}
