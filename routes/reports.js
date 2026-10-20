const express = require('express');
const router = express.Router();
const { query } = require('../database');

const REPORT_DEFINITIONS = {
  'student-room-hostel': {
    title: '1. Student + Room + Hostel Report',
    description: 'Detailed allocation listing of students with their assigned rooms, floors, and hostels.',
    sql: `
      SELECT 
        s.StudentID,
        CONCAT(s.FirstName, ' ', s.LastName) AS StudentName,
        s.Email,
        s.Gender,
        s.PlanType,
        COALESCE(r.RoomNo, 'Unassigned') AS RoomNo,
        COALESCE(r.FloorNo, 0) AS FloorNo,
        COALESCE(h.HostelName, 'Unassigned') AS HostelName
      FROM STUDENT s
      LEFT JOIN ROOM r ON s.RoomNo = r.RoomNo
      LEFT JOIN HOSTEL h ON s.HostelID = h.HostelID
      ORDER BY s.StudentID ASC;
    `
  },
  'student-phones': {
    title: '2. Student + Student Phone Report',
    description: 'Multi-phone contact registry mapping all contact numbers per student.',
    sql: `
      SELECT 
        s.StudentID,
        CONCAT(s.FirstName, ' ', s.LastName) AS StudentName,
        s.Email,
        sp.PhoneNo
      FROM STUDENT s
      JOIN STUDENT_PHONE sp ON s.StudentID = sp.StudentID
      ORDER BY s.StudentID, sp.PhoneNo;
    `
  },
  'hostel-warden': {
    title: '3. Hostel + Warden Report',
    description: 'Administrative hierarchy connecting each hostel building to its presiding warden and phone numbers.',
    sql: `
      SELECT 
        h.HostelID,
        h.HostelName,
        h.TotalFloors,
        w.WardenID,
        COALESCE(w.WardenName, 'No Warden Assigned') AS WardenName,
        COALESCE(w.Email, '-') AS WardenEmail,
        (SELECT GROUP_CONCAT(wp.PhoneNo, ', ') FROM WARDEN_PHONE wp WHERE wp.WardenID = w.WardenID) AS WardenPhones
      FROM HOSTEL h
      LEFT JOIN WARDEN w ON h.WardenID = w.WardenID
      ORDER BY h.HostelID ASC;
    `
  },
  'room-type-hostel': {
    title: '4. Room + Hostel Report',
    description: 'Inventory of all rooms with room configurations, bed capacities, room rents, and hostel locations.',
    sql: `
      SELECT 
        r.RoomNo,
        r.FloorNo,
        r.Type AS RoomType,
        r.Capacity,
        r.RoomRent,
        h.HostelName
      FROM ROOM r
      JOIN HOSTEL h ON r.HostelID = h.HostelID
      ORDER BY h.HostelName, r.FloorNo, r.RoomNo;
    `
  },
  'mess-meal': {
    title: '5. Mess + Meal Report',
    description: 'Meal menus, descriptions, and costs across all mess halls.',
    sql: `
      SELECT 
        m.MessID,
        m.MessName,
        m.MessType,
        m.Location,
        ml.MealID,
        ml.MealName,
        ml.Description,
        ml.Cost
      FROM MESS m
      JOIN MEAL ml ON m.MessID = ml.MessID
      ORDER BY m.MessID, ml.MealID;
    `
  },
  'mess-staff': {
    title: '6. Mess + Staff Report',
    description: 'Kitchen and service personnel assigned to each mess hall with roles and contacts.',
    sql: `
      SELECT 
        m.MessID,
        m.MessName,
        st.StaffID,
        st.StaffName,
        st.Role,
        st.Salary,
        (SELECT GROUP_CONCAT(sp.PhoneNo, ', ') FROM STAFF_PHONE sp WHERE sp.StaffID = st.StaffID) AS StaffPhones
      FROM MESS m
      JOIN STAFF st ON m.MessID = st.MessID
      ORDER BY m.MessName, st.Role, st.StaffName;
    `
  },
  'supplier-inventory': {
    title: '7. Supplier + Inventory Report',
    description: 'Matrix of verified vendors and the inventory items procured.',
    sql: `
      SELECT 
        s.SupplierID,
        s.SupplierName,
        i.ItemID,
        i.ItemName,
        i.Category,
        i.Unit,
        p.Quantity
      FROM SUPPLIER s
      JOIN PROCURES p ON s.SupplierID = p.SupplierID
      JOIN INVENTORY_ITEM i ON p.ItemID = i.ItemID
      ORDER BY s.SupplierName, i.ItemName;
    `
  },
  'procurement-supplier-inventory': {
    title: '8. Procurement + Supplier + Inventory Report',
    description: 'Purchase ledger linking procurement quantities to mess halls, vendors, and items.',
    sql: `
      SELECT 
        m.MessName,
        s.SupplierName,
        i.ItemName,
        i.Category,
        p.Quantity,
        i.Unit
      FROM PROCURES p
      JOIN MESS m ON p.MessID = m.MessID
      JOIN SUPPLIER s ON p.SupplierID = s.SupplierID
      JOIN INVENTORY_ITEM i ON p.ItemID = i.ItemID
      ORDER BY m.MessName, s.SupplierName;
    `
  },
  'student-payment': {
    title: '9. Student + Payment Report',
    description: 'Complete fee payment transactions joined with student records.',
    sql: `
      SELECT 
        p.PaymentID,
        p.Amount,
        p.PaymentMode,
        p.Status,
        CONCAT(p.PaymentDay, '-', p.PaymentMonth, '-', p.PaymentYear) AS PaymentDate,
        s.StudentID,
        CONCAT(s.FirstName, ' ', s.LastName) AS StudentName,
        s.Email,
        s.RoomNo,
        h.HostelName
      FROM PAYMENT p
      JOIN STUDENT s ON p.StudentID = s.StudentID
      LEFT JOIN HOSTEL h ON s.HostelID = h.HostelID
      ORDER BY p.PaymentID ASC;
    `
  },
  'hostel-occupancy': {
    title: '10. Overall Hostel Occupancy Report',
    description: 'High-level aggregation of hostels, total rooms, and bed capacity.',
    sql: `
      SELECT 
        h.HostelID,
        h.HostelName,
        h.TotalFloors,
        COUNT(r.RoomNo) AS TotalRooms,
        COALESCE(SUM(r.Capacity), 0) AS TotalBedCapacity,
        COUNT(DISTINCT s.StudentID) AS AssignedStudents
      FROM HOSTEL h
      LEFT JOIN ROOM r ON h.HostelID = r.HostelID
      LEFT JOIN STUDENT s ON h.HostelID = s.HostelID
      GROUP BY h.HostelID, h.HostelName, h.TotalFloors
      ORDER BY h.HostelID;
    `
  },
  'available-rooms': {
    title: '11. Available Rooms Report',
    description: 'Directory of rooms and student assignments across campus.',
    sql: `
      SELECT 
        r.RoomNo,
        r.FloorNo,
        r.Type AS RoomType,
        r.Capacity,
        r.RoomRent,
        h.HostelName,
        COUNT(s.StudentID) AS OccupantsCount
      FROM ROOM r
      JOIN HOSTEL h ON r.HostelID = h.HostelID
      LEFT JOIN STUDENT s ON r.RoomNo = s.RoomNo
      GROUP BY r.RoomNo, r.FloorNo, r.Type, r.Capacity, r.RoomRent, h.HostelName
      ORDER BY h.HostelName, r.FloorNo, r.RoomNo;
    `
  },
  'student-payment-summary': {
    title: '12. Student Payment Summary Report',
    description: 'Financial rollup calculating total payment amounts aggregated per student.',
    sql: `
      SELECT 
        s.StudentID,
        CONCAT(s.FirstName, ' ', s.LastName) AS StudentName,
        s.Email,
        s.RoomNo,
        h.HostelName,
        COUNT(p.PaymentID) AS TotalTransactions,
        COALESCE(SUM(p.Amount), 0) AS TotalPaidAmount
      FROM STUDENT s
      LEFT JOIN HOSTEL h ON s.HostelID = h.HostelID
      LEFT JOIN PAYMENT p ON s.StudentID = p.StudentID
      GROUP BY s.StudentID, s.FirstName, s.LastName, s.Email, s.RoomNo, h.HostelName
      ORDER BY TotalPaidAmount DESC;
    `
  },
  'inventory-procurement-summary': {
    title: '13. Inventory & Procurement Summary Report',
    description: 'Combined stock and procurement totals grouped by inventory item.',
    sql: `
      SELECT 
        i.ItemID,
        i.ItemName,
        i.Category,
        i.Unit,
        COUNT(p.MessID) AS ProcurementOrdersCount,
        COALESCE(SUM(p.Quantity), 0) AS TotalProcuredQuantity
      FROM INVENTORY_ITEM i
      LEFT JOIN PROCURES p ON i.ItemID = p.ItemID
      GROUP BY i.ItemID, i.ItemName, i.Category, i.Unit
      ORDER BY i.Category, i.ItemName;
    `
  }
};

// GET list of all available reports
router.get('/', (req, res) => {
  const list = Object.keys(REPORT_DEFINITIONS).map(key => ({
    key,
    title: REPORT_DEFINITIONS[key].title,
    description: REPORT_DEFINITIONS[key].description
  }));
  res.json({ success: true, count: list.length, data: list });
});

// GET execution of specific report
router.get('/:reportKey', async (req, res) => {
  try {
    const { reportKey } = req.params;
    const report = REPORT_DEFINITIONS[reportKey];
    if (!report) {
      return res.status(404).json({ success: false, message: `Report '${reportKey}' not found` });
    }

    const startTime = process.hrtime();
    const rows = await query(report.sql);
    const diff = process.hrtime(startTime);
    const executionTimeMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(2);

    res.json({
      success: true,
      reportKey,
      title: report.title,
      description: report.description,
      sql: report.sql.trim(),
      executionTimeMs,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error(`Error running report '${req.params.reportKey}':`, error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
