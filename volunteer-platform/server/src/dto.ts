import { BadRequestException } from '@nestjs/common';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, validate } from 'class-validator';

export async function input<T extends object>(type: ClassConstructor<T>, body: unknown) {
  const value = plainToInstance(type, body);
  const errors = await validate(value, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true });
  if (errors.length) throw new BadRequestException(errors.flatMap(e => Object.values(e.constraints || {})).join('；'));
  return value;
}

export class LoginInput {
  @IsString() @MinLength(1) @MaxLength(80) username!: string;
  @IsString() @MinLength(1) @MaxLength(200) password!: string;
}
export class IdsInput {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsString({ each: true }) ids!: string[];
}
export class ReviewInput extends IdsInput {
  @IsIn(['APPROVED', 'REJECTED']) decision!: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}
export class AttendanceInput extends IdsInput {
  @IsIn(['PRESENT', 'ABSENT']) attendance!: string;
  @IsOptional() @IsInt() @Min(1) @Max(14400) minutes?: number;
  @IsString() @MinLength(1) @MaxLength(200) reason!: string;
}
export class ActivityInput {
  @IsString() @MinLength(2) @MaxLength(80) title!: string;
  @IsIn(['校园服务', '社区关怀', '环境保护', '文化教育', '赛会保障']) category!: string;
  @IsString() @MinLength(5) @MaxLength(3000) description!: string;
  @IsString() @MinLength(2) @MaxLength(120) location!: string;
  @IsString() @MinLength(1) @MaxLength(30) contactName!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsDateString() registrationEndsAt!: string;
  @IsInt() @Min(1) @Max(10000) capacity!: number;
  @IsInt() @Min(1) @Max(14400) defaultMinutes!: number;
  @IsIn(['DRAFT', 'PUBLISHED']) status!: string;
}
export class StatusInput {
  @IsIn(['DRAFT', 'PUBLISHED', 'CANCELLED']) status!: string;
}
export class ExportInput {
  @IsString() from!: string;
  @IsString() to!: string;
  @IsOptional() @IsString() @MaxLength(80) department?: string;
  @IsOptional() @IsString() activityId?: string;
}
export class ApplyInput {
  @IsString() @MinLength(1) sessionId!: string;
  @IsBoolean() notificationConsent!: boolean;
}
