// Supabase Edge Function: send-email
// Sends transactional emails via Resend when a user registers, applies to be
// an ambassador, or applies to be an artisan.
//
// Invoked by Supabase Database Webhooks (INSERT on profiles / ambassadors /
// artisans). Secured by a shared secret header so only your webhooks can call it.
//
// Deploy:  supabase functions deploy send-email --no-verify-jwt
// Secrets: RESEND_API_KEY, EMAIL_FROM, WEBHOOK_SECRET
//          (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are provided automatically)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'Lezerv <hello@lezerv.com>';
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const BRAND = '#002a42';

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1a1c1e;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="text-align:center;padding:16px 0;">
        <span style="font-size:22px;font-weight:bold;color:${BRAND};">Lezerv</span>
      </div>
      <div style="background:#fff;border-radius:16px;padding:32px;border:1px solid #e2e2e5;">
        <h1 style="font-size:22px;color:${BRAND};margin:0 0 12px;">${title}</h1>
        ${bodyHtml}
      </div>
      <p style="text-align:center;color:#72787e;font-size:12px;margin-top:24px;">
        Lezerv · Verified home services in Lagos<br/>You're receiving this because you have a Lezerv account.
      </p>
    </div></body></html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;background:${BRAND};color:#fff;text-decoration:none;padding:12px 24px;border-radius:9999px;font-weight:bold;">${label}</a>`;
}

const SITE = 'https://www.lezerv.com';

interface EmailSpec { to: string; subject: string; html: string; }

async function lookupEmailByUserId(userId: string): Promise<{ email?: string; name?: string }> {
  if (!userId || !SUPABASE_URL || !SERVICE_KEY) return {};
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=email,full_name`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const rows = await r.json();
    return { email: rows?.[0]?.email, name: rows?.[0]?.full_name };
  } catch {
    return {};
  }
}

async function buildEmail(table: string, record: Record<string, any>): Promise<EmailSpec | null> {
  const firstName = (n?: string) => (n ? n.split(' ')[0] : 'there');

  if (table === 'profiles') {
    if (!record.email) return null;
    return {
      to: record.email,
      subject: 'Welcome to Lezerv 🎉',
      html: shell(`Welcome, ${firstName(record.full_name)}!`,
        `<p>Your Lezerv account is ready. Post a job and we'll match you with a verified artisan near you — plumbing, power, cooling, cleaning and more.</p>
         <p>Chat and pay safely, all in one place.</p>${btn(`${SITE}/post-job`, 'Apply for a service')}`),
    };
  }

  if (table === 'ambassadors') {
    if (!record.email) return null;
    return {
      to: record.email,
      subject: "You're a Lezerv Ambassador! 🚀",
      html: shell(`Welcome aboard, ${firstName(record.name)}!`,
        `<p>You're now a Lezerv Ambassador. Share your referral code and earn points every time someone books through you.</p>
         <p style="margin:16px 0;">Your referral code:</p>
         <div style="font-size:20px;font-weight:bold;letter-spacing:2px;color:${BRAND};background:#f3f3f6;padding:12px;border-radius:10px;text-align:center;">${record.referral_code ?? ''}</div>
         ${btn(`${SITE}/ambassador`, 'Go to my dashboard')}`),
    };
  }

  if (table === 'artisans') {
    const { email } = await lookupEmailByUserId(record.user_id);
    if (!email) return null;
    return {
      to: email,
      subject: 'We received your artisan application ✅',
      html: shell(`Thanks, ${firstName(record.display_name)}!`,
        `<p>We've received your application to become a Lezerv artisan. Our team will review your details and verify your documents.</p>
         <p>You'll get another email once you're approved — then you can turn on availability and start receiving jobs in your areas.</p>
         ${btn(`${SITE}/become-artisan`, 'View my application')}`),
    };
  }

  return null;
}

async function sendViaResend(spec: EmailSpec): Promise<Response> {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to: [spec.to], subject: spec.subject, html: spec.html }),
  });
  return r;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Shared-secret check (set the same value in the webhook header + function secret)
  if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: any;
  try { payload = await req.json(); } catch { return new Response('Bad request', { status: 400 }); }

  // Supabase DB webhook payload: { type, table, record, schema, old_record }
  const table = payload.table as string;
  const record = payload.record as Record<string, any>;
  if (!table || !record) return new Response('No record', { status: 200 });

  try {
    const spec = await buildEmail(table, record);
    if (!spec) return new Response('No email for this event', { status: 200 });
    const res = await sendViaResend(spec);
    const body = await res.text();
    if (!res.ok) console.error('Resend error:', res.status, body);
    return new Response(JSON.stringify({ ok: res.ok }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('send-email failed:', err);
    return new Response('Error', { status: 200 }); // don't fail the webhook/insert
  }
});
