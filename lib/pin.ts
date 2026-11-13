// pin.ts: the logic behind /api/pin.
// Receives a certificate PDF (or its metadata JSON) from the issuer page and uploads it to IPFS via Pinata.
// The Pinata key (JWT) stays on the server. The browser never sees it.

import { validateMetadata } from "./metadata";

export const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_JSON_BYTES = 100 * 1024;     // 100 KB
const PINATA_UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";

export interface PinOptions {
  jwt: string;
  fetchImpl?: typeof fetch; // lets tests use a fake Pinata
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function handlePin(request: Request, opts: PinOptions): Promise<Response> {
  if (request.method !== "POST") return json(405, { error: "Use POST" });
  if (!opts.jwt) return json(500, { error: "Server is not configured" });

  const contentType = request.headers.get("content-type") ?? "";
  let file: Blob;
  let name: string;

  if (contentType.startsWith("multipart/form-data")) {
    // ----- A PDF upload -----
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json(400, { error: "Could not read the upload" });
    }
    const f = form.get("file");
    if (!(f instanceof Blob)) return json(400, { error: "Send the PDF in a form field called 'file'" });
    if (f.size === 0) return json(400, { error: "The file is empty" });
    if (f.size > MAX_PDF_BYTES) return json(413, { error: "The PDF is too big (max 5 MB)" });

    // Check the file really is a PDF: every PDF starts with "%PDF-"
    const head = new TextDecoder().decode(await f.slice(0, 5).arrayBuffer());
    if (head !== "%PDF-") return json(415, { error: "Only PDF files are allowed" });

    file = new Blob([await f.arrayBuffer()], { type: "application/pdf" });
    name = "credential.pdf";
  } else if (contentType.startsWith("application/json")) {
    // ----- Certificate metadata -----
    const text = await request.text();
    if (text.length > MAX_JSON_BYTES) return json(413, { error: "Metadata is too big" });
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return json(400, { error: "Metadata is not valid JSON" });
    }
    const check = validateMetadata(data);
    if (!check.ok) return json(400, { error: "Invalid metadata", details: check.errors });

    file = new Blob([JSON.stringify(data)], { type: "application/json" });
    name = "metadata.json";
  } else {
    return json(415, { error: "Send a PDF (multipart/form-data) or metadata (application/json)" });
  }

  // ----- Upload to Pinata (public IPFS) -----
  const body = new FormData();
  body.append("file", file, name);
  body.append("network", "public");
  body.append("name", name);

  const doFetch = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(PINATA_UPLOAD_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.jwt}` },
      body,
    });
  } catch {
    return json(502, { error: "Could not reach IPFS service" });
  }
  // Do not pass Pinata's error details to the browser
  if (!res.ok) return json(502, { error: "Upload to IPFS failed" });

  const out = (await res.json().catch(() => null)) as { data?: { cid?: string; size?: number } } | null;
  const cid = out?.data?.cid;
  if (!cid) return json(502, { error: "Upload to IPFS failed" });

  return json(200, { cid, uri: `ipfs://${cid}`, size: out?.data?.size ?? file.size });
}
