
const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/db');
const { mapToCamel } = require('../utils/helpers');

router.get('/quotes', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM quotes ORDER BY date DESC");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/quotes', async (req, res) => {
    const q = req.body;
    const newId = Date.now();
    try {
        const pool = await getDb();
        const rawLog = q.statusLog || [];
        const truncatedLog = rawLog.slice(0, 20);

        const sql = `INSERT INTO quotes (id, customer_name, date, status, items_json, subtotal, tax, grand_total, ai_analysis, status_log_json) VALUES (?,?,?,?,?,?,?,?,?,?)`;
        await pool.query(sql, [newId, q.customerName, new Date(q.date), q.status, JSON.stringify(q.items), q.subtotal, q.tax, q.grand_total, q.aiAnalysis || '', JSON.stringify(truncatedLog)]);
        res.json({ success: true, data: { ...q, id: newId, statusLog: truncatedLog } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/quotes/:id', async (req, res) => {
    const q = req.body;
    try {
        const pool = await getDb();
        const rawLog = q.statusLog || [];
        const truncatedLog = rawLog.slice(0, 20);

        const sql = `UPDATE quotes SET customer_name=?, status=?, items_json=?, subtotal=?, tax=?, grand_total=?, ai_analysis=?, status_log_json=? WHERE id=?`;
        await pool.query(sql, [q.customerName, q.status, JSON.stringify(q.items), q.subtotal, q.tax, q.grand_total, q.aiAnalysis || '', JSON.stringify(truncatedLog), req.params.id]);
        res.json({ success: true, data: { ...q, statusLog: truncatedLog } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/quotes/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query("DELETE FROM quotes WHERE id=?", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
