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
