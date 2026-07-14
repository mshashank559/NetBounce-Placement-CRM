import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches all leads from the database, handling Supabase's default 1000-row pagination limit.
 */
export async function fetchAllLeads() {
  const { data, error } = await supabase.rpc('get_leads_v2');

  if (error) {
    console.error("Error fetching leads via RPC:", error);
    throw error;
  }

  const sortedLeads = [...(data || [])];
  sortedLeads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return sortedLeads;
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

