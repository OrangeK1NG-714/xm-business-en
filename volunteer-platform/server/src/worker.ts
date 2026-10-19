import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './api.js';
import { Tasks } from './queue.js';
import { Notifications } from './notifications.js';
import { Reporting } from './reporting.js';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  const tasks = app.get(Tasks), notifications = app.get(Notifications), reporting = app.get(Reporting);
  await notifications.recoverInterrupted();
  await tasks.boss.work<{ notificationId: string }>('sms.send', { pollingIntervalSeconds: 1 }, async jobs => { for (const job of jobs) await notifications.send(job.data.notificationId); });
  await tasks.boss.work<{ exportId: string }>('report.export', { pollingIntervalSeconds: 1 }, async jobs => { for (const job of jobs) await reporting.generate(job.data.exportId); });
  setInterval(() => { notifications.recoverInterrupted().catch(error => console.error('Notification recovery failed:', error.message)); }, 60000).unref();
  console.log('Worker ready: sms.send / report.export');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
