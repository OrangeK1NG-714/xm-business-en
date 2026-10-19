import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Database } from './database.js';
import type { ActivityInput } from './dto.js';
import { Prisma } from './generated/prisma/client.js';
import { maskPhone } from './domain.js';

const activityInclude = { sessions: { orderBy: { startsAt: 'asc' as const }, include: { applications: { select: { status: true } } } } };

@Injectable()
export class Activities {
  constructor(@Inject(Database) private db: Database) {}
  async list(publicOnly = false) {
    const rows = await this.db.activity.findMany({ where: publicOnly ? { status: 'PUBLISHED' } : {}, include: activityInclude, orderBy: { createdAt: 'desc' } });
    return rows.map(({ sessions, ...activity }) => ({ ...activity, sessions: sessions.map(({ applications, ...session }) => ({ ...session, appliedCount: applications.filter(a => a.status !== 'CANCELLED').length, approvedCount: applications.filter(a => a.status === 'APPROVED').length, pendingCount: applications.filter(a => a.status === 'PENDING').length })) }));
  }
  async create(data: ActivityInput, actorId: string) {
    const { startsAt, endsAt, registrationEndsAt, capacity, defaultMinutes, ...activity } = data;
    if (Date.parse(endsAt) <= Date.parse(startsAt) || Date.parse(registrationEndsAt) > Date.parse(startsAt)) throw new BadRequestException('请检查活动起止时间和报名截止时间');
    if (defaultMinutes > (Date.parse(endsAt) - Date.parse(startsAt)) / 60000) throw new BadRequestException('默认服务时长不能超过场次时长');
    return this.db.$transaction(async tx => {
      const row = await tx.activity.create({ data: { ...activity, sessions: { create: { title: '默认场次', startsAt, endsAt, registrationEndsAt, capacity, defaultMinutes } } }, include: { sessions: true } });
      await tx.auditLog.create({ data: { actorId, action: 'ACTIVITY_CREATE', targetId: row.id, detail: { title: row.title } } });
      return row;
    });
  }
  async changeStatus(id: string, status: string, actorId: string) {
    return this.db.$transaction(async tx => {
      const current = await tx.activity.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('活动不存在');
      if (current.source !== 'LOCAL') throw new ConflictException('外部活动须通过对接模块变更');
      if (current.status === status) return current;
      const row = await tx.activity.update({ where: { id }, data: { status } });
      if (status === 'CANCELLED') {
        await tx.notification.updateMany({ where: { application: { session: { activityId: id } }, status: 'PENDING' }, data: { status: 'CANCELLED' } });
      }
      await tx.auditLog.create({ data: { actorId, action: 'ACTIVITY_STATUS', targetId: id, detail: { from: current.status, to: status } } });
      return row;
    });
  }
  async copy(id: string, actorId: string) {
    const activity = await this.db.activity.findUnique({ where: { id }, include: { sessions: true } });
    if (!activity) throw new NotFoundException('活动不存在');
    return this.db.$transaction(async tx => {
      const row = await tx.activity.create({ data: {
        title: `${activity.title}（副本）`, category: activity.category, description: activity.description,
        location: activity.location, contactName: activity.contactName, color: activity.color, status: 'DRAFT',
        sessions: { create: activity.sessions.map(s => ({ title: s.title, startsAt: s.startsAt, endsAt: s.endsAt, registrationEndsAt: s.registrationEndsAt, capacity: s.capacity, defaultMinutes: s.defaultMinutes })) },
      } });
      await tx.auditLog.create({ data: { actorId, action: 'ACTIVITY_COPY', targetId: row.id, detail: { originalId: id } } });
      return row;
    });
  }
  async apply(sessionId: string, userId: string, consent: boolean) {
    if (!consent) throw new BadRequestException('请确认接收本次活动报名结果通知');
    try {
      return await this.db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "ActivitySession" WHERE id = ${sessionId} FOR UPDATE`;
        const session = await tx.activitySession.findUnique({ where: { id: sessionId }, include: { activity: true } });
        if (!session) throw new NotFoundException('场次不存在');
        if (session.activity.source !== 'LOCAL') throw new BadRequestException('此活动需要到外部平台报名');
        if (session.activity.status !== 'PUBLISHED' || session.registrationEndsAt <= new Date()) throw new BadRequestException('活动未开放报名或报名已截止');
        const current = await tx.application.findUnique({ where: { sessionId_userId: { sessionId, userId } } });
        if (current && current.status !== 'CANCELLED') throw new ConflictException('你已经报名过该场次');
        const data = current ? await tx.application.update({ where: { id: current.id }, data: { status: 'PENDING', reviewReason: null } }) : await tx.application.create({ data: { sessionId, userId } });
        await tx.auditLog.create({ data: { actorId: userId, action: 'APPLICATION_SUBMIT', targetId: data.id, detail: { notificationConsent: true } } });
        return data;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('你已经报名过该场次');
      throw error;
    }
  }
  async cancel(id: string, userId: string) {
    return this.db.$transaction(async tx => {
      const application = await tx.application.findUnique({ where: { id }, include: { session: true } });
      if (!application || application.userId !== userId) throw new NotFoundException('报名记录不存在');
      await tx.$queryRaw`SELECT id FROM "ActivitySession" WHERE id = ${application.sessionId} FOR UPDATE`;
      if (application.session.startsAt <= new Date() || application.attendance !== 'UNRECORDED') throw new BadRequestException('活动已开始，请联系负责人处理');
      await tx.application.update({ where: { id }, data: { status: 'CANCELLED' } });
      await tx.notification.updateMany({ where: { applicationId: id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'APPLICATION_CANCEL', targetId: id, detail: {} } });
      return { ok: true };
    });
  }
  async applications(userId?: string) {
    const rows = await this.db.application.findMany({ where: userId ? { userId } : {}, include: { user: { select: { id: true, name: true, number: true, department: true, phone: true } }, session: { include: { activity: true } }, serviceRecords: true, notifications: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, id: true } } }, orderBy: { createdAt: 'desc' } });
    return rows.map(row => ({ ...row, user: { ...row.user, phone: maskPhone(row.user.phone) } }));
  }
}
