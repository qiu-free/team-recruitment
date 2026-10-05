# 项目组队与成员招募平台 Demo 设计

## 目标

交付一个可以通过 Docker Compose 从头启动、使用预置账号完成“发布项目/查找项目/申请加入/审核加入/查看结果”闭环的全栈 Demo。实现题目要求的真实数据访问、权限校验、申请状态、角色名额和并发一致性。

## 范围

- 预置四个测试账号，不实现注册、验证码、找回密码和复杂后台管理。
- 支持个人资料编辑、项目发布、项目筛选、项目详情、加入申请、撤回、发起人接受/拒绝、暂停/恢复招募。
- 支持三类预置项目：招募中、暂停招募、角色已满；至少一个角色剩余一个名额并有两条待审核申请。
- 申请保存提交时的资料快照；非发起人不能审核，非申请相关人员不能读取申请正文。
- 通过 PostgreSQL 事务、行锁和唯一约束保护接受申请、重复审核和并发竞争。
- 不实现即时聊天、附件、成员退出、踢出成员、名额调整和自动匹配。

## 架构

采用单仓库结构：React + Vite + TypeScript 前端构建为静态资源，Fastify + TypeScript 后端提供 REST API 并托管构建产物，PostgreSQL 作为独立 Compose 服务。数据库初始化脚本只在新数据卷上执行；业务数据全部存储在 PostgreSQL named volume 中。

认证使用预置账号登录和 HttpOnly Cookie 会话。会话保存在应用进程内，重启后需要重新登录；项目、申请、成员和审核结果保存在数据库中。后端每个敏感接口重新检查当前用户身份和资源权限。

## 数据模型

- `users`：账号、密码哈希、昵称、简介、技能标签、每周可投入时间。
- `projects`：发起人、标题、目标、进展、预期成果、暂停开关。
- `project_roles`：项目角色、技能要求、人数上限。
- `applications`：申请内容、提交时资料快照、状态、拒绝原因和审核时间。
- `project_members`：项目成员及其角色；发起人作为展示成员但不占招募角色名额。

数据库约束确保同一项目同一用户最多一个成员身份；通过部分唯一索引确保同一项目同一用户最多一条待审核申请。接受申请事务锁定申请和角色，并在事务内完成状态变更与成员插入。

## API 方向

- `POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`
- `GET /api/profile`、`PATCH /api/profile`
- `GET /api/projects`、`POST /api/projects`、`GET /api/projects/:id`
- `PATCH /api/projects/:id/recruitment`
- `POST /api/projects/:id/applications`、`GET /api/applications/mine`、`POST /api/applications/:id/withdraw`
- `GET /api/projects/:id/applications`（仅发起人）
- `POST /api/applications/:id/approve`、`POST /api/applications/:id/reject`（仅发起人）

公开项目接口返回角色余量和成员名单，但申请理由、承担内容和资料快照只按权限返回。

## 前端信息架构

使用单页 Demo 界面，登录后提供：项目浏览/筛选、项目详情与申请入口、我的申请、我发起的项目/审核面板、个人资料编辑。所有主要请求有加载、空结果、错误和成功反馈；名额竞争失败显示后端真实原因。

## 测试和验收

- 单元测试：筛选 AND 逻辑、同角色技能匹配、申请状态转换和名额规则。
- API 测试：登录、资料、项目、申请、权限和审核接口。
- 并发测试：一个名额接受两名申请人、同一申请重复接受、撤回与接受竞争。
- Docker 验证：`docker compose up --build`，执行核心流程，再保留数据卷重建容器确认数据存在。
- README 提供账号、示例项目、至少三个关键场景的操作步骤和实际验证命令。

## 已知限制

- Demo 会话只存在应用内存，重启应用后需重新登录，不影响业务数据持久化。
- 预置密码仅用于验收 Demo，不适用于生产环境。
- 暂不提供角色名额发布后的编辑，以及成员退出和管理功能。
