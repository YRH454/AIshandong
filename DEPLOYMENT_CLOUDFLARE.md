# Cloudflare 公开部署准备

前端可以部署到 Cloudflare Pages，FastAPI 后端需要部署在能运行 Python 的服务上（例如 Cloud Run、Railway、Render 或自有 VPS），再通过一个 `api.example.com` 子域名接入。Cloudflare Pages 本身不会直接运行这个 FastAPI 进程。

## 前端（Pages）

- 构建目录：`frontend/dist`
- 构建命令：`npm run build`
- 环境变量：`VITE_API_BASE=https://api.example.com/api/v1`

## 后端

生产环境至少设置以下变量：

```dotenv
APP_ENV=production
DB_BACKEND=mysql
MYSQL_HOST=...
MYSQL_PORT=3306
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_DATABASE=...
JWT_SECRET=<随机生成的至少32位字符串>
COOKIE_SECURE=1
COOKIE_SAMESITE=none
CORS_ORIGINS=https://your-pages-domain.pages.dev
# 唯一主管理员（其它账号始终是普通用户）
ADMIN_EMAIL=3539921167@qq.com
ADMIN_USERNAME=EGOIST
# 仅首次初始化全新数据库时可设置；已有账号会按 ADMIN_EMAIL 自动提升
ADMIN_BOOTSTRAP_PASSWORD=<首次初始化时使用的强密码>
# 生产环境必须关闭调试重置令牌，并接入邮件服务发送真实链接
PASSWORD_RESET_DEBUG=0
```

`QWEN_API_KEY`、`DASHSCOPE_API_KEY`、OSS 密钥等只放在后端环境变量中，不要放进前端或提交到仓库。服务启动时会检查生产配置；示例 JWT 密钥、非 HTTPS Cookie 和通配 CORS 会直接阻止启动。

管理员与账号安全说明：

- `3539921167@qq.com` 是本部署唯一主管理员。服务每次启动都会同步该邮箱为 `admin`，并把其它历史管理员降为普通用户；公开注册不能创建管理员。
- 管理员中心只对该邮箱显示，可查看账户、会话和生成任务，并启用/停用普通账号。主管理员账号不能被停用或降级。
- 修改密码会撤销旧会话并刷新当前会话。找回密码接口默认不暴露账号是否存在；生产环境需要把 `password-reset/request` 生成的令牌接入邮件服务（SMTP、Resend、Postmark 等），通过邮件发送带令牌的前端重置链接，禁止把 `debug_token` 返回给浏览器。
- 首次部署前请确认该邮箱已存在且密码可用；全新数据库可以临时设置 `ADMIN_BOOTSTRAP_PASSWORD`，启动后再从环境变量中移除或轮换它。

## 上线前检查

1. 先访问 `https://api.example.com/health`，确认返回 `database: connected`。
2. 用 Pages 域名注册一个测试账户，确认登录、刷新页面、退出登录都正常。
3. 用两个账户分别创建资料和视频任务，确认互相看不到对方的数据。
4. 确认静态媒体目录使用持久化存储；临时容器不应作为长期视频仓库。
5. 生产数据库定期备份，Cloudflare 只负责边缘访问与前端分发，不替代数据库备份。
