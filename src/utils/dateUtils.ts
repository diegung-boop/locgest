export type DurationType = "daily" | "weekly" | "fortnightly" | "monthly" | "custom";

/**
 * Calculates end date based on start date and duration type
 * - monthly: 1 month minus 1 day (e.g. 15/08/2026 -> 14/09/2026)
 * - fortnightly: +15 days
 * - weekly: +7 days
 * - daily: +1 day
 */
export function calculateEndDate(startDateStr: string, durationType: DurationType): string {
  if (!startDateStr) return "";
  const start = new Date(startDateStr + "T00:00:00");
  if (isNaN(start.getTime())) return startDateStr;

  const end = new Date(start);

  switch (durationType) {
    case "daily":
      end.setDate(end.getDate() + 1);
      break;
    case "weekly":
      end.setDate(end.getDate() + 7);
      break;
    case "fortnightly":
      end.setDate(end.getDate() + 15);
      break;
    case "monthly":
      end.setMonth(end.getMonth() + 1);
      end.setDate(end.getDate() - 1);
      break;
    default:
      return startDateStr;
  }

  return end.toISOString().split("T")[0];
}
