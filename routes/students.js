const express = require('express');
const router = express.Router();
const { query, execute } = require('../database');

// GET all students
router.get('/', async (req, res) => {
  try {
    const { search, hostel_id, status } = req.query;
    let sql = `
      SELECT 
        s.StudentID AS student_id,
        s.StudentID,
        s.FirstName AS first_name,
        s.FirstName,
        s.LastName AS last_name,
        s.LastName,
        s.Gender AS gender,
        s.Gender,
        s.DOB AS dob,
        s.DOB,
        s.Email AS email,
        s.Email,
        s.BloodGroup AS blood_group,
        s.BloodGroup,
        s.AllergyInfo AS allergy_info,
        s.AllergyInfo,
        s.PlanType AS plan_type,
        s.PlanType,
        s.PlanType AS status,
        s.RoomNo AS room_number,
        s.RoomNo AS room_id,
        s.RoomNo,
        s.HostelID AS hostel_id,
        s.HostelID,
        s.MessID AS mess_id,
        s.MessID,
        s.MentorStudentID AS mentor_student_id,
        s.MentorStudentID,
        r.FloorNo AS floor,
        r.FloorNo,
        h.HostelName AS hostel_name,
        h.HostelName,
        rt.TypeName AS room_type_name,
        r.RoomRent AS fee_per_month,
        GROUP_CONCAT(sp.PhoneNo, ', ') AS phone_numbers
      FROM STUDENT s
      LEFT JOIN ROOM r ON s.RoomNo = r.RoomNo
      LEFT JOIN HOSTEL h ON s.HostelID = h.HostelID
      LEFT JOIN ROOM_TYPE rt ON r.Type = rt.TypeName OR r.Type = rt.TypeID
      LEFT JOIN STUDENT_PHONE sp ON s.StudentID = sp.StudentID
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      sql += ` AND (s.FirstName LIKE ? OR s.LastName LIKE ? OR s.Email LIKE ? OR s.RoomNo LIKE ?)`;
      const sTerm = `%${search.trim()}%`;
      params.push(sTerm, sTerm, sTerm, sTerm);
    }
    if (hostel_id && hostel_id.trim()) {
      sql += ` AND s.HostelID = ?`;
      params.push(hostel_id.trim());
    }
    if (status && status.trim()) {
      sql += ` AND s.PlanType = ?`;
      params.push(status.trim());
    }

    sql += ` GROUP BY s.StudentID, s.FirstName, s.LastName, s.Gender, s.DOB, s.Email, s.BloodGroup, s.AllergyInfo, s.PlanType, s.RoomNo, s.HostelID, s.MessID, s.MentorStudentID, r.FloorNo, h.HostelName, rt.TypeName, r.RoomRent ORDER BY s.StudentID ASC`;

    const rows = await query(sql, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single student
router.get('/:id', async (req, res) => {
  try {
    const studentId = req.params.id;
    const sql = `
      SELECT 
        s.StudentID AS student_id,
        s.StudentID,
        s.FirstName AS first_name,
        s.FirstName,
        s.LastName AS last_name,
        s.LastName,
        s.Gender AS gender,
        s.Gender,
        s.DOB AS dob,
        s.DOB,
        s.Email AS email,
        s.Email,
        s.BloodGroup AS blood_group,
        s.BloodGroup,
        s.AllergyInfo AS allergy_info,
        s.AllergyInfo,
        s.PlanType AS plan_type,
        s.PlanType,
        s.PlanType AS status,
        s.RoomNo AS room_number,
        s.RoomNo AS room_id,
        s.RoomNo,
        s.HostelID AS hostel_id,
        s.HostelID,
        s.MessID AS mess_id,
        s.MessID,
        s.MentorStudentID AS mentor_student_id,
        s.MentorStudentID,
        r.FloorNo AS floor,
        r.FloorNo,
        h.HostelName AS hostel_name,
        h.HostelName,
        rt.TypeName AS room_type_name,
        r.RoomRent AS fee_per_month
      FROM STUDENT s
      LEFT JOIN ROOM r ON s.RoomNo = r.RoomNo
      LEFT JOIN HOSTEL h ON s.HostelID = h.HostelID
      LEFT JOIN ROOM_TYPE rt ON r.Type = rt.TypeName OR r.Type = rt.TypeID
      WHERE s.StudentID = ?
    `;
    const rows = await query(sql, [studentId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const student = rows[0];
    const phoneRows = await query(`
      SELECT PhoneNo as phone_number FROM STUDENT_PHONE WHERE StudentID = ?
    `, [studentId]);
    const phones = phoneRows.map(p => p.phone_number);

    res.json({ success: true, data: { ...student, phones } });
  } catch (error) {
    console.error('Error fetching student by ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST new student
router.post('/', async (req, res) => {
  try {
    const {
      StudentID,
      student_id,
      FirstName,
      first_name,
      LastName,
      last_name,
      Gender,
      gender,
      DOB,
      dob,
      Email,
      email,
      BloodGroup,
      blood_group,
      AllergyInfo,
      allergy_info,
      PlanType,
      plan_type,
      RoomNo,
      room_id,
      room_number,
      HostelID,
      hostel_id,
      MessID,
      mess_id,
      MentorStudentID,
      mentor_student_id,
      phones
    } = req.body;

    const finalId = StudentID || student_id || ('S' + (1000 + Math.floor(Math.random() * 9000)));
    const finalFirstName = FirstName || first_name || '';
    const finalLastName = LastName || last_name || '';
    const finalEmail = Email || email || '';

    if (!finalFirstName || !finalLastName) {
      return res.status(400).json({ success: false, message: 'First and last name are required' });
    }

    const insertSql = `
      INSERT INTO STUDENT (
        StudentID, FirstName, LastName, Gender, DOB, Email, BloodGroup,
        AllergyInfo, PlanType, RoomNo, HostelID, MessID, MentorStudentID
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await execute(insertSql, [
      finalId,
      finalFirstName,
      finalLastName,
      Gender || gender || 'Male',
      DOB || dob || '2004-01-01',
      finalEmail,
      BloodGroup || blood_group || 'O+',
      AllergyInfo || allergy_info || 'None',
      PlanType || plan_type || 'Standard',
      RoomNo || room_number || room_id || null,
      HostelID || hostel_id || null,
      MessID || mess_id || null,
      MentorStudentID || mentor_student_id || null
    ]);

    if (phones && Array.isArray(phones)) {
      for (const phone of phones) {
        if (phone && String(phone).trim()) {
          await execute(`INSERT INTO STUDENT_PHONE (StudentID, PhoneNo) VALUES (?, ?)`, [finalId, String(phone).trim()]);
        }
      }
    }

    res.status(201).json({ success: true, message: 'Student created successfully', studentId: finalId });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update student
router.put('/:id', async (req, res) => {
  try {
    const studentId = req.params.id;
    const body = req.body || {};

    const existingRows = await query(`SELECT * FROM STUDENT WHERE StudentID = ?`, [studentId]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    const existing = existingRows[0];

    const updateSql = `
      UPDATE STUDENT SET
        FirstName = ?, LastName = ?, Gender = ?, DOB = ?, Email = ?,
        BloodGroup = ?, AllergyInfo = ?, PlanType = ?, RoomNo = ?,
        HostelID = ?, MessID = ?, MentorStudentID = ?
      WHERE StudentID = ?
    `;

    await execute(updateSql, [
      body.FirstName || body.first_name || existing.FirstName,
      body.LastName || body.last_name || existing.LastName,
      body.Gender || body.gender || existing.Gender,
      body.DOB || body.dob || existing.DOB,
      body.Email || body.email || existing.Email,
      body.BloodGroup !== undefined ? (body.BloodGroup || body.blood_group) : existing.BloodGroup,
      body.AllergyInfo !== undefined ? (body.AllergyInfo || body.allergy_info) : existing.AllergyInfo,
      body.PlanType || body.plan_type || body.status || existing.PlanType,
      body.RoomNo || body.room_number || body.room_id || existing.RoomNo,
      body.HostelID || body.hostel_id || existing.HostelID,
      body.MessID || body.mess_id || existing.MessID,
      body.MentorStudentID || body.mentor_student_id || existing.MentorStudentID,
      studentId
    ]);

    if (body.phones && Array.isArray(body.phones)) {
      await execute(`DELETE FROM STUDENT_PHONE WHERE StudentID = ?`, [studentId]);
      for (const phone of body.phones) {
        if (phone && String(phone).trim()) {
          await execute(`INSERT INTO STUDENT_PHONE (StudentID, PhoneNo) VALUES (?, ?)`, [studentId, String(phone).trim()]);
        }
      }
    }

    res.json({ success: true, message: 'Student updated successfully' });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE student
router.delete('/:id', async (req, res) => {
  try {
    const studentId = req.params.id;
    const existing = await query(`SELECT * FROM STUDENT WHERE StudentID = ?`, [studentId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const [paymentCount] = await query(`SELECT COUNT(*) AS count FROM PAYMENT WHERE StudentID = ?`, [studentId]);
    if (paymentCount && Number(paymentCount.count) > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete student with ${paymentCount.count} existing payment records. Foreign key protection active.`
      });
    }

    await execute(`DELETE FROM STUDENT WHERE StudentID = ?`, [studentId]);
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
