import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:pg@8.11.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let client: postgres.Client | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token de autorizacao ausente" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Usuario nao autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: callerProfile } = await supabaseClient
      .from("profiles")
      .select("permissao")
      .eq("id", caller.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.permissao !== "administrador") {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem restaurar backup" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const backupJson = await req.json();

    if (!backupJson || !backupJson.data) {
      return new Response(
        JSON.stringify({ error: "Backup JSON invalido: secao data ausente" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    client = new postgres.Client({ connectionString: dbUrl });
    await client.connect();

    const result = await client.query(
      "SELECT public.restore_backup($1::jsonb) AS result",
      [JSON.stringify(backupJson)]
    );

    const restoreResult = result.rows[0]?.result;

    return new Response(
      JSON.stringify(restoreResult),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno do servidor";

    // If the function raised RESTORE_FAILED:..., extract the JSON report
    if (msg.startsWith("RESTORE_FAILED:")) {
      const reportJson = msg.substring("RESTORE_FAILED:".length);
      try {
        const report = JSON.parse(reportJson);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Falha ao restaurar uma ou mais tabelas - restauracao cancelada (rollback)",
            tables: report,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch {
        // fall through to generic error
      }
    }

    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } finally {
    if (client) {
      try { await client.end(); } catch { /* ignore */ }
    }
  }
});
