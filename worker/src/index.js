/**
 * Vizuly profile sync.
 *
 * Holds one opaque blob per account: child profiles, favourites, ratings and
 * corrections, exactly as the browser stored them. It never parses that blob,
 * so a shape change in the app needs no change here.
 *
 * No accounts and no login. One device issues a six digit code, the other
 * redeems it, and both end up pointing at the same account id. A child's
 * profile is not worth a password, and a login is a security surface with no
 * payoff (see .claude/rules/ROADMAP.md).
 *
 * Additive by design: it may never be load-bearing. A dead Worker costs the
 * sync and nothing else, because the app reads localStorage first either way.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
};

const MAX_BYTES = 200000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });

const newAccount = () => crypto.randomUUID().replace(/-/g, '');

/** Six digits, from the platform CSPRNG. Short enough to read out loud. */
const newCode = () =>
  String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');

// Account ids and codes both come from here, so anything else is a bad request.
const isAccount = (s) => /^[0-9a-f]{32}$/.test(s ?? '');
const isCode = (s) => /^[0-9]{6}$/.test(s ?? '');

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const parts = new URL(request.url).pathname.split('/');
    const route = parts[1];
    const arg = parts[2];

    // Device A: hand out a code for this account, creating one if needed.
    if (route === 'pair' && request.method === 'POST') {
      const account = isAccount(arg) ? arg : newAccount();
      const code = newCode();
      await env.SYNC.put('code:' + code, account, { expirationTtl: 600 });
      return json({ code, account, expiresIn: 600 });
    }

    // Device B: redeem the code and get the same account. One use only.
    if (route === 'claim' && request.method === 'POST') {
      if (!isCode(arg)) return json({ error: 'code_invalid' }, 400);
      const account = await env.SYNC.get('code:' + arg);
      if (!account) return json({ error: 'code_invalid' }, 404);
      await env.SYNC.delete('code:' + arg);
      return json({ account });
    }

    if (route === 'state' && isAccount(arg)) {
      if (request.method === 'GET') {
        const stored = await env.SYNC.get('state:' + arg);
        return stored
          ? new Response(stored, { headers: { ...CORS, 'content-type': 'application/json' } })
          : json(null);
      }
      if (request.method === 'PUT') {
        const body = await request.text();
        if (body.length > MAX_BYTES) return json({ error: 'too_large' }, 413);
        try { JSON.parse(body); } catch { return json({ error: 'not_json' }, 400); }
        await env.SYNC.put('state:' + arg, body);
        return json({ ok: true });
      }
    }

    return json({ error: 'not_found' }, 404);
  },
};
