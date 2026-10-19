import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { fromPrisma, PgBoss } from 'pg-boss';
import type { Prisma } from './generated/prisma/client.js';
import { config } from './config.js';

@Injectable()
export class Tasks implements OnModuleInit, OnModuleDestroy {
  readonly boss = new PgBoss({ connectionString: config().databaseUrl, schema: 'volunteer_jobs', application_name: 'volunteer-platform' });
  async onModuleInit() {
    this.boss.on('error', error => new Logger('Tasks').error(error.message));
    await this.boss.start();
    await this.boss.createQueue('sms.send', { retryLimit: 3, retryDelay: 30, retryBackoff: true });
    await this.boss.createQueue('report.export', { retryLimit: 2, retryDelay: 5 });
  }
  async sms(tx: Prisma.TransactionClient, notificationId: string) {
    return this.boss.send('sms.send', { notificationId }, { db: fromPrisma(tx), singletonKey: notificationId });
  }
  async report(tx: Prisma.TransactionClient, exportId: string) {
    return this.boss.send('report.export', { exportId }, { db: fromPrisma(tx), singletonKey: exportId });
  }
  async onModuleDestroy() { await this.boss.stop({ graceful: true, timeout: 10000 }); }
}
