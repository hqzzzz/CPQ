
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getDb, configureDb, getPool } = require('../utils/db');
const SystemLogger = require('../utils/logger');
const { mapToCamel } = require('../utils/helpers');
const { upload } = require('../middleware/upload');
const { SEED_TYPES, SEED_CATEGORIES, SEED_PRODUCTS, SEED_ROLES, SEED_USERS, SEED_SETTINGS } = require('../utils/seeds');

// LOGS
router.get('/admin/logs', async (req, res) => {
    res.json({ success: true, data: SystemLogger.getLogs() });
});

// HEALTH
router.get('/health', (req, res) => {
    res.json({ status: 'online', db: getPool() ? 'connected' : 'disconnected' });
});

// TEST CONN
router.get('/test-connection', (req, res) => {
    res.json({ success: true, message: 'Connection Successful', timestamp: new Date().toISOString() });
});

// CONFIG (Connect DB)
router.post('/config', async (req, res) => {
    try {
        await configureDb(req.body);
        res.json({ success: true, message: 'Connected to Database' });
    } catch (e) {
        SystemLogger.error('Database Connection Failed', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// HANDSHAKE
router.post('/handshake', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT token FROM api_keys WHERE status = 'active' LIMIT 1");
        if (rows.length > 0) return res.json({ success: true, token: rows[0].token });
        
        const token = 'sk-' + crypto.randomBytes(8).toString('hex');
        const id = Date.now();
        await pool.query("INSERT INTO api_keys (id, name, token, status) VALUES (?,?,?,?)", [id, 'Auto-Frontend', token, 'active']);
        
        SystemLogger.info('Generated new Auto-Frontend API Key', { key: token.substring(0,8) + '...' });
        return res.json({ success: true, token });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// INIT DB
router.post('/init', async (req, res) => {
    const dbPool = getPool();
    if (!dbPool) return res.status(400).json({ success: false, message: 'DB not connected' });
    
    SystemLogger.warn('INITIALIZATION STARTED: Dropping tables...');
    
    try {
        const conn = await dbPool.getConnection();
        await conn.beginTransaction();

        const tables = [
            `DROP TABLE IF EXISTS quote_items`,
            `DROP TABLE IF EXISTS boms`,
            `DROP TABLE IF EXISTS product_boms`,
            `DROP TABLE IF EXISTS products`,
            `DROP TABLE IF EXISTS product_types`,
            `DROP TABLE IF EXISTS product_categories`,
            `DROP TABLE IF EXISTS quotes`,
            `DROP TABLE IF EXISTS roles`,
            `DROP TABLE IF EXISTS users`,
            `DROP TABLE IF EXISTS settings`,
            `DROP TABLE IF EXISTS api_keys`,

            `CREATE TABLE api_keys (id BIGINT PRIMARY KEY, name VARCHAR(100), token VARCHAR(255), status VARCHAR(20), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE product_types (id BIGINT PRIMARY KEY, name VARCHAR(100), level INT, color VARCHAR(50))`,
            `CREATE TABLE product_categories (id BIGINT PRIMARY KEY, name VARCHAR(100), sort_order INT DEFAULT 0)`,
            `CREATE TABLE products (
                id BIGINT PRIMARY KEY, material_code VARCHAR(100), unit VARCHAR(20), name VARCHAR(255), 
                description TEXT, specifications TEXT, type INT, category VARCHAR(100), 
                cost DECIMAL(15,4), base_price DECIMAL(15,4), inventory INT, 
                base_image LONGTEXT,
                gallery_images_json LONGTEXT, documents_json LONGTEXT
            )`,
            `CREATE TABLE boms (id BIGINT PRIMARY KEY, name VARCHAR(255), specifications TEXT, description TEXT, category VARCHAR(100), base_image LONGTEXT, items_json LONGTEXT)`,
            `CREATE TABLE product_boms (product_id BIGINT PRIMARY KEY, items_json LONGTEXT)`,
            `CREATE TABLE quotes (
                id BIGINT PRIMARY KEY, customer_name VARCHAR(255), date DATETIME, status VARCHAR(50), 
                subtotal DECIMAL(15,4), tax DECIMAL(15,4), grand_total DECIMAL(15,4), items_json LONGTEXT, ai_analysis TEXT,
                status_log_json LONGTEXT
            )`,
            `CREATE TABLE roles (id BIGINT PRIMARY KEY, name VARCHAR(100), description TEXT, is_system BOOLEAN, permissions_json TEXT)`,
            `CREATE TABLE users (
                id BIGINT PRIMARY KEY, username VARCHAR(100), name VARCHAR(100), email VARCHAR(255), 
                role BIGINT, employee_id VARCHAR(50), title VARCHAR(100), department VARCHAR(100), 
                avatar TEXT, auth_provider VARCHAR(20), password VARCHAR(255), last_login DATETIME
            )`,
            `CREATE TABLE settings (id VARCHAR(20) PRIMARY KEY, quote_json LONGTEXT, production_json LONGTEXT)`
        ];

        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        for (const sql of tables) await conn.query(sql);
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');

        for (const t of SEED_TYPES) await conn.query("INSERT INTO product_types VALUES (?,?,?,?)", [t.id, t.name, t.level, t.color]);
        for (let i = 0; i < SEED_CATEGORIES.length; i++) {
            const c = SEED_CATEGORIES[i];
            await conn.query("INSERT INTO product_categories VALUES (?,?,?)", [c.id, c.name, i]);
        }
        for (const p of SEED_PRODUCTS) {
            await conn.query(`INSERT INTO products (id, material_code, unit, name, description, specifications, type, category, cost, base_price, inventory, base_image, gallery_images_json, documents_json) 
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
                [p.id, p.materialCode, p.unit, p.name, p.description, p.specifications, p.type, p.category, p.cost, p.basePrice, p.inventory, p.baseImage, JSON.stringify(p.galleryImages), JSON.stringify(p.documents)]);
        }
        for (const r of SEED_ROLES) await conn.query("INSERT INTO roles VALUES (?,?,?,?,?)", [r.id, r.name, r.description, r.isSystem, JSON.stringify(r.permissions)]);
        for (const u of SEED_USERS) await conn.query(`INSERT INTO users (id, username, name, email, role, employee_id, avatar, auth_provider, password, last_login) 
            VALUES (?,?,?,?,?,?,?,?,?,?)`, [u.id, u.username, u.name, u.email, u.role, u.employee_id, u.avatar, u.authProvider, u.password, new Date()]);
        
        await conn.query("INSERT INTO settings VALUES (?,?,?)", ['global', 
            JSON.stringify(SEED_SETTINGS.quote), 
            JSON.stringify(SEED_SETTINGS.production)
        ]);
        
        const defaultToken = 'sk-' + crypto.randomBytes(8).toString('hex');
        await conn.query("INSERT INTO api_keys (id, name, token, status) VALUES (?,?,?,?)", [1, 'sk-admin', defaultToken, 'active']);

        const TestToken = 'sk-19921123';
        await conn.query("INSERT INTO api_keys (id, name, token, status) VALUES (?,?,?,?)", [2, 'sk-test', TestToken, 'active']);
        
        await conn.commit();
        conn.release();
        
        SystemLogger.info('Initialization Completed Successfully');
        res.json({ success: true, message: 'Database Initialized', data: defaultToken });
    } catch (e) {
        if(dbPool) { try{ const c = await dbPool.getConnection(); await c.rollback(); c.release(); } catch(err){} }
        SystemLogger.error('Initialization Failed', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// UPLOAD
router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file provided' });
    }

    let originalName = req.file.originalname;
    try {
        originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    } catch (e) {}

    let dbName = 'default';
    const dbPool = getPool();
    if (dbPool && dbPool.pool && dbPool.pool.config) {
        dbName = dbPool.pool.config.connectionConfig.database;
    }
    const dateFolder = new Date().toISOString().slice(0, 7);
    const fileUrl = `/storage/${dbName}/${dateFolder}/${req.file.filename}`;
    
    SystemLogger.info(`File Uploaded: ${req.file.filename}`, { size: req.file.size });

    res.json({
        success: true,
        data: {
            id: req.body.id || Date.now().toString(),
            name: originalName,
            url: fileUrl,
            type: req.file.mimetype,
            size: req.file.size,
            uploadDate: new Date().toISOString()
        }
    });
});

// SETTINGS TEMPLATES
router.get('/settings/templates', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM settings WHERE id='global'");
        if (rows.length > 0) {
            const data = rows[0];
            res.json({
                success: true,
                data: {
                    quote: JSON.parse(data.quote_json),
                    production: JSON.parse(data.production_json)
                }
            });
        } else {
            res.json({ success: true, data: SEED_SETTINGS });
        }
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/settings/templates', async (req, res) => {
    const s = req.body;
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT id FROM settings WHERE id='global'");
        if(rows.length === 0) {
            await pool.query("INSERT INTO settings VALUES (?,?,?)", ['global', JSON.stringify(s.quote), JSON.stringify(s.production)]);
        } else {
            await pool.query("UPDATE settings SET quote_json=?, production_json=? WHERE id='global'", [JSON.stringify(s.quote), JSON.stringify(s.production)]);
        }
        res.json({ success: true, data: s });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// KEYS
router.get('/keys', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM api_keys ORDER BY created_at DESC");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/keys', async (req, res) => {
    const { name } = req.body;
    const token = 'sk-' + crypto.randomBytes(8).toString('hex');
    const id = Date.now();
    try {
        const pool = await getDb();
        await pool.query("INSERT INTO api_keys (id, name, token, status) VALUES (?,?,?,?)", [id, name, token, 'active']);
        SystemLogger.info(`New API Key Created: ${name}`);
        res.json({ success: true, data: { id, name, token, status: 'active' } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/keys/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query("DELETE FROM api_keys WHERE id = ?", [req.params.id]);
        SystemLogger.warn(`API Key Revoked: ${req.params.id}`);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
