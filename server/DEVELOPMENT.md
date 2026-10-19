# 后端跟课说明

当前后端以 `大庚剑阵-后看/第6招(双token鉴权)/讲义/token.md` 和课程代码为对照，已接通双 Token，前端采用 React。业务文件继续保留课程的名称、方法、注释与执行顺序。

## 对照文件

项目中的 `server/` 对应课程的后端工程，下面的相对路径从 `server/` 开始：

| 课程内容 | 项目内文件（相对 server） |
| --- | --- |
| 词库查询、分页、标签筛选 | `apps/server/src/word-book/word-book.controller.ts`、`word-book.service.ts` |
| 注册、登录、更新最后登录时间 | `apps/server/src/user/user.controller.ts`、`user.service.ts` |
| 签发 accessToken 和 refreshToken | `apps/server/src/auth/auth.service.ts`、`auth.module.ts` |
| 受保护词库接口、验证 accessToken | `libs/shared/src/auth/auth.guard.ts` |
| JWT 密钥、10 秒有效期和环境变量 | `libs/shared/src/shared.module.ts` |
| 全局前缀、版本、拦截器 | `apps/server/src/main.ts` |
| 统一返回 | `libs/shared/src/response/response.service.ts` |
| 响应拦截与异常处理 | `libs/shared/src/interceptor/interceptor.ts`、`exceptionFilter.ts` |
| Prisma 连接 | `libs/shared/src/prisma/prisma.service.ts` |

共享类型来自 `packages/common/user/index.ts`，包括 `Token`、`WebResultUser`、`TokenPayload` 和带 `tokenType` 的载荷类型。登录和注册返回不含密码的资料及双 Token。

## 保留的本地差异

- 端口采用已约定的后端 6001、前端 6002、AI 6003。
- 使用现有 React 前端。登录和注册按课程先调用 `md5(password)`，再提交后端；前端根据响应 `code` 判断业务成功或失败。
- 保留当前依赖版本、Prisma 生成文件和数据库迁移记录。`nest-cli.json` 与 `webpack.config.js` 用于当前 Prisma 7 生成代码的编译兼容。
- 使用你已接入的 `@nestjs/jwt`、`@nestjs/config`、签发服务和鉴权 Guard。JWT 默认 accessToken 10 秒，refreshToken 7 天；两个 Token 的 `tokenType` 不可互换。
- 本次补上 `UserService.refreshToken` 生成 Token 后遗漏的 `return this.responseService.success(token)`，否则前端无法取得刷新结果。
- 当前 JWT / Config 依赖为 ESM，Jest 的 ts-jest 配置针对这两个包增加转译兼容，以便验证真实签发及 Guard 行为。
- `prisma/import-words.ts`、`word-import.ts`、`seed.ts` 和额外的 `.spec.ts` 是本地导入与验证辅助文件，不属于课程业务实现。跟课主要阅读上表中的文件。

此前额外抽出的 `setup.ts`、`password.ts`、`user.validation.ts` 已移除，初始化回到课程的 `main.ts` 中。

## 当前课程接口

- `GET /api/v1/word-book`：需要 `Authorization: Bearer <accessToken>`；缺少、过期或使用 refreshToken 返回 HTTP 401。默认 `page=1&pageSize=12`；`word` 使用课程的 `contains` 查询；标签参数字符串为 `true` 时参与筛选。返回 `{ total, list }`，按 `frq: 'desc'` 排序。
- `POST /api/v1/user/register`：提交 `{ name, phone, password, email? }`。`password` 是前端计算的 MD5。依次检查手机号、邮箱是否重复，再创建用户，使用 `userSelect` 排除密码。
- `POST /api/v1/user/login`：提交 `{ phone, password }`。依次检查手机号是否存在、提交值是否匹配，然后更新 `lastLoginAt` 并返回用户资料和双 Token。注册同样返回双 Token。
- `POST /api/v1/user/refresh-token`：提交 `{ refreshToken }`，验证签名、有效期、`tokenType: 'refresh'` 及用户存在后返回 `{ accessToken, refreshToken }`。无效令牌返回课程业务错误 `code=500`、`data=null`。

统一响应为 `{ timestamp, path, message, code, success, data }`。保留课程原始语义：成功 `code=200`，业务错误通过 `responseService.error` 返回 `code=500`；普通响应拦截器的 `success` 固定为 `true`，所以前端以 `code` 判断。POST 使用 Nest 默认 HTTP 201，业务错误与 HTTP 状态需要区分。`HttpException` 由课程异常过滤器单独处理。

密码处理和错误返回在这里用于对照课程；MD5 不适合作为正式项目的密码存储方案。前端应同时检查业务 `code`；独立刷新客户端不能再次触发自己的刷新逻辑。退出登录目前仅清理客户端会话。

## 启动

本地使用 Node.js 24、pnpm 和 PostgreSQL。已经导入词库的数据库无需再次导入。在仓库根目录执行：

```sh
pnpm install
pnpm --filter @en/server db:generate
pnpm run all
```

`server/.env` 配置 `DATABASE_URL` 和 `SECRET_KEY`，格式见 `.env.example`。密钥仅由后端读取。前端 http://localhost:6002 通过 Vite 将 `/api/v1` 代理到后端 6001，课程 `main.ts` 不额外配置 CORS。

在另一台机器首次准备数据库时执行：

```sh
pnpm --filter @en/server db:migrate
pnpm --filter @en/server db:import:words "/你的课程路径/第1招(项目搭建)/数据库脚本/ecdict.csv"
```

完整词库 CSV 默认 GBK 编码，UTF-8 文件加 `--encoding=utf-8`。加 `--dry-run` 只读取校验；重复导入跳过已有单词，不更新或删除数据。没有 CSV 时可用 `pnpm --filter @en/server db:seed:demo` 导入 6 个演示词条。

验证命令：

```sh
pnpm --filter @en/server build:all
pnpm --filter @en/server test --runInBand
pnpm --filter @en/web build
pnpm --filter @en/web lint
pnpm --filter @en/web test
```
