/**
 * Weekend and Extended CRM Lockdown Utility
 * 
 * Policy:
 * - Lockdown Period: Saturday 04:30 AM (IST) to Monday 07:30 PM (IST) [19:30 IST]
 * - Restricted Roles: SALES_TL, SALES_TM, LEAD_TL, LEAD_GEN
 * - Exempted Roles: ADMIN, ACCOUNTANT, ACCOUNT_MANAGER, PROCESS_ANALYST
 * - Admin Overrides: Admin can grant a temporary Weekend Pass expiring on the upcoming Monday 7:30 PM IST
 */

export const RESTRICTED_WEEKEND_ROLES = [
  'SALES_TL',
  'SALES_TM',
  'LEAD_TL',
  'LEAD_GEN',
] as const;

export const EXEMPT_WEEKEND_ROLES = [
  'ADMIN',
  'ACCOUNTANT',
  'ACCOUNT_MANAGER',
  'PROCESS_ANALYST',
] as const;

export const WEEKEND_LOCK_MESSAGE = 
  'Weekend Access Locked. Access is restricted as per company policy until Monday 7:30 PM. If you need urgent access to work, please contact the CRM Administrator for approval.';

/**
 * Returns current date/time converted into Indian Standard Time (IST / Asia/Kolkata)
 */
export const getISTDateComponents = (date: Date = new Date()) => {
  const istString = date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istDate = new Date(istString);
  return {
    dayOfWeek: istDate.getDay(), // 0 = Sun, 1 = Mon, 2 = Tue, ..., 6 = Sat
    hours: istDate.getHours(),
    minutes: istDate.getMinutes(),
    totalMinutes: istDate.getHours() * 60 + istDate.getMinutes(),
    istDate,
  };
};

/**
 * Checks if the current time falls inside the lockdown window:
 * Saturday 04:30 AM IST (270 mins) to Monday 07:30 PM IST (1170 mins)
 */
export const isWeekendLockdownActive = (date: Date = new Date()): boolean => {
  const { dayOfWeek, totalMinutes } = getISTDateComponents(date);

  // 1. Saturday: Locked starting from 04:30 AM (4*60 + 30 = 270 mins)
  if (dayOfWeek === 6) {
    return totalMinutes >= 270;
  }

  // 2. Sunday: Entire day is locked
  if (dayOfWeek === 0) {
    return true;
  }

  // 3. Monday: Locked until 07:30 PM (19*60 + 30 = 1170 mins)
  if (dayOfWeek === 1) {
    return totalMinutes < 1170;
  }

  // Tuesday (2), Wednesday (3), Thursday (4), Friday (5): Regular working hours, unlocked
  return false;
};

/**
 * Calculates the exact upcoming Monday 07:30 PM IST expiration timestamp for a Weekend Pass
 */
export const getUpcomingMondayLockdownEndIST = (date: Date = new Date()): Date => {
  const { istDate, dayOfWeek } = getISTDateComponents(date);
  
  // Calculate days until Monday (1)
  let daysUntilMonday = 0;
  if (dayOfWeek === 6) { // Saturday -> 2 days to Monday
    daysUntilMonday = 2;
  } else if (dayOfWeek === 0) { // Sunday -> 1 day to Monday
    daysUntilMonday = 1;
  } else if (dayOfWeek === 1) { // Monday -> today
    daysUntilMonday = 0;
  } else {
    // If granted mid-week (e.g. Friday), calculate days until next Monday
    daysUntilMonday = (8 - dayOfWeek) % 7;
  }

  const targetDate = new Date(istDate);
  targetDate.setDate(targetDate.getDate() + daysUntilMonday);
  targetDate.setHours(19, 30, 0, 0); // 7:30 PM IST

  return targetDate;
};

/**
 * Helper to check if a specific role is subject to weekend lockdown
 */
export const isRoleRestrictedOnWeekend = (role?: string | null): boolean => {
  if (!role) return false;
  return RESTRICTED_WEEKEND_ROLES.includes(role as any);
};
