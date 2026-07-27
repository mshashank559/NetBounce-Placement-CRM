import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches all leads from the database, handling Supabase's default 1000-row pagination limit.
 */
export async function fetchAllLeads() {
  const { count, error: countErr } = await (supabase.rpc as any)('get_leads_v2', {}, { count: 'exact', head: true });

  if (countErr) {
    console.error("Error fetching leads count:", countErr);
    throw countErr;
  }

  const total = count || 0;
  if (total === 0) return [];

  const step = 1000;
  const chunkRanges: { from: number; to: number }[] = [];

  for (let from = 0; from < total; from += step) {
    const to = Math.min(from + step - 1, total - 1);
    chunkRanges.push({ from, to });
  }

  let allLeads: any[] = [];
  const BATCH_SIZE = 2; // Process 2 ranges at a time to prevent database connection saturation

  for (let i = 0; i < chunkRanges.length; i += BATCH_SIZE) {
    const batch = chunkRanges.slice(i, i + BATCH_SIZE);
    const promises = batch.map(({ from, to }) =>
      (supabase.rpc as any)('get_leads_v2', {}).range(from, to)
    );

    const results = await Promise.all(promises);

    for (const r of results) {
      if (r.error) {
        console.error("Error fetching leads range batch:", r.error);
        throw r.error;
      }
      if (r.data) {
        allLeads = [...allLeads, ...r.data];
      }
    }
  }

  // Ensure items are ordered by created_at descending (newest first)
  allLeads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return allLeads;
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

