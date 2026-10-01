import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'server_not_configured' }, { status: 500, headers: corsHeaders })
  }

  const authorization = req.headers.get('authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return Response.json({ error: 'not_authenticated' }, { status: 401, headers: corsHeaders })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await adminClient.auth.getUser(token)
  if (userError || !userData.user) {
    return Response.json({ error: 'invalid_session' }, { status: 401, headers: corsHeaders })
  }

  // Prefer the proxy-provided client address. Never accept an IP from the JSON body.
  const forwarded = req.headers.get('x-forwarded-for') || ''
  const realIp = req.headers.get('x-real-ip') || ''
  const connectingIp = req.headers.get('cf-connecting-ip') || ''
  const ip = (connectingIp || realIp || forwarded.split(',')[0] || '').trim()

  // Basic validation for IPv4/IPv6-shaped values before sending to PostgreSQL inet.
  if (!ip || ip.length > 64 || /[^0-9a-fA-F:., ]/.test(ip)) {
    return Response.json({ error: 'ip_unavailable' }, { status: 400, headers: corsHeaders })
  }

  const userAgent = (req.headers.get('user-agent') || '').slice(0, 1000)

  const { error: insertError } = await adminClient
    .from('login_ip_audit')
    .insert({
      user_id: userData.user.id,
      ip_address: ip,
      user_agent: userAgent || null,
    })

  if (insertError) {
    return Response.json({ error: 'audit_write_failed' }, { status: 500, headers: corsHeaders })
  }

  return Response.json({ ok: true }, { status: 200, headers: corsHeaders })
})
