

# Forumlify LITE Edition 🌊

> 一个简洁、优雅的现代社区系统。5 分钟 Docker 一键部署。

## ✨ 特性

- 🎨 精致简约的界面设计，支持亮色/暗色模式
- ⚡️ 轻量快速，无需复杂配置
- 🔐 自带用户认证（JWT）
- 📝 发帖、回复、举报、管理后台
- 🐳 Docker 一键部署
- 🌓 暗色/亮色模式切换

## 🤔 如何选择版本

Forumlify 提供了两个不同架构的分支版本，以满足不同部署环境与开发需求的场景：

* **Lite 版 (`lite` 分支)**：轻量单体架构，零构建步骤，资源占用极低，主要由Furrium维护。
* **Next.js 版 (`next` 分支)**：现代全栈架构，组件化开发，支持云原生与 Serverless / 边缘部署，主要由lezi-fun维护。

你可以根据以下维度选择最适合你当前需求的版本：

| 对比维度 | Forumlify (Lite 版 / `lite`) | Forumlify-Next (Next.js 版 / `next`) | 选择建议 |
| :--- | :--- | :--- | :--- |
| **上手速度与部署** | **极快**（零编译步骤，直接 `node server.js` 或 Docker 启动） | **中等**（需要经过 `next build` 编译打包，或配置 OpenNext） | 希望 1 分钟快速跑起来选 `lite` |
| **VPS 最低配置要求** | **1 核 512MB RAM**（资源占用极低，适合低配小鸡） | **1 核 1GB RAM+**（主要在打包构建时需要较多内存） | 内存有限或低配 VPS 推荐 `lite` |
| **存储扩展性** | 本地磁盘存储（`uploads/` 目录） | 支持 **Cloudflare R2 / S3 兼容对象存储** + 本地回退 | 需要接云存储或海量图片存储选 `next` |
| **部署环境支持** | 传统 VPS / Docker 容器 | VPS / Docker / **Cloudflare Workers / Vercel** | 需要 Serverless / 边缘部署选 `next` |
| **技术栈与二次开发** | 原生 Vanilla JS + Express，无框架门槛 | React 19 + Next.js 16 + Tailwind，组件化程度高 | 熟悉 React 框架或需要团队协同选 `next` |
| **测试与工程化** | 基础配置，轻量化结构 | 内置自动化测试套件（Unit / Integration Tests） | 追求工程化与自动化测试选 `next` |
| **适合场景** | 个人轻量论坛、小圈子交流、低成本运行、快速原型验证 | 中大型社区、云原生部署、需要扩展对象存储或边缘加速 | 根据站点规模与长期规划选择 |

## 🚀 快速开始

### Docker 部署（推荐）

```
git clone https://github.com/forumlify/public.git
cd public

cp .env.example .env
# 编辑 .env，为 POSTGRES_PASSWORD 和 JWT_SECRET 设置强随机值
docker compose up --build -d

```

旧版 Compose 也可以使用 `docker-compose up -d`。请妥善备份 `.env`；更换
`JWT_SECRET` 会使现有登录令牌失效。

> `git clone` 生成的目录名是 `public`（取自仓库名），不是 `forumlify`。
> 若想使用其他目录名，可在 clone 时指定，例如
> `git clone https://github.com/forumlify/public.git forumlify`。

应用默认运行在 `http://localhost:3000`。

容器启动时会自动执行 `migrations/` 中尚未应用的 SQL 文件。可使用以下命令检查状态：

```bash
docker compose ps
docker compose logs -f app
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
```

- `/health/live` 表示 Node.js 服务正在运行。
- `/health/ready` 仅在 PostgreSQL 可用时返回成功。
- PostgreSQL 不再暴露到宿主机网络；应用通过 Compose 内部网络访问数据库。
- 应用收到 `SIGTERM`/`SIGINT` 后会停止接收新连接并关闭数据库连接池。

升级代码后执行 `docker compose up --build -d`，应用会在启动前自动应用新增迁移。

#### Docker 数据备份

数据库保存在 `db_data` 卷中，上传文件继续保存在宿主机的 `./uploads` 目录，以兼容旧版部署。升级或删除容器前请备份：

```bash
docker compose exec -T db pg_dump -U forumlify forumlify > forumlify.sql
tar czf forumlify-uploads.tar.gz uploads/
```

`docker compose down` 会保留数据卷；只有明确执行 `docker compose down -v` 才会删除数据。

---

> 如需部署 Next.js 版本，请前往 [forumlify/tree/next](https://github.com/forumlify/public/tree/next)。

---

### 从源码构建

> 适合二次开发、自定义部署或不想用 Docker 的场景。

#### 环境要求

- Node.js 20+
- PostgreSQL 13+

#### 步骤

1. **克隆并安装依赖**

```bash
git clone https://github.com/forumlify/public.git
cd public
npm install
```

2. **准备数据库**

创建数据库用户与空库即可，表结构交给迁移脚本处理：

```bash
psql -U postgres -c "CREATE USER forumlify WITH PASSWORD '请替换为强密码';"
psql -U postgres -c "CREATE DATABASE forumlify OWNER forumlify;"
```

> `schema.sql` 仅作为表结构的参考快照保留，**不要**再用它手工建表。
> 请统一使用第 4 步的 `npm run migrate`，它会按顺序执行 `migrations/`
> 下的文件并记录版本。手工建表后再跑迁移会导致版本记录与实际结构
> 不一致，后续升级容易出错。

3. **配置环境变量**

复制示例文件并按需修改：

```bash
cp .env.example .env
```

`migrations/` 与 `server.js` 直接读取进程环境变量，`.env` 不会自动加载。
使用 `npm start` 手动启动时，请先导出这些变量：

```bash
set -a && . ./.env && set +a
```

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `postgresql://forumlify:***@localhost:5432/forumlify` | PostgreSQL 连接串 |
| `PORT` | `3000` | HTTP 监听端口 |
| `JWT_SECRET` | 本地开发使用内置值 | JWT 签名密钥；生产环境必须显式设置，建议至少 32 个字符。较短的旧密钥会产生警告但仍可启动，便于安排会话失效窗口后再轮换 |
| `ALLOWED_ORIGINS` | 空 | 允许跨域访问的来源，多个值用逗号分隔；为空时仅支持同源访问 |
| `TRUST_PROXY` | `false` | 位于可信反向代理后时设为 `true`，用于正确识别限流 IP |
| `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` | PostgreSQL 客户端默认值 | 可替代 `DATABASE_URL`，Compose 使用这些变量避免密码 URL 编码问题 |
| `ADMIN_BOOTSTRAP_TOKEN` | 空 | 首次部署时设置强随机值；注册时填写相同值可创建唯一初始管理员，初始化后应删除该变量 |


4. **执行迁移并启动**

```bash
npm run migrate
npm start
```

应用运行在 `http://localhost:3000`，API 在 `http://localhost:3000/api`。

#### 创建第一个管理员

站点默认没有任何管理员。首次部署时在 `.env` 中设置一个强随机
`ADMIN_BOOTSTRAP_TOKEN`，然后在注册页面的「管理员初始化令牌」一栏填入
相同的值完成注册，该账号即成为管理员。

管理员只能这样创建：普通注册一律是普通用户，且系统存在管理员后，
引导令牌不再生效。初始化完成后请从 `.env` 中删除该变量并重启服务。

#### 前端配置

前端页面为 `index.html`，相关行为可在 `config.js` 中调整：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `FORUM_NAME` | `Forumlify` | 论坛名称（左上角显示） |
| `ENABLE_CAPTCHA` | `true` | 发帖/注册的人机验证（10 以内加减法） |
| `SERVER_PORT` | `null` | 可选：服务端监听端口。优先级：环境变量 `PORT` > `SERVER_PORT` > 默认 `3000` |

#### 上传目录

帖子图片默认保存在 `uploads/` 目录，请确保该目录有写入权限：

```bash
mkdir -p uploads && chmod 755 uploads
```

## 📁 项目结构

```
public/
├── index.html          # 前端页面
├── style.css           # 全局样式
├── config.js           # 前端配置（同时也是服务端配置入口）
├── server.js           # 后端服务（Express）
├── Dockerfile          # Docker 镜像构建文件
├── docker-compose.yml  # Docker 编排
├── package-lock.json   # 依赖锁定文件
├── migrations/         # 数据库迁移（按文件名顺序执行，请勿手工修改已应用的版本）
│   ├── 001_initial.sql
│   └── 002_restore_auth_and_audit_columns.sql
├── schema.sql          # 表结构参考快照（仅供阅读，请勿用于建表）
├── scripts/
│   ├── migrate.js          # 迁移执行器
│   ├── docker-entrypoint.sh
│   └── healthcheck.js
├── test/               # 测试（node --test）
└── js/                 # 前端 JS 模块
    ├── app.js
    ├── admin.js
    ├── api.js
    ├── auth.js
    ├── feed.js
    ├── post.js
    └── user.js
```

## ❓ 常见问题

**升级代码后，登录之后的接口全部返回 500？**

说明数据库缺少 `users.token_version` 或 `event_logs` 的审计字段。执行
`npm run migrate` 应用 `migrations/` 中的修复迁移即可，无需重建数据库。
若该库曾经手工执行过 `schema.sql`，迁移记录可能与实际结构不一致，可先
检查 `SELECT * FROM schema_migrations;`。

**忘记了管理员密码？**

使用注册后在设置页生成的恢复码，在登录页的找回密码入口重置。恢复码
建议在生成后立即离线保存。

**修改密码或邮箱后被登出？**

这两个操作会递增 `users.token_version` 使所有已签发的令牌失效，属于预期
行为；服务端会随响应补发一个新令牌，前端会自动保存并保持在登录状态。
若仍被登出，请强制刷新页面（Ctrl+F5）以载入最新的前端脚本。

## 📝 License

MIT

