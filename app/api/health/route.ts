/**
 * Lightweight health/readiness check. Reports whether the Supabase
 * environment is wired up without exposing any secret values.
 */
export async function GET() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  return Response.json({
    status: "ok",
    supabaseConfigured: configured,
    time: new Date().toISOString(),
  });
}
