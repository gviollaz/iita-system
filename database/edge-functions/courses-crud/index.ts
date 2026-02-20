import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, table, data, filters, select, order, id } = await req.json();

    let result;

    switch (action) {
      case "select": {
        let q = supabase.from(table).select(select || "*");
        if (filters) {
          for (const f of filters) {
            q = q.filter(f.col, f.op, f.val);
          }
        }
        if (order) q = q.order(order.col, { ascending: order.asc ?? true });
        result = await q;
        break;
      }
      case "insert": {
        result = await supabase.from(table).insert(data).select();
        break;
      }
      case "update": {
        result = await supabase.from(table).update(data).eq("id", id).select();
        break;
      }
      case "delete": {
        result = await supabase.from(table).delete().eq("id", id).select();
        break;
      }
      case "soft_delete": {
        result = await supabase.from(table).update({ disable: true }).eq("id", id).select();
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data: result.data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
