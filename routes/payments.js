const express = require('express');
const router = express.Router();
const { query, execute } = require('../database');

// GET all payments with student name & payment details
router.get('/', async (req, res) => {
  try {
    const { student_id, status, search } = req.query;
    let sql = `
      SELECT 
        p.PaymentID AS payment_id,
        p.PaymentID,
        p.StudentID AS student_id,
        p.StudentID,
        p.Amount AS total_amount,
        p.Amount AS amount,
        p.Amount,
        p.PaymentMode AS payment_method,
        p.PaymentMode,
        p.Status AS payment_status,
        p.Status AS status,
        p.Status,
        p.PaymentDay,
        p.PaymentMonth,
        p.PaymentYear,
        CONCAT(p.PaymentDay, '-', p.PaymentMonth, '-', p.PaymentYear) AS payment_date,
        p.PaymentID AS transaction_id,
        CONCAT(s.FirstName, ' ', s.LastName) AS student_name,
        s.Email AS student_email,
        s.RoomNo AS room_number,
        h.HostelName AS hostel_name,
        (SELECT COUNT(*) FROM PAYMENT_DETAIL pd WHERE pd.PaymentID = p.PaymentID) AS details_count
      FROM PAYMENT p
      JOIN STUDENT s ON p.StudentID = s.StudentID
      LEFT JOIN HOSTEL h ON s.HostelID = h.HostelID
      WHERE 1=1
    `;
    const params = [];

    if (student_id && student_id.trim()) {
      sql += ` AND p.StudentID = ?`;
      params.push(student_id.trim());
    }
    if (status && status.trim()) {
      sql += ` AND p.Status = ?`;
      params.push(status.trim());
    }
    if (search && search.trim()) {
      sql += ` AND (p.PaymentID LIKE ? OR s.FirstName LIKE ? OR s.LastName LIKE ?)`;
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    sql += ` ORDER BY p.PaymentID DESC`;

    const rows = await query(sql, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single payment with detail items
router.get('/:id', async (req, res) => {
  try {
    const paymentId = req.params.id;
    const rows = await query(`
      SELECT 
        p.PaymentID AS payment_id,
        p.PaymentID,
        p.StudentID AS student_id,
        p.StudentID,
        p.Amount AS total_amount,
        p.Amount,
        p.PaymentMode AS payment_method,
        p.PaymentMode,
        p.Status AS payment_status,
        p.Status,
        p.PaymentDay,
        p.PaymentMonth,
        p.PaymentYear,
        CONCAT(p.PaymentDay, '-', p.PaymentMonth, '-', p.PaymentYear) AS payment_date,
        p.PaymentID AS transaction_id,
        CONCAT(s.FirstName, ' ', s.LastName) AS student_name,
        s.Email AS student_email,
        s.RoomNo AS room_number,
        h.HostelName AS hostel_name
      FROM PAYMENT p
      JOIN STUDENT s ON p.StudentID = s.StudentID
      LEFT JOIN HOSTEL h ON s.HostelID = h.HostelID
      WHERE p.PaymentID = ?
    `, [paymentId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const payment = rows[0];
    const details = await query(`
      SELECT 
        PaymentID,
        DetailID,
        Month,
        Year,
        MessCharges,
        OtherCharges,
        (MessCharges + OtherCharges) AS total
      FROM PAYMENT_DETAIL 
      WHERE PaymentID = ?
    `, [paymentId]);

    res.json({ success: true, data: { ...payment, details } });
  } catch (error) {
    console.error('Error fetching payment by ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create payment
router.post('/', async (req, res) => {
  try {
    const { PaymentID, payment_id, StudentID, student_id, Amount, total_amount, amount, PaymentMode, payment_method, Status, status, payment_status, PaymentDay, PaymentMonth, PaymentYear, details } = req.body;
    const finalId = PaymentID || payment_id || ('PAY' + (1000 + Math.floor(Math.random() * 9000)));
    const finalStudentId = StudentID || student_id;
    const finalAmount = Number(Amount !== undefined ? Amount : (total_amount !== undefined ? total_amount : (amount || 10000)));
    const now = new Date();
    const day = PaymentDay || now.getDate();
    const month = PaymentMonth || (now.getMonth() + 1);
    const year = PaymentYear || now.getFullYear();

    if (!finalStudentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required' });
    }

    await execute(`
      INSERT INTO PAYMENT (PaymentID, StudentID, Amount, PaymentMode, Status, PaymentDay, PaymentMonth, PaymentYear)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      finalId,
      finalStudentId,
      finalAmount,
      PaymentMode || payment_method || 'UPI',
      Status || payment_status || status || 'Successful',
      day,
      month,
      year
    ]);

    if (details && Array.isArray(details) && details.length > 0) {
      for (let i = 0; i < details.length; i++) {
        const d = details[i];
        const detailId = d.DetailID || d.detail_id || ('D' + (i + 1));
        await execute(`
          INSERT INTO PAYMENT_DETAIL (PaymentID, DetailID, Month, Year, MessCharges, OtherCharges)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          finalId,
          detailId,
          d.Month || d.month || 'Current',
          Number(d.Year || d.year || year),
          Number(d.MessCharges || d.mess_charges || 0),
          Number(d.OtherCharges || d.other_charges || 0)
        ]);
      }
    }

    res.status(201).json({ success: true, message: 'Payment recorded successfully', paymentId: finalId });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE payment
router.delete('/:id', async (req, res) => {
  try {
    const paymentId = req.params.id;
    await execute(`DELETE FROM PAYMENT WHERE PaymentID = ?`, [paymentId]);
    res.json({ success: true, message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
