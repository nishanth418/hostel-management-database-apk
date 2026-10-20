const express = require('express');
const router = express.Router();
const { query, execute } = require('../database');

// GET all suppliers with phone numbers
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `
      SELECT 
        s.SupplierID AS supplier_id,
        s.SupplierID,
        s.SupplierName AS name,
        s.SupplierName AS supplier_name,
        s.SupplierName,
        'Provisions' AS category,
        GROUP_CONCAT(sp.PhoneNo, ', ') AS phone_numbers,
        (SELECT COUNT(*) FROM PROCURES p WHERE p.SupplierID = s.SupplierID) AS total_orders,
        COALESCE((SELECT SUM(p.Quantity * 100) FROM PROCURES p WHERE p.SupplierID = s.SupplierID), 0) AS total_procured_value
      FROM SUPPLIER s
      LEFT JOIN SUPPLIER_PHONE sp ON s.SupplierID = sp.SupplierID
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      sql += ` AND s.SupplierName LIKE ?`;
      params.push(`%${search.trim()}%`);
    }

    sql += ` GROUP BY s.SupplierID, s.SupplierName ORDER BY s.SupplierName ASC`;

    const rows = await query(sql, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single supplier
router.get('/:id', async (req, res) => {
  try {
    const supplierId = req.params.id;
    const rows = await query(`
      SELECT 
        SupplierID AS supplier_id,
        SupplierID,
        SupplierName AS name,
        SupplierName AS supplier_name,
        SupplierName,
        'Provisions' AS category
      FROM SUPPLIER 
      WHERE SupplierID = ?
    `, [supplierId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const supplier = rows[0];
    const phoneRows = await query(`SELECT PhoneNo as phone_number FROM SUPPLIER_PHONE WHERE SupplierID = ?`, [supplierId]);
    const phones = phoneRows.map(p => p.phone_number);
    const procurements = await query(`
      SELECT p.MessID, p.SupplierID, p.ItemID, p.Quantity as quantity, i.ItemName as item_name, i.Unit as unit
      FROM PROCURES p
      JOIN INVENTORY_ITEM i ON p.ItemID = i.ItemID
      WHERE p.SupplierID = ?
    `, [supplierId]);

    res.json({ success: true, data: { ...supplier, phones, procurements } });
  } catch (error) {
    console.error('Error fetching supplier by ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create supplier
router.post('/', async (req, res) => {
  try {
    const { SupplierID, supplier_id, SupplierName, supplier_name, name, phones } = req.body;
    const finalId = SupplierID || supplier_id || ('SUP' + (Math.floor(Math.random() * 90) + 10));
    const finalName = SupplierName || supplier_name || name;
    if (!finalName) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }

    await execute(`
      INSERT INTO SUPPLIER (SupplierID, SupplierName)
      VALUES (?, ?)
    `, [finalId, finalName]);

    if (phones && Array.isArray(phones)) {
      for (const p of phones) {
        if (p && String(p).trim()) {
          await execute(`INSERT INTO SUPPLIER_PHONE (SupplierID, PhoneNo) VALUES (?, ?)`, [finalId, String(p).trim()]);
        }
      }
    }

    res.status(201).json({ success: true, message: 'Supplier created successfully', supplierId: finalId });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update supplier
router.put('/:id', async (req, res) => {
  try {
    const supplierId = req.params.id;
    const body = req.body || {};

    const existingRows = await query(`SELECT * FROM SUPPLIER WHERE SupplierID = ?`, [supplierId]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    const existing = existingRows[0];

    await execute(`
      UPDATE SUPPLIER SET SupplierName = ? WHERE SupplierID = ?
    `, [body.SupplierName || body.supplier_name || body.name || existing.SupplierName, supplierId]);

    if (body.phones && Array.isArray(body.phones)) {
      await execute(`DELETE FROM SUPPLIER_PHONE WHERE SupplierID = ?`, [supplierId]);
      for (const p of body.phones) {
        if (p && String(p).trim()) {
          await execute(`INSERT INTO SUPPLIER_PHONE (SupplierID, PhoneNo) VALUES (?, ?)`, [supplierId, String(p).trim()]);
        }
      }
    }

    res.json({ success: true, message: 'Supplier updated successfully' });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE supplier
router.delete('/:id', async (req, res) => {
  try {
    const supplierId = req.params.id;
    await execute(`DELETE FROM SUPPLIER WHERE SupplierID = ?`, [supplierId]);
    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
