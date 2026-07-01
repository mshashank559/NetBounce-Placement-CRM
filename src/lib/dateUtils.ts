/**
 * Calculates the number of working days (Monday-Friday) between two dates.
 * The starting date is excluded (meaning if start and end are the same, returns 0).
 */
export const getWorkingDaysDifference = (startDate: Date | string | number, endDate: Date | string | number): number => {
  const dStart = new Date(startDate);
  const dEnd = new Date(endDate);
  
  // Normalize both dates to midnight local time to avoid fractional day issues
  const start = new Date(dStart.getFullYear(), dStart.getMonth(), dStart.getDate());
  const end = new Date(dEnd.getFullYear(), dEnd.getMonth(), dEnd.getDate());
  
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
 */
export const getWorkingDaysAgo = (days: number, baseDate: Date | string | number = new Date()): Date => {
  const dBase = new Date(baseDate);
  const date = new Date(dBase.getFullYear(), dBase.getMonth(), dBase.getDate());
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
