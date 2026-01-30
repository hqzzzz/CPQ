
const systemLogs = [];
const MAX_LOGS = 500;

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
        
        const color = level === 'ERROR' ? '\x1b[31m' : level === 'WARN' ? '\x1b[33m' : level === 'HTTP' ? '\x1b[36m' : '\x1b[32m';
        console.log(`${color}[${level}] ${message}\x1b[0m`);
        if (details && level === 'ERROR') console.error(details);
    },
    info: (msg, details) => SystemLogger.add('INFO', msg, details),
    warn: (msg, details) => SystemLogger.add('WARN', msg, details),
    error: (msg, err) => SystemLogger.add('ERROR', msg, typeof err === 'object' ? { message: err.message, stack: err.stack, code: err.code, ...err } : err),
    http: (msg) => SystemLogger.add('HTTP', msg),
    auth: (msg, details) => SystemLogger.add('AUTH', msg, details),
    getLogs: () => systemLogs
};

module.exports = SystemLogger;
