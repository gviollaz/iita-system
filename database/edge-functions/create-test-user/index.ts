import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Utility function para crear usuarios de prueba
// NO usar en produccion — solo para desarrollo/testing
Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data, error } = await supabase.auth.admin.createUser({
      email: 'testgv@iita.com.ar',
      password: 'TestGV2025!',
      email_confirm: true,
      user_metadata: { name: 'Test GV' }
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'testgv@iita.com.ar',
      password: 'TestGV2025!',
    });

    return new Response(JSON.stringify({
      user_created: data.user?.id,
      login_test: loginError ? 'FAILED: ' + loginError.message : 'SUCCESS',
      access_token_preview: loginData?.session?.access_token?.substring(0, 30) + '...'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
