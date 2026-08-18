const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/backup -> export complet de toutes les données
router.get('/', async (req, res) => {
  try {
    const [produits] = await pool.query('SELECT * FROM produits');
    const [clients] = await pool.query('SELECT * FROM clients');
    const [utilisateurs] = await pool.query('SELECT id, nom, email, role FROM utilisateurs');
    const [ventes] = await pool.query('SELECT * FROM ventes');
    const [venteDetails] = await pool.query('SELECT * FROM vente_details');
    const [mouvements] = await pool.query('SELECT * FROM mouvements');
    const [fideliteRows] = await pool.query('SELECT * FROM parametres_fidelite WHERE id = 1');

    res.json({
      version: 4,
      dateExport: new Date().toISOString(),
      produits, clients, utilisateurs, ventes, venteDetails, mouvements,
      fidelite: fideliteRows[0] || { fcfa_par_point: 100, seuil_recompense: 500 }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/backup/restaurer -> ATTENTION : remplace toutes les données actuelles
router.post('/restaurer', async (req, res) => {
  const { produits, clients, utilisateurs, ventes, venteDetails, mouvements, fidelite } = req.body;
  if (!Array.isArray(produits)) return res.status(400).json({ error: 'Format de sauvegarde invalide' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    await connection.query('TRUNCATE TABLE vente_details');
    await connection.query('TRUNCATE TABLE mouvements');
    await connection.query('TRUNCATE TABLE ventes');
    await connection.query('TRUNCATE TABLE produits');
    await connection.query('TRUNCATE TABLE clients');
    await connection.query('TRUNCATE TABLE utilisateurs');

    for (const p of produits) {
      await connection.query(
        'INSERT INTO produits (id, nom, categorie, prix, quantite, seuil_alerte, carton) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.nom, p.categorie || null, p.prix, p.quantite, p.seuil_alerte || 5, p.carton || 1]
      );
    }
    for (const c of (clients || [])) {
      await connection.query(
        'INSERT INTO clients (id, nom, telephone, email, adresse, dette, points) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [c.id, c.nom, c.telephone || null, c.email || null, c.adresse || null, c.dette || 0, c.points || 0]
      );
    }
    for (const u of (utilisateurs || [])) {
      await connection.query(
        'INSERT INTO utilisateurs (id, nom, email, mot_de_passe, role) VALUES (?, ?, ?, ?, ?)',
        [u.id, u.nom, u.email || null, u.mot_de_passe || null, u.role || 'vendeur']
      );
    }
    for (const v of (ventes || [])) {
      await connection.query(
        'INSERT INTO ventes (id, client_id, utilisateur_id, sous_total, remise_pct, total, credit, date_vente) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [v.id, v.client_id, v.utilisateur_id, v.sous_total || v.total, v.remise_pct || 0, v.total, !!v.credit, v.date_vente]
      );
    }
    for (const d of (venteDetails || [])) {
      await connection.query(
        'INSERT INTO vente_details (id, vente_id, produit_id, quantite, prix_unitaire) VALUES (?, ?, ?, ?, ?)',
        [d.id, d.vente_id, d.produit_id, d.quantite, d.prix_unitaire]
      );
    }
    for (const m of (mouvements || [])) {
      await connection.query(
        'INSERT INTO mouvements (id, produit_id, produit_nom, type, quantite, date_mouvement) VALUES (?, ?, ?, ?, ?, ?)',
        [m.id, m.produit_id, m.produit_nom, m.type, m.quantite, m.date_mouvement]
      );
    }
    if (fidelite) {
      await connection.query(
        `INSERT INTO parametres_fidelite (id, fcfa_par_point, seuil_recompense) VALUES (1, ?, ?)
         ON DUPLICATE KEY UPDATE fcfa_par_point = ?, seuil_recompense = ?`,
        [fidelite.fcfa_par_point || 100, fidelite.seuil_recompense || 500, fidelite.fcfa_par_point || 100, fidelite.seuil_recompense || 500]
      );
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();
    res.json({ message: 'Données restaurées' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;