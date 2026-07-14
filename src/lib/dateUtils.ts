/**
 * Returns the day, month, and year of a date string or Date object in Indian Standard Time (IST / Asia/Kolkata)
 */
export const getISTDateParts = (date: Date | string | number) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return { year: 0, month: 0, day: 0 };
  
  const yearStr = d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric' });
  const monthStr = d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: '2-digit' });
  const dayStr = d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', day: '2-digit' });
  
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
    day: parseInt(dayStr, 10)
  };
};

/**
 * Returns the year and month of a date string or Date object in Indian Standard Time (IST / Asia/Kolkata)
 */
export const getISTYearAndMonth = (date: Date | string | number) => {
  const { year, month } = getISTDateParts(date);
  const monthStr = String(month).padStart(2, '0');
  return {
    year,
    month,
    key: `${year}-${monthStr}`
  };
};

/**
 * Returns an IST date string in YYYY-MM-DD format
 */
export const getISTDateString = (date: Date | string | number): string => {
  const { year, month, day } = getISTDateParts(date);
  if (year === 0) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * Formats a date to DD/MM/YYYY in Indian Standard Time (IST)
 */
export const formatToISTDateString = (date?: Date | string | number) => {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    return formatter.format(d);
  } catch (e) {
    const { year, month, day } = getISTDateParts(d);
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }
};

/**
 * Calculates the number of working days (Monday-Friday) between two dates.
 * The starting date is excluded (meaning if start and end are the same, returns 0).
 * Standardized to Indian Standard Time (IST) timezone.
 */
export const getWorkingDaysDifference = (startDate: Date | string | number, endDate: Date | string | number): number => {
  const { year: sy, month: sm, day: sd } = getISTDateParts(startDate);
  const { year: ey, month: em, day: ed } = getISTDateParts(endDate);
  
  if (sy === 0 || ey === 0) return 0;
  
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  
  if (start >= end) return 0;
  
  let workingDays = 0;
  const current = new Date(start.getTime());
  
  // Start checking from the day after the start date
  current.setDate(current.getDate() + 1);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Sunday, 6 = Saturday
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  return workingDays;
};

/**
 * Calculates the date that is a specific number of working days (Monday-Friday) ago.
 * Standardized to Indian Standard Time (IST) timezone.
 */
export const getWorkingDaysAgo = (days: number, baseDate: Date | string | number = new Date()): Date => {
  const { year, month, day } = getISTDateParts(baseDate);
  const date = new Date(year, month - 1, day);
  let count = 0;
  while (count < days) {
    date.setDate(date.getDate() - 1);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }
  return date;
};

/**
 * Returns the UTC Date object representing the START of the current operational shift.
 *
 * Business logic (Option A — confirmed):
 *   The working day runs 7:30 PM IST → 7:30 PM IST (next day).
 *   - If current IST time < 19:30 → shift started at 19:30 the PREVIOUS calendar day.
 *   - If current IST time ≥ 19:30 → shift started at 19:30 TODAY.
 *
 * All "+ Today" counts must use this boundary instead of midnight.
 */
export const getShiftStart = (): Date => {
  // IST = UTC + 5:30
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

  // Current time expressed in IST as a plain local-style Date
  const nowUTC = new Date();
  const nowIST = new Date(nowUTC.getTime() + IST_OFFSET_MS);

  const hours = nowIST.getUTCHours();
  const minutes = nowIST.getUTCMinutes();
  const isPastShiftStart = hours > 19 || (hours === 19 && minutes >= 30);

  // Build a Date representing 19:30 IST on the correct day (in UTC arithmetic)
  // Start from today midnight UTC-as-IST
  const shiftDayIST = new Date(nowIST);
  shiftDayIST.setUTCHours(19, 30, 0, 0); // 19:30 IST expressed as UTC fields

  if (!isPastShiftStart) {
    // Shift started yesterday: move back one full day
    shiftDayIST.setUTCDate(shiftDayIST.getUTCDate() - 1);
  }

  // Convert IST-arithmetic result back to true UTC
  return new Date(shiftDayIST.getTime() - IST_OFFSET_MS);
};

/**
 * Returns true if the given ISO date string falls inside the current operational shift.
 * Use this everywhere "+ Today" is computed, instead of comparing YYYY-MM-DD strings.
 *
 * @param isoDate - Any ISO 8601 string (created_at, updated_at, call_date + 'T00:00:00', …)
 */
export const isInCurrentShift = (isoDate: string | null | undefined): boolean => {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return false;
  return d >= getShiftStart();
};
