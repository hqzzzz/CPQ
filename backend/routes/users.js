
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getDb } = require('../utils/db');
const { mapToCamel } = require('../utils/helpers');

// Helper for hashing (MD5 per requirements)
const hashPassword = (pwd) => crypto.createHash('md5').update(pwd).digest('hex');

// --- 用户管理 (Users) ---

// 获取所有用户
router.get('/users', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM users");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { 
        res.status(500).json({ success: false, message: e.message }); 
    }
});

// 创建新用户 (支持 OAuth 自动注册)
router.post('/users', async (req, res) => {
    const u = req.body;
    // ID 策略: 如果客户端(OAuth)提供了 ID 则使用，否则生成基于时间的 ID 模拟自增
    const newId = u.id || Date.now(); 
    
    try {
        const pool = await getDb();
        
        // 检查是否存在 (幂等性保护)
        const [existing] = await pool.query("SELECT id FROM users WHERE email = ? OR username = ?", [u.email, u.username]);
        if (existing.length > 0) {
             // 如果用户已存在，返回现有用户而不是报错 (适配 OAuth 登录逻辑)
             return res.json({ success: true, data: { ...u, id: existing[0].id } });
        }

        // Determine password: if provided, assume already hashed by frontend? 
        // Or if raw, hash it. However, requirements stated frontend sends hash.
        // If not provided, use default '123456' hashed.
        let finalPassword = u.password;
        if (!finalPassword && u.authProvider === 'local') {
            finalPassword = hashPassword('123456');
        } 
        // If password comes from frontend already hashed (length 32 hex), keep it. 
        // Otherwise hash it. Simple heuristic: MD5 hex is 32 chars.
        if (finalPassword && finalPassword.length !== 32) {
             finalPassword = hashPassword(finalPassword);
        }

        const sql = `INSERT INTO users (id, username, name, email, role, employee_id, title, department, avatar, auth_provider, password, last_login) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;
        
        await pool.query(sql, [
            newId, 
            u.username, 
            u.name, 
            u.email, 
            u.role || 4, // 默认为访客角色 (Guest)
            u.employee_id || '', 
            u.title || '', 
            u.department || '', 
            u.avatar || '', 
            u.authProvider || 'local', 
            finalPassword, 
            new Date()
        ]);
        
        res.json({ success: true, data: { ...u, id: newId } });
    } catch (e) { 
        console.error("创建用户失败:", e);
        res.status(500).json({ success: false, message: e.message }); 
    }
});

// 更新用户信息
router.put('/users/:id', async (req, res) => {
    const u = req.body;
    try {
        const pool = await getDb();
        const sql = `UPDATE users SET name=?, email=?, role=?, employee_id=?, title=?, department=?, avatar=? WHERE id=?`;
        await pool.query(sql, [u.name, u.email, u.role, u.employee_id, u.title, u.department, u.avatar, req.params.id]);
        res.json({ success: true, data: u });
    } catch (e) { 
        res.status(500).json({ success: false, message: e.message }); 
    }
});

// 删除用户
router.delete('/users/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query("DELETE FROM users WHERE id=?", [req.params.id]);
        res.json({ success: true });
    } catch (e) { 
        res.status(500).json({ success: false, message: e.message }); 
    }
});

// --- 角色权限 (Roles) ---

// 获取所有角色
router.get('/roles', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM roles");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { 
        res.status(500).json({ success: false, message: e.message }); 
    }
});

// 创建新角色
router.post('/roles', async (req, res) => {
    const r = req.body;
    const newId = Date.now();
    try {
        const pool = await getDb();
        // permissions 字段存储为 JSON 字符串
        await pool.query("INSERT INTO roles VALUES (?,?,?,?,?)", [newId, r.name, r.description, r.isSystem ? 1 : 0, JSON.stringify(r.permissions)]);
        res.json({ success: true, data: { ...r, id: newId } });
    } catch (e) { 
        res.status(500).json({ success: false, message: e.message }); 
    }
});

// 更新角色
router.put('/roles/:id', async (req, res) => {
    const r = req.body;
    try {
        const pool = await getDb();
        await pool.query("UPDATE roles SET name=?, description=?, permissions_json=? WHERE id=?", [r.name, r.description, JSON.stringify(r.permissions), req.params.id]);
        res.json({ success: true, data: r });
    } catch (e) { 
        res.status(500).json({ success: false, message: e.message }); 
    }
});

// 删除角色
router.delete('/roles/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query("DELETE FROM roles WHERE id=?", [req.params.id]);
        res.json({ success: true });
    } catch (e) { 
        res.status(500).json({ success: false, message: e.message }); 
    }
});

module.exports = router;
