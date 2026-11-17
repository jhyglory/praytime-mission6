import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createPrayerApi } from "./api";
import { createPrayerRepository, type PrayerScope } from "./repository";
import { validatePrayerConfiguration } from "./configuration";

function repository(scope: PrayerScope) {
  // These server-only variables deliberately have no signup/VITE/NEXT_PUBLIC fallback.
  const { url, key } = validatePrayerConfiguration(process.env.PRAYER_SUPABASE_URL,
    scope === "public" ? process.env.PRAYER_SUPABASE_PUBLISHABLE_KEY : process.env.PRAYER_SUPABASE_SECRET_KEY, scope);
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
      // Opaque API keys belong in apikey, never in the JWT Authorization slot.
      if ((key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      return fetch(input, { ...init, headers, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) });
    } },
  });
  return createPrayerRepository(client, scope);
}

export const prayerApi = createPrayerApi({ repository });
