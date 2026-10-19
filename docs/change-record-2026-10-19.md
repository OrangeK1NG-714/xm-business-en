# 2026-10-19 项目工作保存记录

- 仓库：<https://github.com/OrangeK1NG-714/xm-business-en>
- 工作分支：`codex/save-project-work-20261019`
- 合并目标：`master`
- 起始提交：`7b14ca3c8bda74052b20d2ece7b1b05cb1ddbf37`
- 保存方式：提交当前工作，通过 GitHub PR 使用 merge commit 合并，保留功能提交和合并节点。

## 保存内容

- 英语学习前端：首页与 3D 素材、词库查询与筛选、搜索、登录注册、双 Token 持久化、并发刷新与路由保护。
- 英语学习后端：登录注册、JWT 签发与刷新、词库访问保护、Prisma 兼容和词库导入工具；补齐开发说明、配置示例与测试。
- 志愿服务平台初版：独立 pnpm 工作区，管理后台、NestJS API、后台任务、数据库模型与迁移、审核通知、出勤时长和 Excel 报表；保存产品与技术方案。
- 提交前修复：为词库查询启用已有 AuthGuard；修正志愿后台 JSX 闭合、组件导入与 Day.js 相对时间插件缺失导致的编译失败。

## 验证结果

在仓库根目录执行：

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter @en/web test` | 15 项测试通过 |
| `pnpm --filter @en/web lint` | 通过 |
| `pnpm --filter @en/web build` | 通过 |
| `pnpm --filter @en/server test --runInBand` | 6 个测试套件、24 项测试通过 |
| `pnpm --filter @en/server build:all` | server、ai 均构建通过 |

在 `volunteer-platform/` 执行：

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter @volunteer/server test` | 7 项测试通过 |
| `pnpm --filter @volunteer/server build` | 通过 |
| `pnpm --filter @volunteer/admin build` | 通过 |

两处 Web 构建有打包体积提示，不影响构建成功。本次未执行数据库迁移、真实短信发送或数据库端到端联调；志愿小程序尚未包含在本次代码中。

实际 `.env`、依赖目录和构建产物由现有忽略规则排除，环境示例和模型原始许可随代码保存。PR 链接与功能提交标识在创建后补记；合并节点可在 GitHub PR 时间线与 `master` 的 Git 历史中查询。
