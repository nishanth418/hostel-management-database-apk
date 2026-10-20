const express = require('express');
const router = express.Router();
const { query, execute } = require('../database');

// GET all mess facilities with contacts
router.get('/', async (req, res) => {
  try {
    const rows = await query(`
      SELECT 
        m.MessID AS mess_id,
        m.MessID,
        m.MessName AS mess_name,
        m.MessName AS name,
        m.MessName,
        m.MessType AS type,
        m.MessType AS mess_type,
        m.MessType,
        m.Location AS location,
        m.Location,
        GROUP_CONCAT(mc.ContactNo, ', ') AS contact_numbers,
        (SELECT COUNT(*) FROM MEAL ml WHERE ml.MessID = m.MessID) AS total_meals_scheduled,
        (SELECT COUNT(*) FROM STAFF st WHERE st.MessID = m.MessID) AS staff_count
      FROM MESS m
      LEFT JOIN MESS_CONTACT mc ON m.MessID = mc.MessID
      GROUP BY m.MessID, m.MessName, m.MessType, m.Location
      ORDER BY m.MessID ASC
    `);

    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Error fetching mess list:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single mess
router.get('/:id', async (req, res) => {
  try {
    const messId = req.params.id;
    const rows = await query(`
      SELECT 
        m.MessID AS mess_id,
        m.MessID,
        m.MessName AS mess_name,
        m.MessName AS name,
        m.MessName,
        m.MessType AS type,
        m.MessType AS mess_type,
        m.MessType,
        m.Location AS location,
        m.Location
      FROM MESS m
      WHERE m.MessID = ?
    `, [messId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Mess not found' });
    }

    const mess = rows[0];
    const contactRows = await query(`SELECT ContactNo as contact_number FROM MESS_CONTACT WHERE MessID = ?`, [messId]);
    const contacts = contactRows.map(c => c.contact_number);
    const meals = await query(`SELECT MealID as meal_id, MealName as meal_name, Description as description, Cost as cost FROM MEAL WHERE MessID = ?`, [messId]);
    const staff = await query(`SELECT StaffID as staff_id, StaffName as name, Role as role FROM STAFF WHERE MessID = ?`, [messId]);

    res.json({ success: true, data: { ...mess, contacts, meals, staff } });
  } catch (error) {
    console.error('Error fetching mess by ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create mess
router.post('/', async (req, res) => {
  try {
    const { MessID, mess_id, MessName, mess_name, name, MessType, type, mess_type, Location, location, contacts } = req.body;
    const finalId = MessID || mess_id || ('M' + (Math.floor(Math.random() * 90) + 10));
    const finalName = MessName || mess_name || name;
    if (!finalName) {
      return res.status(400).json({ success: false, message: 'Mess name is required' });
    }

    await execute(`
      INSERT INTO MESS (MessID, MessName, MessType, Location)
      VALUES (?, ?, ?, ?)
    `, [finalId, finalName, MessType || type || mess_type || 'Mixed', Location || location || 'Campus Block']);

    if (contacts && Array.isArray(contacts)) {
      for (const c of contacts) {
        if (c && String(c).trim()) {
          await execute(`INSERT INTO MESS_CONTACT (MessID, ContactNo) VALUES (?, ?)`, [finalId, String(c).trim()]);
        }
      }
    }

    res.status(201).json({ success: true, message: 'Mess created successfully', messId: finalId });
  } catch (error) {
    console.error('Error creating mess:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update mess
router.put('/:id', async (req, res) => {
  try {
    const messId = req.params.id;
    const body = req.body || {};

    const existingRows = await query(`SELECT * FROM MESS WHERE MessID = ?`, [messId]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Mess not found' });
    }
    const existing = existingRows[0];

    await execute(`
      UPDATE MESS SET
        MessName = ?, MessType = ?, Location = ?
      WHERE MessID = ?
    `, [
      body.MessName || body.mess_name || body.name || existing.MessName,
      body.MessType || body.type || body.mess_type || existing.MessType,
      body.Location || body.location || existing.Location,
      messId
    ]);

    if (body.contacts && Array.isArray(body.contacts)) {
      await execute(`DELETE FROM MESS_CONTACT WHERE MessID = ?`, [messId]);
      for (const c of body.contacts) {
        if (c && String(c).trim()) {
          await execute(`INSERT INTO MESS_CONTACT (MessID, ContactNo) VALUES (?, ?)`, [messId, String(c).trim()]);
        }
      }
    }

    res.json({ success: true, message: 'Mess updated successfully' });
  } catch (error) {
    console.error('Error updating mess:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE mess
router.delete('/:id', async (req, res) => {
  try {
    const messId = req.params.id;
    await execute(`DELETE FROM MESS WHERE MessID = ?`, [messId]);
    res.json({ success: true, message: 'Mess deleted successfully' });
  } catch (error) {
    console.error('Error deleting mess:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
