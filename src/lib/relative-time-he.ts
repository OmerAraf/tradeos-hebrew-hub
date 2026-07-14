export function relativeTimeHe(iso: string): string {
  const then = new Date(iso).getTime();
  if (!isFinite(then)) return "";
  const diffSec = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return `לפני ${diffSec} שניות`;
  const min = Math.round(diffSec / 60);
  if (min < 60) return `לפני ${min} דקות`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `לפני ${hr} שעות`;
  const day = Math.round(hr / 24);
  if (day < 30) return `לפני ${day} ימים`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `לפני ${mo} חודשים`;
  const yr = Math.round(mo / 12);
  return `לפני ${yr} שנים`;
}
