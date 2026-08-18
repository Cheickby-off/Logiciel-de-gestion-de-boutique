// db.js
// Crée un "pool" de connexions vers MySQL Workbench / MySQL Server.
// Un pool = plusieurs connexions réutilisables, plus efficace qu'une seule connexion.

require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;