export function toDateKey(value: Date | string = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function todayKey() {
  return toDateKey();
}

export function tomorrowKey() {
  return toDateKey(addDays(new Date(), 1));
}

export function dateKeyToLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function timestampForDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const now = new Date();

  return new Date(
    year,
    month - 1,
    day,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  ).toISOString();
}

export function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateKeyToLocalDate(value));
}

export function getRelativeDateLabel(value: string) {
  if (value === todayKey()) {
    return "Today";
  }

  if (value === tomorrowKey()) {
    return "Tomorrow";
  }

  if (value === toDateKey(addDays(new Date(), -1))) {
    return "Yesterday";
  }

  return "";
}
