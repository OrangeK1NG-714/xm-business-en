import { Injectable } from '@nestjs/common';
import type { UserLogin, UserRegister, Token, TokenPayload, RefreshTokenPayload } from '@en/common/user';
import { PrismaService, ResponseService } from '@libs/shared';
import type { Prisma } from '@libs/shared/generated/prisma/client';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { userSelect } from './user.select';
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService,
    private readonly responseService: ResponseService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) { }
  //登录
  async login(createUserDto: UserLogin) {
    //phone password
    //1. 检查是手机号是否存在
    const user = await this.prisma.user.findUnique({
      where: {
        phone: createUserDto.phone, //查询手机号
      }
    })
    if (!user) {
      return this.responseService.error(null, '手机号不存在');
    }
    //2. 检查密码是否正确
    if (user.password !== createUserDto.password) {
      return this.responseService.error(null, '密码不正确');
    }
    //3. 查询用户信息 更新最后登录时间
    const updateUser = await this.prisma.user.update({
      where: {
        id: user.id, //查询用户ID
      },
      data: {
        lastLoginAt: new Date(), //最后登录时间
      },
      select: userSelect
    })
    //4. 生成token {userId, name, email}
    const token = this.authService.generateToken({ userId: updateUser.id, name: updateUser.name, email: updateUser.email })

    return this.responseService.success({ ...updateUser, token });
  }
  //注册 Primsa他所有的API都是异步的
  async register(createUserDto: UserRegister) {
    const data: Prisma.UserCreateInput = {
      name: createUserDto.name,
      phone: createUserDto.phone,
      password: createUserDto.password,
      lastLoginAt: new Date(), //最后登录时间
    }
    //name email? phone password
    //1. 如果手机号已经存在则返回错误
    //findUnique 返回单个数据 也就是返回一个对象 findUnique 他只能查询数据是唯一的 并且返回单个数据
    const user = await this.prisma.user.findUnique({
      where: {
        phone: createUserDto.phone, //查询手机号
      }
    })
    if (user) {
      return this.responseService.error(null, '手机号已经存在');
    }
    //2. 判断一下邮箱如果他传入了 并且存在了也不行的说明重复了
    if (createUserDto.email) {
      const emailUser = await this.prisma.user.findUnique({
        where: {
          email: createUserDto.email, //查询邮箱
        }
      })
      if (emailUser) {
        return this.responseService.error(null, '邮箱已经存在');
      }
      data.email = createUserDto.email;
    }
    //3. 创建用户 默认他是把所有的值全部返回包括密码 排除掉密码
    const newUser = await this.prisma.user.create({
      data,
      select: userSelect
    })
    //4. 生成token {userId, name, email}
    const token = this.authService.generateToken({ userId: newUser.id, name: newUser.name, email: newUser.email })
    return this.responseService.success({ ...newUser, token });
  }
  //刷新token
  async refreshToken(createUserDto: Omit<Token, 'accessToken'>) {
    //1. 验证refreshToken是否有效
    try{
       const decoded = this.jwtService.verify<RefreshTokenPayload>(createUserDto.refreshToken)
       if(decoded.tokenType !== 'refresh'){
        return this.responseService.error(null,'refreshToken已过期或无效')
       }
       const user = await this.prisma.user.findUnique({
        where:{
          id: decoded.userId
        }
       })
       if(!user){
        return this.responseService.error(null,'用户不存在');
       }
       const token = this.authService.generateToken({userId: user.id,name:user.name,email:user.email});
       return this.responseService.success(token);
    }
   catch(error){
    return this.responseService.error(null, 'refreshToken已过期或无效')
   }
  }
}
