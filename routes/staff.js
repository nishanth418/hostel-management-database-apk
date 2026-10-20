const express = require('express');
const router = express.Router();
const { query, execute } = require('../database');

// GET all staff with phones and mess info
router.get('/', async (req, res) => {
  try {
    const { role, mess_id, search } = req.query;
    let sql = `
      SELECT 
        st.StaffID AS staff_id,
        st.StaffID,
        st.StaffName AS name,
        st.StaffName,
        st.JoinDate AS join_date,
        st.JoinDate,
        st.Salary AS salary,
        st.Salary,
        st.Role AS role,
        st.Role,
        st.MessID AS mess_id,
        st.MessID,
        m.MessName AS mess_name,
        GROUP_CONCAT(sp.PhoneNo, ', ') AS phone_numbers
      FROM STAFF st
      LEFT JOIN MESS m ON st.MessID = m.MessID
      LEFT JOIN STAFF_PHONE sp ON st.StaffID = sp.StaffID
      WHERE 1=1
    `;
    const params = [];

    if (role && role.trim()) {
      sql += ` AND st.Role = ?`;
      params.push(role.trim());
    }
    if (mess_id && mess_id.trim()) {
      sql += ` AND st.MessID = ?`;
      params.push(mess_id.trim());
    }
    if (search && search.trim()) {
      sql += ` AND (st.StaffName LIKE ? OR st.Role LIKE ?)`;
      const s = `%${search.trim()}%`;
      params.push(s, s);
    }

    sql += ` GROUP BY st.StaffID, st.StaffName, st.JoinDate, st.Salary, st.Role, st.MessID, m.MessName ORDER BY st.StaffID ASC`;

    const rows = await query(sql, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Error fetching staff list:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single staff
router.get('/:id', async (req, res) => {
  try {
    const staffId = req.params.id;
    const rows = await query(`
      SELECT 
        st.StaffID AS staff_id,
        st.StaffID,
        st.StaffName AS name,
        st.StaffName,
        st.JoinDate AS join_date,
        st.JoinDate,
        st.Salary AS salary,
        st.Salary,
        st.Role AS role,
        st.Role,
        st.MessID AS mess_id,
        st.MessID,
        m.MessName AS mess_name
      FROM STAFF st
      LEFT JOIN MESS m ON st.MessID = m.MessID
      WHERE st.StaffID = ?
    `, [staffId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    const staff = rows[0];
    const phoneRows = await query(`SELECT PhoneNo as phone_number FROM STAFF_PHONE WHERE StaffID = ?`, [staffId]);
    const phones = phoneRows.map(p => p.phone_number);

    res.json({ success: true, data: { ...staff, phones } });
  } catch (error) {
    console.error('Error fetching staff member by ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create staff
router.post('/', async (req, res) => {
  try {
    const { StaffID, staff_id, StaffName, name, JoinDate, join_date, Salary, salary, Role, role, MessID, mess_id, phones } = req.body;
    const finalId = StaffID || staff_id || ('ST' + (Math.floor(Math.random() * 90) + 10));
    const finalName = StaffName || name;
    if (!finalName) {
      return res.status(400).json({ success: false, message: 'Staff name is required' });
    }

    await execute(`
      INSERT INTO STAFF (StaffID, StaffName, JoinDate, Salary, Role, MessID)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      finalId,
      finalName,
      JoinDate || join_date || '01-JAN-22',
      Number(Salary !== undefined ? Salary : (salary || 25000)),
      Role || role || 'Support Staff',
      MessID || mess_id || null
    ]);

    if (phones && Array.isArray(phones)) {
      for (const p of phones) {
        if (p && String(p).trim()) {
          await execute(`INSERT INTO STAFF_PHONE (StaffID, PhoneNo) VALUES (?, ?)`, [finalId, String(p).trim()]);
        }
      }
    }

    res.status(201).json({ success: true, message: 'Staff member created successfully', staffId: finalId });
  } catch (error) {
    console.error('Error creating staff member:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update staff
router.put('/:id', async (req, res) => {
  try {
    const staffId = req.params.id;
    const body = req.body || {};

    const existingRows = await query(`SELECT * FROM STAFF WHERE StaffID = ?`, [staffId]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }
    const existing = existingRows[0];

    await execute(`
      UPDATE STAFF SET
        StaffName = ?, JoinDate = ?, Salary = ?, Role = ?, MessID = ?
      WHERE StaffID = ?
    `, [
      body.StaffName || body.name || existing.StaffName,
      body.JoinDate || body.join_date || existing.JoinDate,
      body.Salary !== undefined ? Number(body.Salary) : (body.salary !== undefined ? Number(body.salary) : existing.Salary),
      body.Role || body.role || existing.Role,
      body.MessID || body.mess_id || existing.MessID,
      staffId
    ]);

    if (body.phones && Array.isArray(body.phones)) {
      await execute(`DELETE FROM STAFF_PHONE WHERE StaffID = ?`, [staffId]);
      for (const p of body.phones) {
        if (p && String(p).trim()) {
          await execute(`INSERT INTO STAFF_PHONE (StaffID, PhoneNo) VALUES (?, ?)`, [staffId, String(p).trim()]);
        }
      }
    }

    res.json({ success: true, message: 'Staff member updated successfully' });
  } catch (error) {
    console.error('Error updating staff member:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE staff
router.delete('/:id', async (req, res) => {
  try {
    const staffId = req.params.id;
    await execute(`DELETE FROM STAFF WHERE StaffID = ?`, [staffId]);
    res.json({ success: true, message: 'Staff member deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff member:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
