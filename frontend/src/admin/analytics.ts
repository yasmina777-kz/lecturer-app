export type AnalyticsUser = {
  id: string;
  fullName: string;
  role: string;
  isDisabled: boolean;
  createdAt: string;
};
/** Registration dates are grouped in UTC, so counts do not change with admin timezone. */
export function userAnalytics(users: AnalyticsUser[], days: number, now: Date) {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const start = today - (days - 1) * 86400000;
  const dates = users
    .map((u) => Date.parse(u.createdAt))
    .filter((t) => Number.isFinite(t) && t <= now.getTime());
  const daily = Array.from({ length: days }, (_, i) => {
    const day = start + i * 86400000;
    return {
      date: new Date(day).toISOString().slice(0, 10),
      count: dates.filter((t) => t >= day && t < day + 86400000).length,
    };
  });
  const roles = ["Student", "Lecturer", "Admin"].map((role) => ({
    role,
    count: users.filter((u) => u.role === role).length,
  }));
  return {
    daily,
    roles,
    total: users.length,
    enabled: users.filter((u) => !u.isDisabled).length,
    disabled: users.filter((u) => u.isDisabled).length,
    added: daily.reduce((n, d) => n + d.count, 0),
    recent: users
      .filter((u) => Number.isFinite(Date.parse(u.createdAt)))
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 5),
  };
}
