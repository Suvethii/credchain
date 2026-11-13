import { expect } from "chai";
import { gatewayUrls, fetchFromIpfs, IPFS_GATEWAYS } from "../lib/metadata";

const CID = "bafkreidxsb3qim2gqqgv7c5ognvnzhmmj5xe7jv3lksem4ngnb5uaddb2q";

// A fake fetch: each URL gets the answer we choose ("ok", a status number, "error" or "hang")
function fakeFetch(plan: Record<string, "ok" | number | "error" | "hang">) {
  const tried: string[] = [];
  const impl = (async (url: any, init: any) => {
    const u = String(url); tried.push(u);
    const host = Object.keys(plan).find((h) => u.includes(h));
    const what = host ? plan[host] : "error";
    if (what === "ok") return new Response("file", { status: 200 });
    if (typeof what === "number") return new Response("", { status: what });
    if (what === "hang") {
      return new Promise((_, reject) =>
        init.signal.addEventListener("abort", () => reject(Object.assign(new Error("abort"), { name: "AbortError" }))));
    }
    throw new Error("network down");
  }) as typeof fetch;
  return { impl, tried };
}

describe("IPFS gateway fallback", function () {
  it("makes one link per gateway, in order", function () {
    const urls = gatewayUrls(`ipfs://${CID}`);
    expect(urls).to.have.length(IPFS_GATEWAYS.length);
    expect(urls[0]).to.equal(`https://gateway.pinata.cloud/ipfs/${CID}`);
    expect(urls[1]).to.equal(`https://ipfs.io/ipfs/${CID}`);
  });

  it("rejects links that are not ipfs://", function () {
    expect(() => gatewayUrls("https://example.com/x.pdf")).to.throw();
  });

  it("uses the first gateway when it works", async function () {
    const f = fakeFetch({ "pinata.cloud": "ok" });
    const res = await fetchFromIpfs(`ipfs://${CID}`, { fetchImpl: f.impl });
    expect(res.status).to.equal(200);
    expect(f.tried).to.have.length(1);
  });

  it("moves to the next gateway when one is down or returns an error", async function () {
    const f = fakeFetch({ "pinata.cloud": "error", "ipfs.io": 504, "cloudflare-ipfs.com": "ok" });
    const res = await fetchFromIpfs(`ipfs://${CID}`, { fetchImpl: f.impl });
    expect(res.status).to.equal(200);
    expect(f.tried).to.have.length(3);
  });

  it("gives up on a slow gateway after the time limit", async function () {
    const f = fakeFetch({ "pinata.cloud": "hang", "ipfs.io": "ok" });
    const res = await fetchFromIpfs(`ipfs://${CID}`, { fetchImpl: f.impl, timeoutMs: 50 });
    expect(res.status).to.equal(200);
    expect(f.tried).to.have.length(2);
  });

  it("explains which gateways failed when all of them fail", async function () {
    const f = fakeFetch({ "pinata.cloud": 404, "ipfs.io": "error", "cloudflare-ipfs.com": "hang" });
    try {
      await fetchFromIpfs(`ipfs://${CID}`, { fetchImpl: f.impl, timeoutMs: 50 });
      expect.fail("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).to.contain("All IPFS gateways failed");
      expect(msg).to.contain("HTTP 404");
      expect(msg).to.contain("timed out");
    }
  });
});
