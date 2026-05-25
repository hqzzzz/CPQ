
const { getDb } = require('../utils/db');
const SystemLogger = require('../utils/logger');

// 引导密钥 (Bootstrap Key): 用于系统初始化或紧急管理员访问
// 注意：此密钥仅允许来自 Localhost (本机) 的连接
let BOOTSTRAP_KEY = process.env.BOOTSTRAP_KEY || null; 

const setBootstrapKey = (key) => { BOOTSTRAP_KEY = key; };

/**
 * 认证中间件 (Authentication Middleware)
 * 拦截所有 API 请求，验证 Authorization 头中的 Bearer Token。
 */
const requireAuth = async (req, res, next) => {
    // 1. 放行 OPTIONS 预检请求 (CORS)
    if (req.method === 'OPTIONS') return next();

    const path = req.originalUrl || req.url;
    const cleanPath = path.split('?')[0];

    // 2. 白名单路径 (Public Whitelist) - 无需认证即可访问
    if (cleanPath.endsWith('/api/health') ||      // 健康检查
        cleanPath.endsWith('/api/config') ||      // 数据库配置
        cleanPath.endsWith('/api/init') ||        // 数据库初始化
        cleanPath.endsWith('/api/handshake') ||   // 首次握手获取 Token
        cleanPath.includes('/api/auth/') ||       // **新增: OAuth 登录相关接口**
        cleanPath.startsWith('/storage')) {       // 静态文件存储
        return next();
    }

    // 3. 检查 Authorization 请求头
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        SystemLogger.auth(`访问拒绝: 缺少认证头 - ${cleanPath}`, { key: 'missing' });
        return res.status(401).json({ success: false, message: '请求未包含认证 Token (Missing Authorization header)' });
    }

    const token = authHeader.split(' ')[1]; // Format: "Bearer <token>"
    // 日志脱敏处理
    const maskedKey = token.length > 8 ? token.substring(0,8) + '...' : token;

    // 4. 检查是否为超级管理员引导密钥 (Bootstrap Key)
    if (token === BOOTSTRAP_KEY) {
        const remoteIp = req.socket.remoteAddress;
        // 安全检查：Bootstrap Key 只能在服务器本机使用
        const isLocal = remoteIp === '::1' || remoteIp === '127.0.0.1' || remoteIp === '::ffff:127.0.0.1';
        
        if (!isLocal) {
            SystemLogger.auth(`安全警告: 拦截到非本地 IP 尝试使用 Admin Key - ${remoteIp}`, { key: 'admin_attempt' });
            return res.status(403).json({ success: false, message: '安全警告: 管理员密钥仅限本机访问 (Localhost Only).' });
        }
        return next(); // 放行
    }

    // 5. 验证数据库中的 API Key (标准用户/前端访问)
    try {
        const pool = await getDb();
        // 查询 Token 是否存在且状态为 active
        const [rows] = await pool.query("SELECT * FROM api_keys WHERE token = ? AND status = 'active'", [token]);
        
        if (rows.length === 0) {
            SystemLogger.auth(`认证失败: 无效的 API Token`, { key: maskedKey, path: cleanPath });
            return res.status(401).json({ success: false, message: 'API Key 无效或已被撤销' });
        }
        // 认证通过
        next();
    } catch (e) {
        // 异常处理：数据库连接失败等
        const errorDetails = {
            message: e.message,
            sqlCode: e.code,
            syscall: e.syscall,
            path: cleanPath,
            maskedKey: maskedKey
        };
        SystemLogger.error(`认证过程发生系统错误 - ${cleanPath}`, errorDetails);
        
        if (e.message && e.message.includes('Database not connected')) {
            return res.status(503).json({ success: false, message: '服务暂不可用: 数据库未连接' });
        }
        if (e.code === 'ECONNREFUSED') {
            return res.status(503).json({ success: false, message: '数据库连接被拒绝，请检查 MySQL 服务。' });
        }
        return res.status(500).json({ success: false, message: '认证系统内部错误: ' + e.message });
    }
};

module.exports = { requireAuth, setBootstrapKey };
