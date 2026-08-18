const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/stats/resume -> chiffre d'affaires total + nombre de ventes
router.get('/resume', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS nb_ventes, COALESCE(SUM(total), 0) AS chiffre_affaires
       FROM ventes`
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/jour -> total des ventes d'aujourd'hui
router.get('/jour', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS total FROM ventes WHERE DATE(date_vente) = CURDATE()`
    );
    res.json({ total: rows[0].total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/mois -> total des ventes du mois en cours
router.get('/mois', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS total FROM ventes
       WHERE YEAR(date_vente) = YEAR(CURDATE()) AND MONTH(date_vente) = MONTH(CURDATE())`
    );
    res.json({ total: rows[0].total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/7jours -> total des ventes par jour sur les 7 derniers jours
router.get('/7jours', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DATE(date_vente) AS jour, COALESCE(SUM(total), 0) AS total
       FROM ventes
       WHERE date_vente >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(date_vente)`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/top-produits -> les produits les plus vendus (par revenu)
router.get('/top-produits', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.nom, SUM(vd.quantite) AS total_vendu, SUM(vd.quantite * vd.prix_unitaire) AS revenu
       FROM vente_details vd
       JOIN produits p ON vd.produit_id = p.id
       GROUP BY p.id, p.nom
       ORDER BY revenu DESC
       LIMIT 5`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/alertes-stock -> produits sous leur seuil d'alerte
router.get('/alertes-stock', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM produits WHERE quantite <= seuil_alerte'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;