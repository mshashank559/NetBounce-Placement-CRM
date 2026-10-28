import { supabase } from "@/integrations/supabase/client";

let cachedLeads: any[] | null = null;
let lastFetchTime = 0;
let pendingPromise: Promise<any[]> | null = null;
const CACHE_TTL = 1000 * 60 * 2; // 2 minutes in-memory cache

export function invalidateLeadsCache() {
  cachedLeads = null;
  lastFetchTime = 0;
}

/**
 * Fetches all leads from the database, handling Supabase's default 1000-row pagination limit.
 * Uses parallel chunk downloads and an in-memory cache for instant subsequent reads.
 */
export async function fetchAllLeads(forceFresh = false) {
  const now = Date.now();
  if (!forceFresh && cachedLeads && (now - lastFetchTime < CACHE_TTL)) {
    return cachedLeads;
  }

  if (pendingPromise) {
    return pendingPromise;
  }

  pendingPromise = (async () => {
    const STEP = 1000;
    try {
      // 1. Try to get exact total lead count
      let total = 0;
      const { count, error: countErr } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true });

      if (!countErr && typeof count === 'number' && count > 0) {
        total = count;
      } else {
        const { count: c2 } = await supabase
          .from('leads')
          .select('unique_id', { count: 'exact', head: true });
        if (typeof c2 === 'number' && c2 > 0) total = c2;
      }

      // 2. If total is known, parallel download all chunks with retry
      if (total > 0) {
        const chunkPromises = [];
        for (let from = 0; from < total; from += STEP) {
          const to = Math.min(from + STEP - 1, total - 1);
          chunkPromises.push((async () => {
            let attempts = 0;
            while (attempts < 3) {
              attempts++;
              const res = await supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false })
                .range(from, to);

              if (!res.error && res.data) {
                return res.data;
              }
              if (attempts < 3) {
                await new Promise(r => setTimeout(r, 400 * attempts));
              }
            }
            return [];
          })());
        }

        const chunkResults = await Promise.all(chunkPromises);
        const allLeads = chunkResults.flat();
        if (allLeads.length > 0) {
          cachedLeads = allLeads;
          lastFetchTime = Date.now();
          return allLeads;
        }
      }

      // 3. Fallback: Sequential paging if count was 0 or parallel chunks returned empty
      let from = 0;
      let allLeads: any[] = [];
      while (true) {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + STEP - 1);

        if (error || !data || data.length === 0) break;
        allLeads.push(...data);
        if (data.length < STEP) break;
        from += STEP;
      }

      cachedLeads = allLeads;
      lastFetchTime = Date.now();
      return allLeads;
    } catch (err) {
      console.error('fetchAllLeads exception:', err);
      // Emergency fallback with sequential paging, never capping at 1000
      let from = 0;
      let allLeads: any[] = [];
      try {
        while (true) {
          const { data, error } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, from + STEP - 1);
          if (error || !data || data.length === 0) break;
          allLeads.push(...data);
          if (data.length < STEP) break;
          from += STEP;
        }
      } catch {}
      return allLeads.length > 0 ? allLeads : (cachedLeads || []);
    } finally {
      pendingPromise = null;
    }
  })();

  return pendingPromise;
}

/**
 * Normalizes a lead source string to standard casing and corrects common typos.
 */
export function normalizeSource(source: string | null | undefined): string {
  if (!source) return 'Not Specified';
  const clean = source.trim().toLowerCase();
  
  // LinkedIn typos & variants
  if (
    clean.includes('link') ||
    clean.includes('linl') ||
    clean.includes('lnk') ||
    clean.startsWith('lik') ||
    clean.startsWith('lki') ||
    clean.startsWith('lin') ||
    clean.includes('linkedin')
  ) {
    return 'LinkedIn';
  }


  // Gmail variants
  if (clean.includes('gmail') || clean.includes('google')) {
    return 'Gmail';
  }

  // WhatsApp variants
  if (clean.includes('whatsapp') || clean.includes('whats app') || clean.includes('whats-app')) {
    return 'WhatsApp';
  }

  // OPT Nation variants
  if (clean.includes('opt') || clean.includes('optnation') || clean.includes('opt nation')) {
    return 'OPT Nation';
  }

  // Default formatting: Capitalize first letter of each word
  return source
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

