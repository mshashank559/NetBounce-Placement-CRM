import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches all leads from the database, handling Supabase's default 1000-row pagination limit.
 */
export async function fetchAllLeads() {
  try {
    const { count, error: countErr } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true });

    const total = count ?? 0;

    if (total === 0) {
      const { data: fallbackData } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3000);
      return fallbackData || [];
    }

    const step = 1000;
    let allLeads: any[] = [];

    for (let from = 0; from < total; from += step) {
      const to = Math.min(from + step - 1, total - 1);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error fetching leads chunk:', error);
        break;
      }
      if (data && data.length > 0) {
        allLeads = [...allLeads, ...data];
      }
    }

    return allLeads;
  } catch (err) {
    console.error('fetchAllLeads exception:', err);
    const { data } = await supabase.from('leads').select('*').limit(3000);
    return data || [];
  }
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

