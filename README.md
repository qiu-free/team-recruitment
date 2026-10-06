# 组队集市 · Team Recruitment Demo

这是题目 7“项目组队与成员招募平台”的可运行 Demo。它包含真实 React 前端、Fastify 后端和 PostgreSQL 数据库，重点覆盖从项目发布到申请审核、成员加入和名额竞争的完整闭环。

## 快速启动（推荐：Docker Compose）

环境只需要安装 Docker Desktop，不需要在宿主机安装 Node.js 或 PostgreSQL。

```bash
copy .env.example .env
# 将 .env 中的 SESSION_SECRET 替换为至少 32 个字符的随机值
docker compose up --build
```

打开 <http://localhost:3000>。首次启动时 PostgreSQL 会自动执行 `db/init/001_schema.sql` 和 `db/init/002_seed.sql`，创建表结构和测试素材。

Compose 会拒绝使用缺失或过短的 `SESSION_SECRET` 启动。该密钥用于签名登录会话，不要提交 `.env` 或把真实密钥写入仓库。

停止但保留数据卷：

```bash
docker compose down
docker compose up -d
```

不要使用 `docker compose down -v`，否则会删除持久化业务数据。

## 本机快速体验（无 Docker）

本地没有 PostgreSQL 时，项目会自动使用内存 Demo 数据，适合快速体验界面和业务流程；此模式重启后数据会恢复为预置状态。

```bash
npm install
npm run build
npm start
```

打开 <http://localhost:3000>。如需使用真实数据库，请配置 `.env` 或环境变量中的 `DATABASE_URL`，再启动服务。

## 测试账号和预置项目

所有账号密码均为 `demo1234`：

| 账号 | 用途 |
| --- | --- |
| `alice` | 项目发起人，拥有“校园智能导览”和“绿色校园能耗看板” |
| `bob` | 前端申请人；在开放项目中已有一条待审核申请 |
| `cathy` | 竞争申请人；与 bob 竞争开放项目唯一前端名额 |
| `david` | 无关用户/后端开发者；用于权限和已满员项目测试 |

预置项目：

- `校园智能导览`：招募中；前端开发只有 1 个名额，bob 和 cathy 有两条待审核申请。
- `绿色校园能耗看板`：暂停招募；已有角色但不接收新申请。
- `社团活动协作台`：后端角色已满。

## 三个核心验收场景

### 1. 一名额两申请竞争

1. 用 `alice` 登录，打开“校园智能导览”。
2. 在“申请审核”中接受 bob 或 cathy 的申请。
3. 再接受另一人的申请。
4. 预期：第一次成功，第二次明确提示“该角色名额已满”；前端角色余量为 0，成员名单只有一人，另一申请仍为待审核。

也可以分别用 `alice` 的两个浏览器会话同时点击接受，后端事务和数据库容量检查仍必须保证最多加入一人。

### 2. 暂停招募和申请状态

1. 用 `alice` 打开“绿色校园能耗看板”，确认页面显示“暂停招募”。
2. 用 `bob` 或 `cathy` 尝试提交申请，预期后端拒绝并显示暂停原因。
3. 用 `alice` 回到“校园智能导览”，可继续审核已有待审核申请。
4. 取消暂停后，只有仍有剩余名额的角色才恢复接收新申请。

### 3. 权限、资料快照和持久化

1. 用 `bob` 登录，尝试调用或通过界面审核 alice 的项目，后端应返回无权限。
2. 用申请人提交申请后编辑个人资料，再让发起人查看申请；申请卡片展示提交时的资料快照。
3. 申请人只能在“我的申请”查看自己的申请正文，其他用户不能读取该正文。
4. Docker 模式下创建项目、申请并审核后执行 `docker compose down && docker compose up -d`，刷新页面确认项目、申请、成员和剩余名额仍存在。

## 验证命令

```bash
npm test
npm run build
```

当前自动化测试覆盖：筛选规则、角色余量、预置素材、登录、资料更新、重复申请、暂停招募、申请撤回、权限审核、重复审核和一名额两申请竞争。`npm test` 会先构建前端产物，再执行测试，干净环境可直接运行。

真实 PostgreSQL 并发验证可在 Compose app 容器中执行：

```bash
docker compose exec app npm run verify:postgres
```

脚本会创建临时项目，真实并发接受两条申请，确认最终一条成功、一条 `ROLE_FULL`，并在结束后删除临时项目。

完整验收记录见 `tests/acceptance-checklist.md`，其中包含附件 TEAM-01 到 TEAM-11 及交付验证的操作、预期结果和实际结果。

## Docker 验收记录

验收机需要 Docker Engine 正常运行。检查命令：

```bash
docker version
docker compose version
```

当前项目已完成 Docker 构建、PostgreSQL 初始化、核心流程和保留数据卷重建验证。验收环境启动 Engine 后执行：

```bash
docker compose up --build -d
docker compose ps
docker compose logs app
```

验收记录见 `tests/acceptance-checklist.md`。本轮验证使用 named volume `110_team-recruitment-data`；执行 `docker compose down` 后再执行 `docker compose up -d`，项目、申请、成员和角色余量均可继续读取。不要使用 `docker compose down -v`，除非要清空数据重新初始化。

若验收操作已经改变预置素材状态，需要恢复干净基线时执行 `docker compose down -v && docker compose up --build -d`。该命令会删除当前业务数据，只应在重新开始验收时使用。数据库初始化脚本只在新数据卷首次创建时执行。

## 数据和权限设计

- 发起人作为项目成员展示，但不占招募角色名额。
- 待审核申请不占名额；只有接受后才创建成员记录并占用角色席位。
- 同一项目同一用户最多一条待审核申请；拒绝或撤回后，历史记录保留并允许重新申请。
- 申请保存提交时的昵称、简介、技能和每周时间快照。
- 数据访问权限在 Fastify 后端检查，不能通过隐藏前端按钮绕过。
- 接受申请在 PostgreSQL 事务中锁定申请和角色，检查状态、成员唯一性和剩余容量后同时更新申请与成员。

## 技术与已知限制

- 前端：React + Vite + TypeScript；后端：Fastify + TypeScript；数据库：PostgreSQL；部署：Docker Compose。
- 页面字体使用 Google Fonts 的 Manrope、DM Mono 和 Playfair Display；如果验收环境无法访问字体 CDN，会回退到本地字体，不影响功能。
- Demo 会话使用服务端签名 HttpOnly Cookie，签名密钥由 `SESSION_SECRET` 配置；过期后需要重新登录。业务项目、申请、成员和审核结果存储在 PostgreSQL 卷中。
- 本地 HTTP 验收保持 `COOKIE_SECURE=false`；只有通过 HTTPS 反向代理时才设置为 `true`。
- 预置账号密码仅用于本题 Demo；新初始化数据使用带随机盐的 scrypt 哈希。已有旧数据在账号成功登录时自动升级密码哈希，仍不应直接用于生产环境。
- 暂不实现注册、验证码、找回密码、即时聊天、附件、自动匹配、成员退出/踢出和发布后调整角色名额。
