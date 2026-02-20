import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// REMOVED: APPROVE_WEBHOOK constant — approval now handled by RPC approve_ai_response directly in PostgreSQL
// REMOVED: dispatch_approved endpoint — no longer needed, frontend calls RPC instead

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const { endpoint, params, action, table, data, filters, select, order, id } = body;

    if (action) {
      let result;
      switch (action) {
        case "select": {
          let q = sb.from(table).select(select || "*");
          if (filters) for (const f of filters) q = q.filter(f.col, f.op, f.val);
          if (order) q = q.order(order.col, { ascending: order.asc ?? true });
          result = await q;
          break;
        }
        case "insert": { result = await sb.from(table).insert(data).select(); break; }
        case "update": { result = await sb.from(table).update(data).eq("id", id).select(); break; }
        case "delete": { result = await sb.from(table).delete().eq("id", id).select(); break; }
        case "soft_delete": { result = await sb.from(table).update({ disable: true }).eq("id", id).select(); break; }
        default: return json({ error: "Invalid action" }, 400);
      }
      if (result.error) return json({ error: result.error.message }, 400);
      return json({ data: result.data });
    }

    if (endpoint === "incoming_message") {
      const { address, channel_id, text, external_ref, person_name, ad_external_ref } = params || {};
      if (!address || !channel_id) return json({ error: "address and channel_id required" }, 400);
      const { data: d, error } = await sb.rpc('process_incoming_message', {
        p_address: String(address), p_channel_id: Number(channel_id),
        p_text: text || null, p_external_ref: external_ref || null,
        p_person_name: person_name || null, p_ad_external_ref: ad_external_ref || null,
      });
      if (error) return json({ error: error.message }, 400);
      if (d?.error) return json({ error: d.error }, 400);
      return json({ data: d });
    }

    if (endpoint === "outgoing_message") {
      const { address, channel_id, text, external_ref, status } = params || {};
      if (!address || !channel_id) return json({ error: "address and channel_id required" }, 400);
      const { data: d, error } = await sb.rpc('process_outgoing_message', {
        p_address: String(address), p_channel_id: Number(channel_id),
        p_text: text || null, p_external_ref: external_ref || null,
        p_status: status || 'send',
      });
      if (error) return json({ error: error.message }, 400);
      if (d?.error) return json({ error: d.error }, 400);
      return json({ data: d });
    }

    if (endpoint === "conversations") {
      const { provider, channel_id, branch_id, status, search, page = 0, limit = 50, date_from, date_to } = params || {};
      const { data: d, error } = await sb.rpc('get_conversations', {
        p_provider: provider || null, p_channel_id: channel_id || null,
        p_branch_id: branch_id || null, p_status: status || null,
        p_search: search || null, p_limit: limit, p_offset: page * limit,
        p_date_from: date_from || null, p_date_to: date_to || null,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ data: d || [] });
    }

    // OPTIMIZED: Single RPC call instead of 7 sequential queries
    if (endpoint === "chat") {
      const { conversation_id } = params;
      if (!conversation_id) return json({ error: "conversation_id required" }, 400);
      const { data: d, error } = await sb.rpc('get_chat_detail', {
        p_conversation_id: Number(conversation_id),
      });
      if (error) return json({ error: error.message }, 400);
      return json({ data: d });
    }

    if (endpoint === "channels") {
      const { data: d } = await sb.from('channels').select('id, name, address, branch_id, branches(name), id_channel_provider, channel_providers(name)').order('name');
      return json({ data: d });
    }
    if (endpoint === "branches") {
      const { data: d } = await sb.from('branches').select('*').order('name');
      return json({ data: d });
    }
    if (endpoint === "stats") {
      const { data: d, error } = await sb.rpc('get_crm_stats');
      if (error) return json({ error: error.message }, 400);
      return json({ data: d });
    }
    if (endpoint === "msgs_per_day") {
      const { days = 30 } = params || {};
      const { data: d, error } = await sb.rpc('get_msgs_per_day', { p_days: days });
      if (error) return json({ error: error.message }, 400);
      return json({ data: d || [] });
    }
    if (endpoint === "volume_by_channel") {
      const { data: d, error } = await sb.rpc('get_volume_by_channel');
      if (error) return json({ error: error.message }, 400);
      return json({ data: d || [] });
    }
    if (endpoint === "volume_by_provider") {
      const { data: d, error } = await sb.rpc('get_volume_by_provider');
      if (error) return json({ error: error.message }, 400);
      return json({ data: d || [] });
    }

    if (endpoint === "channel_analysis") {
      const { date_from, date_to, branch_id, provider, channel_id } = params || {};
      const { data: d, error } = await sb.rpc('get_channel_analysis', {
        p_date_from: date_from || null, p_date_to: date_to || null,
        p_branch_id: branch_id ? parseInt(branch_id) : null,
        p_provider: provider || null, p_channel_id: channel_id ? parseInt(channel_id) : null,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ data: d || [] });
    }

    if (endpoint === "top_leads") {
      const { limit = 20 } = params || {};
      const { data: d, error } = await sb.rpc('get_top_leads', { p_limit: limit });
      if (error) return json({ error: error.message }, 400);
      return json({ data: d || [] });
    }
    if (endpoint === "unanswered") {
      const { limit = 30 } = params || {};
      const { data: d, error } = await sb.rpc('get_unanswered_conversations', { p_limit: limit });
      if (error) return json({ error: error.message }, 400);
      return json({ data: d || [] });
    }
    if (endpoint === "person_detail") {
      const { person_id } = params;
      const { data: d, error } = await sb.rpc('get_person_detail', { p_person_id: person_id });
      if (error) return json({ error: error.message }, 400);
      return json({ data: d });
    }
    if (endpoint === "search_persons") {
      const { search, page = 0, limit = 50 } = params || {};
      const { data: d, error } = await sb.rpc('search_persons', { p_search: search || null, p_limit: limit, p_offset: page * limit });
      if (error) return json({ error: error.message }, 400);
      return json({ data: d || [] });
    }
    if (endpoint === "person_conversations") {
      const { person_id } = params;
      const { data: d } = await sb.from('person_conversation').select('id, address, id_conversation, conversations(id, start_date)').eq('id_person', person_id).order('id', { ascending: false });
      return json({ data: d });
    }

    if (endpoint === "person_full") {
      const { person_id } = params;
      if (!person_id) return json({ error: "person_id required" }, 400);
      const { data: d, error } = await sb.rpc('get_person_full_profile', { p_person_id: person_id });
      if (error) return json({ error: error.message }, 400);
      return json({ data: d });
    }

    if (endpoint === "persons_enriched") {
      const { search, tag_curso, provincia, pais, has_phone, has_email, page = 0, limit = 50 } = params || {};
      const { data: d, error } = await sb.rpc('get_persons_enriched', {
        p_search: search || null, p_tag_curso: tag_curso || null,
        p_provincia: provincia || null, p_pais: pais || null,
        p_has_phone: has_phone ?? null, p_has_email: has_email ?? null,
        p_limit: limit, p_offset: page * limit,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ data: d });
    }

    if (endpoint === "persons_filter_options") {
      const { data: d, error } = await sb.rpc('get_persons_filter_options');
      if (error) return json({ error: error.message }, 400);
      return json({ data: d });
    }

    if (endpoint === "send_to_person") {
      const { person_id, person_address, channel_id, text, attachment_url, attachment_name } = params || {};
      if (!person_id || !person_address || !channel_id) return json({ error: "person_id, person_address, and channel_id are required" }, 400);
      if (!text?.trim() && !attachment_url?.trim()) return json({ error: "text or attachment_url required" }, 400);
      let scId: number | null = null; let convId: number | null = null;
      const { data: existingPCs } = await sb.from('person_conversation').select('id, id_conversation, address').eq('id_person', person_id).eq('address', person_address);
      if (existingPCs && existingPCs.length > 0) {
        for (const pc of existingPCs) {
          const { data: sc } = await sb.from('system_conversation').select('id, id_channel').eq('id_conversation', pc.id_conversation).eq('id_channel', channel_id).single();
          if (sc) { scId = sc.id; convId = pc.id_conversation; break; }
        }
      }
      if (!scId) {
        const { data: newConv, error: convErr } = await sb.from('conversations').insert({ start_date: new Date().toISOString() }).select().single();
        if (convErr) return json({ error: "Error creating conversation: " + convErr.message }, 400);
        convId = newConv.id;
        const { error: pcErr } = await sb.from('person_conversation').insert({ id_person: person_id, id_conversation: convId, address: person_address });
        if (pcErr) return json({ error: "Error creating person_conversation: " + pcErr.message }, 400);
        const { data: newSC, error: scErr } = await sb.from('system_conversation').insert({ id_channel: channel_id, id_conversation: convId }).select().single();
        if (scErr) return json({ error: "Error creating system_conversation: " + scErr.message }, 400);
        scId = newSC.id;
      }
      const ts = new Date().toISOString();
      const { data: newInt, error: intErr } = await sb.from('interactions').insert({ id_system_conversation: scId, text: text?.trim() || null, time_stamp: ts, status: 'new', external_ref: 'crm-person-' + Date.now() }).select().single();
      if (intErr) return json({ error: "Error creating interaction: " + intErr.message }, 400);
      if (attachment_url?.trim() && newInt?.id) {
        const ext = (attachment_url.split('.').pop() || 'file').split('?')[0].toLowerCase();
        const { data: mediaInserted } = await sb.from('medias').insert({ name: attachment_name?.trim() || 'adjunto', type: ext, content_dir: attachment_url.trim() }).select().single();
        if (mediaInserted?.id) await sb.from('interaction_medias').insert({ interaction_id: newInt.id, media_id: mediaInserted.id });
      }
      return json({ data: { success: true, conversation_id: convId, interaction_id: newInt?.id } });
    }

    if (endpoint === "persons_list") {
      const { search, provider, has_email, course_interest, page = 0, limit = 50 } = params || {};
      let q = sb.from('persons').select('id, first_name, last_name, email, birth_date, location_address, country, state_province, national_id, creation_datetime', { count: 'exact' });
      if (search) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,national_id.ilike.%${search}%`);
      if (has_email === true) q = q.not('email', 'is', null).neq('email', '');
      q = q.order('id', { ascending: false }).range(page * limit, (page + 1) * limit - 1);
      const { data: persons, count, error } = await q;
      if (error) return json({ error: error.message }, 400);
      const enriched = [];
      for (const p of (persons || [])) {
        const { data: pcs } = await sb.from('person_conversation').select('address, id_conversation').eq('id_person', p.id);
        const provAddrs: Record<string, string[]> = {};
        if (pcs && pcs.length > 0) {
          for (const pc of pcs) {
            if (!pc.id_conversation) continue;
            const { data: sc } = await sb.from('system_conversation').select('channels(channel_providers(name))').eq('id_conversation', pc.id_conversation).single();
            const prov = sc?.channels?.channel_providers?.name || 'unknown';
            if (!provAddrs[prov]) provAddrs[prov] = [];
            if (pc.address && !provAddrs[prov].includes(pc.address)) provAddrs[prov].push(pc.address);
          }
        }
        enriched.push({ ...p, channel_addresses: provAddrs, conversation_count: (pcs || []).length });
      }
      return json({ data: enriched, total: count });
    }

    if (endpoint === "update_person") {
      const { person_id, updates } = params;
      if (!person_id || !updates) return json({ error: "person_id and updates required" }, 400);
      const { data: d, error } = await sb.from('persons').update(updates).eq('id', person_id).select();
      if (error) return json({ error: error.message }, 400);
      return json({ data: d });
    }

    return json({ error: "Unknown endpoint or action" }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});
