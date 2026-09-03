import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateAccessCode, hashAccessCode } from "@/lib/sessions/tokens";

const ROTATION_SECONDS = 60;

export async function rotateAccessCode(eventId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const code = generateAccessCode();
  const hash = hashAccessCode(code);
  const expiresAt = new Date(Date.now() + ROTATION_SECONDS * 1000);

  await supabase
    .from("events")
    .update({ access_code_hash: hash, access_code_expires_at: expiresAt.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", eventId);

  await supabase
    .from("public_events")
    .update({
      access_challenge: { code, expiresAt: expiresAt.toISOString(), rotationSeconds: ROTATION_SECONDS },
      updated_at: new Date().toISOString(),
    })
    .eq("event_id", eventId);

  return code;
}

export async function validateAccessCode(eventId: string, inputCode: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("events")
    .select("require_live_code, access_code_hash, access_code_expires_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!data) return false;

  if (!data.require_live_code) return true;
  if (!data.access_code_hash || !data.access_code_expires_at) return false;

  const expiresAt = new Date(data.access_code_expires_at);
  if (expiresAt < new Date()) return false;

  const inputHash = hashAccessCode(inputCode);
  return inputHash === data.access_code_hash;
}
