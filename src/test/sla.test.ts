import { describe, it, expect } from "vitest";

// The logic we implemented for filtering stale leads:
interface Lead {
  lead_status: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  created_at: string;
  updated_at: string;
}

function isLeadStale(l: Lead): boolean {
  if (['Closed', 'Non Interested'].includes(l.lead_status || '')) return false;

  if (l.lead_status === 'New') {
    const assignmentDate = l.assigned_at ? new Date(l.assigned_at) : new Date(l.created_at || l.updated_at);
    const daysSinceAssignment = (Date.now() - assignmentDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceAssignment > 5;
  }

  const hrs = (Date.now() - new Date(l.updated_at).getTime()) / 3600000;
  return hrs > 24;
}

describe("SLA Stale Lead Logic", () => {
  it("should NOT mark a 'New' lead assigned today as stale", () => {
    const lead: Lead = {
      lead_status: "New",
      assigned_to: "agent-1",
      assigned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(isLeadStale(lead)).toBe(false);
  });

  it("should NOT mark a 'New' lead assigned 4 days ago as stale", () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const lead: Lead = {
      lead_status: "New",
      assigned_to: "agent-1",
      assigned_at: fourDaysAgo,
      created_at: fourDaysAgo,
      updated_at: fourDaysAgo,
    };
    expect(isLeadStale(lead)).toBe(false);
  });

  it("should mark a 'New' lead assigned 6 days ago as stale", () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    const lead: Lead = {
      lead_status: "New",
      assigned_to: "agent-1",
      assigned_at: sixDaysAgo,
      created_at: sixDaysAgo,
      updated_at: sixDaysAgo,
    };
    expect(isLeadStale(lead)).toBe(true);
  });

  it("should mark an active 'DNR1' lead updated 25 hours ago as stale", () => {
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const lead: Lead = {
      lead_status: "DNR1",
      assigned_to: "agent-1",
      assigned_at: twentyFiveHoursAgo,
      created_at: twentyFiveHoursAgo,
      updated_at: twentyFiveHoursAgo,
    };
    expect(isLeadStale(lead)).toBe(true);
  });

  it("should NOT mark an active 'DNR1' lead updated 23 hours ago as stale", () => {
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    const lead: Lead = {
      lead_status: "DNR1",
      assigned_to: "agent-1",
      assigned_at: twentyThreeHoursAgo,
      created_at: twentyThreeHoursAgo,
      updated_at: twentyThreeHoursAgo,
    };
    expect(isLeadStale(lead)).toBe(false);
  });

  it("should NOT mark 'Closed' or 'Non Interested' leads as stale, regardless of update date", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const leadClosed: Lead = {
      lead_status: "Closed",
      assigned_to: "agent-1",
      assigned_at: tenDaysAgo,
      created_at: tenDaysAgo,
      updated_at: tenDaysAgo,
    };
    const leadNonInterested: Lead = {
      lead_status: "Non Interested",
      assigned_to: "agent-1",
      assigned_at: tenDaysAgo,
      created_at: tenDaysAgo,
      updated_at: tenDaysAgo,
    };
    expect(isLeadStale(leadClosed)).toBe(false);
    expect(isLeadStale(leadNonInterested)).toBe(false);
  });
});
