
const express = require('express');
const router = express.Router();
const axios = require('axios');
const qs = require('qs');
const { getDb } = require('../utils/db');
const SystemLogger = require('../utils/logger');

// --- 配置区域 (生产环境请使用 process.env) ---
// 请确保在服务器环境变量中设置这些值，否则无法连接真实 OAuth
const CONFIG = {
    FRONTEND_REDIRECT_BASE: process.env.FRONTEND_URL || 'http://localhost:5173/login', // 前端回调页
    
    GOOGLE: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
        CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'your-google-secret',
        TOKEN_URL: 'https://oauth2.googleapis.com/token',
        USER_INFO_URL: 'https://www.googleapis.com/oauth2/v3/userinfo',
        AUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
        SCOPE: 'openid email profile'
    },
    MICROSOFT: {
        CLIENT_ID: process.env.MICROSOFT_CLIENT_ID || 'your-microsoft-client-id',
        CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET || 'your-microsoft-secret',
        // 使用 common 租户支持个人和企业号
        TOKEN_URL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', 
        USER_INFO_URL: 'https://graph.microsoft.com/v1.0/me',
        AUTH_URL: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        SCOPE: 'User.Read offline_access openid profile email'
    },
    WECHAT: {
        APP_ID: process.env.WECHAT_APP_ID || 'your-wx-appid',
        APP_SECRET: process.env.WECHAT_APP_SECRET || 'your-wx-secret',
        // 微信开放平台 (网站应用)
        AUTH_URL: 'https://open.weixin.qq.com/connect/qrconnect', 
        TOKEN_URL: 'https://api.weixin.qq.com/sns/oauth2/access_token',
        USER_INFO_URL: 'https://api.weixin.qq.com/sns/userinfo',
        SCOPE: 'snsapi_login'
    }
};

// --- 辅助函数：数据库用户处理 ---
async function upsertUser(provider, profile) {
    const pool = await getDb();
    
    // 1. 查找是否存在 (根据 Email 或 Provider ID)
    // 微信通常没有 email，所以优先匹配 OpenID/ProviderID
    let sqlCheck = "SELECT * FROM users WHERE (email = ? AND email != '') OR (auth_provider = ? AND employee_id = ?)";
    let checkParams = [profile.email || 'no_email', provider, profile.id];
    
    const [existing] = await pool.query(sqlCheck, checkParams);
    
    if (existing.length > 0) {
        // 用户已存在，更新最后登录时间
        const user = existing[0];
        await pool.query("UPDATE users SET last_login = NOW() WHERE id = ?", [user.id]);
        return user;
    }

    // 2. 创建新用户
    const newId = Date.now(); // 推荐使用数据库自增，这里为了兼容现有逻辑使用时间戳
    const insertSql = `INSERT INTO users (id, username, name, email, role, employee_id, title, department, avatar, auth_provider, last_login) VALUES (?,?,?,?,?,?,?,?,?,?,NOW())`;
    
    // 默认访客角色 (4)
    const newUser = {
        id: newId,
        username: profile.email ? profile.email.split('@')[0] : `${provider}_${profile.id.substring(0,6)}`,
        name: profile.name,
        email: profile.email || '',
        role: 4,
        employee_id: profile.id, // 暂存 Provider 的唯一 ID
        title: '访客',
        department: '外部',
        avatar: profile.avatar || '',
        auth_provider: provider
    };

    await pool.query(insertSql, [
        newUser.id, newUser.username, newUser.name, newUser.email, 
        newUser.role, newUser.employee_id, newUser.title, newUser.department, 
        newUser.avatar, newUser.auth_provider
    ]);

    return newUser;
}

// --- API 路由 ---

// 1. 获取登录跳转链接
// 前端调用此接口，获取 redirectUrl 后 `window.location.href` 跳转
router.get('/auth/:provider/url', (req, res) => {
    const { provider } = req.params;
    let url = '';
    const redirectUri = `${CONFIG.FRONTEND_REDIRECT_BASE}`; // 回调到前端页面

    if (provider === 'google') {
        const params = new URLSearchParams({
            client_id: CONFIG.GOOGLE.CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: CONFIG.GOOGLE.SCOPE,
            state: 'google', // 用于前端识别来源
            access_type: 'offline',
            prompt: 'consent'
        });
        url = `${CONFIG.GOOGLE.AUTH_URL}?${params.toString()}`;
    
    } else if (provider === 'microsoft') {
        const params = new URLSearchParams({
            client_id: CONFIG.MICROSOFT.CLIENT_ID,
            response_type: 'code',
            redirect_uri: redirectUri,
            response_mode: 'query',
            scope: CONFIG.MICROSOFT.SCOPE,
            state: 'microsoft'
        });
        url = `${CONFIG.MICROSOFT.AUTH_URL}?${params.toString()}`;

    } else if (provider === 'wechat') {
        // 微信开放平台网页登录
        const params = new URLSearchParams({
            appid: CONFIG.WECHAT.APP_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: CONFIG.WECHAT.SCOPE,
            state: 'wechat'
        });
        // 微信要求 redirect_uri 域名必须备案且在后台配置
        url = `${CONFIG.WECHAT.AUTH_URL}?${params.toString()}#wechat_redirect`;
    } else {
        // Handle 'register' case which might be matched if order is loose, 
        // but express matches specific routes first usually if defined well.
        // Assuming this wildcard catches only valid providers if register is defined separately.
        return res.status(400).json({ success: false, message: '不支持的提供商' });
    }

    res.json({ success: true, url });
});

// 2. 注册 (Register) - Local
router.post('/auth/register', async (req, res) => {
    const { username, password, name, email } = req.body;
    if (!username || !password || !name) {
        return res.status(400).json({ success: false, message: '用户名、密码和姓名不能为空' });
    }

    try {
        const pool = await getDb();
        // Check existence
        const [existing] = await pool.query("SELECT id FROM users WHERE username = ? OR (email = ? AND email != '')", [username, email || '']);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: '用户名或邮箱已被注册' });
        }

        const newId = Date.now();
        // Default role 4 (Guest)
        await pool.query(
            "INSERT INTO users (id, username, name, email, password, role, auth_provider, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
            [newId, username, name, email || '', password, 4, 'local']
        );

        SystemLogger.auth(`New User Registered: ${username}`);
        res.json({ success: true, message: '注册成功' });
    } catch (e) {
        SystemLogger.error('Registration Failed', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// 3. 处理登录回调 (交换 Token)
// 前端获取 code 后，POST 到这里
router.post('/auth/login', async (req, res) => {
    const { provider, code } = req.body;
    const redirectUri = `${CONFIG.FRONTEND_REDIRECT_BASE}`;

    if (!code) return res.status(400).json({ success: false, message: '缺少授权码 (Code)' });

    try {
        let profile = {}; // { id, name, email, avatar }

        if (provider === 'google') {
            // A. 获取 Token
            const tokenRes = await axios.post(CONFIG.GOOGLE.TOKEN_URL, qs.stringify({
                code,
                client_id: CONFIG.GOOGLE.CLIENT_ID,
                client_secret: CONFIG.GOOGLE.CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

            const { access_token } = tokenRes.data;

            // B. 获取用户信息
            const userRes = await axios.get(CONFIG.GOOGLE.USER_INFO_URL, {
                headers: { Authorization: `Bearer ${access_token}` }
            });
            
            profile = {
                id: userRes.data.sub,
                name: userRes.data.name,
                email: userRes.data.email,
                avatar: userRes.data.picture
            };

        } else if (provider === 'microsoft') {
            const tokenRes = await axios.post(CONFIG.MICROSOFT.TOKEN_URL, qs.stringify({
                code,
                client_id: CONFIG.MICROSOFT.CLIENT_ID,
                client_secret: CONFIG.MICROSOFT.CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

            const { access_token } = tokenRes.data;

            // 获取基本信息
            const userRes = await axios.get(CONFIG.MICROSOFT.USER_INFO_URL, {
                headers: { Authorization: `Bearer ${access_token}` }
            });

            profile = {
                id: userRes.data.id,
                name: userRes.data.displayName,
                email: userRes.data.mail || userRes.data.userPrincipalName, // 微软邮箱字段可能不同
                avatar: '' // 头像需要额外 API 调用，暂略
            };

        } else if (provider === 'wechat') {
            // 微信流程
            const tokenUrl = `${CONFIG.WECHAT.TOKEN_URL}?appid=${CONFIG.WECHAT.APP_ID}&secret=${CONFIG.WECHAT.APP_SECRET}&code=${code}&grant_type=authorization_code`;
            const tokenRes = await axios.get(tokenUrl);
            
            if (tokenRes.data.errcode) throw new Error(`WeChat Error: ${tokenRes.data.errmsg}`);
            
            const { access_token, openid } = tokenRes.data;
            
            const userUrl = `${CONFIG.WECHAT.USER_INFO_URL}?access_token=${access_token}&openid=${openid}`;
            const userRes = await axios.get(userUrl);

            profile = {
                id: userRes.data.unionid || userRes.data.openid,
                name: userRes.data.nickname,
                email: '', // 微信不返回邮箱
                avatar: userRes.data.headimgurl
            };
        } else {
            throw new Error('不支持的提供商');
        }

        // 数据库处理
        const dbUser = await upsertUser(provider, profile);

        // 格式化返回给前端 (驼峰)
        const userResponse = {
            id: dbUser.id,
            username: dbUser.username,
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role,
            authProvider: dbUser.auth_provider,
            avatar: dbUser.avatar
        };

        SystemLogger.auth(`OAuth Login Success: ${provider}`, { user: userResponse.username });
        res.json({ success: true, data: userResponse });

    } catch (error) {
        SystemLogger.error(`OAuth Login Failed: ${provider}`, error);
        res.status(500).json({ success: false, message: `认证失败: ${error.message}` });
    }
});

module.exports = router;
