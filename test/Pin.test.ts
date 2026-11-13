import { expect } from "chai";
import { handlePin, MAX_PDF_BYTES } from "../lib/pin";

const enc = new TextEncoder();
const PDF = enc.encode("%PDF-1.7\nfake test certificate\n%%EOF");
const GOOD_META = {
  name: "Web Basics: Test Student",
  description: "Credential issued by Raxwo Practice Institute on CredChain.",
  credential: {
    recipientName: "Test Student",
    credentialTitle: "Web Basics",
    issuerName: "Raxwo Practice Institute",
    issueDate: "2026-11-11",
    documentUri: "ipfs://bafy-example-pdf",
    documentHash: "0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  },
};

// A fake Pinata that records what was sent and answers like the real one
function fakePinata(ok = true) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    if (!ok) return new Response('{"error":"secret details"}', { status: 401 });
    return new Response(JSON.stringify({ data: { cid: "bafytestcid", size: 123 } }), { status: 200 });
  }) as typeof fetch;
  return { impl, calls };
}

function pdfRequest(bytes: Uint8Array, field = "file") {
  const form = new FormData();
  form.append(field, new Blob([bytes], { type: "application/pdf" }), "cert.pdf");
  return new Request("http://localhost/api/pin", { method: "POST", body: form });
}
function jsonRequest(data: unknown) {
  return new Request("http://localhost/api/pin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof data === "string" ? data : JSON.stringify(data),
  });
}

describe("/api/pin", function () {
  it("uploads a PDF and returns its ipfs:// link", async function () {
    const p = fakePinata();
    const res = await handlePin(pdfRequest(PDF), { jwt: "test-jwt", fetchImpl: p.impl });
    expect(res.status).to.equal(200);
    expect(await res.json()).to.deep.equal({ cid: "bafytestcid", uri: "ipfs://bafytestcid", size: 123 });
    // Sent to Pinata with the secret key and as a public file
    expect(p.calls[0].url).to.equal("https://uploads.pinata.cloud/v3/files");
    expect((p.calls[0].init.headers as any).Authorization).to.equal("Bearer test-jwt");
    expect((p.calls[0].init.body as FormData).get("network")).to.equal("public");
  });

  it("uploads valid metadata JSON", async function () {
    const p = fakePinata();
    const res = await handlePin(jsonRequest(GOOD_META), { jwt: "test-jwt", fetchImpl: p.impl });
    expect(res.status).to.equal(200);
    expect(((await res.json()) as any).uri).to.equal("ipfs://bafytestcid");
  });

  it("rejects a file that is not a PDF", async function () {
    const p = fakePinata();
    const res = await handlePin(pdfRequest(enc.encode("not a pdf")), { jwt: "x", fetchImpl: p.impl });
    expect(res.status).to.equal(415);
    expect(p.calls.length).to.equal(0); // nothing sent to Pinata
  });

  it("rejects a PDF bigger than 5 MB", async function () {
    const big = new Uint8Array(MAX_PDF_BYTES + 1);
    big.set(enc.encode("%PDF-"));
    const res = await handlePin(pdfRequest(big), { jwt: "x", fetchImpl: fakePinata().impl });
    expect(res.status).to.equal(413);
  });

  it("rejects an upload without a 'file' field", async function () {
    const res = await handlePin(pdfRequest(PDF, "document"), { jwt: "x", fetchImpl: fakePinata().impl });
    expect(res.status).to.equal(400);
  });

  it("rejects invalid metadata and says why", async function () {
    const bad = { ...GOOD_META, credential: { ...GOOD_META.credential, issueDate: "11/11/2026" } };
    const res = await handlePin(jsonRequest(bad), { jwt: "x", fetchImpl: fakePinata().impl });
    expect(res.status).to.equal(400);
    expect(((await res.json()) as any).details[0]).to.contain("issueDate");
  });

  it("rejects broken JSON and other content types", async function () {
    expect((await handlePin(jsonRequest("{oops"), { jwt: "x" })).status).to.equal(400);
    const txt = new Request("http://localhost/api/pin", { method: "POST", body: "hello", headers: { "content-type": "text/plain" } });
    expect((await handlePin(txt, { jwt: "x" })).status).to.equal(415);
  });

  it("only accepts POST", async function () {
    const res = await handlePin(new Request("http://localhost/api/pin"), { jwt: "x" });
    expect(res.status).to.equal(405);
  });

  it("refuses to run without the Pinata key", async function () {
    const res = await handlePin(pdfRequest(PDF), { jwt: "" });
    expect(res.status).to.equal(500);
  });

  it("hides Pinata's error details from the browser", async function () {
    const res = await handlePin(pdfRequest(PDF), { jwt: "x", fetchImpl: fakePinata(false).impl });
    expect(res.status).to.equal(502);
    expect(await res.text()).to.not.contain("secret");
  });
});
