/**
 * 新农e家后端服务 - 数据库连接配置
 * 
 * 使用 mysql2/promise 连接池方式管理 MySQL 连接
 * 连接池可复用连接，避免频繁创建/销毁，提高性能
 */

const mysql = require('mysql2/promise');

// 创建连接池
const pool = mysql.createPool({
  host: 'localhost',       // 数据库主机地址
  port: 3306,              // 端口
  user: 'root',            // 用户名
  password:'CHANGE_ME',      // 密码
  database: 'xinnong',     // 数据库名
  waitForConnections: true,
  connectionLimit: 10,     // 最大连接数
  queueLimit: 0,           // 无队列限制
  charset: 'utf8mb4'       // 支持中文和emoji
});

// 测试数据库连接
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL 数据库连接成功 (xinnong)');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL 数据库连接失败:', err.message);
    console.error('请检查：');
    console.error('  1. MySQL 服务是否已启动');
    console.error('  2. 数据库 xinnong 是否已创建（运行 init.sql）');
    console.error('  3. 用户名/密码是否正确');
  });

module.exports = pool;
