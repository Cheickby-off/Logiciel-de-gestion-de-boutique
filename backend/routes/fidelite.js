const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/fidelite -> paramètres actuels
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM parametres_fidelite WHERE id = 1');
    res.json(rows[0] || { fcfa_par_point: 100, seuil_recompense: 500 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/fidelite -> mettre à jour les paramètres
// body: { fcfa_par_point, seuil_recompense }
router.put('/', async (req, res) => {
  const { fcfa_par_point, seuil_recompense } = req.body;
  if (!fcfa_par_point || fcfa_par_point < 1 || !seuil_recompense || seuil_recompense < 1) {
    return res.status(400).json({ error: 'Valeurs invalides' });
  }
  try {
    await pool.query(
      `INSERT INTO parametres_fidelite (id, fcfa_par_point, seuil_recompense) VALUES (1, ?, ?)
       ON DUPLICATE KEY UPDATE fcfa_par_point = ?, seuil_recompense = ?`,
      [fcfa_par_point, seuil_recompense, fcfa_par_point, seuil_recompense]
    );
    res.json({ message: 'Programme de fidélité mis à jour' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;