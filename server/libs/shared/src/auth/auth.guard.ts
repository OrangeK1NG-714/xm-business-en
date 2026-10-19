import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import type { RefreshTokenPayload } from '@en/common/user';
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService:JwtService){}
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const headers = request.headers;
    if(!headers.authorization){
      throw new UnauthorizedException('不允许绕过前端')
    }
    const token =  headers.authorization.split(' ')[1]
    try{
      const  decoded =this.jwtService.verify<RefreshTokenPayload>(token);
      if(decoded.tokenType !== 'access'){
        throw new UnauthorizedException('token已过期或无效')
      }
      request.user = decoded
      return true
    }catch(error){
      throw new UnauthorizedException('token已过期或无效')
    }
  }
}
