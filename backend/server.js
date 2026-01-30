
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const path = require('path');

const SystemLogger = require('./utils/logger');
const { requireAuth, setBootstrapKey } = require('./middleware/auth');
const { BUCK_ROOT } = require('./middleware/upload');

// Routers
const productsRouter = require('./routes/products');
const bomsRouter = require('./routes/boms');
const quotesRouter = require('./routes/quotes');
const usersRouter = require('./routes/users');
const systemRouter = require('./routes/system');
const authRouter = require('./routes/auth'); // Import Auth Router

const app = express();
let PORT = process.env.PORT ? parseInt(process.env.PORT) : 3002;

// --- CONFIGURATION ---
const BOOTSTRAP_KEY = 'sk-admin-' + crypto.randomBytes(6).toString('hex');
setBootstrapKey(BOOTSTRAP_KEY); // Pass to middleware

app.use(cors({
    origin: function (origin, callback) {
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Version'],
    credentials: true
}));

app.use(bodyParser.json({ limit: '50mb' }));

// Request Logger
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        SystemLogger.http(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// Static Files
app.use('/storage', express.static(BUCK_ROOT));

// Auth Middleware applied to /api
// Note: We need to exempt OAuth login routes from requireAuth inside the router itself or here.
// For simplicity, we apply requireAuth generally but the authRouter handles its own public paths.
app.use('/api', requireAuth);

// Routes
app.use('/api', productsRouter);
app.use('/api', bomsRouter);
app.use('/api', quotesRouter);
app.use('/api', usersRouter);
app.use('/api', systemRouter);
app.use('/api', authRouter); // Register Auth Router

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
