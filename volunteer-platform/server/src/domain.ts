const offset = 8 * 60 * 60 * 1000;
export const serviceDate = (value: Date) => new Date(value.getTime() + offset).toISOString().slice(0, 10);
export const maskPhone = (value: string) => value.replace(/^(\d{3})\d{4}(\d+)$/, '$1****$2');
export const hours = (minutes: number) => Math.round(minutes / 60 * 100) / 100;

export function assertDateRange(from: string, to: string) {
  const valid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!valid(from) || !valid(to) || from > to) throw new Error('请选择有效的开始和结束日期');
}

export function splitMinutes(start: Date, end: Date, minutes: number) {
  const duration = end.getTime() - start.getTime();
  if (duration <= 0 || !Number.isInteger(minutes) || minutes <= 0 || minutes > Math.floor(duration / 60000)) throw new Error('核定时长须为正整数分钟，且不能超过场次时长');
  const slices: { serviceDate: string; minutes: number }[] = [];
  let cursor = start.getTime();
  let allocated = 0;
  while (cursor < end.getTime()) {
    const date = serviceDate(new Date(cursor));
    const midnight = Date.parse(`${date}T00:00:00+08:00`) + 86400000;
    const next = Math.min(midnight, end.getTime());
    const cumulative = Math.round(minutes * (next - start.getTime()) / duration);
    slices.push({ serviceDate: date, minutes: cumulative - allocated });
    allocated = cumulative;
    cursor = next;
  }
  return slices.filter(item => item.minutes > 0);
}

export interface ReportRow {
  userId: string; name: string; number: string; department: string;
  activityId: string; activity: string; sessionId: string; session: string;
  serviceDate: string; minutes: number;
}

export function summarize(rows: ReportRow[]) {
  const people = new Map<string, { userId: string; name: string; number: string; department: string; activities: Set<string>; sessions: Set<string>; minutes: number }>();
  const activities = new Map<string, { activityId: string; activity: string; sessionId: string; session: string; serviceDate: string; people: Set<string>; minutes: number }>();
  for (const row of rows) {
    const person = people.get(row.userId) || { userId: row.userId, name: row.name, number: row.number, department: row.department, activities: new Set<string>(), sessions: new Set<string>(), minutes: 0 };
    person.activities.add(row.activityId); person.sessions.add(row.sessionId); person.minutes += row.minutes; people.set(row.userId, person);
    const key = `${row.sessionId}:${row.serviceDate}`;
    const activity = activities.get(key) || { activityId: row.activityId, activity: row.activity, sessionId: row.sessionId, session: row.session, serviceDate: row.serviceDate, people: new Set<string>(), minutes: 0 };
    activity.people.add(row.userId); activity.minutes += row.minutes; activities.set(key, activity);
  }
  return {
    people: [...people.values()].map(({ activities, sessions, ...person }) => ({ ...person, activityCount: activities.size, sessionCount: sessions.size, hours: hours(person.minutes) })),
    activities: [...activities.values()].map(({ people, ...item }) => ({ ...item, peopleCount: people.size, hours: hours(item.minutes) })),
    totalMinutes: rows.reduce((sum, row) => sum + row.minutes, 0),
  };
}
