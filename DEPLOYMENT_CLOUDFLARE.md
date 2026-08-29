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
```

`QWEN_API_KEY`、`DASHSCOPE_API_KEY`、OSS 密钥等只放在后端环境变量中，不要放进前端或提交到仓库。服务启动时会检查生产配置；示例 JWT 密钥、非 HTTPS Cookie 和通配 CORS 会直接阻止启动。

## 上线前检查

1. 先访问 `https://api.example.com/health`，确认返回 `database: connected`。
2. 用 Pages 域名注册一个测试账户，确认登录、刷新页面、退出登录都正常。
3. 用两个账户分别创建资料和视频任务，确认互相看不到对方的数据。
4. 确认静态媒体目录使用持久化存储；临时容器不应作为长期视频仓库。
5. 生产数据库定期备份，Cloudflare 只负责边缘访问与前端分发，不替代数据库备份。
