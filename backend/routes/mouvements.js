const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/mouvements -> historique des mouvements de stock (200 plus récents)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM mouvements ORDER BY date_mouvement DESC LIMIT 200');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;