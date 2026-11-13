// Real end-to-end test of the /api/pin logic with your own Pinata key:
// 1) upload a small sample certificate PDF, 2) build + check its metadata, 3) upload the metadata.
// Run:  set -a && . ~/credchain-secrets.env && set +a && npx hardhat run scripts/pin-smoke.ts
import { handlePin } from "../lib/pin";
import { sha256Hex, buildMetadata } from "../lib/metadata";

// A tiny but real one-page PDF that says "CredChain practice certificate"
function samplePdf(): Uint8Array {
  const text = "BT /F1 18 Tf 72 720 Td (CredChain practice certificate - TEST DATA) Tj ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { pdf += `${String(o).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

async function main() {
  const jwt = process.env.PINATA_JWT ?? "";
  const gateway = (cid: string) => `https://ipfs.io/ipfs/${cid}`;

  // 1) Upload the PDF, the same way the issuer page will call /api/pin
  const pdf = samplePdf();
  const form = new FormData();
  form.append("file", new Blob([pdf], { type: "application/pdf" }), "certificate.pdf");
  const pdfRes = await handlePin(new Request("http://local/api/pin", { method: "POST", body: form }), { jwt });
  const pdfOut = (await pdfRes.json()) as any;
  console.log("PDF upload:     ", pdfRes.status, pdfOut);
  if (pdfRes.status !== 200) return;

  // 2) Build the metadata with the PDF's fingerprint
  const documentHash = await sha256Hex(pdf);
  const meta = buildMetadata({
    recipientName: "Test Student",
    credentialTitle: "Web Basics",
    issuerName: "Raxwo Practice Institute",
    issueDate: new Date().toISOString().slice(0, 10),
    documentUri: pdfOut.uri,
    documentHash,
  });

  // 3) Upload the metadata JSON
  const metaRes = await handlePin(
    new Request("http://local/api/pin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(meta) }),
    { jwt },
  );
  const metaOut = (await metaRes.json()) as any;
  console.log("Metadata upload:", metaRes.status, metaOut);
  if (metaRes.status !== 200) return;

  console.log("\nPDF fingerprint (docHash for issue):", documentHash);
  console.log("Metadata uri (uri for issue):       ", metaOut.uri);
  console.log("\nOpen in the browser:");
  console.log("  PDF:      ", gateway(pdfOut.cid));
  console.log("  Metadata: ", gateway(metaOut.cid));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
