
const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/db');
const { mapToCamel } = require('../utils/helpers');

// PRODUCTS
router.get('/products', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM products");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/products', async (req, res) => {
    const p = req.body;
    const newId = Date.now();
    try {
        const pool = await getDb();
        const sql = `INSERT INTO products (id, material_code, unit, name, description, specifications, type, category, cost, base_price, inventory, base_image, gallery_images_json, documents_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
        const params = [
            newId, p.materialCode, p.unit, p.name, p.description, p.specifications, p.type, p.category, 
            p.cost || 0, p.basePrice || 0, p.inventory || 0, p.baseImage || '', 
            JSON.stringify(p.galleryImages || []), JSON.stringify(p.documents || [])
        ];
        await pool.query(sql, params);
        res.json({ success: true, data: { ...p, id: newId } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/products/:id', async (req, res) => {
    const p = req.body;
    try {
        const pool = await getDb();
        const sql = `UPDATE products SET material_code=?, unit=?, name=?, description=?, specifications=?, type=?, category=?, cost=?, base_price=?, inventory=?, base_image=?, gallery_images_json=?, documents_json=? WHERE id=?`;
        const params = [p.materialCode, p.unit, p.name, p.description, p.specifications, p.type, p.category, p.cost, p.basePrice, p.inventory, p.baseImage || '', JSON.stringify(p.galleryImages || []), JSON.stringify(p.documents || []), req.params.id];
        await pool.query(sql, params);
        res.json({ success: true, data: p });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/products/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query("DELETE FROM products WHERE id=?", [req.params.id]);
        await pool.query("DELETE FROM product_boms WHERE product_id=?", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// TYPES
router.get('/types', async (req, res) => {
    try {
        const pool = await getDb();
        const [rows] = await pool.query("SELECT * FROM product_types ORDER BY level ASC");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/types', async (req, res) => {
    const t = req.body;
    const newId = Date.now();
    try {
        const pool = await getDb();
        await pool.query("INSERT INTO product_types VALUES (?,?,?,?)", [newId, t.name, t.level, t.color]);
        res.json({ success: true, data: { ...t, id: newId } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/types/:id', async (req, res) => {
    const t = req.body;
    try {
        const pool = await getDb();
        await pool.query("UPDATE product_types SET name=?, level=?, color=? WHERE id=?", [t.name, t.level, t.color, req.params.id]);
        res.json({ success: true, data: t });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/types/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query("DELETE FROM product_types WHERE id=?", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// CATEGORIES
router.get('/categories', async (req, res) => {
    try {
        const pool = await getDb();
        // Sort by sort_order ASC
        const [rows] = await pool.query("SELECT * FROM product_categories ORDER BY sort_order ASC");
        res.json({ success: true, data: rows.map(mapToCamel) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/categories', async (req, res) => {
    const c = req.body;
    const newId = Date.now();
    try {
        const pool = await getDb();
        // Default sort_order to 0 if not provided, or better yet, default to max+1? 
        // For simplicity, default 0 or provided value.
        await pool.query("INSERT INTO product_categories (id, name, sort_order) VALUES (?,?,?)", [newId, c.name, c.sortOrder || 0]);
        res.json({ success: true, data: { ...c, id: newId } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/categories/reorder', async (req, res) => {
    const categories = req.body; // Expect array of {id, sortOrder}
    if (!Array.isArray(categories)) return res.status(400).json({ success: false, message: 'Invalid data' });
    
    try {
        const pool = await getDb();
        const conn = await pool.getConnection();
        await conn.beginTransaction();
        try {
            for (const cat of categories) {
                await conn.query("UPDATE product_categories SET sort_order=? WHERE id=?", [cat.sortOrder, cat.id]);
            }
            await conn.commit();
            res.json({ success: true });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/categories/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query("DELETE FROM product_categories WHERE id=?", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
