
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const SystemLogger = require('../utils/logger');
const { getPool } = require('../utils/db');

const BUCK_ROOT = process.env.BUCK_ROOT || path.join(__dirname, '../../BUCK'); 

const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        let dbName = 'default';
        try {
            const dbPool = getPool();
            if (dbPool && dbPool.pool && dbPool.pool.config && dbPool.pool.config.connectionConfig) {
                dbName = dbPool.pool.config.connectionConfig.database;
            } else if (req.query.db) {
                dbName = req.query.db;
            }
        } catch (e) {
            console.error('Error determining DB name for folder:', e);
        }

        const dateFolder = new Date().toISOString().slice(0, 7);
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
        const id = req.body.id || Date.now();
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const filename = `${id}TL${cleanName}`;
        cb(null, filename);
    }
});

const upload = multer({ storage: storage });
module.exports = { upload, BUCK_ROOT };
