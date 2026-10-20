const express = require('express');
const router = express.Router();
const { query, execute } = require('../database');

// GET all procurements
router.get('/', async (req, res) => {
  try {
    const { supplier_id, item_id, mess_id } = req.query;
    let sql = `
      SELECT 
        CONCAT(p.MessID, '-', p.SupplierID, '-', p.ItemID) AS procure_id,
        p.MessID AS mess_id,
        p.MessID,
        m.MessName AS mess_name,
        p.SupplierID AS supplier_id,
        p.SupplierID,
        s.SupplierName AS supplier_name,
        p.ItemID AS item_id,
        p.ItemID,
        i.ItemName AS item_name,
        i.Category AS item_category,
        i.Unit AS item_unit,
        p.Quantity AS quantity,
        p.Quantity,
        (p.Quantity * 100) AS total_cost,
        'Completed' AS status
      FROM PROCURES p
      JOIN MESS m ON p.MessID = m.MessID
      JOIN SUPPLIER s ON p.SupplierID = s.SupplierID
      JOIN INVENTORY_ITEM i ON p.ItemID = i.ItemID
      WHERE 1=1
    `;
    const params = [];

    if (supplier_id && supplier_id.trim()) {
      sql += ` AND p.SupplierID = ?`;
      params.push(supplier_id.trim());
    }
    if (item_id && item_id.trim()) {
      sql += ` AND p.ItemID = ?`;
      params.push(item_id.trim());
    }
    if (mess_id && mess_id.trim()) {
      sql += ` AND p.MessID = ?`;
      params.push(mess_id.trim());
    }

    sql += ` ORDER BY p.MessID ASC, p.SupplierID ASC`;

    const rows = await query(sql, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Error fetching procurements:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create procurement
router.post('/', async (req, res) => {
  try {
    const { MessID, mess_id, SupplierID, supplier_id, ItemID, item_id, Quantity, quantity } = req.body;
    const finalMessId = MessID || mess_id;
    const finalSupplierId = SupplierID || supplier_id;
    const finalItemId = ItemID || item_id;
    const finalQty = Number(Quantity !== undefined ? Quantity : (quantity || 10));

    if (!finalMessId || !finalSupplierId || !finalItemId) {
      return res.status(400).json({ success: false, message: 'MessID, SupplierID, and ItemID are required' });
    }

    await execute(`
      INSERT INTO PROCURES (MessID, SupplierID, ItemID, Quantity)
      VALUES (?, ?, ?, ?)
    `, [finalMessId, finalSupplierId, finalItemId, finalQty]);

    res.status(201).json({ success: true, message: 'Procurement recorded successfully' });
  } catch (error) {
    console.error('Error recording procurement:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE procurement
router.delete('/', async (req, res) => {
  try {
    const { MessID, mess_id, SupplierID, supplier_id, ItemID, item_id } = req.query;
    const finalMessId = MessID || mess_id;
    const finalSupplierId = SupplierID || supplier_id;
    const finalItemId = ItemID || item_id;

    if (!finalMessId || !finalSupplierId || !finalItemId) {
      return res.status(400).json({ success: false, message: 'MessID, SupplierID, and ItemID parameters are required' });
    }

    await execute(`
      DELETE FROM PROCURES WHERE MessID = ? AND SupplierID = ? AND ItemID = ?
    `, [finalMessId, finalSupplierId, finalItemId]);

    res.json({ success: true, message: 'Procurement removed successfully' });
  } catch (error) {
    console.error('Error deleting procurement:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
