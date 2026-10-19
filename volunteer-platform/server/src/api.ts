import { Body, Controller, Get, Inject, Module, Param, Post, Query, Req, Res, UseGuards, NotFoundException } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Database } from './database.js';
import { Tasks } from './queue.js';
import { Activities } from './activities.js';
import { Applications } from './applications.js';
import { Notifications } from './notifications.js';
import { Reporting } from './reporting.js';
import { AdminGuard, type AuthRequest, Sessions, UserGuard } from './auth.js';
import { ActivityInput, ApplyInput, AttendanceInput, ExportInput, input, LoginInput, ReviewInput, StatusInput } from './dto.js';
import { config } from './config.js';
import { EXTERNAL_PLATFORM, MockPlatformAdapter, type ExternalPlatformAdapter } from './integration.js';

@ApiTags('公开与登录')
@Controller()
class PublicController {
  constructor(@Inject(Database) private db: Database, @Inject(Sessions) private sessions: Sessions, @Inject(Activities) private activities: Activities) {}
  @Get('health') async health() { await this.db.$queryRaw`SELECT 1`; return { status: 'ok' }; }
  @Get('config') settings() { return { demo: config().demo, smsProvider: config().provider, externalConnected: false }; }
  @Post('auth/login') @ApiOperation({ summary: '管理员登录' }) async login(@Body() body: unknown, @Req() req: AuthRequest) {
    const data = await input(LoginInput, body); return this.sessions.login(data.username, data.password, req.ip || 'unknown');
  }
  @Post('auth/demo') async demo() {
    if (!config().demo) throw new NotFoundException();
    const user = await this.db.user.findFirst({ where: { role: 'ADMIN' } });
    if (!user) throw new NotFoundException('请先执行演示数据初始化');
    return this.sessions.sign(user);
  }
  @Post('auth/demo-volunteer') async demoVolunteer() {
    if (!config().demo) throw new NotFoundException();
    const user = await this.db.user.findUnique({ where: { number: 'DEMO-001' } });
    if (!user) throw new NotFoundException('请先初始化演示数据');
    return this.sessions.sign(user);
  }
  @Get('public/activities') publicActivities() { return this.activities.list(true); }
}

@ApiTags('志愿者') @ApiBearerAuth() @UseGuards(UserGuard)
@Controller('me')
class VolunteerController {
  constructor(@Inject(Activities) private activities: Activities) {}
  @Get('applications') list(@Req() req: AuthRequest) { return this.activities.applications(req.identity.sub); }
  @Post('applications') async apply(@Body() body: unknown, @Req() req: AuthRequest) { const data = await input(ApplyInput, body); return this.activities.apply(data.sessionId, req.identity.sub, data.notificationConsent); }
  @Post('applications/:id/cancel') cancel(@Param('id') id: string, @Req() req: AuthRequest) { return this.activities.cancel(id, req.identity.sub); }
}

@ApiTags('管理工作台') @ApiBearerAuth() @UseGuards(AdminGuard)
@Controller('admin')
class AdminController {
  constructor(@Inject(Database) private db: Database, @Inject(Activities) private activities: Activities, @Inject(Applications) private applications: Applications, @Inject(Notifications) private notifications: Notifications, @Inject(Reporting) private reporting: Reporting, @Inject(EXTERNAL_PLATFORM) private external: ExternalPlatformAdapter) {}
  @Get('activities') list() { return this.activities.list(); }
  @Post('activities') async create(@Body() body: unknown, @Req() req: AuthRequest) { return this.activities.create(await input(ActivityInput, body), req.identity.sub); }
  @Post('activities/:id/status') async changeStatus(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthRequest) { return this.activities.changeStatus(id, (await input(StatusInput, body)).status, req.identity.sub); }
  @Post('activities/:id/copy') copy(@Param('id') id: string, @Req() req: AuthRequest) { return this.activities.copy(id, req.identity.sub); }
  @Get('applications') registrations() { return this.activities.applications(); }
  @Post('applications/review') async review(@Body() body: unknown, @Req() req: AuthRequest) { return this.applications.review(await input(ReviewInput, body), req.identity.sub); }
  @Post('applications/attendance') async attendance(@Body() body: unknown, @Req() req: AuthRequest) { return this.applications.attendance(await input(AttendanceInput, body), req.identity.sub); }
  @Get('notifications') messages() { return this.notifications.list(); }
  @Post('notifications/:id/retry') retry(@Param('id') id: string, @Req() req: AuthRequest) { return this.notifications.retry(id, req.identity.sub); }
  @Get('reports') reports(@Query() filters: ExportInput) { return this.reporting.preview(filters); }
  @Get('exports') exports() { return this.reporting.list(); }
  @Post('exports') async createExport(@Body() body: unknown, @Req() req: AuthRequest) { return this.reporting.create(await input(ExportInput, body), req.identity.sub); }
  @Get('exports/:id/download') async download(@Param('id') id: string, @Res() res: Response) { const job = await this.reporting.download(id); res.download(job.filePath!, job.fileName!); }
  @Get('people') async people() {
    const users = await this.db.user.findMany({ where: { role: 'VOLUNTEER' }, select: { id: true, name: true, number: true, department: true, createdAt: true, applications: { select: { status: true, serviceRecords: { where: { status: 'CONFIRMED' }, select: { minutes: true } } } } }, orderBy: { name: 'asc' } });
    return users.map(({ applications, ...user }) => ({ ...user, applications: applications.length, minutes: applications.reduce((sum, item) => sum + item.serviceRecords.reduce((s, r) => s + r.minutes, 0), 0) }));
  }
  @Get('audit') audit() { return this.db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }); }
  @Get('system') system() { return { demo: config().demo, smsProvider: config().provider, notificationsEnabled: config().notificationsEnabled, externalPlatform: { name: this.external.name, connected: this.external.connected, mode: 'adapter', detail: '对接接口已预留，当前使用本地活动与演示数据' }, reportPolicy: '按服务日期统计已核定的有效记录；时区 Asia/Shanghai' }; }
}

@Module({
  imports: [JwtModule.registerAsync({ useFactory: () => ({ secret: config().secret, signOptions: { expiresIn: '8h', issuer: 'volunteer-platform', audience: 'volunteer-client' }, verifyOptions: { issuer: 'volunteer-platform', audience: 'volunteer-client' } }) })],
  controllers: [PublicController, VolunteerController, AdminController],
  providers: [Database, Tasks, Sessions, UserGuard, AdminGuard, Activities, Applications, Notifications, Reporting, { provide: EXTERNAL_PLATFORM, useClass: MockPlatformAdapter }],
})
export class AppModule {}
