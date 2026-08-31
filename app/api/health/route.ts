/**
 * Lightweight health/readiness check. Reports whether the Supabase
 * environment is wired up without exposing any secret values.
 *
 * `supabaseKeyRole` decodes only the (non-secret) `role` claim of the key so
 * you can confirm you supplied the `service_role` key and not the `anon` key,
 * which RLS would block.
 */
function keyRole(key: string | undefined): string {
  if (!key) return "missing";
  if (key.startsWith("sb_secret_")) return "service_role (sb_secret_…)";
  if (key.startsWith("sb_publishable_")) return "anon (sb_publishable_… — WRONG)";
  const parts = key.split(".");
  if (parts.length === 3) {
    try {
      const json = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf8"),
      ) as { role?: string };
      return json.role ?? "unknown-jwt";
    } catch {
      return "unparseable-jwt";
    }
  }
  return "unknown-format";
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return Response.json({
    status: "ok",
    supabaseConfigured: Boolean(url && key),
    supabaseUrlHost: url ? new URL(url).host : null,
    supabaseKeyRole: keyRole(key),
    time: new Date().toISOString(),
  });
}
