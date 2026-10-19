import { Module, Global } from '@nestjs/common';
import { SharedService } from './shared.service';
import { PrismaModule } from './prisma/prisma.module';
import { ResponseModule } from './response/response.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  providers: [SharedService],
  exports: [SharedService, PrismaModule, ResponseModule,JwtModule,ConfigModule],
  imports: [
    PrismaModule, ResponseModule,
    ConfigModule.forRoot({
      isGlobal: true, //全局配置
      envFilePath: '.env', //环境变量文件
    }),
    JwtModule.registerAsync({
      imports:[ConfigModule],
      inject:[ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('SECRET_KEY'),
        signOptions: { expiresIn: 10 },
      })
    })
  ],
})
export class SharedModule { }
