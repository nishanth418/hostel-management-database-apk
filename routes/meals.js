const express = require('express');
const router = express.Router();
const { query, execute } = require('../database');

// GET meals with optional filtering by mess
router.get('/', async (req, res) => {
  try {
    const { mess_id, search } = req.query;
    let sql = `
      SELECT 
        m.MealID AS meal_id,
        m.MealID,
        m.MealName AS meal_name,
        m.MealName AS name,
        m.MealName,
        m.Description AS description,
        m.Description,
        m.Cost AS cost,
        m.Cost,
        m.MessID AS mess_id,
        m.MessID,
        ms.MessName AS mess_name,
        ms.MessType AS mess_type
      FROM MEAL m
      JOIN MESS ms ON m.MessID = ms.MessID
      WHERE 1=1
    `;
    const params = [];

    if (mess_id && mess_id.trim()) {
      sql += ` AND m.MessID = ?`;
      params.push(mess_id.trim());
    }
    if (search && search.trim()) {
      sql += ` AND (m.MealName LIKE ? OR m.Description LIKE ?)`;
      const s = `%${search.trim()}%`;
      params.push(s, s);
    }

    sql += ` ORDER BY m.MessID ASC, m.MealID ASC`;

    const rows = await query(sql, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Error fetching meals:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single meal
router.get('/:id', async (req, res) => {
  try {
    const mealId = req.params.id;
    const rows = await query(`
      SELECT 
        m.MealID AS meal_id,
        m.MealID,
        m.MealName AS meal_name,
        m.MealName AS name,
        m.MealName,
        m.Description AS description,
        m.Description,
        m.Cost AS cost,
        m.Cost,
        m.MessID AS mess_id,
        m.MessID,
        ms.MessName AS mess_name
      FROM MEAL m
      JOIN MESS ms ON m.MessID = ms.MessID
      WHERE m.MealID = ?
    `, [mealId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Meal not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching meal by ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create meal
router.post('/', async (req, res) => {
  try {
    const { MealID, meal_id, MealName, meal_name, name, Description, description, Cost, cost, MessID, mess_id } = req.body;
    const finalId = MealID || meal_id || ('ML' + (Math.floor(Math.random() * 90) + 10));
    const finalName = MealName || meal_name || name;
    const finalMessId = MessID || mess_id;

    if (!finalName || !finalMessId) {
      return res.status(400).json({ success: false, message: 'Meal name and Mess ID are required' });
    }

    await execute(`
      INSERT INTO MEAL (MealID, MealName, Description, Cost, MessID)
      VALUES (?, ?, ?, ?, ?)
    `, [finalId, finalName, Description || description || '', Number(Cost !== undefined ? Cost : (cost || 100)), finalMessId]);

    res.status(201).json({ success: true, message: 'Meal created successfully', mealId: finalId });
  } catch (error) {
    console.error('Error creating meal:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update meal
router.put('/:id', async (req, res) => {
  try {
    const mealId = req.params.id;
    const body = req.body || {};

    const existingRows = await query(`SELECT * FROM MEAL WHERE MealID = ?`, [mealId]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Meal not found' });
    }
    const existing = existingRows[0];

    await execute(`
      UPDATE MEAL SET
        MealName = ?, Description = ?, Cost = ?, MessID = ?
      WHERE MealID = ?
    `, [
      body.MealName || body.meal_name || body.name || existing.MealName,
      body.Description !== undefined ? (body.Description || body.description) : existing.Description,
      body.Cost !== undefined ? Number(body.Cost) : (body.cost !== undefined ? Number(body.cost) : existing.Cost),
      body.MessID || body.mess_id || existing.MessID,
      mealId
    ]);

    res.json({ success: true, message: 'Meal updated successfully' });
  } catch (error) {
    console.error('Error updating meal:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE meal
router.delete('/:id', async (req, res) => {
  try {
    const mealId = req.params.id;
    await execute(`DELETE FROM MEAL WHERE MealID = ?`, [mealId]);
    res.json({ success: true, message: 'Meal deleted successfully' });
  } catch (error) {
    console.error('Error deleting meal:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
