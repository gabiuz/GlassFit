import type { OperatingScheduleRange, DayOfWeek } from "./types";

/**
 * Formats a 24-hour time string (HH:MM) to 12-hour format with AM/PM.
 * Example: "08:00" -> "8:00 AM", "17:30" -> "5:30 PM", "12:00" -> "12:00 PM", "00:00" -> "12:00 AM"
 */
export function formatTime12h(time24: string): string {
  if (!time24 || typeof time24 !== "string") return "";
  const parts = time24.split(":");
  if (parts.length !== 2) return time24;
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours) || !minutes) return time24;
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12}:${minutes} ${period}`;
}

/**
 * Derives a human-readable day range string from start and end days.
 * Example: ("Monday", "Saturday") -> "Monday - Saturday", ("Saturday", "Saturday") -> "Saturday"
 */
export function formatDayRange(startDay: DayOfWeek, endDay: DayOfWeek): string {
  if (startDay === endDay) {
    return startDay;
  }
  return `${startDay} - ${endDay}`;
}

/**
 * Derives a human-readable hour range string from start and end 24h times.
 * Example: ("08:00", "17:00") -> "8:00 AM - 5:00 PM"
 */
export function formatHourRange(startTime: string, endTime: string): string {
  return `${formatTime12h(startTime)} - ${formatTime12h(endTime)}`;
}

/**
 * Formats a single schedule range into a summary string.
 * Example: "Monday - Saturday: 8:00 AM - 5:00 PM"
 */
export function formatScheduleSummary(schedule: OperatingScheduleRange): string {
  const dayRange = formatDayRange(schedule.startDay, schedule.endDay);
  const hourRange = formatHourRange(schedule.startTime, schedule.endTime);
  return `${dayRange}: ${hourRange}`;
}

/**
 * Formats multiple schedule ranges into a composite joined summary string.
 * Example: "Monday - Friday: 8:00 AM - 5:00 PM | Saturday: 8:00 AM - 12:00 PM"
 */
export function formatMultiScheduleSummary(schedules: OperatingScheduleRange[]): string {
  if (!schedules || schedules.length === 0) return "";
  return schedules.map(formatScheduleSummary).join(" | ");
}
