// Vercel Function: POST /api/pin
// Set PINATA_JWT in the Vercel project's environment variables (never in code).
import { handlePin } from "../lib/pin";

export async function POST(request: Request): Promise<Response> {
  return handlePin(request, { jwt: process.env.PINATA_JWT ?? "" });
}
