export interface Person { id: string; name: string; number: string; department: string; phone?: string; minutes?: number; applications?: number }
export interface Session { id: string; title: string; startsAt: string; endsAt: string; registrationEndsAt: string; capacity: number; defaultMinutes: number; appliedCount: number; approvedCount: number; pendingCount: number; activity?: Activity }
export interface Activity { id: string; title: string; category: string; description: string; location: string; contactName: string; status: string; color: string; source: string; createdAt: string; sessions: Session[] }
export interface Application { id: string; status: string; attendance: string; createdAt: string; user: Person; session: Session & { activity: Activity }; serviceRecords: { minutes: number; status: string; serviceDate: string }[]; notifications: { id: string; status: string }[] }
export interface Notification { id: string; phone: string; status: string; attempts: number; error: string | null; createdAt: string; sentAt: string | null; application: { user: { name: string }; session: { activity: { title: string } } }; parameters: { activity: string; startsAt: string; location: string }; logs: { status: string; detail: string; createdAt: string }[] }
export interface ExportJob { id: string; status: string; fileName?: string; rowCount?: number; error?: string; createdAt: string; filters: { from: string; to: string } }
export interface Report { people: { userId: string; name: string; number: string; department: string; activityCount: number; sessionCount: number; minutes: number; hours: number }[]; activities: { activityId: string; activity: string; sessionId: string; session: string; serviceDate: string; peopleCount: number; minutes: number; hours: number }[]; rows: { userId: string; name: string; activity: string; serviceDate: string; minutes: number }[]; totalMinutes: number; totalHours: number }
export interface Settings { demo: boolean; smsProvider: string; notificationsEnabled: boolean; externalPlatform: { name: string; connected: boolean; detail: string }; reportPolicy: string }

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem('volunteer-token');
  const response = await fetch(`/api/${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('session-expired'));
    const error = await response.json().catch(() => ({}));
    throw new Error(Array.isArray(error.message) ? error.message.join('；') : error.message || '请求未完成，请重试');
  }
  return response.json();
}
export const post = <T,>(path: string, body: unknown = {}) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });
export async function downloadExport(job: ExportJob) {
  const response = await fetch(`/api/admin/exports/${job.id}/download`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('volunteer-token')}` } });
  if (!response.ok) throw new Error('下载失败，请刷新后重试');
  const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a');
  link.href = url; link.download = job.fileName || '志愿服务统计.xlsx'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
