# 新农e家 · PC 版（XinNong E-Jia）

> 农产品尾货转化助农平台 —— 大学生创新创业训练计划项目（PC 大屏适配版）

把农户滞销的农产品"尾货"转化为可流通商品：**农户发布尾货 → 企业采购加工 → 消费者购买**，并提供批次溯源查询。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 单文件 `index.html`（原生 HTML/CSS/JS，fetch 对接 API） |
| 后端 | Node.js + Express |
| 数据库 | MySQL（mysql2 连接池） |
| 鉴权 | JWT + bcryptjs 密码加密 |
| 其他 | multer 文件上传、cors 跨域 |

## 功能特性

- **四种角色**：管理员 / 农户 / 企业 / 消费者，注册即区分角色权限
- **尾货流转**：农户发布尾货 → 企业意向采购 → 加工成商品上架
- **商城闭环**：商品列表、购物车、下单、订单状态流转
- **批次溯源**：按批次号查询商品全链路状态
- **数据看板**：首页统计农户数、企业数、商品数等

## 快速开始

```bash
# 1. 初始化数据库（会创建 xinnong 库：7 张表 + 测试数据）
mysql -u root -p < server/init.sql

# 2. 安装依赖
cd server
npm install

# 3. 配置数据库连接（编辑 server/db.js，将 CHANGE_ME 替换为你的本地密码）

# 4. 启动后端（端口 3001）
node index.js        # 或 npm run dev

# 5. 浏览器直接打开 index.html
```

## 目录结构

```
├── index.html          PC 端前端页面（单文件，已内置 API 对接层）
└── server/
    ├── index.js        Express 后端 API（主入口）
    ├── db.js           MySQL 连接池配置
    ├── init.sql        建表 + 测试数据
    └── package.json    依赖配置
```

## 安全说明

仓库中所有真实密码 / 密钥均已替换为 `CHANGE_ME` 占位符，本地运行前请替换为自己的值。完整 API 一览、测试账号、溯源批次号见 [server/README.md](server/README.md)。
