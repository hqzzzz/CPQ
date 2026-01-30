
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

module.exports = { getDb, configureDb, getPool };
