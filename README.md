# English Lab

基于课程「大庚剑阵」第 1–6 招的 React + Ant Design / NestJS 学习项目，已接入双 Token 鉴权。

## 已实现

- 词库：真实数据库查询、关键词搜索、8 类考试标签筛选、分页、英语发音。
- 全局搜索：点击导航搜索，或使用 Ctrl/Cmd + K、Ctrl/Cmd + F；500ms 防抖、复制单词、Esc 关闭。
- 首页：响应式布局、滚动展示、数字动画、Three.js GLTF 模型与拖动交互。
- 登录注册：前端表单校验、账号重复检测、用户资料展示；按课程在前端计算 MD5，后端保存并比较提交值。
- 双 Token：用户资料和两个令牌持久化；请求自动携带 Bearer accessToken，遇到 401 刷新双 Token 并重发，并发请求共享一次刷新。
- 登录保护：未登录访问词库或搜索时打开登录弹框，成功后继续原操作；刷新凭证无效则清除登录态，退出回首页。

课程为了方便测试，将 accessToken 有效期设为 **10 秒**、refreshToken 设为 **7 天**；10 秒后出现一次 401，随后刷新成功并重发是预期流程。

React 与 Vue 课程的对应关系、主要代码和验证方式见 [前端跟课说明](apps/web/README.md)，接口契约见 [后端跟课说明](server/DEVELOPMENT.md)。这份 MD5 密码示例用于本地跟课，正式项目应使用专门的密码哈希方案。

## 启动

需要 Node.js 24、pnpm 和 PostgreSQL。

```sh
pnpm install
pnpm --filter @en/server db:generate
```

配置 `server/.env` 中的 `DATABASE_URL` 和 JWT 签名密钥 `SECRET_KEY`，格式见 `server/.env.example`。密钥只保存在后端。使用独立开发数据库，随后执行：

```sh
pnpm --filter @en/server db:migrate
pnpm --filter @en/server db:import:words "/你的课程路径/第1招(项目搭建)/数据库脚本/ecdict.csv"
pnpm run all
```

没有课程 CSV 时，可执行 `pnpm --filter @en/server db:seed:demo` 导入 6 个演示词条。完整词库导入使用固定词条 ID，重跑跳过已有词条，不覆盖数据。

| 服务 | 地址 | 单独启动 |
| --- | --- | --- |
| 前端 | http://localhost:6002 | `pnpm run web` |
| 后端 | http://localhost:6001/api/v1 | `pnpm run server` |
| AI 初始化服务 | http://localhost:6003 | `pnpm run ai` |

Vite 将 `/api/v1` 代理到后端 6001；生产部署需配置相同的反向代理及 HTTPS。详细数据库准备和接口契约见 [后端开发说明](server/DEVELOPMENT.md)。

## 验证

```sh
pnpm --filter @en/web build
pnpm --filter @en/web lint
pnpm --filter @en/web test
pnpm --filter @en/server build:all
pnpm --filter @en/server test --runInBand
```

## 案例素材

3D 模型取自本机课程参考资料，作者和原始许可保存在 `apps/web/public/models/*/license.txt`，页面模型区域也提供署名。注册模型使用 CC BY-NC 4.0，只能用于非商业用途；商业使用需替换或取得作者授权。词库 CSV 由使用者从课程资料提供，不纳入仓库。
