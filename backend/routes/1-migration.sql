-- ============================================================
-- MIGRATION : à exécuter UNE FOIS sur ta base boutique_manager
-- existante. Ça n'efface aucune donnée, ça ajoute juste ce qui
-- manque pour supporter carton, dette, points, remise, etc.
-- ============================================================

USE boutique_manager;

-- ---------- Produits : vente par carton ----------
ALTER TABLE produits
    ADD COLUMN carton INT NOT NULL DEFAULT 1;

-- ---------- Clients : dette (crédit) et points de fidélité ----------
ALTER TABLE clients
    ADD COLUMN dette DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN points INT NOT NULL DEFAULT 0;

-- ---------- Ventes : sous-total, remise, indicateur crédit ----------
ALTER TABLE ventes
    ADD COLUMN sous_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN remise_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN credit BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------- Utilisateurs : email/mot de passe deviennent optionnels ----------
-- (le frontend n'a pas d'écran de connexion, ce sont juste des noms de vendeurs)
ALTER TABLE utilisateurs
    MODIFY email VARCHAR(150) NULL,
    MODIFY mot_de_passe VARCHAR(255) NULL,
    MODIFY role VARCHAR(50) NOT NULL DEFAULT 'vendeur';

-- ---------- Historique des mouvements de stock ----------
CREATE TABLE IF NOT EXISTS mouvements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produit_id INT NULL,
    produit_nom VARCHAR(150) NOT NULL,
    type VARCHAR(100) NOT NULL,
    quantite VARCHAR(20) NOT NULL DEFAULT '',
    date_mouvement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE SET NULL
);

-- ---------- Paramètres du programme de fidélité (une seule ligne, id=1) ----------
CREATE TABLE IF NOT EXISTS parametres_fidelite (
    id INT PRIMARY KEY DEFAULT 1,
    fcfa_par_point INT NOT NULL DEFAULT 100,
    seuil_recompense INT NOT NULL DEFAULT 500
);

INSERT INTO parametres_fidelite (id, fcfa_par_point, seuil_recompense)
VALUES (1, 100, 500)
ON DUPLICATE KEY UPDATE id = id;