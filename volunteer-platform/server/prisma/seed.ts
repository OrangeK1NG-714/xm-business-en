import { Database } from '../src/database.js';
import { serviceDate, splitMinutes } from '../src/domain.js';
import * as argon from 'argon2';

const db = new Database();
const date = serviceDate(new Date());
function day(delta: number, time: string) { return new Date(Date.parse(`${date}T${time}:00+08:00`) + delta * 86400000); }

async function seed() {
  if (process.env.DEMO_MODE !== 'true' || process.env.SMS_PROVIDER !== 'mock') throw new Error('演示初始化仅能在 DEMO_MODE=true 且 SMS_PROVIDER=mock 时运行');
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) throw new Error('请先设置至少 12 位的 ADMIN_PASSWORD');
  const admin = await db.user.upsert({ where: { number: 'ADMIN-001' }, update: {}, create: { name: '管理老师', number: 'ADMIN-001', department: '志愿服务中心', phone: '00000000000', role: 'ADMIN', username: process.env.ADMIN_USERNAME || 'admin', passwordHash: await argon.hash(process.env.ADMIN_PASSWORD) } });
  const names = ['林沐晴','陈奕安','周以宁','许知远','沈嘉禾','吴一诺','陆书言','苏予安','程星野','宋念初','叶清和','顾知夏'];
  for (let i = 0; i < names.length; i++) await db.user.upsert({ where: { id: `demo-user-${i + 1}` }, update: {}, create: { id: `demo-user-${i + 1}`, name: names[i], number: `DEMO-${String(i + 1).padStart(3, '0')}`, department: ['计算机学院','人文学院','艺术设计学院','经济管理学院'][i % 4], phone: `0000000${String(i + 1).padStart(4, '0')}` } });
  const activities = [
    { title: '新生有你，校园更暖', category: '校园服务', description: '为刚到校的新同学提供校园路线引导、行李搬运和咨询服务。请穿着舒适的鞋子，带上你的笑容，一起把校园的第一份温暖传递出去。', location: '小和山校区 · 南门广场', delta: 1, start: '08:30', end: '11:30', capacity: 20, minutes: 180, color: 'green' },
    { title: '让旧书，遇见新的主人', category: '社区关怀', description: '整理社区捐赠图书，为孩子们挑选适合的读物，协助完成爱心书屋的分类与上架。无需专业经验，欢迎每一位热爱阅读的你。', location: '和家园社区 · 共享书屋', delta: 3, start: '09:00', end: '12:00', capacity: 12, minutes: 180, color: 'orange' },
    { title: '沿着溪流，捡回一点绿色', category: '环境保护', description: '沿校园附近溪流开展垃圾清理与环保宣传。工具由组织方提供，请自带水杯，注意防晒，和伙伴们一起守护身边的自然。', location: '小和山 · 溪畔步道', delta: 5, start: '14:00', end: '17:00', capacity: 30, minutes: 180, color: 'blue' },
    { title: '一起点亮周末课堂', category: '文化教育', description: '为社区儿童提供绘本阅读与手工陪伴，记录孩子们的想象力与成长。', location: '西溪社区 · 青少年活动室', delta: -2, start: '09:00', end: '12:00', capacity: 10, minutes: 180, color: 'pink' },
    { title: '图书馆里的小小整理师', category: '校园服务', description: '参与图书归类、书架整理和自助借还引导，让每一本书都回到属于它的位置。', location: '小和山校区 · 图书馆', delta: -5, start: '13:30', end: '16:00', capacity: 8, minutes: 150, color: 'green' },
    { title: '秋日运动会 · 志愿同行', category: '赛会保障', description: '为运动会提供检录、引导、后勤和秩序维护服务。具体安排将在活动发布后通知。', location: '小和山校区 · 田径场', delta: 12, start: '08:00', end: '12:00', capacity: 40, minutes: 240, color: 'orange' },
  ];
  for (let i = 0; i < activities.length; i++) {
    const spec = activities[i], id = `demo-activity-${i + 1}`;
    await db.activity.upsert({ where: { id }, update: {}, create: { id, title: spec.title, category: spec.category, description: spec.description, location: spec.location, contactName: '志愿服务中心', color: spec.color, status: i === 5 ? 'DRAFT' : 'PUBLISHED', createdAt: day(-8 + i, '10:00'), sessions: { create: { id: `demo-session-${i + 1}`, title: spec.start < '12:00' ? '上午场' : '下午场', startsAt: day(spec.delta, spec.start), endsAt: day(spec.delta, spec.end), registrationEndsAt: day(spec.delta, '07:00'), capacity: spec.capacity, defaultMinutes: spec.minutes } } } });
  }
  for (let session = 1; session <= 5; session++) {
    for (let i = 1; i <= (session < 4 ? 4 : 5); i++) {
      const id = `demo-application-${session}-${i}`;
      const past = session >= 4;
      const attendance = past ? i === 5 ? 'ABSENT' : 'PRESENT' : 'UNRECORDED';
      await db.application.upsert({ where: { id }, update: {}, create: { id, sessionId: `demo-session-${session}`, userId: `demo-user-${(i + session - 2) % 12 + 1}`, status: past || i === 4 ? 'APPROVED' : 'PENDING', attendance, reviewVersion: past || i === 4 ? 1 : 0, createdAt: day(-1, `${String(8 + i).padStart(2,'0')}:15`) } });
      if (past && attendance === 'PRESENT') {
        const s = await db.activitySession.findUniqueOrThrow({ where: { id: `demo-session-${session}` } });
        const minutes = i === 4 ? s.defaultMinutes - 30 : s.defaultMinutes;
        for (const slice of splitMinutes(s.startsAt, s.endsAt, minutes)) await db.serviceRecord.upsert({ where: { applicationId_serviceDate: { applicationId: id, serviceDate: slice.serviceDate } }, update: {}, create: { applicationId: id, ...slice, confirmedBy: admin.id } });
      }
    }
  }
  console.log('演示数据已准备：6 个活动、12 名虚构志愿者。短信为模拟模式，未触发发送。');
}
seed().finally(() => db.$disconnect());
