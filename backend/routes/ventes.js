const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/ventes -> liste des ventes avec le nom du client et du vendeur
router.get('/', async (req, res) => {
  try {
    const [ventes] = await pool.query(
      `SELECT v.*, c.nom AS client_nom, u.nom AS vendeur_nom
       FROM ventes v
       LEFT JOIN clients c ON v.client_id = c.id
       LEFT JOIN utilisateurs u ON v.utilisateur_id = u.id
       ORDER BY v.date_vente DESC`
    );
    res.json(ventes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ventes -> enregistrer une vente (ticket de caisse)
// body attendu: { client_id, utilisateur_id, remise_pct, credit, lignes: [{ produit_id, quantite }, ...] }
router.post('/', async (req, res) => {
  const { client_id, utilisateur_id, remise_pct, credit, lignes } = req.body;

  if (!lignes || lignes.length === 0) {
    return res.status(400).json({ error: 'Aucune ligne de vente fournie' });
  }
  if (credit && !client_id) {
    return res.status(400).json({ error: 'Un client est requis pour une vente à crédit' });
  }

  // Transaction : si une étape échoue, tout est annulé (stock, vente, dette, points)
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let sousTotal = 0;
    const detailsAInserer = [];

    for (const ligne of lignes) {
      const [produitRows] = await connection.query(
        'SELECT * FROM produits WHERE id = ? FOR UPDATE',
        [ligne.produit_id]
      );
      if (produitRows.length === 0) throw new Error(`Produit ${ligne.produit_id} introuvable`);
      const produit = produitRows[0];

      if (produit.quantite < ligne.quantite) {
        throw new Error(`Stock insuffisant pour ${produit.nom}`);
      }

      sousTotal += produit.prix * ligne.quantite;
      detailsAInserer.push({ produit_id: produit.id, nom: produit.nom, quantite: ligne.quantite, prix_unitaire: produit.prix });

      await connection.query('UPDATE produits SET quantite = quantite - ? WHERE id = ?', [ligne.quantite, produit.id]);
      await connection.query(
        'INSERT INTO mouvements (produit_id, produit_nom, type, quantite) VALUES (?, ?, ?, ?)',
        [produit.id, produit.nom, 'Vente', '-' + ligne.quantite]
      );
    }

    const remise = remise_pct && remise_pct > 0 ? Math.min(remise_pct, 100) : 0;
    const total = sousTotal - (sousTotal * remise / 100);

    const [venteResult] = await connection.query(
      'INSERT INTO ventes (client_id, utilisateur_id, sous_total, remise_pct, total, credit) VALUES (?, ?, ?, ?, ?, ?)',
      [client_id || null, utilisateur_id || null, sousTotal, remise, total, !!credit]
    );
    const venteId = venteResult.insertId;

    for (const d of detailsAInserer) {
      await connection.query(
        'INSERT INTO vente_details (vente_id, produit_id, quantite, prix_unitaire) VALUES (?, ?, ?, ?)',
        [venteId, d.produit_id, d.quantite, d.prix_unitaire]
      );
    }

    // Crédit + points fidélité
    let pointsGagnes = 0;
    if (client_id) {
      const [fideliteRows] = await connection.query('SELECT * FROM parametres_fidelite WHERE id = 1');
      const fcfaParPoint = fideliteRows[0] ? fideliteRows[0].fcfa_par_point : 100;
      pointsGagnes = Math.floor(total / fcfaParPoint);

      if (credit) {
        await connection.query('UPDATE clients SET dette = dette + ?, points = points + ? WHERE id = ?', [total, pointsGagnes, client_id]);
      } else if (pointsGagnes > 0) {
        await connection.query('UPDATE clients SET points = points + ? WHERE id = ?', [pointsGagnes, client_id]);
      }
    }

    await connection.commit();
    res.status(201).json({ id: venteId, sousTotal, remise, total, pointsGagnes, message: 'Vente enregistrée' });
  } catch (err) {
    await connection.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// GET /api/ventes/:id -> détail d'une vente (le contenu du ticket)
router.get('/:id', async (req, res) => {
  try {
    const [details] = await pool.query(
      `SELECT vd.*, p.nom AS produit_nom
       FROM vente_details vd
       JOIN produits p ON vd.produit_id = p.id
       WHERE vd.vente_id = ?`,
      [req.params.id]
    );
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;