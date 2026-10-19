import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Database } from './database.js';
import { Tasks } from './queue.js';
import { config } from './config.js';
import { splitMinutes } from './domain.js';
import type { AttendanceInput, ReviewInput } from './dto.js';

@Injectable()
export class Applications {
  constructor(@Inject(Database) private db: Database, @Inject(Tasks) private tasks: Tasks) {}
  async review(data: ReviewInput, actorId: string) {
    const ids = [...new Set(data.ids)];
    return this.db.$transaction(async tx => {
      const rows = await tx.application.findMany({ where: { id: { in: ids } }, include: { user: true, session: { include: { activity: true } } } });
      if (rows.length !== ids.length) throw new NotFoundException('部分报名记录不存在');
      const sessionIds = [...new Set(rows.map(row => row.sessionId))].sort();
      // Lock the shared capacity before re-reading applications; a per-application lock would permit overbooking.
      for (const id of sessionIds) await tx.$queryRaw`SELECT id FROM "ActivitySession" WHERE id = ${id} FOR UPDATE`;
      let changed = 0;
      for (const row of rows) {
        const current = await tx.application.findUniqueOrThrow({ where: { id: row.id } });
        if (current.status === data.decision) continue;
        if (current.source !== 'LOCAL') throw new ConflictException('外部平台报名尚未启用审核写回');
        if (current.status !== 'PENDING') throw new ConflictException(`${row.user.name}的报名状态已变化，请刷新后操作`);
        if (row.session.activity.status !== 'PUBLISHED') throw new BadRequestException('仅开放中的活动可以审核');
        if (data.decision === 'APPROVED') {
          const approved = await tx.application.count({ where: { sessionId: row.sessionId, status: 'APPROVED' } });
          if (approved >= row.session.capacity) throw new ConflictException(`“${row.session.activity.title}”名额已满，本次批量审核未提交`);
        }
        const version = current.reviewVersion + 1;
        await tx.application.update({ where: { id: row.id }, data: { status: data.decision, reviewVersion: version, reviewedAt: new Date(), reviewReason: data.reason || null } });
        await tx.auditLog.create({ data: { actorId, action: 'APPLICATION_REVIEW', targetId: row.id, detail: { from: current.status, to: data.decision, version, reason: data.reason || '' } } });
        if (data.decision === 'APPROVED' && config().notificationsEnabled) {
          const notification = await tx.notification.create({ data: { applicationId: row.id, eventKey: `approved:${row.id}:${version}`, phone: row.user.phone, parameters: { activity: row.session.activity.title, startsAt: row.session.startsAt.toISOString(), location: row.session.activity.location, version } } });
          await this.tasks.sms(tx, notification.id);
        }
        changed++;
      }
      return { changed };
    }, { timeout: 20000 });
  }
  async attendance(data: AttendanceInput, actorId: string) {
    return this.db.$transaction(async tx => {
      const ids = [...new Set(data.ids)];
      const rows = await tx.application.findMany({ where: { id: { in: ids } }, include: { session: { include: { activity: true } }, serviceRecords: true } });
      if (rows.length !== ids.length) throw new NotFoundException('部分记录不存在');
      for (const row of [...rows].sort((a, b) => a.id.localeCompare(b.id))) {
        await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${row.id} FOR UPDATE`;
        const current = await tx.application.findUniqueOrThrow({ where: { id: row.id }, include: { serviceRecords: true } });
        if (current.status !== 'APPROVED') throw new BadRequestException('只有审核通过的人员可以登记出勤');
        if (row.session.activity.status === 'CANCELLED') throw new BadRequestException('已取消活动不能核定时长');
        if (!config().demo && row.session.endsAt > new Date()) throw new BadRequestException('活动结束后才可以核定时长');
        const minutes = data.minutes ?? row.session.defaultMinutes;
        let slices: ReturnType<typeof splitMinutes> = [];
        if (data.attendance === 'PRESENT') {
          try { slices = splitMinutes(row.session.startsAt, row.session.endsAt, minutes); } catch (error) { throw new BadRequestException((error as Error).message); }
        }
        await tx.application.update({ where: { id: row.id }, data: { attendance: data.attendance } });
        await tx.serviceRecord.updateMany({ where: { applicationId: row.id }, data: { status: 'REVOKED', confirmedBy: actorId } });
        for (const slice of slices) await tx.serviceRecord.upsert({ where: { applicationId_serviceDate: { applicationId: row.id, serviceDate: slice.serviceDate } }, create: { ...slice, applicationId: row.id, confirmedBy: actorId }, update: { minutes: slice.minutes, status: 'CONFIRMED', confirmedBy: actorId } });
        await tx.auditLog.create({ data: { actorId, action: 'SERVICE_CONFIRM', targetId: row.id, detail: { before: { attendance: current.attendance, records: current.serviceRecords.map(s => ({ date: s.serviceDate, minutes: s.minutes, status: s.status })) }, after: { attendance: data.attendance, records: slices }, reason: data.reason } } });
      }
      return { changed: rows.length };
    }, { timeout: 20000 });
  }
}
