const express = require('express');
const router = express.Router();
const pool = require('../db');

async function ajouterMouvement(connection, produit_id, produit_nom, type, quantite) {
  await connection.query(
    'INSERT INTO mouvements (produit_id, produit_nom, type, quantite) VALUES (?, ?, ?, ?)',
    [produit_id, produit_nom, type, quantite]
  );
}

// GET /api/produits -> liste tous les produits
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM produits ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/produits/:id -> un seul produit
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM produits WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Produit introuvable' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/produits -> créer un produit (+ log "Ajout initial" si quantité > 0)
router.post('/', async (req, res) => {
  const { nom, categorie, prix, quantite, seuil_alerte, carton } = req.body;
  if (!nom || prix === undefined) {
    return res.status(400).json({ error: 'nom et prix sont obligatoires' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      'INSERT INTO produits (nom, categorie, prix, quantite, seuil_alerte, carton) VALUES (?, ?, ?, ?, ?, ?)',
      [nom, categorie || null, prix, quantite || 0, seuil_alerte || 5, carton || 1]
    );
    const id = result.insertId;
    if (quantite && quantite > 0) {
      await ajouterMouvement(connection, id, nom, 'Ajout initial', '+' + quantite);
    }
    await connection.commit();
    res.status(201).json({ id, nom, categorie, prix, quantite: quantite || 0, seuil_alerte: seuil_alerte || 5, carton: carton || 1 });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// PUT /api/produits/:id -> modifier un produit (infos générales, pas le stock)
router.put('/:id', async (req, res) => {
  try {
    const { nom, categorie, prix, quantite, seuil_alerte, carton } = req.body;
    const [result] = await pool.query(
      'UPDATE produits SET nom=?, categorie=?, prix=?, quantite=?, seuil_alerte=?, carton=? WHERE id=?',
      [nom, categorie, prix, quantite, seuil_alerte, carton || 1, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Produit introuvable' });
    res.json({ message: 'Produit mis à jour' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/produits/:id/stock -> correction d'inventaire (comptage physique)
// body: { nouvelle_quantite }
router.patch('/:id/stock', async (req, res) => {
  const { nouvelle_quantite } = req.body;
  if (nouvelle_quantite === undefined || nouvelle_quantite < 0) {
    return res.status(400).json({ error: 'nouvelle_quantite invalide' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM produits WHERE id = ? FOR UPDATE', [req.params.id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Produit introuvable' });
    }
    const produit = rows[0];
    const ecart = nouvelle_quantite - produit.quantite;
    if (ecart !== 0) {
      await connection.query('UPDATE produits SET quantite = ? WHERE id = ?', [nouvelle_quantite, produit.id]);
      await ajouterMouvement(connection, produit.id, produit.nom, 'Ajustement inventaire', (ecart > 0 ? '+' : '') + ecart);
    }
    await connection.commit();
    res.json({ message: 'Stock corrigé', ecart });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// DELETE /api/produits/:id -> supprimer un produit
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM produits WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Produit introuvable' });
    res.json({ message: 'Produit supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;