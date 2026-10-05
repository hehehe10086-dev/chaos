// GET /api/health — confirms the API is reachable.
export function GET() {
  return Response.json({ ok: true, time: new Date().toISOString() });
}
