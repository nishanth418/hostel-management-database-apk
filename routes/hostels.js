const express = require('express');
const router = express.Router();
const { query, execute } = require('../database');

// GET all hostels with warden info & room count summary
router.get('/', async (req, res) => {
  try {
    const rows = await query(`
      SELECT 
        h.HostelID AS hostel_id,
        h.HostelID,
        h.HostelName AS name,
        h.HostelName,
        h.TotalFloors AS total_floors,
        h.TotalFloors,
        h.WardenID AS warden_id,
        h.WardenID,
        'Campus Block' AS type,
        'Campus' AS address,
        w.WardenName AS warden_name,
        w.WardenName,
        w.Email AS warden_email,
        COUNT(DISTINCT r.RoomNo) AS total_rooms,
        COUNT(DISTINCT s.StudentID) AS occupied_rooms,
        (CASE WHEN COUNT(DISTINCT r.RoomNo) >= COUNT(DISTINCT s.StudentID) THEN COUNT(DISTINCT r.RoomNo) - COUNT(DISTINCT s.StudentID) ELSE 0 END) AS available_rooms,
        COALESCE(SUM(r.Capacity), 0) AS total_capacity
      FROM HOSTEL h
      LEFT JOIN WARDEN w ON h.WardenID = w.WardenID
      LEFT JOIN ROOM r ON h.HostelID = r.HostelID
      LEFT JOIN STUDENT s ON h.HostelID = s.HostelID
      GROUP BY h.HostelID, h.HostelName, h.TotalFloors, h.WardenID, w.WardenName, w.Email
      ORDER BY h.HostelID ASC
    `);

    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Error fetching hostels:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single hostel
router.get('/:id', async (req, res) => {
  try {
    const hostelId = req.params.id;
    const rows = await query(`
      SELECT 
        h.HostelID AS hostel_id,
        h.HostelID,
        h.HostelName AS name,
        h.HostelName,
        h.TotalFloors AS total_floors,
        h.TotalFloors,
        h.WardenID AS warden_id,
        h.WardenID,
        'Campus Block' AS type,
        'Campus' AS address,
        w.WardenName AS warden_name,
        w.WardenName,
        w.Email AS warden_email
      FROM HOSTEL h
      LEFT JOIN WARDEN w ON h.WardenID = w.WardenID
      WHERE h.HostelID = ?
    `, [hostelId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    const hostel = rows[0];
    const rooms = await query(`
      SELECT 
        r.RoomNo AS room_id,
        r.RoomNo AS room_number,
        r.RoomNo,
        r.FloorNo AS floor,
        r.FloorNo,
        r.Type AS room_type,
        r.Type,
        r.Capacity AS capacity,
        r.Capacity,
        r.RoomRent AS fee_per_month,
        r.RoomRent,
        r.HostelID
      FROM ROOM r
      WHERE r.HostelID = ?
    `, [hostelId]);

    res.json({ success: true, data: { ...hostel, rooms } });
  } catch (error) {
    console.error('Error fetching hostel by ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create hostel
router.post('/', async (req, res) => {
  try {
    const { HostelID, hostel_id, HostelName, name, TotalFloors, total_floors, WardenID, warden_id } = req.body;
    const finalId = HostelID || hostel_id || ('H' + (Math.floor(Math.random() * 900) + 10));
    const finalName = HostelName || name;
    if (!finalName) {
      return res.status(400).json({ success: false, message: 'Hostel name is required' });
    }

    await execute(`
      INSERT INTO HOSTEL (HostelID, HostelName, TotalFloors, WardenID)
      VALUES (?, ?, ?, ?)
    `, [finalId, finalName, Number(TotalFloors || total_floors || 3), WardenID || warden_id || null]);

    res.status(201).json({ success: true, message: 'Hostel created successfully', hostelId: finalId });
  } catch (error) {
    console.error('Error creating hostel:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update hostel
router.put('/:id', async (req, res) => {
  try {
    const hostelId = req.params.id;
    const { HostelName, name, TotalFloors, total_floors, WardenID, warden_id } = req.body;

    const existingRows = await query(`SELECT * FROM HOSTEL WHERE HostelID = ?`, [hostelId]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }
    const existing = existingRows[0];

    await execute(`
      UPDATE HOSTEL SET
        HostelName = ?, TotalFloors = ?, WardenID = ?
      WHERE HostelID = ?
    `, [
      HostelName || name || existing.HostelName,
      TotalFloors !== undefined ? Number(TotalFloors) : (total_floors !== undefined ? Number(total_floors) : existing.TotalFloors),
      WardenID || warden_id || existing.WardenID,
      hostelId
    ]);

    res.json({ success: true, message: 'Hostel updated successfully' });
  } catch (error) {
    console.error('Error updating hostel:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE hostel
router.delete('/:id', async (req, res) => {
  try {
    const hostelId = req.params.id;
    const [roomCount] = await query(`SELECT COUNT(*) AS count FROM ROOM WHERE HostelID = ?`, [hostelId]);
    if (roomCount && Number(roomCount.count) > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete hostel: it currently contains ${roomCount.count} rooms. Please reassign or delete rooms first.`
      });
    }

    await execute(`DELETE FROM HOSTEL WHERE HostelID = ?`, [hostelId]);
    res.json({ success: true, message: 'Hostel deleted successfully' });
  } catch (error) {
    console.error('Error deleting hostel:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
