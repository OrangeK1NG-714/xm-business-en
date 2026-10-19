export interface User {
    id: string; // 用户ID
    name: string; // 用户名
    email?: string | null; // 邮箱
    phone: string; // 手机号
    address?: string | null; // 地址
    password: string; // 密码
    avatar?: string | null; // 头像
    wordNumber: number; // 单词数量
    dayNumber: number; // 打卡天数
    createdAt: Date; // 创建时间
    updatedAt: Date; // 更新时间
    lastLoginAt?: Date | null; // 最后登录时间
}

//登录的类型
export type UserLogin = Pick<User, 'phone' | 'password'>
//注册
export type UserRegister = Pick<User, 'name' | 'phone' | 'email' | 'password'>
//返回的类型,不包含密码
export type ResultUser = Omit<User, 'password'>

//token的类型
export type Token = {
    accessToken: string,
    refreshToken: string,
}
//返回的类型，包含token
export type WebResultUser = ResultUser & {
    token: Token
}
//token的载荷
export type TokenPayload = Pick<User, 'name' | 'email'> & { userId: User['id'] }
//刷新token的载荷
export type RefreshTokenPayload = TokenPayload & { tokenType: 'refresh' | 'access' }