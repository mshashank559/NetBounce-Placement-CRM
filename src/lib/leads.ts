import { supabase } from "@/integrations/supabase/client";

let cachedLeads: any[] | null = null;
let lastFetchTime = 0;
let pendingPromise: Promise<any[]> | null = null;
const CACHE_TTL = 1000 * 60 * 2; // 2 minutes in-memory cache

export function invalidateLeadsCache() {
  cachedLeads = null;
  lastFetchTime = 0;
}

const ESSENTIAL_LEAD_COLUMNS = `
  unique_id,
  display_id,
  name,
  email,
  phone,
  technology,
  lead_status,
  created_at,
  lead_generated_by,
  assigned_to,
  team_lead_id,
  lead_source,
  lead_category,
  agreement_status,
  university
`;

/**
 * Fetches leads from the database with controlled concurrency and selective columns
 * to prevent Supabase connection pool exhaustion and statement timeouts.
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
      // 1. Try to get total lead count (estimated to prevent statement timeout)
      let total = 0;
      const { count, error: countErr } = await supabase
        .from('leads')
        .select('unique_id', { count: 'estimated', head: true });

      if (!countErr && typeof count === 'number' && count > 0) {
        total = count;
      } else {
        total = 9000; // sensible upper bound fallback
      }

      // 2. Fetch chunks sequentially (never flood database connection pool with parallel Promise.all)
      let allLeads: any[] = [];
      for (let from = 0; from < total; from += STEP) {
        const to = from + STEP - 1;
        const { data, error } = await supabase
          .from('leads')
          .select(ESSENTIAL_LEAD_COLUMNS)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) {
          console.warn(`fetchAllLeads chunk [${from}-${to}] failed:`, error);
          break;
        }

        if (data && data.length > 0) {
          allLeads.push(...data);
          if (data.length < STEP) break; // Reached last chunk
        } else {
          break;
        }

        // Small 30ms throttle between chunks to allow other app queries (notifications, SLA) to breathe
        await new Promise(r => setTimeout(r, 30));
      }

      if (allLeads.length > 0) {
        cachedLeads = allLeads;
        lastFetchTime = Date.now();
        return allLeads;
      }

      return cachedLeads || [];
    } catch (err) {
      console.error('fetchAllLeads exception:', err);
      return cachedLeads || [];
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

