import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { mkdir, rename, chmod } from 'node:fs/promises';
import path from 'node:path';
import { Database } from './database.js';
import { Tasks } from './queue.js';
import { config } from './config.js';
import { assertDateRange, hours, summarize, type ReportRow } from './domain.js';
import type { ExportInput } from './dto.js';
import type { Prisma } from './generated/prisma/client.js';

export function buildWorkbook(rows: ReportRow[], filters: ExportInput, generatedAt: Date) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '青禾志愿'; workbook.created = generatedAt;
  workbook.subject = `${filters.from} 至 ${filters.to}；按服务日期、有效核定时长统计（Asia/Shanghai）`;
  const summary = summarize(rows);
  const sheets = [
    { name: '人员活动明细', columns: [['name','姓名'],['number','学号 / 工号'],['department','部门 / 班级'],['activity','活动名称'],['session','场次'],['serviceDate','服务日期'],['minutes','核定分钟'],['hours','核定小时']], data: rows.map(row => ({ ...row, hours: hours(row.minutes) })) },
    { name: '人员汇总', columns: [['name','姓名'],['number','学号 / 工号'],['department','部门 / 班级'],['activityCount','活动数'],['sessionCount','场次数'],['minutes','总分钟'],['hours','总小时']], data: summary.people },
    { name: '活动汇总', columns: [['activity','活动名称'],['session','场次'],['serviceDate','服务日期'],['peopleCount','参加人数'],['minutes','总分钟'],['hours','总小时']], data: summary.activities },
  ];
  for (const spec of sheets) {
    const sheet = workbook.addWorksheet(spec.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = spec.columns.map(([key, header]) => ({ key, header, width: key === 'activity' ? 34 : 19 }));
    sheet.addRows(spec.data);
    sheet.getRow(1).height = 28;
    sheet.getRow(1).eachCell(cell => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF285542' } }; });
    sheet.autoFilter = { from: 'A1', to: { row: 1, column: spec.columns.length } };
    sheet.getColumn('hours').numFmt = '0.00';
  }
  return workbook;
}

@Injectable()
export class Reporting {
  constructor(@Inject(Database) private db: Database, @Inject(Tasks) private tasks: Tasks) {}
  async rows(filters: ExportInput, database: Prisma.TransactionClient = this.db): Promise<ReportRow[]> {
    try { assertDateRange(filters.from, filters.to); } catch (error) { throw new BadRequestException((error as Error).message); }
    const records = await database.serviceRecord.findMany({ where: {
      status: 'CONFIRMED', serviceDate: { gte: filters.from, lte: filters.to },
      application: { status: 'APPROVED', attendance: 'PRESENT', ...(filters.department ? { user: { department: filters.department } } : {}), session: { ...(filters.activityId ? { activityId: filters.activityId } : {}), activity: { status: { not: 'CANCELLED' } } } },
    }, include: { application: { include: { user: { select: { id: true, name: true, number: true, department: true } }, session: { include: { activity: { select: { id: true, title: true } } } } } } }, orderBy: [{ serviceDate: 'asc' }, { id: 'asc' }] });
    return records.map(row => { const { user, session } = row.application; return { userId: user.id, name: user.name, number: user.number, department: user.department, activityId: session.activity.id, activity: session.activity.title, sessionId: session.id, session: session.title, serviceDate: row.serviceDate, minutes: row.minutes }; });
  }
  async preview(filters: ExportInput) {
    const rows = await this.rows(filters);
    const summary = summarize(rows);
    return { ...summary, rows, totalHours: hours(summary.totalMinutes) };
  }
  async create(filters: ExportInput, actorId: string) {
    try { assertDateRange(filters.from, filters.to); } catch (error) { throw new BadRequestException((error as Error).message); }
    return this.db.$transaction(async tx => {
      const job = await tx.exportJob.create({ data: { createdBy: actorId, filters: { ...filters, policyVersion: 1 } } });
      await this.tasks.report(tx, job.id);
      await tx.auditLog.create({ data: { actorId, action: 'REPORT_EXPORT', targetId: job.id, detail: { ...filters } } });
      return job;
    });
  }
  async list() { return this.db.exportJob.findMany({ orderBy: { createdAt: 'desc' }, take: 50, omit: { filePath: true } }); }
  async generate(exportId: string) {
    const job = await this.db.exportJob.findUniqueOrThrow({ where: { id: exportId } });
    if (job.status === 'COMPLETED') return;
    await this.db.exportJob.update({ where: { id: exportId }, data: { status: 'PROCESSING', error: null } });
    try {
      const filters = job.filters as unknown as ExportInput;
      const generatedAt = new Date();
      const rows = await this.db.$transaction(tx => this.rows(filters, tx), { isolationLevel: 'RepeatableRead', timeout: 30000 });
      const workbook = buildWorkbook(rows, filters, generatedAt);
      const directory = config().exportDirectory;
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const filePath = path.join(directory, `${job.id}.xlsx`);
      const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
      await workbook.xlsx.writeFile(tempPath); await chmod(tempPath, 0o600); await rename(tempPath, filePath);
      await this.db.exportJob.update({ where: { id: exportId }, data: { status: 'COMPLETED', fileName: `志愿服务统计_${filters.from}_${filters.to}.xlsx`, filePath, rowCount: rows.length, completedAt: generatedAt } });
    } catch (error) {
      await this.db.exportJob.update({ where: { id: exportId }, data: { status: 'FAILED', error: (error as Error).message.slice(0, 300) } });
      throw error;
    }
  }
  async download(id: string) {
    const job = await this.db.exportJob.findUnique({ where: { id } });
    if (!job || job.status !== 'COMPLETED' || !job.filePath) throw new NotFoundException('报表尚未生成或不存在');
    return job;
  }
}
