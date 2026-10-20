const express = require('express');
const router = express.Router();
const { query, execute } = require('../database');

// GET all inventory items
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let sql = `
      SELECT 
        i.ItemID AS item_id,
        i.ItemID,
        i.ItemName AS item_name,
        i.ItemName AS name,
        i.ItemName,
        i.Category AS category,
        i.Category,
        i.Unit AS unit,
        i.Unit,
        COALESCE((SELECT SUM(p.Quantity) FROM PROCURES p WHERE p.ItemID = i.ItemID), 0) AS quantity,
        100 AS min_required_quantity,
        0 AS is_low_stock
      FROM INVENTORY_ITEM i
      WHERE 1=1
    `;
    const params = [];

    if (category && category.trim()) {
      sql += ` AND i.Category = ?`;
      params.push(category.trim());
    }
    if (search && search.trim()) {
      sql += ` AND (i.ItemName LIKE ? OR i.Category LIKE ?)`;
      const s = `%${search.trim()}%`;
      params.push(s, s);
    }

    sql += ` ORDER BY i.Category ASC, i.ItemName ASC`;

    const rows = await query(sql, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single inventory item
router.get('/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    const rows = await query(`
      SELECT 
        i.ItemID AS item_id,
        i.ItemID,
        i.ItemName AS item_name,
        i.ItemName AS name,
        i.ItemName,
        i.Category AS category,
        i.Category,
        i.Unit AS unit,
        i.Unit,
        COALESCE((SELECT SUM(p.Quantity) FROM PROCURES p WHERE p.ItemID = i.ItemID), 0) AS quantity,
        100 AS min_required_quantity
      FROM INVENTORY_ITEM i
      WHERE i.ItemID = ?
    `, [itemId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const item = rows[0];
    const procurements = await query(`
      SELECT p.MessID, p.SupplierID, p.ItemID, p.Quantity as quantity, s.SupplierName as supplier_name
      FROM PROCURES p
      JOIN SUPPLIER s ON p.SupplierID = s.SupplierID
      WHERE p.ItemID = ?
    `, [itemId]);

    res.json({ success: true, data: { ...item, procurements } });
  } catch (error) {
    console.error('Error fetching inventory item by ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create inventory item
router.post('/', async (req, res) => {
  try {
    const { ItemID, item_id, ItemName, item_name, name, Category, category, Unit, unit } = req.body;
    const finalId = ItemID || item_id || ('IT' + (100 + Math.floor(Math.random() * 900)));
    const finalName = ItemName || item_name || name;

    if (!finalName) {
      return res.status(400).json({ success: false, message: 'Item name is required' });
    }

    await execute(`
      INSERT INTO INVENTORY_ITEM (ItemID, ItemName, Category, Unit)
      VALUES (?, ?, ?, ?)
    `, [finalId, finalName, Category || category || 'General', Unit || unit || 'Kg']);

    res.status(201).json({ success: true, message: 'Item created successfully', itemId: finalId });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update inventory item
router.put('/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    const body = req.body || {};

    const existingRows = await query(`SELECT * FROM INVENTORY_ITEM WHERE ItemID = ?`, [itemId]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    const existing = existingRows[0];

    await execute(`
      UPDATE INVENTORY_ITEM SET
        ItemName = ?, Category = ?, Unit = ?
      WHERE ItemID = ?
    `, [
      body.ItemName || body.item_name || body.name || existing.ItemName,
      body.Category || body.category || existing.Category,
      body.Unit || body.unit || existing.Unit,
      itemId
    ]);

    res.json({ success: true, message: 'Item updated successfully' });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE inventory item
router.delete('/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    await execute(`DELETE FROM INVENTORY_ITEM WHERE ItemID = ?`, [itemId]);
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
