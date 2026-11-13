// Vercel Function: POST /api/pin
// Environment variables (set in Vercel, never in code):
//   PINATA_JWT       - Pinata key (server-only)
//   ALLOWED_ORIGINS  - web app addresses allowed to call this API, comma-separated (empty = any, testing only)
import { handlePinWithCors } from "../lib/pin";

const opts = () => ({ jwt: process.env.PINATA_JWT ?? "", allowedOrigins: process.env.ALLOWED_ORIGINS ?? "" });

export async function POST(request: Request): Promise<Response> {
  return handlePinWithCors(request, opts());
}

export async function OPTIONS(request: Request): Promise<Response> {
  return handlePinWithCors(request, opts());
}
