const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/clients -> liste tous les clients (avec dette et points)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM clients ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients -> créer un client
router.post('/', async (req, res) => {
  try {
    const { nom, telephone, email, adresse } = req.body;
    if (!nom) return res.status(400).json({ error: 'nom est obligatoire' });
    const [result] = await pool.query(
      'INSERT INTO clients (nom, telephone, email, adresse) VALUES (?, ?, ?, ?)',
      [nom, telephone || null, email || null, adresse || null]
    );
    res.status(201).json({ id: result.insertId, nom, telephone, email, adresse, dette: 0, points: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/clients/:id -> modifier les infos d'un client
router.put('/:id', async (req, res) => {
  try {
    const { nom, telephone, email, adresse } = req.body;
    const [result] = await pool.query(
      'UPDATE clients SET nom=?, telephone=?, email=?, adresse=? WHERE id=?',
      [nom, telephone, email, adresse, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Client introuvable' });
    res.json({ message: 'Client mis à jour' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/clients/:id/paiement -> encaisser un paiement sur la dette
// body: { montant }
router.patch('/:id/paiement', async (req, res) => {
  const { montant } = req.body;
  if (!montant || montant <= 0) return res.status(400).json({ error: 'montant invalide' });
  try {
    const [rows] = await pool.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Client introuvable' });
    const nouvelleDette = Math.max(0, rows[0].dette - montant);
    await pool.query('UPDATE clients SET dette = ? WHERE id = ?', [nouvelleDette, req.params.id]);
    res.json({ message: 'Paiement enregistré', dette: nouvelleDette });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/clients/:id/recompense -> donner une récompense fidélité (débite les points)
// body: { description }
router.patch('/:id/recompense', async (req, res) => {
  const { description } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM clients WHERE id = ? FOR UPDATE', [req.params.id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Client introuvable' });
    }
    const [fideliteRows] = await connection.query('SELECT * FROM parametres_fidelite WHERE id = 1');
    const seuil = fideliteRows[0] ? fideliteRows[0].seuil_recompense : 500;
    const client = rows[0];
    if (client.points < seuil) {
      await connection.rollback();
      return res.status(400).json({ error: 'Points insuffisants pour une récompense' });
    }
    const nouveauxPoints = client.points - seuil;
    await connection.query('UPDATE clients SET points = ? WHERE id = ?', [nouveauxPoints, client.id]);
    await connection.query(
      'INSERT INTO mouvements (produit_id, produit_nom, type, quantite) VALUES (NULL, ?, ?, ?)',
      [client.nom, 'Récompense fidélité : ' + (description || ''), '']
    );
    await connection.commit();
    res.json({ message: 'Récompense enregistrée', points: nouveauxPoints });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// DELETE /api/clients/:id -> supprimer un client
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM clients WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Client introuvable' });
    res.json({ message: 'Client supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;