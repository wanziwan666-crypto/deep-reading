export async function POST() {
  return new Response(JSON.stringify({ error: "legacy_removed" }), { status: 410 })
}
