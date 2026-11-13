import { expect } from "chai";
import {
  sha256Hex, pdfMatchesHash, buildMetadata, validateMetadata, expiryToTimestamp,
} from "../lib/metadata";

const enc = new TextEncoder();
// Known answer: SHA-256 of the text "abc" (from the official SHA-256 test vectors)
const ABC_HASH = "0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

function sample() {
  return buildMetadata({
    recipientName: "Test Student",
    credentialTitle: "Web Basics",
    issuerName: "Raxwo Practice Institute",
    issueDate: "2026-11-11",
    documentUri: "ipfs://bafy-example-pdf",
    documentHash: ABC_HASH,
  });
}

describe("metadata.ts", function () {
  // ---------- Fingerprint ----------

  it("makes the correct SHA-256 fingerprint (known test value)", async function () {
    expect(await sha256Hex(enc.encode("abc"))).to.equal(ABC_HASH);
  });

  it("gives a completely different fingerprint when one letter changes", async function () {
    const a = await sha256Hex(enc.encode("Certificate: Grade A"));
    const b = await sha256Hex(enc.encode("Certificate: Grade B"));
    expect(a).to.not.equal(b);
    expect(a).to.match(/^0x[0-9a-f]{64}$/);
  });

  it("detects the original file and rejects an edited one", async function () {
    const original = enc.encode("%PDF-1.7 original certificate");
    const onChain = await sha256Hex(original);
    expect(await pdfMatchesHash(original, onChain)).to.equal(true);
    expect(await pdfMatchesHash(enc.encode("%PDF-1.7 edited certificate"), onChain)).to.equal(false);
    expect(await pdfMatchesHash(original, onChain.toUpperCase().replace("0X", "0x"))).to.equal(true);
  });

  // ---------- Build ----------

  it("builds metadata with a readable name and the credential details", function () {
    const m = sample();
    expect(m.name).to.equal("Web Basics: Test Student");
    expect(m.credential.issuerName).to.equal("Raxwo Practice Institute");
    expect(m.credential).to.not.have.property("grade");
  });

  // ---------- Validate ----------

  it("accepts correct metadata", function () {
    expect(validateMetadata(sample())).to.deep.equal({ ok: true, errors: [] });
  });

  it("reports missing fields", function () {
    const m: any = sample();
    m.credential.recipientName = "  ";
    delete m.description;
    const r = validateMetadata(m);
    expect(r.ok).to.equal(false);
    expect(r.errors).to.include("description is required");
    expect(r.errors).to.include("credential.recipientName is required");
  });

  it("rejects a bad date, and an expiry before the issue date", function () {
    const m: any = sample();
    m.credential.issueDate = "2026-02-30"; // not a real date
    expect(validateMetadata(m).errors[0]).to.contain("issueDate");
    const m2: any = sample();
    m2.credential.expiryDate = "2026-01-01";
    expect(validateMetadata(m2).errors).to.include("credential.expiryDate must be after issueDate");
  });

  it("rejects a wrong document hash or a non-IPFS link", function () {
    const m: any = sample();
    m.credential.documentHash = "0x1234";
    m.credential.documentUri = "https://example.com/file.pdf";
    const r = validateMetadata(m);
    expect(r.errors.some((e) => e.includes("documentHash"))).to.equal(true);
    expect(r.errors.some((e) => e.includes("documentUri"))).to.equal(true);
  });

  // ---------- Expiry for the contract ----------

  it("turns an expiry date into the contract's expiresAt (0 = never)", function () {
    expect(expiryToTimestamp()).to.equal(0n);
    expect(expiryToTimestamp("2027-01-01")).to.equal(1798847999n); // 2027-01-01 23:59:59 UTC
  });
});
