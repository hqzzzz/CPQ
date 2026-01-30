
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
let PORT = process.env.PORT ? parseInt(process.env.PORT) : 3002;

// --- CONFIGURATION ---
const BOOTSTRAP_KEY = 'sk-admin-' + crypto.randomBytes(6).toString('hex');
const BUCK_ROOT = path.join(__dirname, '../BUCK'); // Storage Root

// --- LOGGING SERVICE ---
const systemLogs = [];
const MAX_LOGS = 500; // Increased log buffer for stats

const SystemLogger = {
    add: (level, message, details = null) => {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            details
        };
        systemLogs.unshift(entry);
        if (systemLogs.length > MAX_LOGS) systemLogs.pop();
        
        // Output to console for dev visibility
        const color = level === 'ERROR' ? '\x1b[31m' : level === 'WARN' ? '\x1b[33m' : level === 'HTTP' ? '\x1b[36m' : '\x1b[32m';
        console.log(`${color}[${level}] ${message}\x1b[0m`);
        if (details && level === 'ERROR') console.error(details);
    },
    info: (msg, details) => SystemLogger.add('INFO', msg, details),
    warn: (msg, details) => SystemLogger.add('WARN', msg, details),
    error: (msg, err) => SystemLogger.add('ERROR', msg, typeof err === 'object' ? { message: err.message, stack: err.stack, code: err.code, ...err } : err),
    http: (msg) => SystemLogger.add('HTTP', msg),
    auth: (msg, details) => SystemLogger.add('AUTH', msg, details)
};

app.use(cors({
    origin: function (origin, callback) {
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Version'],
    credentials: true
}));

app.use(bodyParser.json({ limit: '50mb' }));

// Request Logger Middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        SystemLogger.http(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// --- STATIC FILE SERVING ---
// Maps http://localhost:3002/storage -> local ../BUCK folder
app.use('/storage', express.static(BUCK_ROOT));

let dbPool = null;

// --- FILE STORAGE CONFIGURATION (Multer) ---
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        let dbName = 'default';
        try {
            // Attempt to get the database name from the active pool
            if (dbPool && dbPool.pool && dbPool.pool.config && dbPool.pool.config.connectionConfig) {
                dbName = dbPool.pool.config.connectionConfig.database;
            } else if (req.query.db) {
                dbName = req.query.db;
            }
        } catch (e) {
            console.error('Error determining DB name for folder:', e);
        }

        // Folder Structure: BUCK / {dbName} / {YYYY-MM}
        const dateFolder = new Date().toISOString().slice(0, 7); // YYYY-MM
        const finalPath = path.join(BUCK_ROOT, dbName, dateFolder);

        try {
            await fs.promises.mkdir(finalPath, { recursive: true });
            cb(null, finalPath);
        } catch (err) {
            SystemLogger.error('Failed to create storage directory', err);
            cb(err, null);
        }
    },
    filename: function (req, file, cb) {
        // Naming Convention: {id}TL{originalName}
        // ID must be passed in formData. If missing, fallback to timestamp.
        const id = req.body.id || Date.now();
        // Sanitize filename to remove dangerous characters but keep extension
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const filename = `${id}TL${cleanName}`;
        cb(null, filename);
    }
});

const upload = multer({ storage: storage });

// --- SEED DATA ---
const SEED_TYPES = [
    { id: 1, name: '销售成品', level: 1, color: '#d946ef' },
    { id: 2, name: '成品', level: 2, color: '#22c55e' },
    { id: 3, name: '组件', level: 3, color: '#F59E0B' },
    { id: 4, name: '零件', level: 4, color: '#84cc16' },
    { id: 5, name: '标准件', level: 90, color: '#64748b' }
];

// Placeholder 1x1 pixel base64 transparent gif
const PLACEHOLDER_IMG = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const SEED_PRODUCTS = [
    {
        id: 1, materialCode: 'SRV-ENT-X1', unit: 'EA', name: 'Enterprise Server X1',
        description: 'High-performance rack server for enterprise workloads.', specifications: '2U Rackmount, Dual Socket', 
        type: 1, cost: 1800.00, basePrice: 2500.00, inventory: 45, category: 'Hardware',
        baseImage: PLACEHOLDER_IMG, // New Base Image Column
        galleryImages: [{
            id: 'seed-img-1', name: 'server_front.jpg', type: 'image/jpeg', size: 1024, uploadDate: new Date().toISOString(),
            url: 'https://images.unsplash.com/photo-1591405351990-4726e331f141?auto=format&fit=crop&w=400&q=80'
        }], 
        documents: []
    },
    {
        id: 2, materialCode: 'SW-CRM-SUB', unit: 'LIC', name: 'Cloud CRM License',
        description: 'Cloud-based Customer Relationship Management subscription.', specifications: 'SaaS, Annual', 
        type: 1, cost: 10.00, basePrice: 50.00, inventory: 9999, category: 'Software',
        baseImage: PLACEHOLDER_IMG, // New Base Image Column
        galleryImages: [{
            id: 'seed-img-2', name: 'crm_dashboard.jpg', type: 'image/jpeg', size: 2048, uploadDate: new Date().toISOString(),
            url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=400&q=80'
        }], 
        documents: []
    }
];

const SEED_ROLES = [
    { 
        id: 1, name: 'Administrator', description: 'Full system access', isSystem: true, 
        permissions: { dashboard: ['view'], products: ['view','create','edit','delete','view_cost','export'], settings: ['view','edit'], types: ['view', 'create', 'edit', 'delete'], bom: ['view', 'create', 'edit', 'delete'] } 
    },
    { 
        id: 2, name: 'Sales Rep', description: 'Create and manage quotes', isSystem: false, 
        permissions: { dashboard: ['view'], products: ['view'], quotes: ['view','create','edit','delete','export'] } 
    }
];

const SEED_USERS = [
    {
        id: 1, employeeId: 'EMP001', username: 'admin', name: 'Administrator', role: 1, 
        authProvider: 'local', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', email: 'admin@cloudcpq.com'
    }
];

const SEED_SETTINGS = {
    quote: { title: "Sales Quote", companyName: "青岛鑫光正牧业", companyAddress: "123 Tech Blvd", companyContact: "sales@nexus.com", terms: "Net 30" },
    production: { title: "Production Work Order" }
};

// --- HELPER FUNCTIONS ---

const getDb = async () => {
    if (!dbPool) {
        throw new Error("Database not connected. Pool is null. Please configure Data Source.");
    }
    return dbPool;
};

// Convert snake_case DB rows to camelCase JS objects
const mapToCamel = (row) => {
    if (!row) return null;
    const newRow = {};
    for (const key in row) {
        const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        
        // Auto-parse known JSON columns
        if (['galleryImages', 'documents', 'items', 'permissions', 'quote', 'production', 'bomConfig', 'statusLog'].includes(camelKey) || key.endsWith('_json')) {
            try {
                const finalKey = key.endsWith('_json') ? camelKey.replace('Json', '') : camelKey;
                newRow[finalKey] = (typeof row[key] === 'string') ? JSON.parse(row[key]) : (row[key] || []);
            } catch (e) {
                const finalKey = key.endsWith('_json') ? camelKey.replace('Json', '') : camelKey;
                newRow[finalKey] = [];
            }
        } else {
            newRow[camelKey] = row[key];
        }
    }
    return newRow;
};

// --- AUTH MIDDLEWARE ---
const requireAuth = async (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    const path = req.originalUrl || req.url;
    const cleanPath = path.split('?')[0];

    // Whitelist public/setup endpoints and storage
    if (cleanPath.endsWith('/api/health') || 
        cleanPath.endsWith('/api/config') || 
        cleanPath.endsWith('/api/init') || 
        cleanPath.endsWith('/api/handshake') ||
        cleanPath.startsWith('/storage')) { 
        return next();
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        SystemLogger.auth(`Missing Auth Header for ${cleanPath}`, { key: 'missing' });
        return res.status(401).json({ success: false, message: 'Missing Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const maskedKey = token.length > 8 ? token.substring(0,8) + '...' : token;

    if (token === BOOTSTRAP_KEY) {
        const remoteIp = req.socket.remoteAddress;
        const isLocal = remoteIp === '::1' || remoteIp === '127.0.0.1' || remoteIp === '::ffff:127.0.0.1';
        
        if (!isLocal) {
            SystemLogger.auth(`Blocked remote Admin access from ${remoteIp}`, { key: 'admin_attempt' });
            return res.status(403).json({ success: false, message: 'Security Alert: Admin Key is restricted to Localhost only.' });
        }
        return next();
    }

    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM api_keys WHERE token = ? AND status = 'active'", [token]);
        
        if (rows.length === 0) {
            SystemLogger.auth(`Invalid API Key used`, { key: maskedKey, path: cleanPath });
            return res.status(401).json({ success: false, message: 'Invalid or Revoked API Key' });
        }
        next();
    } catch (e) {
        const errorDetails = {
            message: e.message,
            sqlCode: e.code,
            syscall: e.syscall,
            path: cleanPath,
            maskedKey: maskedKey,
            dbConnected: !!dbPool
        };
        SystemLogger.error(`Auth Check Failed for ${cleanPath}`, errorDetails);
        if (e.message.includes('Database not connected')) return res.status(503).json({ success: false, message: 'Database Service Unavailable: Not Connected' });
        if (e.code === 'ECONNREFUSED') return res.status(503).json({ success: false, message: 'Database Connection Refused. Check MySQL Server.' });
        return res.status(500).json({ success: false, message: 'Auth System Error: ' + e.message });
    }
};

app.use('/api', requireAuth);

// --- UPLOAD ENDPOINT ---
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file provided' });
    }

    // FIX: Solve Chinese filename garbled code issue (Latin1 to UTF8)
    let originalName = req.file.originalname;
    try {
        // Multer/Node often parses non-ASCII headers as Latin1 by default
        // We explicitly convert the buffer back to UTF8 to restore Chinese characters
        originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    } catch (e) {
        // Fallback to original if conversion fails
    }

    let dbName = 'default';
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
            name: originalName, // Use the corrected name
            url: fileUrl,
            type: req.file.mimetype,
            size: req.file.size,
            uploadDate: new Date().toISOString()
        }
    });
});


// --- SYSTEM ENDPOINTS ---

app.get('/api/admin/logs', async (req, res) => {
    res.json({ success: true, data: systemLogs });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'online', db: dbPool ? 'connected' : 'disconnected' });
});

app.get('/api/test-connection', (req, res) => {
    res.json({ success: true, message: 'Connection Successful', timestamp: new Date().toISOString() });
});

app.post('/api/config', async (req, res) => {
    const { host, port, user, password, database } = req.body; 
    const dbUser = user || req.body.username || 'root';
    
    SystemLogger.info(`Reconfiguring Database connection to ${host}:${port}/${database}`);

    try {
        if (dbPool) await dbPool.end();
        const tempPool = mysql.createPool({
            host, port: parseInt(port), user: dbUser, password, database,
            waitForConnections: true, connectionLimit: 10, connectTimeout: 5000,
            decimalNumbers: true // Fix for string/number calculations
        });
        const conn = await tempPool.getConnection();
        await conn.ping();
        conn.release();
        dbPool = tempPool;
        SystemLogger.info('Database Connection Established Successfully');
        res.json({ success: true, message: 'Connected to Database' });
    } catch (e) {
        SystemLogger.error('Database Connection Failed', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/handshake', async (req, res) => {
    try {
        if (!dbPool) return res.status(503).json({ success: false, message: 'Database not connected' });
        const pool = await getDb();
        const [rows] = await pool.query("SELECT token FROM api_keys WHERE status = 'active' LIMIT 1");
        if (rows.length > 0) return res.json({ success: true, token: rows[0].token });
        
        const token = 'sk-' + crypto.randomBytes(8).toString('hex');
        const id = Date.now(); // Integer ID
        await pool.query("INSERT INTO api_keys (id, name, token, status) VALUES (?,?,?,?)", [id, 'Auto-Frontend', token, 'active']);
        
        SystemLogger.info('Generated new Auto-Frontend API Key', { key: token.substring(0,8) + '...' });
        return res.json({ success: true, token });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/init', async (req, res) => {
    if (!dbPool) return res.status(400).json({ success: false, message: 'DB not connected' });
    
    SystemLogger.warn('INITIALIZATION STARTED: Dropping tables...');
    
    try {
        const conn = await dbPool.getConnection();
        await conn.beginTransaction();

        // FIX: Using BIGINT for ID to support Date.now()
        const tables = [
            `DROP TABLE IF EXISTS quote_items`,
            `DROP TABLE IF EXISTS boms`,
            `DROP TABLE IF EXISTS product_boms`, // New Table drop
            `DROP TABLE IF EXISTS products`,
            `DROP TABLE IF EXISTS product_types`,
            `DROP TABLE IF EXISTS quotes`,
            `DROP TABLE IF EXISTS roles`,
            `DROP TABLE IF EXISTS users`,
            `DROP TABLE IF EXISTS settings`,
            `DROP TABLE IF EXISTS api_keys`,

            `CREATE TABLE api_keys (id BIGINT PRIMARY KEY, name VARCHAR(100), token VARCHAR(255), status VARCHAR(20), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
            
            `CREATE TABLE product_types (id BIGINT PRIMARY KEY, name VARCHAR(100), level INT, color VARCHAR(50))`,
            
            // CHANGED: id is BIGINT to hold Date.now(). base_price is DECIMAL. base_image is LONGTEXT.
            `CREATE TABLE products (
                id BIGINT PRIMARY KEY, material_code VARCHAR(100), unit VARCHAR(20), name VARCHAR(255), 
                description TEXT, specifications TEXT, type INT, category VARCHAR(100), 
                cost DECIMAL(15,2), base_price DECIMAL(15,2), inventory INT, 
                base_image LONGTEXT,
                gallery_images_json LONGTEXT, documents_json LONGTEXT
            )`,
            
            // Auxiliary BOMs (Standalone) - UPDATED with specifications, description AND category
            `CREATE TABLE boms (id BIGINT PRIMARY KEY, name VARCHAR(255), specifications TEXT, description TEXT, category VARCHAR(100), items_json LONGTEXT)`,
            
            // Product BOMs (Attached to Product ID)
            `CREATE TABLE product_boms (product_id BIGINT PRIMARY KEY, items_json LONGTEXT)`,
            
            `CREATE TABLE quotes (
                id BIGINT PRIMARY KEY, customer_name VARCHAR(255), date DATETIME, status VARCHAR(50), 
                subtotal DECIMAL(15,2), tax DECIMAL(15,2), grand_total DECIMAL(15,2), items_json LONGTEXT, ai_analysis TEXT,
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
        for (const p of SEED_PRODUCTS) {
            await conn.query(`INSERT INTO products (id, material_code, unit, name, description, specifications, type, category, cost, base_price, inventory, base_image, gallery_images_json, documents_json) 
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
                [p.id, p.materialCode, p.unit, p.name, p.description, p.specifications, p.type, p.category, p.cost, p.basePrice, p.inventory, p.baseImage, JSON.stringify(p.galleryImages), JSON.stringify(p.documents)]);
        }
        for (const r of SEED_ROLES) await conn.query("INSERT INTO roles VALUES (?,?,?,?,?)", [r.id, r.name, r.description, r.isSystem, JSON.stringify(r.permissions)]);
        for (const u of SEED_USERS) await conn.query(`INSERT INTO users (id, username, name, email, role, employee_id, avatar, auth_provider, password, last_login) 
            VALUES (?,?,?,?,?,?,?,?,?,?)`, [u.id, u.username, u.name, u.email, u.role, u.employeeId, u.avatar, u.authProvider, 'admin', new Date()]);
        
        await conn.query("INSERT INTO settings VALUES (?,?,?)", ['global', 
            JSON.stringify(SEED_SETTINGS.quote), 
            JSON.stringify(SEED_SETTINGS.production)
        ]);
        
        //const defaultToken = 'sk-default-' + crypto.randomBytes(4).toString('hex');
        const defaultToken = 'sk-6aba53907cd2adc4';
        await conn.query("INSERT INTO api_keys (id, name, token, status) VALUES (?,?,?,?)", [1, 'Default Key', defaultToken, 'active']);

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

// --- DATA ENDPOINTS ---

// 1. PRODUCTS
app.get('/api/products', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM products");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/products', async (req, res) => {
    const p = req.body;
    
    // Generate BIGINT ID
    const newId = Date.now();
    try {
        const pool = await getDb();
        const sql = `INSERT INTO products (id, material_code, unit, name, description, specifications, type, category, cost, base_price, inventory, base_image, gallery_images_json, documents_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
        const params = [
            newId, 
            p.materialCode, 
            p.unit, 
            p.name, 
            p.description, 
            p.specifications, 
            p.type, 
            p.category, 
            p.cost || 0, 
            p.basePrice || 0, 
            p.inventory || 0, 
            p.baseImage || '', 
            JSON.stringify(p.galleryImages || []), 
            JSON.stringify(p.documents || [])
        ];
        
        await pool.query(sql, params);
        res.json({ success: true, data: { ...p, id: newId } });
    } catch (e) { 
        console.error("Insert Product Error:", e);
        res.status(500).json({ success: false, message: e.message }); 
    }
});

app.put('/api/products/:id', async (req, res) => {
    const p = req.body;
    try {
        const pool = await getDb();
        const sql = `UPDATE products SET material_code=?, unit=?, name=?, description=?, specifications=?, type=?, category=?, cost=?, base_price=?, inventory=?, base_image=?, gallery_images_json=?, documents_json=? WHERE id=?`;
        const params = [p.materialCode, p.unit, p.name, p.description, p.specifications, p.type, p.category, p.cost, p.basePrice, p.inventory, p.baseImage || '', JSON.stringify(p.galleryImages || []), JSON.stringify(p.documents || []), req.params.id];
        await pool.query(sql, params);
        res.json({ success: true, data: p });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const pool = await getDb();
        // Also delete associated product BOM
        await pool.query("DELETE FROM products WHERE id=?", [req.params.id]);
        await pool.query("DELETE FROM product_boms WHERE product_id=?", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 2. TYPES
app.get('/api/types', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM product_types ORDER BY level ASC");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/types', async (req, res) => {
    const t = req.body;
    const newId = Date.now();
    try {
        const pool = await getDb();
        await pool.query("INSERT INTO product_types VALUES (?,?,?,?)", [newId, t.name, t.level, t.color]);
        res.json({ success: true, data: { ...t, id: newId } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/types/:id', async (req, res) => {
    const t = req.body;
    try {
        const pool = await getDb();
        await pool.query("UPDATE product_types SET name=?, level=?, color=? WHERE id=?", [t.name, t.level, t.color, req.params.id]);
        res.json({ success: true, data: t });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/types/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query("DELETE FROM product_types WHERE id=?", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 3. AUXILIARY BOMs (Table: boms)
app.get('/api/boms', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM boms");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/boms', async (req, res) => {
    const b = req.body;
    const newId = Date.now();
    try {
        const pool = await getDb();
        // Auxiliary BOMs now include category
        await pool.query("INSERT INTO boms (id, name, specifications, description, category, items_json) VALUES (?,?,?,?,?,?)", [newId, b.name, b.specifications || '', b.description || '', b.category || '', JSON.stringify(b.items)]);
        res.json({ success: true, data: { ...b, id: newId } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/boms/:id', async (req, res) => {
    const b = req.body;
    try {
        const pool = await getDb();
        await pool.query("UPDATE boms SET name=?, specifications=?, description=?, category=?, items_json=? WHERE id=?", [b.name, b.specifications || '', b.description || '', b.category || '', JSON.stringify(b.items), req.params.id]);
        res.json({ success: true, data: b });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/boms/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query("DELETE FROM boms WHERE id=?", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 3.1 PRODUCT BOMs (Table: product_boms)
app.get('/api/product-boms', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM product_boms");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/product-boms/:productId', async (req, res) => {
    const { items } = req.body;
    const productId = req.params.productId;
    try {
        const pool = await getDb();
        // Insert or Update on Duplicate Key
        const sql = `INSERT INTO product_boms (product_id, items_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE items_json = VALUES(items_json)`;
        await pool.query(sql, [productId, JSON.stringify(items)]);
        res.json({ success: true, data: { productId: Number(productId), items } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 4. QUOTES
app.get('/api/quotes', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM quotes ORDER BY date DESC");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/quotes', async (req, res) => {
    const q = req.body;
    const newId = Date.now();
    try {
        const pool = await getDb();
        // Ensure statusLog is max 20 items
        const rawLog = q.statusLog || [];
        const truncatedLog = rawLog.slice(0, 20);

        const sql = `INSERT INTO quotes (id, customer_name, date, status, items_json, subtotal, tax, grand_total, ai_analysis, status_log_json) VALUES (?,?,?,?,?,?,?,?,?,?)`;
        await pool.query(sql, [newId, q.customerName, new Date(q.date), q.status, JSON.stringify(q.items), q.subtotal, q.tax, q.grandTotal, q.aiAnalysis || '', JSON.stringify(truncatedLog)]);
        res.json({ success: true, data: { ...q, id: newId, statusLog: truncatedLog } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/quotes/:id', async (req, res) => {
    const q = req.body;
    try {
        const pool = await getDb();
        // Ensure statusLog is max 20 items
        const rawLog = q.statusLog || [];
        const truncatedLog = rawLog.slice(0, 20);

        const sql = `UPDATE quotes SET customer_name=?, status=?, items_json=?, subtotal=?, tax=?, grand_total=?, ai_analysis=?, status_log_json=? WHERE id=?`;
        await pool.query(sql, [q.customerName, q.status, JSON.stringify(q.items), q.subtotal, q.tax, q.grand_total, q.aiAnalysis || '', JSON.stringify(truncatedLog), req.params.id]);
        res.json({ success: true, data: { ...q, statusLog: truncatedLog } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/quotes/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query("DELETE FROM quotes WHERE id=?", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 5. USERS
app.get('/api/users', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM users");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/users', async (req, res) => {
    const u = req.body;
    const newId = Date.now();
    try {
        const pool = await getDb();
        const sql = `INSERT INTO users (id, username, name, email, role, employee_id, title, department, avatar, auth_provider, password, last_login) VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
        await pool.query(sql, [newId, u.username, u.name, u.email, u.role, u.employee_id, u.title, u.department, u.avatar, u.authProvider, u.password || '123456', new Date()]);
        res.json({ success: true, data: { ...u, id: newId } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/users/:id', async (req, res) => {
    const u = req.body;
    try {
        const pool = await getDb();
        const sql = `UPDATE users SET name=?, email=?, role=?, employee_id=?, title=?, department=?, avatar=? WHERE id=?`;
        await pool.query(sql, [u.name, u.email, u.role, u.employeeId, u.title, u.department, u.avatar, req.params.id]);
        res.json({ success: true, data: u });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query("DELETE FROM users WHERE id=?", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 6. ROLES
app.get('/api/roles', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM roles");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/roles', async (req, res) => {
    const r = req.body;
    const newId = Date.now();
    try {
        const pool = await getDb();
        await pool.query("INSERT INTO roles VALUES (?,?,?,?,?)", [newId, r.name, r.description, r.isSystem, JSON.stringify(r.permissions)]);
        res.json({ success: true, data: { ...r, id: newId } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/roles/:id', async (req, res) => {
    const r = req.body;
    try {
        const pool = await getDb();
        await pool.query("UPDATE roles SET name=?, description=?, permissions_json=? WHERE id=?", [r.name, r.description, JSON.stringify(r.permissions), req.params.id]);
        res.json({ success: true, data: r });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/roles/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query("DELETE FROM roles WHERE id=?", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 7. SETTINGS
app.get('/api/settings/templates', async (req, res) => {
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

app.put('/api/settings/templates', async (req, res) => {
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

// 8. API KEYS
app.get('/api/keys', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM api_keys ORDER BY created_at DESC");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/keys', async (req, res) => {
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

app.delete('/api/keys/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query("DELETE FROM api_keys WHERE id = ?", [req.params.id]);
        SystemLogger.warn(`API Key Revoked: ${req.params.id}`);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// --- SERVER START ---
const startServer = (port) => {
    const server = app.listen(port, '0.0.0.0', () => {
        const msg = `CloudCPQ Backend Server running on port ${port}`;
        SystemLogger.info(msg);
        console.log(`\n=========================================================`);
        console.log(msg);
        console.log(` URL: http://localhost:${port}`);
        console.log(` Storage: ${BUCK_ROOT}`);
        console.log(` Bootstrap API Key: ${BOOTSTRAP_KEY}`);
        console.log(` Admin Access Restricted to Localhost`);
        console.log(`=========================================================\n`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            SystemLogger.warn(`Port ${port} is busy. Trying ${port + 1}...`);
            startServer(port + 1);
        } else {
            SystemLogger.error('Fatal Server Error', err);
            console.error('Server error:', err);
        }
    });
};

startServer(PORT);
