
CREATE DATABASE IF NOT EXISTS boutique_manager;
USE boutique_manager;

-- ---------- Table Produits ------
CREATE TABLE IF NOT EXISTS produits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(150) NOT NULL,
    categorie VARCHAR(100),
    prix DECIMAL(10,2) NOT NULL,
    quantite INT NOT NULL DEFAULT 0,
    seuil_alerte INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Table Clients ----------
CREATE TABLE IF NOT EXISTS clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(150) NOT NULL,
    telephone VARCHAR(30),
    email VARCHAR(150),
    adresse VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Table Utilisateurs (comptes du personnel) ----------
CREATE TABLE IF NOT EXISTS utilisateurs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    mot_de_passe VARCHAR(255) NOT NULL,
    role ENUM('admin', 'vendeur') DEFAULT 'vendeur',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Table Ventes (une vente = un ticket de caisse) ----------
CREATE TABLE IF NOT EXISTS ventes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NULL,
    utilisateur_id INT NULL,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    date_vente TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL
);

-- ---------- Table Détails de vente (les lignes d'un ticket) ----------
CREATE TABLE IF NOT EXISTS vente_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vente_id INT NOT NULL,
    produit_id INT NOT NULL,
    quantite INT NOT NULL,
    prix_unitaire DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE CASCADE,
    FOREIGN KEY (produit_id) REFERENCES produits(id)
);

-- ---------- Quelques données de test (optionnel) ----------
INSERT INTO produits (nom, categorie, prix, quantite) VALUES
('Riz 25kg', 'Alimentation', 15000, 30),
('Huile 1L', 'Alimentation', 1200, 50),
('Savon', 'Hygiène', 500, 100);

INSERT INTO utilisateurs (nom, email, mot_de_passe, role) VALUES
('Admin', 'admin@boutique.com', 'admin123', 'admin');