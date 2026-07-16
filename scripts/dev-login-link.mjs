// Dev helper: creates a teacher session and prints the auth cookies to set
// on localhost so the browser is signed in. Usage: node scripts/dev-login-link.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const LMS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of fs.readFileSync(path.join(LMS_ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: env.TEACHER_EMAIL,
});
if (linkErr) throw linkErr;

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
  type: "magiclink",
  token_hash: linkData.properties.hashed_token,
});
if (otpErr) throw otpErr;

const session = otpData.session;
const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const name = `sb-${projectRef}-auth-token`;
const value =
  "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");

const CHUNK = 3180;
const cookies = [];
if (value.length <= CHUNK) {
  cookies.push([name, value]);
} else {
  for (let i = 0; i * CHUNK < value.length; i++) {
    cookies.push([`${name}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK)]);
  }
}
console.log(JSON.stringify(cookies));
