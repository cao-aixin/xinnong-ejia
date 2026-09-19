-- ================================================================
-- 新农e家 · 尾货转化助农生态平台 数据库建表脚本
-- 数据库: xinnong
-- 字符集: utf8mb4（支持中文和emoji）
-- ================================================================

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS xinnong DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE xinnong;

-- ================================================================
-- 1. 用户表 (users)
-- 存储所有用户信息，通过 role 字段区分身份
-- ================================================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
  `username`      VARCHAR(50)  NOT NULL UNIQUE COMMENT '用户名（登录账号）',
  `password`      VARCHAR(255) NOT NULL COMMENT '密码（bcrypt加密存储）',
  `role`          ENUM('farmer','enterprise','consumer','admin') NOT NULL DEFAULT 'consumer' COMMENT '用户身份：farmer-农户, enterprise-企业, consumer-消费者, admin-管理员',
  `nickname`      VARCHAR(50)  DEFAULT '' COMMENT '昵称/显示名称',
  `phone`         VARCHAR(20)  DEFAULT '' COMMENT '手机号',
  `address`       VARCHAR(255) DEFAULT '' COMMENT '地址',
  `avatar`        VARCHAR(255) DEFAULT '' COMMENT '头像URL',
  `balance`       DECIMAL(10,2) DEFAULT 0.00 COMMENT '账户余额',
  `status`        TINYINT      DEFAULT 1 COMMENT '状态：1-正常, 0-禁用',
  `created_at`    DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  `updated_at`    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_role` (`role`),
  INDEX `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ================================================================
-- 2. 尾货表 (surplus)
-- 农户发布的尾货信息
-- ================================================================
DROP TABLE IF EXISTS `surplus`;
CREATE TABLE `surplus` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '尾货ID',
  `user_id`       INT UNSIGNED NOT NULL COMMENT '发布农户的用户ID',
  `crop_type`     VARCHAR(50)  NOT NULL COMMENT '农产品品类（如：苹果、番茄、白菜）',
  `variety`       VARCHAR(50)  DEFAULT '' COMMENT '品种（如：红富士、大番茄）',
  `quantity`      DECIMAL(10,2) NOT NULL COMMENT '数量（公斤）',
  `price`         DECIMAL(10,2) DEFAULT 0.00 COMMENT '期望单价（元/公斤）',
  `description`   TEXT COMMENT '详细描述（外观、品相等）',
  `address`       VARCHAR(255) NOT NULL COMMENT '产地地址',
  `harvest_date`  DATE DEFAULT NULL COMMENT '采摘日期',
  `images`        TEXT COMMENT '图片URL列表（JSON数组）',
  `grade`         ENUM('A','B','C','pending') DEFAULT 'pending' COMMENT '品相等级：A-优品, B-良品, C-次品, pending-待评估',
  `status`        ENUM('pending','matched','processing','completed','expired') DEFAULT 'pending' COMMENT '状态：pending-待匹配, matched-已匹配, processing-处理中, completed-已完成, expired-已过期',
  `matched_enterprise_id` INT UNSIGNED DEFAULT NULL COMMENT '匹配的企业ID',
  `views`         INT UNSIGNED DEFAULT 0 COMMENT '浏览次数',
  `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '发布时间',
  `updated_at`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_status` (`status`),
  INDEX `idx_crop_type` (`crop_type`),
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='尾货表';

-- ================================================================
-- 3. 商品表 (products)
-- 优选商城中的商品（加工后的尾货产品）
-- ================================================================
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '商品ID',
  `name`          VARCHAR(100) NOT NULL COMMENT '商品名称',
  `category`      VARCHAR(50)  NOT NULL DEFAULT '其他' COMMENT '分类（水果/蔬菜/粮油/干货/加工品/其他）',
  `origin`        VARCHAR(100) DEFAULT '' COMMENT '产地',
  `description`   TEXT COMMENT '商品描述',
  `price`         DECIMAL(10,2) NOT NULL COMMENT '售价（元）',
  `original_price`DECIMAL(10,2) DEFAULT 0.00 COMMENT '原价（元，用于展示折扣）',
  `stock`         INT UNSIGNED DEFAULT 0 COMMENT '库存数量',
  `sales`         INT UNSIGNED DEFAULT 0 COMMENT '销量',
  `images`        TEXT COMMENT '商品图片URL（JSON数组，第一张为主图）',
  `weight`        VARCHAR(50)  DEFAULT '' COMMENT '规格/重量',
  `grade`         ENUM('A','B','C') DEFAULT 'A' COMMENT '品相等级',
  `surplus_id`    INT UNSIGNED DEFAULT NULL COMMENT '关联的尾货ID（来源追溯）',
  `status`        TINYINT DEFAULT 1 COMMENT '状态：1-上架, 0-下架',
  `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_category` (`category`),
  INDEX `idx_status` (`status`),
  INDEX `idx_sales` (`sales` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品表';

-- ================================================================
-- 4. 订单表 (orders)
-- 所有交易订单
-- ================================================================
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '订单ID',
  `order_no`      VARCHAR(32)  NOT NULL UNIQUE COMMENT '订单编号（如：XN20260508123456）',
  `user_id`       INT UNSIGNED NOT NULL COMMENT '买家用户ID',
  `seller_id`     INT UNSIGNED DEFAULT NULL COMMENT '卖家用户ID（企业或农户）',
  `type`          ENUM('purchase','shop','process') NOT NULL DEFAULT 'shop' COMMENT '订单类型：purchase-尾货采购, shop-商城购物, process-加工订单',
  `total_amount`  DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '订单总金额',
  `status`        ENUM('pending','paid','shipped','delivered','completed','cancelled','refunded') NOT NULL DEFAULT 'pending' COMMENT '订单状态',
  `address`       VARCHAR(255) DEFAULT '' COMMENT '收货地址',
  `phone`         VARCHAR(20)  DEFAULT '' COMMENT '收货人电话',
  `remark`        TEXT COMMENT '订单备注',
  `paid_at`       DATETIME DEFAULT NULL COMMENT '支付时间',
  `shipped_at`    DATETIME DEFAULT NULL COMMENT '发货时间',
  `completed_at`  DATETIME DEFAULT NULL COMMENT '完成时间',
  `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_order_no` (`order_no`),
  INDEX `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- ================================================================
-- 5. 订单明细表 (order_items)
-- 每个订单包含的商品明细
-- ================================================================
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '明细ID',
  `order_id`      INT UNSIGNED NOT NULL COMMENT '关联订单ID',
  `product_id`    INT UNSIGNED DEFAULT NULL COMMENT '商品ID（商城订单）',
  `surplus_id`    INT UNSIGNED DEFAULT NULL COMMENT '尾货ID（尾货采购订单）',
  `product_name`  VARCHAR(100) NOT NULL COMMENT '商品/尾货名称',
  `price`         DECIMAL(10,2) NOT NULL COMMENT '单价',
  `quantity`      DECIMAL(10,2) NOT NULL COMMENT '数量',
  `subtotal`      DECIMAL(10,2) NOT NULL COMMENT '小计金额',
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  INDEX `idx_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细表';

-- ================================================================
-- 6. 溯源信息表 (traceability)
-- 农产品全链路溯源记录
-- ================================================================
DROP TABLE IF EXISTS `traceability`;
CREATE TABLE `traceability` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '溯源ID',
  `batch_no`      VARCHAR(32)  NOT NULL UNIQUE COMMENT '批次号（如：XN-20260508-001）',
  `product_name`  VARCHAR(100) NOT NULL COMMENT '产品名称',
  `farmer_id`     INT UNSIGNED NOT NULL COMMENT '农户ID',
  `farmer_name`   VARCHAR(50)  DEFAULT '' COMMENT '农户姓名',
  `origin`        VARCHAR(255) NOT NULL COMMENT '产地地址',
  `harvest_date`  DATE NOT NULL COMMENT '采摘日期',
  `enterprise_id` INT UNSIGNED DEFAULT NULL COMMENT '加工企业ID',
  `enterprise_name` VARCHAR(100) DEFAULT '' COMMENT '加工企业名称',
  `process_date`  DATE DEFAULT NULL COMMENT '加工日期',
  `process_desc`  TEXT COMMENT '加工工艺描述',
  `grade`         ENUM('A','B','C') DEFAULT 'A' COMMENT '品相等级',
  `quality_report` TEXT COMMENT '质检报告（JSON格式）',
  `blockchain_hash` VARCHAR(128) DEFAULT '' COMMENT '区块链存证哈希值',
  `status`        ENUM('planted','harvested','inspected','processed','delivered','sold') DEFAULT 'planted' COMMENT '溯源阶段',
  `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (`farmer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_batch_no` (`batch_no`),
  INDEX `idx_farmer_id` (`farmer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='溯源信息表';

-- ================================================================
-- 7. 购物车表 (cart)
-- 用户购物车
-- ================================================================
DROP TABLE IF EXISTS `cart`;
CREATE TABLE `cart` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '购物车ID',
  `user_id`       INT UNSIGNED NOT NULL COMMENT '用户ID',
  `product_id`    INT UNSIGNED NOT NULL COMMENT '商品ID',
  `quantity`      INT UNSIGNED DEFAULT 1 COMMENT '数量',
  `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
  UNIQUE KEY `uk_user_product` (`user_id`, `product_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='购物车表';

-- ================================================================
-- 插入测试数据
-- ================================================================

-- 管理员账号（密码: admin123）
INSERT INTO `users` (`username`, `password`, `role`, `nickname`, `phone`, `balance`) VALUES
('admin', '$2a$10$DikSf2UqEtRklBpMZYYwxuzknAKZythtv7gg2enR3Pi3HLxpBv6fW', 'admin', '系统管理员', '13800000000', 0.00),
-- 农户账号（密码: farmer123）
('zhangnong', '$2a$10$/YDpYXX8xQ5JF4mukitErerneinI8Q9TiePfzZYlgRxsm.nFxeAjy', 'farmer', '张农户', '13811111111', 1580.50),
('lignong',   '$2a$10$/YDpYXX8xQ5JF4mukitErerneinI8Q9TiePfzZYlgRxsm.nFxeAjy', 'farmer', '李农户', '13822222222', 920.00),
-- 企业账号（密码: enterprise123）
('xxfood',  '$2a$10$zbqrGPDzqkgRCWHSsS4Z3OFkm9IpAp.InhZgndvNerWpFQ6e7alEm', 'enterprise', 'XX食品有限公司', '13900000001', 25000.00),
('mrdried', '$2a$10$zbqrGPDzqkgRCWHSsS4Z3OFkm9IpAp.InhZgndvNerWpFQ6e7alEm', 'enterprise', '明瑞果干加工厂', '13900000002', 18000.00),
-- 消费者账号（密码: consumer123）
('lixiaofei', '$2a$10$GMptggwaXRTbpvNENue4DewiCDW5rzd91jjQj08RwzfPg7bWaek/a', 'consumer', '李消费者', '15000000001', 500.00),
('wanggou',   '$2a$10$GMptggwaXRTbpvNENue4DewiCDW5rzd91jjQj08RwzfPg7bWaek/a', 'consumer', '王购物', '15000000002', 320.00);

-- 测试尾货数据
INSERT INTO `surplus` (`user_id`, `crop_type`, `variety`, `quantity`, `price`, `description`, `address`, `harvest_date`, `status`, `views`) VALUES
(2, '苹果', '红富士', 500, 2.50, '外观略有磕碰，口感正常，适合加工果汁或果干', '山东省烟台市栖霞市', '2026-05-01', 'pending', 23),
(2, '番茄', '大番茄', 300, 1.80, '成熟度偏高，部分软果，适合做番茄酱', '山东省潍坊市寿光市', '2026-05-03', 'matched', 45),
(3, '白菜', '大白菜', 1000, 0.50, '品相良好，由于滞销低价处理', '河北省张家口市张北县', '2026-04-28', 'pending', 12),
(3, '土豆', '黄心土豆', 800, 1.20, '个头偏小但品质优良，适合加工薯片', '甘肃省定西市安定区', '2026-05-02', 'completed', 67);

-- 测试商品数据
INSERT INTO `products` (`name`, `category`, `origin`, `description`, `price`, `original_price`, `stock`, `sales`, `weight`, `grade`) VALUES
('烟台红富士苹果 5斤装', '水果', '山东烟台', '精选A级红富士，果肉脆甜多汁，果径80mm以上', 29.90, 49.90, 200, 1580, '5斤/箱', 'A'),
('新疆阿克苏冰糖心苹果', '水果', '新疆阿克苏', '正宗冰糖心，甜度18+，自然成熟采摘', 39.90, 59.90, 150, 980, '5斤/箱', 'A'),
('赣南脐橙 10斤装', '水果', '江西赣州', '皮薄肉厚，汁水丰富，维C含量高', 35.00, 55.00, 300, 2340, '10斤/箱', 'A'),
('阳光玫瑰葡萄 3斤装', '水果', '云南宾川', '无籽脆甜，玫瑰香气浓郁，果粒饱满', 49.90, 79.90, 80, 670, '3斤/盒', 'A'),
('有机番茄 5斤装', '蔬菜', '山东寿光', '自然成熟，酸甜可口，适合生吃或烹饪', 19.90, 29.90, 250, 1200, '5斤/箱', 'A'),
('寿光精品小番茄', '蔬菜', '山东寿光', '千禧品种，一口一个，酸甜开胃', 15.90, 25.00, 180, 890, '2斤/盒', 'A'),
('五常大米 10斤装', '粮油', '黑龙江五常', '正宗稻花香2号，当季新米，颗粒饱满', 59.90, 89.90, 400, 3200, '10斤/袋', 'A'),
('农家土鸡蛋 30枚', '粮油', '贵州黔东南', '散养土鸡所产，蛋黄饱满颜色深', 39.90, 49.90, 120, 1560, '30枚/盒', 'A'),
('芒果干 250g 袋装', '干货', '海南三亚', '新鲜芒果低温烘干，无添加糖精，酸甜可口', 18.90, 28.00, 500, 4500, '250g/袋', 'A'),
('红薯条 200g 袋装', '干货', '福建龙岩', '地瓜天然晾晒，软糯香甜，低脂健康零食', 12.90, 19.90, 600, 3800, '200g/袋', 'A'),
('冻干苹果脆片 100g', '加工品', '山东烟台', 'FD冻干工艺，锁住营养，酥脆可口', 25.90, 35.00, 200, 1200, '100g/罐', 'A'),
('番茄酱 500g 瓶装', '加工品', '山东寿光', '尾货番茄深加工，无防腐剂，纯天然', 9.90, 15.00, 800, 6700, '500g/瓶', 'B');

-- 测试溯源数据
INSERT INTO `traceability` (`batch_no`, `product_name`, `farmer_id`, `farmer_name`, `origin`, `harvest_date`, `enterprise_id`, `enterprise_name`, `process_date`, `process_desc`, `grade`, `quality_report`, `blockchain_hash`, `status`) VALUES
('XN-20260508-001', '烟台红富士苹果', 2, '张农户', '山东省烟台市栖霞市', '2026-05-01', 4, 'XX食品有限公司', '2026-05-03', '清洗→分选→分级→包装', 'A', '{"sweetness":"15.2","firmness":"8.5","weight":"185g","pesticide":"未检出"}', '0x3a7f8b2c1d4e5f6a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2', 'sold'),
('XN-20260508-002', '有机番茄', 2, '张农户', '山东省潍坊市寿光市', '2026-05-03', 4, 'XX食品有限公司', '2026-05-05', '清洗→分选→质检→装盒', 'A', '{"sweetness":"6.8","firmness":"7.2","weight":"160g","pesticide":"未检出"}', '0x7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6', 'processed'),
('XN-20260508-003', '黄心土豆', 3, '李农户', '甘肃省定西市安定区', '2026-05-02', 5, '明瑞果干加工厂', '2026-05-04', '清洗→去皮→切片→烘干→包装', 'B', '{"starch_content":"18.5%","moisture":"78%","weight":"120g","pesticide":"未检出"}', '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1', 'delivered');

-- 测试订单数据
INSERT INTO `orders` (`order_no`, `user_id`, `seller_id`, `type`, `total_amount`, `status`, `address`, `phone`, `remark`, `created_at`) VALUES
('XN20260508001', 6, 4, 'shop', 29.90, 'completed', '北京市朝阳区xx街道xx号', '15000000001', '请尽快发货', '2026-05-06 10:30:00'),
('XN20260508002', 7, 4, 'shop', 69.80, 'shipped', '上海市浦东新区xx路xx号', '15000000002', '', '2026-05-07 14:20:00'),
('XN20260508003', 6, 5, 'shop', 25.90, 'pending', '北京市朝阳区xx街道xx号', '15000000001', '', '2026-05-08 09:15:00');

INSERT INTO `order_items` (`order_id`, `product_id`, `product_name`, `price`, `quantity`, `subtotal`) VALUES
(1, 1, '烟台红富士苹果 5斤装', 29.90, 1, 29.90),
(2, 1, '烟台红富士苹果 5斤装', 29.90, 1, 29.90),
(2, 11, '冻干苹果脆片 100g', 25.90, 1, 25.90),
(3, 11, '冻干苹果脆片 100g', 25.90, 1, 25.90);

-- 测试购物车数据
INSERT INTO `cart` (`user_id`, `product_id`, `quantity`) VALUES
(6, 3, 2),
(6, 9, 1);

-- ================================================================
-- 建表完成！共 7 张表：
-- users          用户表（7条测试数据）
-- surplus        尾货表（4条测试数据）
-- products       商品表（12条测试数据）
-- orders         订单表（3条测试数据）
-- order_items    订单明细表（4条测试数据）
-- traceability   溯源表（3条测试数据）
-- cart           购物车表（2条测试数据）
--
-- 测试账号：
-- 管理员:   admin / admin123
-- 农户:     zhangnong / farmer123
-- 农户:     lignong / farmer123
-- 企业:     xxfood / enterprise123
-- 企业:     mrdried / enterprise123
-- 消费者:   lixiaofei / consumer123
-- 消费者:   wanggou / consumer123
-- （注意：测试密码统一使用同一哈希值，实际部署请用 bcrypt 生成不同哈希）
-- ================================================================
