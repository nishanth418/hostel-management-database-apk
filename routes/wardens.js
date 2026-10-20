const express = require('express');
const router = express.Router();
const { query, execute } = require('../database');

// GET all wardens with phone numbers and assigned hostel
router.get('/', async (req, res) => {
  try {
    const rows = await query(`
      SELECT 
        w.WardenID AS warden_id,
        w.WardenID,
        w.WardenName AS name,
        w.WardenName,
        w.Email AS email,
        w.Email,
        w.JoiningDate AS join_date,
        w.JoiningDate,
        h.HostelName AS hostel_name,
        h.HostelID AS hostel_id,
        GROUP_CONCAT(wp.PhoneNo, ', ') AS phone_numbers
      FROM WARDEN w
      LEFT JOIN HOSTEL h ON w.WardenID = h.WardenID
      LEFT JOIN WARDEN_PHONE wp ON w.WardenID = wp.WardenID
      GROUP BY w.WardenID, w.WardenName, w.Email, w.JoiningDate, h.HostelName, h.HostelID
      ORDER BY w.WardenID ASC
    `);

    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Error fetching wardens:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single warden
router.get('/:id', async (req, res) => {
  try {
    const wardenId = req.params.id;
    const rows = await query(`
      SELECT 
        w.WardenID AS warden_id,
        w.WardenID,
        w.WardenName AS name,
        w.WardenName,
        w.Email AS email,
        w.Email,
        w.JoiningDate AS join_date,
        w.JoiningDate,
        h.HostelName AS hostel_name,
        h.HostelID AS hostel_id
      FROM WARDEN w
      LEFT JOIN HOSTEL h ON w.WardenID = h.WardenID
      WHERE w.WardenID = ?
    `, [wardenId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Warden not found' });
    }

    const warden = rows[0];
    const phoneRows = await query(`SELECT PhoneNo as phone_number FROM WARDEN_PHONE WHERE WardenID = ?`, [wardenId]);
    const phones = phoneRows.map(p => p.phone_number);

    res.json({ success: true, data: { ...warden, phones } });
  } catch (error) {
    console.error('Error fetching warden by ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create warden
router.post('/', async (req, res) => {
  try {
    const { WardenID, warden_id, WardenName, name, Email, email, JoiningDate, join_date, phones } = req.body;
    const finalId = WardenID || warden_id || ('W' + (100 + Math.floor(Math.random() * 900)));
    const finalName = WardenName || name;
    if (!finalName) {
      return res.status(400).json({ success: false, message: 'Warden name is required' });
    }

    await execute(`
      INSERT INTO WARDEN (WardenID, WardenName, Email, JoiningDate)
      VALUES (?, ?, ?, ?)
    `, [finalId, finalName, Email || email || '', JoiningDate || join_date || '01-JAN-22']);

    if (phones && Array.isArray(phones)) {
      for (const phone of phones) {
        if (phone && String(phone).trim()) {
          await execute(`INSERT INTO WARDEN_PHONE (WardenID, PhoneNo) VALUES (?, ?)`, [finalId, String(phone).trim()]);
        }
      }
    }

    res.status(201).json({ success: true, message: 'Warden created successfully', wardenId: finalId });
  } catch (error) {
    console.error('Error creating warden:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update warden
router.put('/:id', async (req, res) => {
  try {
    const wardenId = req.params.id;
    const body = req.body || {};

    const existingRows = await query(`SELECT * FROM WARDEN WHERE WardenID = ?`, [wardenId]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Warden not found' });
    }
    const existing = existingRows[0];

    await execute(`
      UPDATE WARDEN SET
        WardenName = ?, Email = ?, JoiningDate = ?
      WHERE WardenID = ?
    `, [
      body.WardenName || body.name || existing.WardenName,
      body.Email || body.email || existing.Email,
      body.JoiningDate || body.join_date || existing.JoiningDate,
      wardenId
    ]);

    if (body.phones && Array.isArray(body.phones)) {
      await execute(`DELETE FROM WARDEN_PHONE WHERE WardenID = ?`, [wardenId]);
      for (const phone of body.phones) {
        if (phone && String(phone).trim()) {
          await execute(`INSERT INTO WARDEN_PHONE (WardenID, PhoneNo) VALUES (?, ?)`, [wardenId, String(phone).trim()]);
        }
      }
    }

    res.json({ success: true, message: 'Warden updated successfully' });
  } catch (error) {
    console.error('Error updating warden:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE warden
router.delete('/:id', async (req, res) => {
  try {
    const wardenId = req.params.id;
    const [hostelCount] = await query(`SELECT COUNT(*) AS count FROM HOSTEL WHERE WardenID = ?`, [wardenId]);
    if (hostelCount && Number(hostelCount.count) > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete warden: assigned to ${hostelCount.count} hostel(s). Reassign hostel first.`
      });
    }

    await execute(`DELETE FROM WARDEN WHERE WardenID = ?`, [wardenId]);
    res.json({ success: true, message: 'Warden deleted successfully' });
  } catch (error) {
    console.error('Error deleting warden:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
