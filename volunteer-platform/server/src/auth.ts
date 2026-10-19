import { CanActivate, ExecutionContext, ForbiddenException, HttpException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon from 'argon2';
import type { Request } from 'express';
import { Database } from './database.js';

export interface Identity { sub: string; role: string; name: string }
export type AuthRequest = Request & { identity: Identity };

@Injectable()
export class Sessions {
  private readonly failures = new Map<string, { count: number; until: number }>();
  constructor(@Inject(Database) private db: Database, @Inject(JwtService) private jwt: JwtService) {}
  async login(username: string, password: string, address: string) {
    const key = `${address}:${username}`;
    const throttle = this.failures.get(key);
    if (throttle && throttle.until > Date.now() && throttle.count >= 5) throw new HttpException('登录失败次数过多，请 15 分钟后再试', 429);
    const user = await this.db.user.findUnique({ where: { username } });
    if (!user?.passwordHash || user.role !== 'ADMIN' || !await argon.verify(user.passwordHash, password)) {
      this.failures.set(key, { count: throttle && throttle.until > Date.now() ? throttle.count + 1 : 1, until: Date.now() + 900000 });
      throw new UnauthorizedException('账号或密码错误');
    }
    this.failures.delete(key);
    return this.sign(user);
  }
  sign(user: { id: string; role: string; name: string }) {
    return { token: this.jwt.sign({ sub: user.id, role: user.role, name: user.name }), user: { id: user.id, role: user.role, name: user.name } };
  }
}

@Injectable()
export class UserGuard implements CanActivate {
  constructor(@Inject(JwtService) private jwt: JwtService, @Inject(Database) private db: Database) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    try {
      if (!token) throw new Error();
      const identity = await this.jwt.verifyAsync<Identity>(token);
      const user = await this.db.user.findUnique({ where: { id: identity.sub }, select: { id: true, role: true, name: true } });
      if (!user) throw new Error();
      req.identity = { sub: user.id, role: user.role, name: user.name };
      return true;
    } catch { throw new UnauthorizedException('登录已失效，请重新登录'); }
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(UserGuard) private userGuard: UserGuard) {}
  async canActivate(context: ExecutionContext) {
    await this.userGuard.canActivate(context);
    if (context.switchToHttp().getRequest<AuthRequest>().identity.role !== 'ADMIN') throw new ForbiddenException('需要管理权限');
    return true;
  }
}
