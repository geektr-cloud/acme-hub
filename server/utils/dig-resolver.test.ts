import { describe, it, expect, vi, beforeEach } from "vitest";
import { DigResolver } from "./dig-resolver";

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("DigResolver", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolveTxt 请求 type=TXT&nameserver=authoritative", async () => {
    const fetch = mockFetch({
      host: "test.example.com",
      type: "TXT",
      answers: ["val1", "val2"],
    });
    vi.stubGlobal("fetch", fetch);

    const resolver = new DigResolver();
    const result = await resolver.resolveTxt("test.example.com");

    expect(fetch).toHaveBeenCalledOnce();
    const url = fetch.mock.calls[0]![0] as string;
    expect(url).toContain("type=TXT");
    expect(url).toContain("nameserver=authoritative");
    expect(url).toContain("host=test.example.com");
    expect(result).toEqual([["val1"], ["val2"]]);
  });

  it("resolveTxt 多值拆分", async () => {
    vi.stubGlobal("fetch", mockFetch({ answers: ["a", "b", "c"] }));
    const resolver = new DigResolver();
    const result = await resolver.resolveTxt("x.com");
    expect(result).toEqual([["a"], ["b"], ["c"]]);
  });

  it("resolveTxt 空应答 throw", async () => {
    vi.stubGlobal("fetch", mockFetch({ answers: [], rcode: "NXDOMAIN" }));
    const resolver = new DigResolver();
    await expect(resolver.resolveTxt("nope.com")).rejects.toThrow("no records");
  });

  it("HTTP 502 throw", async () => {
    vi.stubGlobal("fetch", mockFetch({ error: "upstream" }, 502));
    const resolver = new DigResolver();
    await expect(resolver.resolveTxt("x.com")).rejects.toThrow("HTTP 502");
  });

  it("HTTP 504 throw", async () => {
    vi.stubGlobal("fetch", mockFetch({ error: "timeout" }, 504));
    const resolver = new DigResolver();
    await expect(resolver.resolveTxt("x.com")).rejects.toThrow("HTTP 504");
  });

  it("resolveCname 正常返回", async () => {
    vi.stubGlobal("fetch", mockFetch({ answers: ["target.example.com"] }));
    const resolver = new DigResolver();
    const result = await resolver.resolveCname("www.example.com");
    expect(result).toEqual(["target.example.com"]);
  });

  it("resolveCname 空应答 throw", async () => {
    vi.stubGlobal("fetch", mockFetch({ answers: [] }));
    const resolver = new DigResolver();
    await expect(resolver.resolveCname("x.com")).rejects.toThrow("no records");
  });

  it("自定义 endpoint", async () => {
    const fetch = mockFetch({ answers: ["val"] });
    vi.stubGlobal("fetch", fetch);

    const resolver = new DigResolver({ endpoint: "https://custom.dig" });
    await resolver.resolveTxt("x.com");

    const url = fetch.mock.calls[0]![0] as string;
    expect(url).toMatch(/^https:\/\/custom\.dig\/dig\?/);
  });
});
