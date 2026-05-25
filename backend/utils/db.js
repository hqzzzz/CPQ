
const mysql = require('mysql2/promise');
const SystemLogger = require('./logger');

let dbPool = null;

const getDb = async () => {
    if (!dbPool) {
        throw new Error("Database not connected. Pool is null. Please configure Data Source.");
    }
    return dbPool;
};

const configureDb = async (config) => {
    const { host, port, user, password, database } = config;
    const dbUser = user || config.username || 'root';

    SystemLogger.info(`Reconfiguring Database connection to ${host}:${port}/${database}`);

    if (dbPool) await dbPool.end();
    const tempPool = mysql.createPool({
        host, port: parseInt(port), user: dbUser, password, database,
        waitForConnections: true, connectionLimit: 10, connectTimeout: 5000,
        decimalNumbers: true
    });
    const conn = await tempPool.getConnection();
    await conn.ping();
    conn.release();
    dbPool = tempPool;
    SystemLogger.info('Database Connection Established Successfully');
    return true;
};

const getPool = () => dbPool;

// Auto-initialize database from environment variables
const autoInitDb = async () => {
    const envConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || '3306',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'cpq'
    };
    
    if (process.env.DB_HOST || process.env.DB_USER || process.env.DB_PASSWORD || process.env.DB_NAME) {
        try {
            SystemLogger.info('Auto-initializing database from environment variables...');
            await configureDb(envConfig);
            SystemLogger.info('Database auto-initialization complete');
            return true;
        } catch (err) {
            SystemLogger.warn(`Database auto-initialization failed: ${err.message}`);
            SystemLogger.info('Server will start but database functionality will be unavailable');
            return false;
        }
    }
    return false;
};

module.exports = { getDb, configureDb, getPool, autoInitDb };
