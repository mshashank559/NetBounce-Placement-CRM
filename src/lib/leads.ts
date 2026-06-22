import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches all leads from the database, handling Supabase's default 1000-row pagination limit.
 */
export async function fetchAllLeads() {
  let allLeads: any[] = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + step - 1);
      
    if (error) {
      console.error("Error fetching leads range:", error);
      throw error;
    }
    
    if (data && data.length > 0) {
      allLeads = [...allLeads, ...data];
      if (data.length < step) {
        hasMore = false;
      } else {
        from += step;
      }
    } else {
      hasMore = false;
    }
  }
  
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

