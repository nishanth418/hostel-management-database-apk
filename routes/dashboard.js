const express = require('express');
const router = express.Router();
const { query } = require('../database');

router.get('/stats', async (req, res) => {
  try {
    // Core KPIs
    const [studentsRow] = await query(`SELECT COUNT(*) AS count FROM STUDENT`);
    const [hostelsRow] = await query(`SELECT COUNT(*) AS count FROM HOSTEL`);
    const [roomsRow] = await query(`SELECT COUNT(*) AS count FROM ROOM`);
    const [staffRow] = await query(`SELECT COUNT(*) AS count FROM STAFF`);
    const [suppliersRow] = await query(`SELECT COUNT(*) AS count FROM SUPPLIER`);
    const [inventoryRow] = await query(`SELECT COUNT(*) AS count FROM INVENTORY_ITEM`);
    const [paymentsAmountRow] = await query(`SELECT COALESCE(SUM(Amount), 0) AS total FROM PAYMENT WHERE Status = 'Successful'`);
    const [paymentsCountRow] = await query(`SELECT COUNT(*) AS count FROM PAYMENT`);

    const totalStudents = Number(studentsRow?.count || 0);
    const totalHostels = Number(hostelsRow?.count || 0);
    const totalRooms = Number(roomsRow?.count || 0);
    const totalStaff = Number(staffRow?.count || 0);
    const totalSuppliers = Number(suppliersRow?.count || 0);
    const totalInventoryItems = Number(inventoryRow?.count || 0);
    const totalPaymentsAmount = Number(paymentsAmountRow?.total || 0);
    const totalPaymentsCount = Number(paymentsCountRow?.count || 0);

    const occupiedRooms = totalStudents;
    const availableRooms = Math.max(0, totalRooms - occupiedRooms);
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // Hostel occupancy breakdown
    const hostelOccupancy = await query(`
      SELECT 
        h.HostelID,
        h.HostelName AS name,
        'Campus Block' AS type,
        COUNT(DISTINCT r.RoomNo) AS total_rooms,
        COUNT(DISTINCT s.StudentID) AS occupied_rooms,
        ROUND((COUNT(DISTINCT s.StudentID) * 100.0 / NULLIF(COUNT(DISTINCT r.RoomNo), 0)), 1) AS occupancy_rate
      FROM HOSTEL h
      LEFT JOIN ROOM r ON h.HostelID = r.HostelID
      LEFT JOIN STUDENT s ON h.HostelID = s.HostelID
      GROUP BY h.HostelID, h.HostelName
      ORDER BY h.HostelID ASC
    `);

    // Low stock / inventory items
    const lowStockItems = await query(`
      SELECT 
        i.ItemID AS item_id,
        i.ItemName AS item_name,
        i.Category AS category,
        COALESCE(p.Quantity, 0) AS quantity,
        100 AS min_required_quantity,
        i.Unit AS unit
      FROM INVENTORY_ITEM i
      LEFT JOIN PROCURES p ON i.ItemID = p.ItemID
      GROUP BY i.ItemID, i.ItemName, i.Category, p.Quantity, i.Unit
      LIMIT 5
    `);

    // Recent payments
    const recentPayments = await query(`
      SELECT 
        p.PaymentID AS payment_id,
        CONCAT(p.PaymentDay, '-', p.PaymentMonth, '-', p.PaymentYear) AS payment_date,
        p.Amount AS total_amount,
        p.PaymentMode AS payment_method,
        p.Status AS payment_status,
        p.PaymentID AS transaction_id,
        CONCAT(s.FirstName, ' ', s.LastName) AS student_name,
        s.RoomNo AS room_number,
        h.HostelName AS hostel_name
      FROM PAYMENT p
      JOIN STUDENT s ON p.StudentID = s.StudentID
      LEFT JOIN HOSTEL h ON s.HostelID = h.HostelID
      ORDER BY p.PaymentID DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        summary: {
          totalStudents,
          totalHostels,
          totalRooms,
          availableRooms,
          occupiedRooms,
          totalStaff,
          totalSuppliers,
          totalInventoryItems,
          totalPaymentsAmount,
          totalPaymentsCount,
          occupancyRate
        },
        hostelOccupancy,
        lowStockItems,
        recentPayments
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
