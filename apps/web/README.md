# React 前端跟课说明

本目录将「第6招(双token鉴权)」的 Vue 示例接到现有 React 界面，保留首页、词库、搜索及登录注册的样式。

## 用到的库

| Vue 课程中的做法 | 当前 React 实现 | 用途 |
| --- | --- | --- |
| Vue 组件、组合式函数 | React 19 + Hooks | 登录弹框、受保护操作、页面状态 |
| Pinia + 持久化插件 | Zustand 5 的 `persist` 中间件 | 用户资料、双 Token 和 localStorage 持久化 |
| Vue Router | React Router 7 | 词库路由保护、退出跳转、登录后返回 |
| Axios 拦截器、刷新队列 | Axios 1 + 共享 Promise | 自动带 Token、401 刷新、恢复并发请求 |
| Element Plus | Ant Design 6 | 表单校验、弹框、提示和账户菜单 |
| md5 | md5 | 保持课程的密码提交格式 |
| — | Vitest 5 | 自动验证鉴权、并发和持久化行为 |

本次新增的依赖只有开发依赖 Vitest；其余沿用项目已有库。前端不需要 JWT 签名库，签发和验证由 NestJS 完成。

## 双 Token 的处理过程

1. 登录或注册成功，取得 `WebResultUser`，把用户资料和 `token: { accessToken, refreshToken }` 一起写入 Zustand，由 `persist` 保存到 localStorage。
2. 普通请求从 Store 读取最新 accessToken，设置 `Authorization: Bearer ...`。登录、注册属于公开接口，不携带旧凭证，也不触发刷新。
3. 受保护接口返回 HTTP 401 后，用独立 Axios 实例向 `/user/refresh-token` 提交 `{ refreshToken }`，避免刷新接口的 401 递归触发刷新。
4. 多个请求同时 401 时共享同一个刷新 Promise。成功后先同时更新两个 Token，再使用原参数、请求体和取消信号重发，每个请求最多重试一次。
5. refreshToken 无效、刷新接口 401/403，或重试仍然 401，清除登录态并提示重新登录。暂时断网和 HTTP 5xx 保留会话，下次操作可继续尝试。

后端沿用课程的统一响应：业务错误也可能是 HTTP 201、`success: true`，所以不能只判断 `success`。刷新必须同时满足 `success`、`code === 200` 和完整 Token 对，普通请求也检查业务 `code`。

## 页面和异步请求

- `useLogin` 用于搜索按钮、快捷键、首页词库入口等操作：未登录先显示弹框，登录或注册完成后执行原动作。
- `RequireAuth` 保护词库路由，包括地址栏直接访问；未登录回首页并打开弹框，成功后返回目标地址。
- `sessionVersion` 在登录或退出时递增，刷新 Token 时不变。旧账号尚未完成的响应不能恢复已经退出的会话、覆盖新账号或清除新账号；账户切换时重新挂载搜索和词库，清理旧数据。
- 某个搜索请求取消时只取消它自己的等待，其余请求仍可完成刷新。迟到的旧 Token 401 会复用已经更新的 Token。
- 持久化缓存升级到版本 1；第 5 招只保存资料、没有双 Token 的旧缓存会自动转成未登录状态。
- 退出时清理用户、Token 和弹框状态，关闭搜索并回到首页。当前课程退出仅清理本地会话，没有后端令牌撤销接口。

## 建议阅读顺序

1. [用户 Store](src/store/user.ts)：用户类型、Token 更新、持久化和会话版本。
2. [请求层](src/api/index.ts)：请求拦截、独立刷新、共享 Promise、失败和取消处理。
3. [用户 API](src/api/user.ts) 与 [登录注册组件](src/components/Login/index.tsx)：提交、存储和登录后的动作。
4. [useLogin](src/hooks/useLogin.ts)、[RequireAuth](src/router/RequireAuth.tsx) 与 [布局](src/layouts/BasicLayout.tsx)：按钮保护、路由保护和退出。
5. [鉴权测试](src/api/index.test.ts)：并发、失败、账号切换和旧缓存的例子。

## 本地验证

在仓库根目录执行 `pnpm run all`，打开 http://localhost:6002。后端需要 PostgreSQL，以及 `server/.env` 的 `DATABASE_URL`、`SECRET_KEY`；签名密钥不放进前端环境变量。

```sh
pnpm --filter @en/web test
pnpm --filter @en/web lint
pnpm --filter @en/web build
```

未登录直接打开 `/word-book`，应回首页并弹出登录。登录或注册后应自动返回词库；刷新页面应保留登录。等待超过 10 秒再搜索，在浏览器 Network 中可以看到：词库 401 → refresh-token 成功 → 词库重发成功。10 秒是讲义的演示配置，refreshToken 有效期是 7 天。

MD5 和 localStorage 沿用课程约定；MD5 不用于正式项目的密码存储，localStorage 中的 Token 需要结合页面的 XSS 防护。
