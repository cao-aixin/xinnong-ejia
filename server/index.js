/**
 * 新农e家 · 尾货转化助农生态平台 — 后端 API 服务
 * 
 * 技术栈: Node.js + Express + MySQL (mysql2/promise)
 * 启动: node index.js  或  npm run dev
 * 默认端口: 3001
 * 
 * 接口列表:
 *   POST  /api/auth/register     — 用户注册
 *   POST  /api/auth/login        — 用户登录
 *   GET   /api/auth/me           — 获取当前用户信息 [JWT]
 *   PUT   /api/auth/profile      — 更新个人信息 [JWT]
 *
 *   GET   /api/surplus           — 获取尾货列表
 *   POST  /api/surplus           — 发布尾货 [JWT, 农户]
 *   GET   /api/surplus/:id       — 获取尾货详情
 *   PUT   /api/surplus/:id       — 更新尾货状态 [JWT]
 *   DELETE /api/surplus/:id      — 删除尾货 [JWT]
 *   GET   /api/surplus/my/list   — 我发布的尾货 [JWT]
 *
 *   GET   /api/products          — 商品列表
 *   GET   /api/products/:id      — 商品详情
 *
 *   GET   /api/orders            — 我的订单列表 [JWT]
 *   POST  /api/orders            — 下单 [JWT]
 *   GET   /api/orders/:id        — 订单详情 [JWT]
 *   PUT   /api/orders/:id/status — 更新订单状态 [JWT]
 *
 *   GET   /api/cart              — 购物车列表 [JWT]
 *   POST  /api/cart              — 加入购物车 [JWT]
 *   PUT   /api/cart/:id          — 更新数量 [JWT]
 *   DELETE /api/cart/:id         — 删除购物车项 [JWT]
 *
 *   GET   /api/trace/:batchNo    — 溯源查询（按批次号）
 *   GET   /api/trace             — 溯源列表
 *
 *   GET   /api/stats             — 首页统计数据 [JWT, admin]
 */

const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('./db');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── 密钥（生产环境请改为环境变量） ───────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME';

// ─── 中间件 ────────────────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── JWT 认证中间件 ─────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录，请先登录' });
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    req.user = payload;   // { id, username, role }
    next();
  } catch (e) {
    return res.status(401).json({ code: 401, message: 'Token 已过期，请重新登录' });
  }
}

// 可选认证（不传 token 也放行，但 req.user 为 null）
function optAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try { req.user = jwt.verify(auth.slice(7), JWT_SECRET); } catch (_) {}
  }
  next();
}

// ──────────────────────────────────────────────────────────────────────────
//  辅助：统一响应
// ──────────────────────────────────────────────────────────────────────────
const ok  = (res, data, message = 'success') => res.json({ code: 200, message, data });
const err = (res, message, code = 400)       => res.status(code).json({ code, message });

// ══════════════════════════════════════════════════════════════════════════
//  1. 用户模块  /api/auth
// ══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auth/register
 * body: { username, password, role, nickname, phone }
 */
app.post('/api/auth/register', async (req, res) => {
  const { username, password, role = 'consumer', nickname = '', phone = '' } = req.body;
  if (!username || !password) return err(res, '用户名和密码不能为空');
  if (!['farmer', 'enterprise', 'consumer'].includes(role))
    return err(res, '身份类型不合法');
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE username=?', [username]);
    if (rows.length > 0) return err(res, '用户名已存在');
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password, role, nickname, phone) VALUES (?,?,?,?,?)',
      [username, hash, role, nickname || username, phone]
    );
    const token = jwt.sign({ id: result.insertId, username, role }, JWT_SECRET, { expiresIn: '7d' });
    ok(res, { token, user: { id: result.insertId, username, role, nickname: nickname || username } }, '注册成功');
  } catch (e) {
    console.error('[register]', e);
    err(res, '服务器错误', 500);
  }
});

/**
 * POST /api/auth/login
 * body: { username, password }
 */
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return err(res, '用户名和密码不能为空');
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username=?', [username]);
    if (!rows.length) return err(res, '用户名或密码错误');
    const user = rows[0];
    if (user.status === 0) return err(res, '账号已被禁用，请联系管理员');
    const match = await bcrypt.compare(password, user.password);
    if (!match) return err(res, '用户名或密码错误');
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    ok(res, {
      token,
      user: { id: user.id, username: user.username, role: user.role, nickname: user.nickname, phone: user.phone, avatar: user.avatar, balance: user.balance }
    }, '登录成功');
  } catch (e) {
    console.error('[login]', e);
    err(res, '服务器错误', 500);
  }
});

/**
 * GET /api/auth/me  — 获取当前登录用户信息
 */
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, role, nickname, phone, address, avatar, balance, created_at FROM users WHERE id=?',
      [req.user.id]
    );
    if (!rows.length) return err(res, '用户不存在', 404);
    ok(res, rows[0]);
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

/**
 * PUT /api/auth/profile  — 更新个人信息
 * body: { nickname, phone, address, avatar }
 */
app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  const { nickname, phone, address, avatar } = req.body;
  try {
    await pool.query(
      'UPDATE users SET nickname=IFNULL(?,nickname), phone=IFNULL(?,phone), address=IFNULL(?,address), avatar=IFNULL(?,avatar) WHERE id=?',
      [nickname||null, phone||null, address||null, avatar||null, req.user.id]
    );
    ok(res, null, '更新成功');
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  2. 尾货模块  /api/surplus
// ══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/surplus  — 尾货列表（企业/所有人可见）
 * query: status, crop_type, page, limit
 */
app.get('/api/surplus', optAuth, async (req, res) => {
  const { status, crop_type, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let sql    = 'SELECT s.*, u.nickname AS farmer_name, u.phone AS farmer_phone FROM surplus s LEFT JOIN users u ON s.user_id=u.id WHERE 1=1';
  const params = [];
  if (status)    { sql += ' AND s.status=?';    params.push(status); }
  if (crop_type) { sql += ' AND s.crop_type LIKE ?'; params.push(`%${crop_type}%`); }
  sql += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  try {
    const [rows] = await pool.query(sql, params);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM surplus WHERE 1=1' + (status ? ' AND status=?' : '') + (crop_type ? ' AND crop_type LIKE ?' : ''), [...(status?[status]:[]), ...(crop_type?[`%${crop_type}%`]:[])]);
    ok(res, { list: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    console.error('[surplus list]', e);
    err(res, '服务器错误', 500);
  }
});

/**
 * GET /api/surplus/my/list  — 我发布的尾货列表（农户）
 */
app.get('/api/surplus/my/list', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM surplus WHERE user_id=? ORDER BY created_at DESC', [req.user.id]);
    ok(res, rows);
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

/**
 * GET /api/surplus/:id  — 尾货详情
 */
app.get('/api/surplus/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT s.*, u.nickname AS farmer_name, u.phone AS farmer_phone FROM surplus s LEFT JOIN users u ON s.user_id=u.id WHERE s.id=?',
      [req.params.id]
    );
    if (!rows.length) return err(res, '尾货不存在', 404);
    // 增加浏览次数
    pool.query('UPDATE surplus SET views=views+1 WHERE id=?', [req.params.id]).catch(()=>{});
    ok(res, rows[0]);
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

/**
 * POST /api/surplus  — 农户发布尾货
 * body: { crop_type, variety, quantity, price, description, address, harvest_date, images }
 */
app.post('/api/surplus', authMiddleware, async (req, res) => {
  if (req.user.role !== 'farmer' && req.user.role !== 'admin')
    return err(res, '只有农户才能发布尾货');
  const { crop_type, variety='', quantity, price=0, description='', address, harvest_date, images='' } = req.body;
  if (!crop_type || !quantity || !address) return err(res, '品类、数量、产地不能为空');
  try {
    const [result] = await pool.query(
      'INSERT INTO surplus (user_id, crop_type, variety, quantity, price, description, address, harvest_date, images) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.user.id, crop_type, variety, quantity, price, description, address, harvest_date||null, typeof images==='object'?JSON.stringify(images):images]
    );
    ok(res, { id: result.insertId }, '发布成功');
  } catch (e) {
    console.error('[surplus post]', e);
    err(res, '服务器错误', 500);
  }
});

/**
 * PUT /api/surplus/:id  — 更新尾货状态（农户本人或企业匹配）
 * body: { status, grade, matched_enterprise_id }
 */
app.put('/api/surplus/:id', authMiddleware, async (req, res) => {
  const { status, grade, matched_enterprise_id, price, description } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM surplus WHERE id=?', [req.params.id]);
    if (!rows.length) return err(res, '尾货不存在', 404);
    const s = rows[0];
    // 仅本人或 admin 可修改
    if (s.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'enterprise')
      return err(res, '无权限修改');
    const fields = [];
    const vals   = [];
    if (status)               { fields.push('status=?');               vals.push(status); }
    if (grade)                { fields.push('grade=?');                vals.push(grade); }
    if (matched_enterprise_id){ fields.push('matched_enterprise_id=?');vals.push(matched_enterprise_id); }
    if (price !== undefined)  { fields.push('price=?');                vals.push(price); }
    if (description)          { fields.push('description=?');          vals.push(description); }
    if (!fields.length) return err(res, '没有可更新的字段');
    vals.push(req.params.id);
    await pool.query(`UPDATE surplus SET ${fields.join(',')} WHERE id=?`, vals);
    ok(res, null, '更新成功');
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

/**
 * DELETE /api/surplus/:id  — 删除尾货（本人或 admin）
 */
app.delete('/api/surplus/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT user_id FROM surplus WHERE id=?', [req.params.id]);
    if (!rows.length) return err(res, '尾货不存在', 404);
    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin')
      return err(res, '无权限删除');
    await pool.query('DELETE FROM surplus WHERE id=?', [req.params.id]);
    ok(res, null, '删除成功');
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  3. 商城模块  /api/products
// ══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/products  — 商品列表
 * query: category, keyword, page, limit
 */
app.get('/api/products', async (req, res) => {
  const { category, keyword, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let sql    = 'SELECT * FROM products WHERE status=1';
  const params = [];
  if (category) { sql += ' AND category=?';      params.push(category); }
  if (keyword)  { sql += ' AND name LIKE ?';     params.push(`%${keyword}%`); }
  sql += ' ORDER BY sales DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  try {
    const [rows] = await pool.query(sql, params);
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM products WHERE status=1' +
      (category ? ' AND category=?' : '') + (keyword ? ' AND name LIKE ?' : ''),
      [...(category?[category]:[]), ...(keyword?[`%${keyword}%`]:[])]
    );
    ok(res, { list: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

/**
 * GET /api/products/:id  — 商品详情
 */
app.get('/api/products/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id=? AND status=1', [req.params.id]);
    if (!rows.length) return err(res, '商品不存在或已下架', 404);
    ok(res, rows[0]);
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  4. 购物车  /api/cart
// ══════════════════════════════════════════════════════════════════════════

/** GET /api/cart */
app.get('/api/cart', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT c.id, c.quantity, p.id AS product_id, p.name, p.price, p.original_price, p.images, p.weight, p.stock FROM cart c JOIN products p ON c.product_id=p.id WHERE c.user_id=?',
      [req.user.id]
    );
    ok(res, rows);
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

/** POST /api/cart  body: { product_id, quantity } */
app.post('/api/cart', authMiddleware, async (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  if (!product_id) return err(res, '商品ID不能为空');
  try {
    // 检查商品是否存在
    const [p] = await pool.query('SELECT id, stock FROM products WHERE id=? AND status=1', [product_id]);
    if (!p.length) return err(res, '商品不存在');
    // 若已在购物车则更新数量
    const [c] = await pool.query('SELECT id, quantity FROM cart WHERE user_id=? AND product_id=?', [req.user.id, product_id]);
    if (c.length > 0) {
      await pool.query('UPDATE cart SET quantity=quantity+? WHERE id=?', [quantity, c[0].id]);
    } else {
      await pool.query('INSERT INTO cart (user_id, product_id, quantity) VALUES (?,?,?)', [req.user.id, product_id, quantity]);
    }
    ok(res, null, '已加入购物车');
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

/** PUT /api/cart/:id  body: { quantity } */
app.put('/api/cart/:id', authMiddleware, async (req, res) => {
  const { quantity } = req.body;
  if (!quantity || quantity < 1) return err(res, '数量不合法');
  try {
    await pool.query('UPDATE cart SET quantity=? WHERE id=? AND user_id=?', [quantity, req.params.id, req.user.id]);
    ok(res, null, '更新成功');
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

/** DELETE /api/cart/:id */
app.delete('/api/cart/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    ok(res, null, '删除成功');
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  5. 订单模块  /api/orders
// ══════════════════════════════════════════════════════════════════════════

/** GET /api/orders  — 我的订单列表（支持 type / status 筛选） */
app.get('/api/orders', authMiddleware, async (req, res) => {
  const { type, status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let sql    = 'SELECT o.*, u.nickname AS seller_name FROM orders o LEFT JOIN users u ON o.seller_id=u.id WHERE o.user_id=?';
  const params = [req.user.id];
  if (type)   { sql += ' AND o.type=?';   params.push(type); }
  if (status) { sql += ' AND o.status=?'; params.push(status); }
  sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  try {
    const [rows] = await pool.query(sql, params);
    // 附带订单明细
    for (const o of rows) {
      const [items] = await pool.query('SELECT * FROM order_items WHERE order_id=?', [o.id]);
      o.items = items;
    }
    ok(res, rows);
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

/** GET /api/orders/:id  — 订单详情 */
app.get('/api/orders/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT o.*, u.nickname AS seller_name FROM orders o LEFT JOIN users u ON o.seller_id=u.id WHERE o.id=? AND o.user_id=?',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return err(res, '订单不存在', 404);
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id=?', [req.params.id]);
    rows[0].items = items;
    ok(res, rows[0]);
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

/**
 * POST /api/orders  — 下单
 * body: { items: [{product_id, quantity}], address, phone, remark, type }
 * 或直接从购物车下单: { from_cart: true, cart_ids: [1,2], address, phone }
 */
app.post('/api/orders', authMiddleware, async (req, res) => {
  const { items = [], from_cart = false, cart_ids = [], address, phone, remark = '', type = 'shop' } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let orderItems = [];
    if (from_cart && cart_ids.length > 0) {
      const [cartRows] = await conn.query(
        'SELECT c.id AS cart_id, c.quantity, p.id AS product_id, p.name, p.price, p.stock FROM cart c JOIN products p ON c.product_id=p.id WHERE c.id IN (?) AND c.user_id=?',
        [cart_ids, req.user.id]
      );
      orderItems = cartRows.map(r => ({ product_id: r.product_id, product_name: r.name, price: r.price, quantity: r.quantity, stock: r.stock, cart_id: r.cart_id }));
    } else {
      for (const item of items) {
        const [p] = await conn.query('SELECT id, name, price, stock FROM products WHERE id=? AND status=1', [item.product_id]);
        if (!p.length) throw new Error(`商品(ID:${item.product_id})不存在`);
        if (p[0].stock < item.quantity) throw new Error(`商品"${p[0].name}"库存不足`);
        orderItems.push({ product_id: p[0].id, product_name: p[0].name, price: p[0].price, quantity: item.quantity, stock: p[0].stock });
      }
    }
    if (!orderItems.length) { await conn.rollback(); return err(res, '订单商品不能为空'); }

    const totalAmount = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const orderNo = 'XN' + Date.now();

    const [orderResult] = await conn.query(
      'INSERT INTO orders (order_no, user_id, type, total_amount, status, address, phone, remark) VALUES (?,?,?,?,?,?,?,?)',
      [orderNo, req.user.id, type, totalAmount.toFixed(2), 'pending', address||'', phone||'', remark]
    );
    const orderId = orderResult.insertId;

    for (const item of orderItems) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, product_name, price, quantity, subtotal) VALUES (?,?,?,?,?,?)',
        [orderId, item.product_id, item.product_name, item.price, item.quantity, (item.price * item.quantity).toFixed(2)]
      );
      // 扣减库存，增加销量
      await conn.query('UPDATE products SET stock=stock-?, sales=sales+? WHERE id=?', [item.quantity, item.quantity, item.product_id]);
      // 清空购物车中的该项
      if (item.cart_id) {
        await conn.query('DELETE FROM cart WHERE id=?', [item.cart_id]);
      }
    }

    await conn.commit();
    ok(res, { order_id: orderId, order_no: orderNo, total_amount: totalAmount.toFixed(2) }, '下单成功');
  } catch (e) {
    await conn.rollback();
    console.error('[create order]', e);
    err(res, e.message || '下单失败');
  } finally {
    conn.release();
  }
});

/**
 * PUT /api/orders/:id/status  — 更新订单状态
 * body: { status: 'paid'|'shipped'|'completed'|'cancelled' }
 */
app.put('/api/orders/:id/status', authMiddleware, async (req, res) => {
  const { status } = req.body;
  const allowed = ['paid', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'];
  if (!allowed.includes(status)) return err(res, '状态值不合法');
  try {
    const [rows] = await pool.query('SELECT * FROM orders WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!rows.length && req.user.role !== 'admin') return err(res, '订单不存在', 404);
    const extra = {};
    if (status === 'paid')      extra.paid_at      = new Date();
    if (status === 'shipped')   extra.shipped_at   = new Date();
    if (status === 'completed') extra.completed_at = new Date();
    let sql = 'UPDATE orders SET status=?';
    const vals = [status];
    Object.entries(extra).forEach(([k, v]) => { sql += `,${k}=?`; vals.push(v); });
    sql += ' WHERE id=?';
    vals.push(req.params.id);
    await pool.query(sql, vals);
    ok(res, null, '状态更新成功');
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  6. 溯源模块  /api/trace
// ══════════════════════════════════════════════════════════════════════════

/** GET /api/trace  — 溯源列表 */
app.get('/api/trace', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM traceability ORDER BY created_at DESC LIMIT 50');
    ok(res, rows);
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

/** GET /api/trace/:batchNo  — 按批次号查询溯源 */
app.get('/api/trace/:batchNo', async (req, res) => {
  try {
    const batchNo = decodeURIComponent(req.params.batchNo).trim();
    const [rows] = await pool.query('SELECT * FROM traceability WHERE batch_no=?', [batchNo]);
    if (!rows.length) return err(res, `未找到批次号 "${batchNo}" 的溯源记录`, 404);
    const trace = rows[0];
    // 解析质检报告 JSON
    try { if (trace.quality_report) trace.quality_report = JSON.parse(trace.quality_report); } catch (_) {}
    // 构建溯源时间线
    const statusMap = {
      planted:   { label: '种植开始', icon: '🌱' },
      harvested: { label: '采摘完成', icon: '🌾' },
      inspected: { label: '质检完成', icon: '🔬' },
      processed: { label: '加工完成', icon: '🏭' },
      delivered: { label: '物流运输', icon: '🚚' },
      sold:      { label: '完成销售', icon: '🛒' }
    };
    const stageOrder = ['planted','harvested','inspected','processed','delivered','sold'];
    const currentIdx = stageOrder.indexOf(trace.status);
    trace.timeline = stageOrder.map((s, i) => ({
      status: s,
      label: statusMap[s].label,
      icon:  statusMap[s].icon,
      done:  i <= currentIdx
    }));
    ok(res, trace);
  } catch (e) {
    console.error('[trace]', e);
    err(res, '服务器错误', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  7. 首页统计  /api/stats
// ══════════════════════════════════════════════════════════════════════════

/** GET /api/stats  — 首页统计数据（无需登录，数据脱敏） */
app.get('/api/stats', async (req, res) => {
  try {
    const [[{ farmers }]]     = await pool.query("SELECT COUNT(*) AS farmers     FROM users   WHERE role='farmer'");
    const [[{ enterprises }]] = await pool.query("SELECT COUNT(*) AS enterprises FROM users   WHERE role='enterprise'");
    const [[{ surplus }]]     = await pool.query("SELECT COUNT(*) AS surplus     FROM surplus WHERE status='pending'");
    const [[{ orders }]]      = await pool.query("SELECT COUNT(*) AS orders      FROM orders  WHERE status='completed'");
    const [[{ products }]]    = await pool.query('SELECT COUNT(*) AS products    FROM products WHERE status=1');
    ok(res, { farmers, enterprises, surplus, completedOrders: orders, products });
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  管理端：后台管理接口  /api/admin
// ══════════════════════════════════════════════════════════════════════════

/** 管理员认证中间件 */
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return err(res, '需要管理员权限', 403);
  next();
}

/** GET /api/admin/users  — 用户列表 */
app.get('/api/admin/users', authMiddleware, adminOnly, async (req, res) => {
  const { role, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let sql = 'SELECT id, username, role, nickname, phone, balance, status, created_at FROM users WHERE 1=1';
  const params = [];
  if (role) { sql += ' AND role=?'; params.push(role); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  try {
    const [rows] = await pool.query(sql, params);
    ok(res, rows);
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

/** PUT /api/admin/users/:id/status  — 禁用/启用用户 */
app.put('/api/admin/users/:id/status', authMiddleware, adminOnly, async (req, res) => {
  const { status } = req.body;
  try {
    await pool.query('UPDATE users SET status=? WHERE id=?', [status, req.params.id]);
    ok(res, null, '操作成功');
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

/** POST /api/admin/products  — 新增商品 */
app.post('/api/admin/products', authMiddleware, adminOnly, async (req, res) => {
  const { name, category='其他', origin='', description='', price, original_price=0, stock=0, weight='', grade='A', images='' } = req.body;
  if (!name || !price) return err(res, '商品名称和价格不能为空');
  try {
    const [r] = await pool.query(
      'INSERT INTO products (name, category, origin, description, price, original_price, stock, weight, grade, images) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [name, category, origin, description, price, original_price, stock, weight, grade, images]
    );
    ok(res, { id: r.insertId }, '商品添加成功');
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

/** PUT /api/admin/products/:id  — 编辑商品 */
app.put('/api/admin/products/:id', authMiddleware, adminOnly, async (req, res) => {
  const fields = ['name','category','origin','description','price','original_price','stock','weight','grade','images','status'];
  const setClause = []; const vals = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { setClause.push(`${f}=?`); vals.push(req.body[f]); }
  }
  if (!setClause.length) return err(res, '没有可更新的字段');
  vals.push(req.params.id);
  try {
    await pool.query(`UPDATE products SET ${setClause.join(',')} WHERE id=?`, vals);
    ok(res, null, '更新成功');
  } catch (e) {
    err(res, '服务器错误', 500);
  }
});

// ──────────────────────────────────────────────────────────────────────────
//  健康检查
// ──────────────────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ code: 200, message: 'OK', time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ code: 500, message: 'DB error' });
  }
});

// 404
app.use((req, res) => res.status(404).json({ code: 404, message: '接口不存在' }));

// ──────────────────────────────────────────────────────────────────────────
//  启动服务
// ──────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   新农e家 · 后端 API 服务已启动               ║
║   地址: http://localhost:${PORT}                ║
║   健康: http://localhost:${PORT}/api/health     ║
╚══════════════════════════════════════════════╝
  `);
});

module.exports = app;
