
const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/db');
const { mapToCamel } = require('../utils/helpers');

// AUXILIARY BOMs
router.get('/boms', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM boms");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/boms', async (req, res) => {
    const b = req.body;
    const newId = Date.now();
    try {
        const pool = await getDb();
        await pool.query("INSERT INTO boms (id, name, specifications, description, category, base_image, items_json) VALUES (?,?,?,?,?,?,?)", 
            [newId, b.name, b.specifications || '', b.description || '', b.category || '', b.baseImage || '', JSON.stringify(b.items)]);
        res.json({ success: true, data: { ...b, id: newId } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/boms/:id', async (req, res) => {
    const b = req.body;
    try {
        const pool = await getDb();
        await pool.query("UPDATE boms SET name=?, specifications=?, description=?, category=?, base_image=?, items_json=? WHERE id=?", 
            [b.name, b.specifications || '', b.description || '', b.category || '', b.baseImage || '', JSON.stringify(b.items), req.params.id]);
        res.json({ success: true, data: b });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/boms/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query("DELETE FROM boms WHERE id=?", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PRODUCT BOMs
router.get('/product-boms', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM product_boms");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/product-boms/:productId', async (req, res) => {
    const { items } = req.body;
    const productId = req.params.productId;
    try {
        const pool = await getDb();
        const sql = `INSERT INTO product_boms (product_id, items_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE items_json = VALUES(items_json)`;
        await pool.query(sql, [productId, JSON.stringify(items)]);
        res.json({ success: true, data: { productId: Number(productId), items } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
