const express = require('express');
const router = express.Router();
const { query, execute } = require('../database');

// GET all rooms with hostel and type details
router.get('/', async (req, res) => {
  try {
    const { hostel_id, type_id, search } = req.query;
    let sql = `
      SELECT 
        r.RoomNo AS room_id,
        r.RoomNo AS room_number,
        r.RoomNo,
        r.FloorNo AS floor,
        r.FloorNo,
        r.Type AS room_type,
        r.Type AS type_name,
        r.Type,
        r.Capacity AS capacity,
        r.Capacity,
        r.RoomRent AS fee_per_month,
        r.RoomRent,
        r.HostelID AS hostel_id,
        r.HostelID,
        'Available' AS status,
        h.HostelName AS hostel_name,
        'Campus Block' AS hostel_type,
        COUNT(DISTINCT s.StudentID) AS current_occupants
      FROM ROOM r
      JOIN HOSTEL h ON r.HostelID = h.HostelID
      LEFT JOIN STUDENT s ON r.RoomNo = s.RoomNo
      WHERE 1=1
    `;
    const params = [];

    if (hostel_id && hostel_id.trim()) {
      sql += ` AND r.HostelID = ?`;
      params.push(hostel_id.trim());
    }
    if (type_id && type_id.trim()) {
      sql += ` AND (r.Type = ? OR r.Type LIKE ?)`;
      params.push(type_id.trim(), `%${type_id.trim()}%`);
    }
    if (search && search.trim()) {
      sql += ` AND (r.RoomNo LIKE ? OR h.HostelName LIKE ? OR r.Type LIKE ?)`;
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    sql += ` GROUP BY r.RoomNo, r.FloorNo, r.Type, r.Capacity, r.RoomRent, r.HostelID, h.HostelName ORDER BY h.HostelName ASC, r.FloorNo ASC, r.RoomNo ASC`;

    const rows = await query(sql, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single room
router.get('/:id', async (req, res) => {
  try {
    const roomId = req.params.id;
    const rows = await query(`
      SELECT 
        r.RoomNo AS room_id,
        r.RoomNo AS room_number,
        r.RoomNo,
        r.FloorNo AS floor,
        r.FloorNo,
        r.Type AS room_type,
        r.Type AS type_name,
        r.Type,
        r.Capacity AS capacity,
        r.Capacity,
        r.RoomRent AS fee_per_month,
        r.RoomRent,
        r.HostelID AS hostel_id,
        r.HostelID,
        'Available' AS status,
        h.HostelName AS hostel_name
      FROM ROOM r
      JOIN HOSTEL h ON r.HostelID = h.HostelID
      WHERE r.RoomNo = ?
    `, [roomId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const room = rows[0];
    const students = await query(`
      SELECT StudentID as student_id, FirstName as first_name, LastName as last_name, Email as email
      FROM STUDENT
      WHERE RoomNo = ?
    `, [roomId]);

    res.json({ success: true, data: { ...room, students } });
  } catch (error) {
    console.error('Error fetching room by ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create room
router.post('/', async (req, res) => {
  try {
    const { RoomNo, room_number, FloorNo, floor, Type, type, Capacity, capacity, RoomRent, room_rent, HostelID, hostel_id } = req.body;
    const finalRoomNo = RoomNo || room_number;
    const finalHostelId = HostelID || hostel_id;

    if (!finalRoomNo || !finalHostelId) {
      return res.status(400).json({ success: false, message: 'Room number and hostel ID are required' });
    }

    await execute(`
      INSERT INTO ROOM (RoomNo, FloorNo, Type, Capacity, RoomRent, HostelID)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      finalRoomNo,
      Number(FloorNo !== undefined ? FloorNo : (floor || 1)),
      Type || type || 'Single Non-AC',
      Number(Capacity !== undefined ? Capacity : (capacity || 1)),
      Number(RoomRent !== undefined ? RoomRent : (room_rent || 4000)),
      finalHostelId
    ]);

    res.status(201).json({ success: true, message: 'Room created successfully', roomId: finalRoomNo });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update room
router.put('/:id', async (req, res) => {
  try {
    const roomId = req.params.id;
    const body = req.body || {};

    const existingRows = await query(`SELECT * FROM ROOM WHERE RoomNo = ?`, [roomId]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    const existing = existingRows[0];

    await execute(`
      UPDATE ROOM SET
        FloorNo = ?, Type = ?, Capacity = ?, RoomRent = ?, HostelID = ?
      WHERE RoomNo = ?
    `, [
      body.FloorNo !== undefined ? Number(body.FloorNo) : (body.floor !== undefined ? Number(body.floor) : existing.FloorNo),
      body.Type || body.type || body.type_name || existing.Type,
      body.Capacity !== undefined ? Number(body.Capacity) : (body.capacity !== undefined ? Number(body.capacity) : existing.Capacity),
      body.RoomRent !== undefined ? Number(body.RoomRent) : (body.room_rent !== undefined ? Number(body.room_rent) : existing.RoomRent),
      body.HostelID || body.hostel_id || existing.HostelID,
      roomId
    ]);

    res.json({ success: true, message: 'Room updated successfully' });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE room
router.delete('/:id', async (req, res) => {
  try {
    const roomId = req.params.id;
    const [studentCount] = await query(`SELECT COUNT(*) AS count FROM STUDENT WHERE RoomNo = ?`, [roomId]);
    if (studentCount && Number(studentCount.count) > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete room: ${studentCount.count} students are currently assigned to it. Please reassign them first.`
      });
    }

    await execute(`DELETE FROM ROOM WHERE RoomNo = ?`, [roomId]);
    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
