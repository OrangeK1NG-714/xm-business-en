import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Database } from './database.js';
import { Tasks } from './queue.js';
import { config } from './config.js';
import { maskPhone } from './domain.js';
import { sms } from 'tencentcloud-sdk-nodejs-sms';

type SmsParameters = { activity: string; startsAt: string; location: string; version: number };
export interface SmsProvider { send(phone: string, parameters: SmsParameters): Promise<{ status: 'MOCK_SENT' | 'ACCEPTED'; messageId: string }> }
class MockSmsProvider implements SmsProvider {
  async send(_phone: string, _parameters: SmsParameters) { return { status: 'MOCK_SENT' as const, messageId: `mock-${crypto.randomUUID()}` }; }
}
class TencentSmsProvider implements SmsProvider {
  async send(phone: string, parameters: SmsParameters) {
    const env = process.env;
    for (const key of ['TENCENT_SECRET_ID', 'TENCENT_SECRET_KEY', 'TENCENT_SMS_APP_ID', 'TENCENT_SMS_SIGN_NAME', 'TENCENT_SMS_TEMPLATE_ID']) if (!env[key]) throw new PermanentSmsError(`缺少配置 ${key}`);
    const client = new sms.v20210111.Client({ credential: { secretId: env.TENCENT_SECRET_ID!, secretKey: env.TENCENT_SECRET_KEY! }, region: 'ap-guangzhou', profile: { httpProfile: { endpoint: 'sms.tencentcloudapi.com', reqTimeout: 15 } } });
    const response = await client.SendSms({ PhoneNumberSet: [`+86${phone}`], SmsSdkAppId: env.TENCENT_SMS_APP_ID!, SignName: env.TENCENT_SMS_SIGN_NAME!, TemplateId: env.TENCENT_SMS_TEMPLATE_ID!, TemplateParamSet: [parameters.activity.slice(0, 20), new Date(parameters.startsAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }), parameters.location.slice(0, 30)] });
    const result = response.SendStatusSet?.[0];
    if (result?.Code !== 'Ok') throw new PermanentSmsError(result?.Message || '短信接口未返回受理结果');
    return { status: 'ACCEPTED' as const, messageId: result.SerialNo! };
  }
}
class PermanentSmsError extends Error {}

@Injectable()
export class Notifications {
  readonly provider: SmsProvider = config().provider === 'mock' ? new MockSmsProvider() : new TencentSmsProvider();
  constructor(@Inject(Database) private db: Database, @Inject(Tasks) private tasks: Tasks) {}
  async list() {
    const rows = await this.db.notification.findMany({ include: { application: { include: { user: { select: { name: true } }, session: { include: { activity: { select: { title: true } } } } } }, logs: { orderBy: { createdAt: 'desc' }, take: 5 } }, orderBy: { createdAt: 'desc' }, take: 500 });
    return rows.map(row => ({ ...row, phone: maskPhone(row.phone) }));
  }
  async send(id: string) {
    const claimed = await this.db.notification.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'SENDING', attempts: { increment: 1 } } });
    if (!claimed.count) return;
    const notification = await this.db.notification.findUniqueOrThrow({ where: { id }, include: { application: { include: { session: { include: { activity: true } } } } } });
    const params = notification.parameters as unknown as SmsParameters;
    if (notification.application.status !== 'APPROVED' || notification.application.reviewVersion !== params.version || notification.application.session.activity.status === 'CANCELLED' || !config().notificationsEnabled) {
      await this.db.notification.update({ where: { id }, data: { status: 'CANCELLED' } }); return;
    }
    try {
      const result = await this.provider.send(notification.phone, params);
      await this.db.$transaction([
        this.db.notification.update({ where: { id }, data: { status: result.status, providerMessageId: result.messageId, sentAt: new Date(), error: null } }),
        this.db.notificationAttempt.create({ data: { notificationId: id, status: result.status, detail: config().provider === 'mock' ? '模拟发送，未联系任何手机号' : result.messageId } }),
      ]);
    } catch (error) {
      // An interrupted external request may already have been accepted; do not automatically send it again.
      const status = error instanceof PermanentSmsError ? 'FAILED' : 'UNKNOWN';
      const detail = (error as Error).message.slice(0, 300);
      await this.db.$transaction([
        this.db.notification.update({ where: { id }, data: { status, error: detail } }),
        this.db.notificationAttempt.create({ data: { notificationId: id, status, detail } }),
      ]);
    }
  }
  async retry(id: string, actorId: string) {
    return this.db.$transaction(async tx => {
      const row = await tx.notification.findUnique({ where: { id }, include: { application: true } });
      if (!row) throw new NotFoundException('通知记录不存在');
      if (row.status !== 'FAILED') throw new ConflictException('只有明确失败的通知可以补发；结果未知的通知需先核查');
      if (row.application.status !== 'APPROVED') throw new ConflictException('报名已失效');
      await tx.notification.update({ where: { id }, data: { status: 'PENDING', error: null } });
      // A separate job key allows a completed previous task to be supplemented intentionally.
      await this.tasks.boss.send('sms.send', { notificationId: id }, { db: (await import('pg-boss')).fromPrisma(tx) });
      await tx.auditLog.create({ data: { actorId, action: 'SMS_RETRY', targetId: id, detail: {} } });
      return { ok: true };
    });
  }
  async recoverInterrupted() {
    await this.db.notification.updateMany({ where: { status: 'SENDING', updatedAt: { lt: new Date(Date.now() - 120000) } }, data: { status: 'UNKNOWN', error: '发送过程被中断，请核查供应商发送记录' } });
  }
}
