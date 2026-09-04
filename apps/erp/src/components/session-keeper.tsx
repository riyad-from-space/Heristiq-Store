"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps the Supabase session alive from the browser.
 *
 * The auth proxy used to refresh the access token on every request. Cloudflare
 * Workers cannot run Node.js proxy code, and a Server Component can read cookies
 * but not write them, so refresh lives here instead: supabase-js refreshes on a
 * timer while a tab is open and writes the new tokens to cookies, which the
 * server reads on the next render.
 *
 * Renders nothing. Mounted once in the authenticated layout.
 */
export function SessionKeeper() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Signed out here, in another tab, or the refresh token expired.
      if (event === "SIGNED_OUT") router.replace("/login");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
