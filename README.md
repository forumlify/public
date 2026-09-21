

# Forumlify LITE Edition 🌊

> 一个简洁、优雅的现代社区系统。5 分钟 Docker 一键部署。

**在线演示：** https://lite.forumlify.org

## ✨ 特性

- 🎨 精致简约的界面设计，支持亮色/暗色模式
- ⚡️ 轻量快速，无需复杂配置
- 🔐 自带用户认证（JWT），改密码后旧令牌立即失效
- 📝 发帖、回复、举报、私信、管理后台
- 📧 邮件支持：后台配置 SMTP，可用于注册邮箱验证与密码找回
- 🌍 界面中英文双语，管理后台可配置自定义页面与样式
- 🐳 Docker 一键部署

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

#### 反向代理与 HTTPS

生产环境建议让 Nginx 终止 TLS 并反代到本机的 3000 端口。要点如下：

```nginx
server {
    listen 443 ssl http2;
    server_name lite.example.org;

    ssl_certificate     /etc/nginx/ssl/lite.example.org.fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/lite.example.org.key;

    # 保留 ACME 挑战路径，否则证书续期会失败
    location /.well-known/acme-challenge/ {
        root /var/www/acme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

配套设置 `.env` 中的 `TRUST_PROXY=true`，否则限流会把所有用户识别为
同一个来源 IP。应用记录审计日志时也依赖该设置取到真实客户端地址。

两个容易踩的坑：

- **80 端口若已存在其他站点的 `default_server`**，它会接管所有未显式
  匹配的 Host，导致本域名的 ACME 挑战请求被 301 跳走、证书签发失败。
  必须为本域名单独写一个 `server_name` 的 80 端口块。
- **ACME 挑战路径要放在 `return 301` 之前**，否则同样会被重定向。

### 邮件（SMTP）

邮件功能**默认关闭**，全部在管理后台配置，无需改环境变量或重启服务。
入口：登录管理员账号 → 右上角头像 → **管理后台** → **邮件设置**。

> 配置保存在数据库的 `settings` 表中，因此在 Docker 部署下也会随
> `db_data` 卷一起持久化，容器重建不会丢失，也不需要给 Compose 增加
> 任何环境变量。

配置项：

| 字段 | 说明 |
|------|------|
| 启用邮件发送 | 总开关，关闭时所有邮件功能不可用 |
| SMTP 服务器 | 如 `smtp.qq.com`、`smtp.gmail.com` |
| 端口 | 587（STARTTLS）或 465（SSL/TLS） |
| 加密方式 | 需与端口匹配：**587 选 STARTTLS，465 选 SSL/TLS** |
| 用户名 | 通常为完整邮箱地址 |
| 密码 / 授权码 | 见下方说明 |
| 发件人名称 | 显示在收件人邮箱里的发件人名字 |
| 发件人邮箱 | 必填，建议与用户名一致，否则易被判定为伪造发件人 |

填写后点击**发送测试邮件**验证连通性，默认发到当前管理员的邮箱。
测试通过即表示配置可用。

#### 关于「授权码」

**QQ 邮箱、163、Gmail 等服务商不能用登录密码发信**，必须先生成专用
授权码：

- **QQ 邮箱**：设置 → 账户 → 开启 SMTP 服务 → 生成授权码
- **163 邮箱**：设置 → POP3/SMTP/IMAP → 开启服务 → 获取授权码
- **Gmail**：需开启两步验证后创建「应用专用密码」

把授权码填进「密码 / 授权码」一栏即可。

#### 使用 Resend

[Resend](https://resend.com) 提供 SMTP 接口，按其官方参数填写即可：

| 字段 | 值 |
|------|-----|
| SMTP 服务器 | `smtp.resend.com` |
| 端口 | `465`（推荐）或 `587` |
| 加密方式 | 465 选 **SSL/TLS**；587 选 STARTTLS |
| 用户名 | `resend` ← **固定值，不是邮箱地址** |
| 密码 / 授权码 | 你的 **API Key**（`re_` 开头） |
| 发件人邮箱 | 已验证域名下的地址，如 `noreply@你的域名` |

使用前需在 Resend 控制台完成两件事：**创建 API Key**，以及
**添加并验证发信域名**（配置 SPF / DKIM 记录）。未验证域名时
只能发往自己的注册邮箱，无法发给其他收件人。

> 用户名填成自己的邮箱地址是常见错误——Resend 要求固定填 `resend`。

##### Resend 的收件人限制

Resend **禁止向 `example.com`、`test.com` 等保留/测试域名发信**，
会直接返回 `550 Invalid to field`。这是服务商的反滥用策略，不是本站
的限制。

因此**不要用测试域名验证邮件功能**——测试时请使用真实可收信的邮箱。
本站会把该错误翻译成中文提示。

若已启用注册邮箱验证，而用户恰好使用了这类邮箱注册，会看到
「收件人邮箱被邮件服务商拒绝」的提示，属预期行为。

#### 使用其他服务商

常见服务商的 SMTP 参数：

| 服务商 | 服务器 | 端口 | 用户名 | 密码 |
|--------|--------|------|--------|------|
| QQ 邮箱 | `smtp.qq.com` | 465 / 587 | 完整邮箱 | 授权码 |
| 163 邮箱 | `smtp.163.com` | 465 / 587 | 完整邮箱 | 授权码 |
| Gmail | `smtp.gmail.com` | 465 / 587 | 完整邮箱 | 应用专用密码 |
| Resend | `smtp.resend.com` | 465 / 587 | `resend` | API Key |
| 阿里云邮件推送 | `smtpdm.aliyun.com` | 465 / 80 | 发信地址 | 设置的密码 |

#### 关于「允许自签证书」

默认开启证书校验。如果你使用的是**自建邮件服务器且用自签证书**，
连接会因证书不受信任而失败，此时才需要打开这个开关。

对 Resend、QQ、Gmail 等使用可信证书的服务商，**保持关闭**。关闭校验
会让连接暴露在中间人攻击下。

#### 密码的存储与显示

SMTP 密码**只写不读**：保存后任何接口都不会返回明文，界面只显示
「已保存密码，留空则不修改」。因此：

- 想改其他字段时，**密码栏留空即可**，原密码保持不变
- 需要更换密码时才填写新值
- 「清除密码」按钮用于彻底移除已保存的密码

#### 邮件用在哪里

配置完成并发送测试邮件成功后，可以开启 **要求注册时验证邮箱**：

- **注册邮箱验证**：新用户注册时必须填写邮箱收到的 6 位验证码。
  验证码 10 分钟有效，连续输错 5 次即作废，且只能使用一次。
  该字段仅在开启此选项时才出现在注册框里。
- **密码找回**：登录页的「忘记密码」支持通过邮箱验证码重置密码，
  与原有的恢复码机制并行，两种方式都可用。

> 未完成 SMTP 配置时**无法开启**注册邮箱验证——这是有意为之，
> 避免开启后所有人都注册不了。

#### 常见配置问题

| 现象 | 原因 |
|------|------|
| 认证失败 | 用了登录密码而非授权码；或用 Resend 时用户名没填 `resend` |
| 连接超时 | 端口被防火墙拦截，**或加密方式与端口不匹配**（465 必须配 SSL/TLS） |
| 套接字错误 | 同上，端口与加密方式不匹配；也可能是证书校验未通过 |
| 发件人被拒 | 发件人邮箱不属于已验证的域名，或与服务商要求不符 |
| 域名解析失败 | SMTP 服务器地址拼写错误 |
| 证书校验失败 | 自建服务器用了自签证书，需打开「允许自签证书」 |

多数云服务商默认封禁 25 端口，建议使用 465 或 587。

> 排错时最有效的两步：先在后台点**发送测试邮件**看具体报错，
> 再对照上表定位。中间的错误提示会直接给出去改哪个字段。

## 📁 项目结构

```
public/
├── index.html          # 前端页面
├── style.css           # 全局样式
├── config.js           # 前端配置（同时也是服务端配置入口）
├── server.js           # 后端服务（Express）
├── lib/
│   └── mailer.js           # SMTP 发信封装（配置读取、发送、错误翻译）
├── Dockerfile          # Docker 镜像构建文件
├── docker-compose.yml  # Docker 编排
├── package-lock.json   # 依赖锁定文件
├── migrations/         # 数据库迁移（按文件名顺序执行，请勿手工修改已应用的版本）
│   ├── 001_initial.sql
│   ├── 002_restore_auth_and_audit_columns.sql
│   └── 003_email_verification.sql
├── schema.sql          # 表结构参考快照（仅供阅读，请勿用于建表）
├── scripts/
│   ├── migrate.js          # 迁移执行器
│   ├── docker-entrypoint.sh
│   └── healthcheck.js
├── test/               # 测试（node --test）
│   ├── app.test.js             # 接口与安全头
│   ├── bootstrap-ui.test.js    # 管理员引导令牌的显示条件
│   ├── i18n-coverage.test.js   # 界面文案翻译覆盖率
│   ├── migration-schema.test.js # 迁移必须覆盖服务端依赖的列
│   └── schema-parity.test.js   # schema.sql 与 migrations 的结构一致性
└── js/                 # 前端 JS 模块
    ├── app.js              # 主入口、路由、Toast、确认框
    ├── admin.js            # 管理后台各标签页
    ├── api.js              # 接口封装
    ├── auth.js             # 登录、注册、退出
    ├── captcha.js          # 人机验证
    ├── feed.js             # 帖子列表
    ├── i18n.js             # 中英文词典与外挂翻译
    ├── icons.js            # SVG 图标
    ├── post.js             # 帖子详情与回复
    ├── security.js         # 转义与安全渲染
    ├── theme.js            # 亮色/暗色切换
    └── user.js             # 用户主页
```

## ❓ 常见问题

**升级代码后，登录之后的接口全部返回 500？**

说明数据库缺少 `users.token_version` 或 `event_logs` 的审计字段。执行
`npm run migrate` 应用 `migrations/` 中的修复迁移即可，无需重建数据库。
若该库曾经手工执行过 `schema.sql`，迁移记录可能与实际结构不一致，可先
检查 `SELECT * FROM schema_migrations;`。

**忘记了管理员密码？**

两种方式：若已配置邮件，在登录页的「忘记密码」用邮箱验证码重置；
否则使用注册后在设置页生成的恢复码重置。恢复码建议生成后立即离线保存。

**修改密码或邮箱后被登出？**

这两个操作会递增 `users.token_version` 使所有已签发的令牌失效，属于预期
行为；服务端会随响应补发一个新令牌，前端会自动保存并保持在登录状态。
若仍被登出，请强制刷新页面（Ctrl+F5）以载入最新的前端脚本。

**注册框里看不到邮箱验证码输入框？**

这是正常的。该字段仅在管理后台开启了「要求注册时验证邮箱」、
且 SMTP 配置完整时才显示。未配置邮件时注册流程与以往一致。

**开启了邮箱验证，但收不到验证码？**

先在后台点「发送测试邮件」确认 SMTP 可用。若测试邮件能收到而验证码
收不到，检查是否被投进了垃圾箱；若用的是自建发信域名，还需配置 SPF
与 DKIM 记录，否则容易进垃圾箱或被直接拒收。

**用 Resend 发送失败？**

按顺序检查三项：用户名必须是 `resend`（不是你的邮箱）、密码必须是
`re_` 开头的 API Key、发件人邮箱必须属于已在 Resend 验证过的域名。
若尚未验证域名，Resend 只允许发往账号注册邮箱，发给其他地址会被拒。

**怎么确认 SMTP 是通的？**

后台「发送测试邮件」默认发到当前管理员的邮箱。收到即表示配置可用，
不必开启注册验证去试探。

**邮件相关接口返回 429？**

发送验证码与找回密码的接口有独立限流（15 分钟 5 次），用于防止被当作
垃圾邮件发射器。稍后再试即可。

**改动 SMTP 配置后没有生效？**

配置保存在数据库中，保存即时生效，无需重启。若填了新的密码但仍是旧
行为，确认密码栏确实填入了新值——留空表示保持原密码不变。

## 📝 License

MIT

