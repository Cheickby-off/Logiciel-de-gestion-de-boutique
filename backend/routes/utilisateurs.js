const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/utilisateurs -> liste (sans les mots de passe)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, nom, email, role, created_at FROM utilisateurs ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/utilisateurs -> créer un compte
// Seul "nom" est obligatoire : email/mot_de_passe restent optionnels
// (le frontend s'en sert comme simple liste de vendeurs, sans écran de connexion)
router.post('/', async (req, res) => {
  try {
    const { nom, email, mot_de_passe, role } = req.body;
    if (!nom) return res.status(400).json({ error: 'nom est obligatoire' });
    const [result] = await pool.query(
      'INSERT INTO utilisateurs (nom, email, mot_de_passe, role) VALUES (?, ?, ?, ?)',
      [nom, email || null, mot_de_passe || null, role || 'vendeur']
    );
    res.status(201).json({ id: result.insertId, nom, email: email || null, role: role || 'vendeur' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/utilisateurs/login -> connexion simple (si email/mot de passe sont utilisés)
router.post('/login', async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;
    const [rows] = await pool.query(
      'SELECT id, nom, email, role FROM utilisateurs WHERE email = ? AND mot_de_passe = ?',
      [email, mot_de_passe]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/utilisateurs/:id -> supprimer un compte
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM utilisateurs WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;