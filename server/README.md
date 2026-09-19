# 新农e家 · 数据库对接说明

## 项目结构

```
xinnong-pc/
├── index.html          ← PC端前端页面（已注入 API 对接代码）
└── server/
    ├── index.js        ← Express 后端 API 服务（主入口）
    ├── db.js           ← MySQL 连接池配置
    ├── init.sql        ← 建表 + 测试数据 SQL
    └── package.json    ← 依赖配置
```

---

## 快速启动

### 第一步：初始化数据库

在 MySQL 客户端（Workbench / 命令行）中执行：

```bash
# 命令行方式（需要将 MySQL bin 加入 PATH）
mysql -u root -p < server/init.sql

# 或者用 npm 脚本（在 server/ 目录下）
cd server
npm run init-db
```

> 执行后会创建 `xinnong` 数据库，以及 7 张表 + 测试数据。

---

### 第二步：安装后端依赖

```bash
cd server
npm install
```

---

### 第三步：启动后端服务

```bash
# 在 server/ 目录下执行
node index.js
# 或开发模式（自动重启）
npm run dev
```

服务启动后会显示：
```
╔══════════════════════════════════════════════╗
║   新农e家 · 后端 API 服务已启动               ║
║   地址: http://localhost:3001                ║
║   健康: http://localhost:3001/api/health     ║
╚══════════════════════════════════════════════╝
```

---

### 第四步：打开前端页面

直接用浏览器打开 `xinnong-pc/index.html`（双击或 file:// 协议均可）。

> ⚠️ 前端通过 `fetch` 调用 `http://localhost:3001/api/...`，后端必须先启动。

---

## 测试账号

| 角色     | 账号        | 密码             |
|----------|-------------|------------------|
| 管理员   | admin       | admin123         |
| 农户     | zhangnong   | farmer123        |
| 农户     | lignong     | farmer123        |
| 企业     | xxfood      | enterprise123    |
| 企业     | mrdried     | enterprise123    |
| 消费者   | lixiaofei   | consumer123      |
| 消费者   | wanggou     | consumer123      |

---

## API 接口一览

| 方法   | 路径                          | 说明               | 需要登录 |
|--------|-------------------------------|--------------------|----------|
| POST   | /api/auth/register            | 用户注册           | ×        |
| POST   | /api/auth/login               | 用户登录           | ×        |
| GET    | /api/auth/me                  | 获取当前用户       | ✓        |
| PUT    | /api/auth/profile             | 更新个人信息       | ✓        |
| GET    | /api/surplus                  | 尾货列表           | ×        |
| GET    | /api/surplus/my/list          | 我的尾货（农户）   | ✓        |
| POST   | /api/surplus                  | 发布尾货           | ✓(农户)  |
| PUT    | /api/surplus/:id              | 更新尾货状态       | ✓        |
| GET    | /api/products                 | 商品列表           | ×        |
| GET    | /api/products/:id             | 商品详情           | ×        |
| GET    | /api/cart                     | 购物车             | ✓        |
| POST   | /api/cart                     | 加入购物车         | ✓        |
| DELETE | /api/cart/:id                 | 删除购物车项       | ✓        |
| GET    | /api/orders                   | 我的订单           | ✓        |
| POST   | /api/orders                   | 下单               | ✓        |
| PUT    | /api/orders/:id/status        | 更新订单状态       | ✓        |
| GET    | /api/trace/:batchNo           | 溯源查询           | ×        |
| GET    | /api/stats                    | 首页统计           | ×        |
| GET    | /api/admin/users              | 用户管理           | ✓(admin) |
| POST   | /api/admin/products           | 添加商品           | ✓(admin) |
| GET    | /api/health                   | 健康检查           | ×        |

---

## 前端对接说明

前端 `index.html` 已注入完整的 API 对接层，主要功能：

1. **登录/注册弹窗**：点击右上角"登录/注册"按钮
2. **首页统计**：自动从数据库读取农户数、企业数等
3. **优选商城**：商品从 products 表动态加载
4. **农户端**：点击"我的尾货"标签查看自己发布的尾货；发布尾货会写入数据库
5. **企业端**：采购列表从数据库实时读取，可点击"意向采购"更新状态
6. **溯源查询**：输入批次号（如 `XN-20260508-001`）查询真实数据
7. **个人中心**：显示真实用户信息和订单列表

---

## 溯源测试批次号

- `XN-20260508-001`（烟台红富士苹果，已售出）
- `XN-20260508-002`（有机番茄，加工中）
- `XN-20260508-003`（黄心土豆，已配送）

---

## 常见问题

**Q: 商城商品显示"加载中"？**  
A: 确保后端已启动（`node index.js`），端口 3001 未被占用。

**Q: 登录报错"用户名或密码错误"？**  
A: init.sql 中的测试密码哈希值是演示用的，需要重新生成。  
   用以下命令生成真实 bcrypt 哈希：
   ```js
   const bcrypt = require('bcryptjs');
   console.log(bcrypt.hashSync('farmer123', 10));
   ```
   然后更新 init.sql 中的密码字段。

**Q: 跨域报错？**  
A: 后端已配置 `cors({ origin: '*' })`，若仍有问题请检查浏览器控制台。
