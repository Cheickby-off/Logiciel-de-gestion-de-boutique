// server.js
// Point d'entrée du serveur. Lance ce fichier avec: npm start

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const produitsRoutes = require('./routes/produits');
const clientsRoutes = require('./routes/clients');
const ventesRoutes = require('./routes/ventes');
const statsRoutes = require('./routes/stats');
const utilisateursRoutes = require('./routes/utilisateurs');
const mouvementsRoutes = require('./routes/mouvements');
const fideliteRoutes = require('./routes/fidelite');
const backupRoutes = require('./routes/backup');

const app = express();

app.use(cors());           // autorise ton frontend (fichier HTML) à appeler cette API
app.use(express.json());   // permet de lire le JSON envoyé dans req.body

// On "branche" chaque groupe de routes sous un préfixe
app.use('/api/produits', produitsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/ventes', ventesRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/utilisateurs', utilisateursRoutes);
app.use('/api/mouvements', mouvementsRoutes);
app.use('/api/fidelite', fideliteRoutes);
app.use('/api/backup', backupRoutes);

// Route de test pour vérifier que le serveur tourne
app.get('/', (req, res) => {
  res.json({ message: 'API Boutique Manager en ligne ✅' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});