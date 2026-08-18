// ============================================================
// Boutique Manager — Frontend connecté à l'API backend (Express + MySQL)
// ============================================================

// Change cette URL si ton backend tourne ailleurs qu'en local
const API_URL = 'http://localhost:3000/api';

// ---------- État local (rempli depuis l'API) ----------
let produits = [];
let clients = [];
let utilisateurs = [];
let mouvements = [];
let fidelite = { fcfa_par_point: 100, seuil_recompense: 500 };
let panier = {}; // { produitId: quantite } — le panier reste en mémoire jusqu'à la vente
let panierTotalActuel = 0;

// ---------- Fonction utilitaire pour appeler l'API ----------
async function apiFetch(path, options = {}) {
  let res;
  try {
    res = await fetch(API_URL + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
  } catch (err) {
    toast("Impossible de joindre le serveur (vérifie qu'il est démarré)");
    throw err;
  }
  let data = {};
  try { data = await res.json(); } catch (e) { /* réponse vide, ok */ }
  if (!res.ok) {
    const message = data.error || `Erreur serveur (${res.status})`;
    toast(message);
    throw new Error(message);
  }
  return data;
}

function formatFCFA(n) {
  return Number(n).toLocaleString('fr-FR') + ' FCFA';
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

// ---------- Navigation ----------
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-' + btn.dataset.page).classList.add('active');
    if (btn.dataset.page === 'caisse') renderCaisse();
    if (btn.dataset.page === 'inventaire') renderInventaire();
    if (btn.dataset.page === 'clients') renderClients();
    if (btn.dataset.page === 'statistiques') renderStatistiques();
    if (btn.dataset.page === 'utilisateurs') renderUtilisateurs();
  });
});

// ============================================================
// PRODUITS
// ============================================================

document.getElementById('btn-ajouter-produit').addEventListener('click', async () => {
  const nom = document.getElementById('input-nom').value.trim();
  const prix = parseFloat(document.getElementById('input-prix').value);
  const quantite = parseInt(document.getElementById('input-qte').value);
  let carton = parseInt(document.getElementById('input-carton').value);
  if (isNaN(carton) || carton < 1) carton = 1;

  if (!nom) { toast("Entre un nom de produit"); return; }
  if (isNaN(prix) || prix < 0) { toast("Entre un prix valide"); return; }
  if (isNaN(quantite) || quantite < 0) { toast("Entre une quantité valide"); return; }

  try {
    await apiFetch('/produits', {
      method: 'POST',
      body: JSON.stringify({ nom, prix, quantite, carton })
    });
    document.getElementById('input-nom').value = '';
    document.getElementById('input-prix').value = '';
    document.getElementById('input-qte').value = '';
    document.getElementById('input-carton').value = '';
    await renderProduits();
    toast("Produit ajouté ✓");
  } catch (err) { /* le message est déjà affiché par apiFetch */ }
});

async function supprimerProduit(id) {
  try {
    await apiFetch('/produits/' + id, { method: 'DELETE' });
    delete panier[id];
    await renderProduits();
  } catch (err) {}
}

async function renderProduits() {
  try {
    produits = await apiFetch('/produits');
  } catch (err) { return; }

  const tbody = document.getElementById('table-produits');
  const empty = document.getElementById('empty-produits');
  tbody.innerHTML = '';

  if (produits.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    produits.forEach(p => {
      const tr = document.createElement('tr');
      const seuil = p.seuil_alerte || 3;
      const stockClass = p.quantite <= seuil ? 'stock-low' : 'stock-ok';
      const carton = p.carton || 1;
      let stockDisplay = `${p.quantite}`;
      if (carton > 1) {
        const nbCartons = Math.floor(p.quantite / carton);
        const reste = p.quantite % carton;
        stockDisplay = `${p.quantite} <span class="qty-badge">(${nbCartons} carton${nbCartons > 1 ? 's' : ''}${reste ? ' + ' + reste : ''})</span>`;
      }
      tr.innerHTML = `
        <td>${escapeHtml(p.nom)}${carton > 1 ? ` <span class="qty-badge">· carton = ${carton}</span>` : ''}</td>
        <td>${formatFCFA(p.prix)}</td>
        <td class="${stockClass}">${stockDisplay}</td>
        <td><button class="btn-danger-ghost" onclick="supprimerProduit(${p.id})">Supprimer</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.getElementById('kpi-nb-produits').textContent = produits.length;
  document.getElementById('kpi-valeur-stock').textContent = formatFCFA(
    produits.reduce((sum, p) => sum + p.prix * p.quantite, 0)
  );
  document.getElementById('kpi-stock-faible').textContent =
    produits.filter(p => p.quantite <= (p.seuil_alerte || 3)).length;
}

// ============================================================
// CAISSE
// ============================================================

async function renderCaisse() {
  try {
    [produits, clients, utilisateurs] = await Promise.all([
      apiFetch('/produits'),
      apiFetch('/clients'),
      apiFetch('/utilisateurs')
    ]);
  } catch (err) { return; }
  renderCaisseUI();
}

// Redessine la caisse à partir des données déjà en mémoire (pas d'appel réseau)
// — utilisé quand on ajoute/retire simplement un article du panier.
function renderCaisseUI() {
  const liste = document.getElementById('liste-caisse-produits');
  const empty = document.getElementById('empty-caisse');
  liste.innerHTML = '';

  if (produits.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    produits.forEach(p => {
      const row = document.createElement('div');
      row.className = 'product-pick';
      const disponible = p.quantite - (panier[p.id] || 0);
      const carton = p.carton || 1;
      row.innerHTML = `
        <div class="product-pick-info">
          <div class="product-pick-name">${escapeHtml(p.nom)}</div>
          <div class="product-pick-price">${formatFCFA(p.prix)} · <span class="qty-badge">${disponible} restant(s)</span></div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <input type="number" min="1" placeholder="Qté" class="qte-manuelle" id="qte_${p.id}" style="width:56px; padding:7px 8px; border-radius:6px; border:1px solid var(--line); font-size:13px;">
          <button class="btn btn-ghost btn-sm" ${disponible <= 0 ? 'disabled' : ''} onclick="ajouterQteManuelle(${p.id})">Ajouter</button>
          ${carton > 1 ? `<button class="btn btn-ghost btn-sm" ${disponible < carton ? 'disabled' : ''} onclick="ajouterAuPanier(${p.id}, ${carton})">+1 carton (${carton})</button>` : ''}
        </div>
      `;
      liste.appendChild(row);
    });
  }
  renderPanier();

  const selectClient = document.getElementById('select-client');
  const clientActuel = selectClient.value;
  selectClient.innerHTML = '<option value="">Client de passage</option>' +
    clients.map(c => `<option value="${c.id}">${escapeHtml(c.nom)}${c.dette > 0 ? ' (doit ' + formatFCFA(c.dette) + ')' : ''}</option>`).join('');
  selectClient.value = clientActuel;

  const selectVendeur = document.getElementById('select-vendeur');
  const vendeurActuel = selectVendeur.value;
  selectVendeur.innerHTML = '<option value="">Non spécifié</option>' +
    utilisateurs.map(u => `<option value="${u.id}">${escapeHtml(u.nom)}</option>`).join('');
  selectVendeur.value = vendeurActuel;
}

function ajouterAuPanier(id, quantite = 1) {
  const p = produits.find(pr => pr.id === id);
  if (!p) return;
  const dansPanier = panier[id] || 0;
  if (dansPanier + quantite > p.quantite) { toast("Stock insuffisant"); return; }
  panier[id] = dansPanier + quantite;
  renderCaisseUI();
}

function ajouterQteManuelle(id) {
  const input = document.getElementById('qte_' + id);
  const val = parseInt(input.value);
  if (isNaN(val) || val <= 0) { toast("Entre une quantité valide"); return; }
  ajouterAuPanier(id, val);
}

function retirerDuPanier(id) {
  delete panier[id];
  renderCaisseUI();
}

function renderPanier() {
  const cont = document.getElementById('panier-liste');
  const empty = document.getElementById('empty-panier');
  cont.innerHTML = '';
  const ids = Object.keys(panier);

  if (ids.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    ids.forEach(id => {
      const p = produits.find(pr => pr.id === Number(id));
      if (!p) return;
      const item = document.createElement('div');
      item.className = 'cart-item';
      item.innerHTML = `
        <span>${escapeHtml(p.nom)} × ${panier[id]}</span>
        <span style="display:flex; align-items:center; gap:8px;">
          ${formatFCFA(p.prix * panier[id])}
          <button class="remove-x" onclick="retirerDuPanier(${id})">✕</button>
        </span>
      `;
      cont.appendChild(item);
    });
  }

  const sousTotal = ids.reduce((sum, id) => {
    const p = produits.find(pr => pr.id === Number(id));
    return sum + (p ? p.prix * panier[id] : 0);
  }, 0);

  let remisePct = parseFloat(document.getElementById('input-remise').value);
  if (isNaN(remisePct) || remisePct < 0) remisePct = 0;
  if (remisePct > 100) remisePct = 100;
  const montantRemise = sousTotal * (remisePct / 100);
  const total = sousTotal - montantRemise;

  document.getElementById('panier-sous-total').textContent = formatFCFA(sousTotal);
  const ligneRemise = document.getElementById('ligne-remise');
  if (remisePct > 0) {
    ligneRemise.style.display = 'flex';
    document.getElementById('panier-remise-montant').textContent = '-' + formatFCFA(montantRemise) + ` (${remisePct}%)`;
  } else {
    ligneRemise.style.display = 'none';
  }
  document.getElementById('panier-total').textContent = formatFCFA(total);
  panierTotalActuel = total;
  calculerMonnaie();
}

function calculerMonnaie() {
  const recu = parseFloat(document.getElementById('input-montant-recu').value);
  const ligne = document.getElementById('ligne-monnaie');
  if (isNaN(recu) || recu <= 0) {
    ligne.style.display = 'none';
    return;
  }
  const monnaie = recu - panierTotalActuel;
  ligne.style.display = 'flex';
  const span = document.getElementById('montant-monnaie');
  if (monnaie < 0) {
    span.textContent = `Manque ${formatFCFA(Math.abs(monnaie))}`;
    span.style.color = 'var(--danger)';
  } else {
    span.textContent = formatFCFA(monnaie);
    span.style.color = 'var(--money)';
  }
}

document.getElementById('btn-finaliser').addEventListener('click', async () => {
  const ids = Object.keys(panier);
  if (ids.length === 0) { toast("Le panier est vide"); return; }

  const clientId = document.getElementById('select-client').value || null;
  const vendeurId = document.getElementById('select-vendeur').value || null;
  const estCredit = document.getElementById('check-credit').checked;

  if (estCredit && !clientId) { toast("Sélectionne un client pour une vente à crédit"); return; }

  let remisePct = parseFloat(document.getElementById('input-remise').value);
  if (isNaN(remisePct) || remisePct < 0) remisePct = 0;
  if (remisePct > 100) remisePct = 100;

  const lignes = ids.map(id => ({ produit_id: Number(id), quantite: panier[id] }));

  try {
    const result = await apiFetch('/ventes', {
      method: 'POST',
      body: JSON.stringify({
        client_id: clientId ? Number(clientId) : null,
        utilisateur_id: vendeurId ? Number(vendeurId) : null,
        remise_pct: remisePct,
        credit: estCredit,
        lignes
      })
    });

    panier = {};
    document.getElementById('input-remise').value = '';
    document.getElementById('check-credit').checked = false;
    document.getElementById('input-montant-recu').value = '';
    document.getElementById('ligne-monnaie').style.display = 'none';

    await renderProduits();
    await renderCaisse();
    await renderClients();

    if (result.pointsGagnes > 0) {
      toast(`Vente enregistrée ✓ (+${result.pointsGagnes} points)`);
    } else {
      toast(estCredit ? "Vente à crédit enregistrée ✓" : "Vente enregistrée ✓");
    }
  } catch (err) { /* message déjà affiché */ }
});

// ============================================================
// INVENTAIRE
// ============================================================

async function renderInventaire() {
  try {
    [produits, mouvements] = await Promise.all([
      apiFetch('/produits'),
      apiFetch('/mouvements')
    ]);
  } catch (err) { return; }

  const tbody = document.getElementById('table-inventaire');
  const empty = document.getElementById('empty-inventaire');
  tbody.innerHTML = '';

  if (produits.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    produits.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(p.nom)}</td>
        <td>${p.quantite}</td>
        <td><input type="number" min="0" placeholder="${p.quantite}" id="compte_${p.id}" style="width:70px; padding:7px 8px; border-radius:6px; border:1px solid var(--line); font-size:13.5px;" oninput="previewEcart(${p.id})"></td>
        <td id="ecart_${p.id}" style="color:var(--ink-soft);">—</td>
        <td><button class="btn btn-ghost btn-sm" onclick="corrigerStock(${p.id})">Corriger le stock</button></td>
      `;
      tbody.appendChild(tr);
    });
  }
  renderMouvements();
}

function previewEcart(id) {
  const input = document.getElementById('compte_' + id);
  const p = produits.find(pr => pr.id === id);
  const val = parseInt(input.value);
  const cell = document.getElementById('ecart_' + id);
  if (isNaN(val) || !p) { cell.textContent = '—'; cell.style.color = 'var(--ink-soft)'; return; }
  const ecart = val - p.quantite;
  cell.textContent = (ecart > 0 ? '+' : '') + ecart;
  cell.style.color = ecart === 0 ? 'var(--money)' : (ecart < 0 ? 'var(--danger)' : 'var(--warn)');
}

async function corrigerStock(id) {
  const input = document.getElementById('compte_' + id);
  const val = parseInt(input.value);
  if (isNaN(val) || val < 0) { toast("Entre un nombre compté valide"); return; }
  try {
    const result = await apiFetch(`/produits/${id}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ nouvelle_quantite: val })
    });
    if (result.ecart === 0) { toast("Aucun écart, rien à corriger"); return; }
    await renderProduits();
    await renderInventaire();
    toast("Stock corrigé ✓");
  } catch (err) {}
}

function renderMouvements() {
  const tbody = document.getElementById('table-mouvements');
  const empty = document.getElementById('empty-mouvements');
  tbody.innerHTML = '';

  if (mouvements.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  mouvements.forEach(m => {
    const tr = document.createElement('tr');
    const qte = String(m.quantite);
    const couleur = qte.startsWith('-') ? 'var(--danger)' : 'var(--money)';
    const date = new Date(m.date_mouvement).toLocaleString('fr-FR');
    tr.innerHTML = `
      <td style="font-size:13px; color:var(--ink-soft);">${date}</td>
      <td>${escapeHtml(m.produit_nom)}</td>
      <td>${escapeHtml(m.type)}</td>
      <td style="color:${couleur}; font-weight:700;">${escapeHtml(qte)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ============================================================
// CLIENTS
// ============================================================

async function renderClients() {
  try {
    [clients, fidelite] = await Promise.all([
      apiFetch('/clients'),
      apiFetch('/fidelite')
    ]);
  } catch (err) { return; }

  const tbody = document.getElementById('table-clients');
  const empty = document.getElementById('empty-clients');
  tbody.innerHTML = '';

  if (clients.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    clients.forEach(c => {
      const dette = c.dette || 0;
      const points = c.points || 0;
      const eligible = points >= fidelite.seuil_recompense;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(c.nom)}</td>
        <td>${escapeHtml(c.telephone || '—')}</td>
        <td style="color:${dette > 0 ? 'var(--danger)' : 'var(--money)'}; font-weight:700;">${formatFCFA(dette)}</td>
        <td>${points} ${eligible ? '<span style="color:var(--warn); font-weight:700;">🎁 éligible</span>' : ''}</td>
        <td style="display:flex; gap:6px; flex-wrap:wrap;">
          ${dette > 0 ? `<button class="btn btn-ghost btn-sm" onclick="encaisserPaiement(${c.id})">Encaisser</button>` : ''}
          ${eligible ? `<button class="btn btn-money btn-sm" onclick="donnerRecompense(${c.id})">Donner récompense</button>` : ''}
          <button class="btn-danger-ghost" onclick="supprimerClient(${c.id})">Supprimer</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
  document.getElementById('kpi-nb-clients').textContent = clients.length;
  document.getElementById('kpi-total-dette').textContent = formatFCFA(clients.reduce((s, c) => s + (c.dette || 0), 0));
  document.getElementById('kpi-eligibles').textContent = clients.filter(c => (c.points || 0) >= fidelite.seuil_recompense).length;

  document.getElementById('input-fcfa-par-point').value = fidelite.fcfa_par_point;
  document.getElementById('input-seuil-recompense').value = fidelite.seuil_recompense;
}

document.getElementById('btn-sauver-fidelite').addEventListener('click', async () => {
  const fcfa_par_point = parseInt(document.getElementById('input-fcfa-par-point').value);
  const seuil_recompense = parseInt(document.getElementById('input-seuil-recompense').value);
  if (isNaN(fcfa_par_point) || fcfa_par_point < 1 || isNaN(seuil_recompense) || seuil_recompense < 1) {
    toast("Entre des valeurs valides"); return;
  }
  try {
    await apiFetch('/fidelite', {
      method: 'PUT',
      body: JSON.stringify({ fcfa_par_point, seuil_recompense })
    });
    await renderClients();
    toast("Programme de fidélité mis à jour ✓");
  } catch (err) {}
});

async function donnerRecompense(id) {
  const client = clients.find(c => c.id === id);
  if (!client) return;
  const description = prompt(`Quelle récompense donnes-tu à ${client.nom} ? (ex: bon restaurant, réduction, cadeau...)`);
  if (description === null || description.trim() === '') return;
  try {
    await apiFetch(`/clients/${id}/recompense`, {
      method: 'PATCH',
      body: JSON.stringify({ description: description.trim() })
    });
    await renderClients();
    toast("Récompense enregistrée ✓");
  } catch (err) {}
}

document.getElementById('btn-ajouter-client').addEventListener('click', async () => {
  const nom = document.getElementById('input-client-nom').value.trim();
  const telephone = document.getElementById('input-client-tel').value.trim();
  if (!nom) { toast("Entre un nom de client"); return; }
  try {
    await apiFetch('/clients', {
      method: 'POST',
      body: JSON.stringify({ nom, telephone })
    });
    document.getElementById('input-client-nom').value = '';
    document.getElementById('input-client-tel').value = '';
    await renderClients();
    toast("Client ajouté ✓");
  } catch (err) {}
});

async function encaisserPaiement(id) {
  const client = clients.find(c => c.id === id);
  if (!client) return;
  const montant = parseFloat(prompt(`Montant payé par ${client.nom} (dette actuelle : ${formatFCFA(client.dette || 0)}) :`));
  if (isNaN(montant) || montant <= 0) return;
  try {
    await apiFetch(`/clients/${id}/paiement`, {
      method: 'PATCH',
      body: JSON.stringify({ montant })
    });
    await renderClients();
    toast("Paiement enregistré ✓");
  } catch (err) {}
}

async function supprimerClient(id) {
  try {
    await apiFetch('/clients/' + id, { method: 'DELETE' });
    await renderClients();
    await renderCaisse();
  } catch (err) {}
}

// ============================================================
// STATISTIQUES
// ============================================================

async function renderStatistiques() {
  let jour, mois, semaine, topProduits, clientsData, resume;
  try {
    [jour, mois, semaine, topProduits, clientsData, resume] = await Promise.all([
      apiFetch('/stats/jour'),
      apiFetch('/stats/mois'),
      apiFetch('/stats/7jours'),
      apiFetch('/stats/top-produits'),
      apiFetch('/clients'),
      apiFetch('/stats/resume')
    ]);
  } catch (err) { return; }

  const totalCredit = clientsData.reduce((s, c) => s + (c.dette || 0), 0);

  document.getElementById('kpi-vente-jour').textContent = formatFCFA(jour.total);
  document.getElementById('kpi-vente-mois').textContent = formatFCFA(mois.total);
  document.getElementById('kpi-total-encaisse').textContent = formatFCFA(resume.chiffre_affaires);
  document.getElementById('kpi-credit-cours').textContent = formatFCFA(totalCredit);

  // Graphique 7 derniers jours
  const joursLabels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    joursLabels.push(d);
  }
  const totauxParJour = joursLabels.map(d => {
    const iso = d.toISOString().slice(0, 10);
    const trouve = semaine.find(s => {
      const sJour = typeof s.jour === 'string' ? s.jour.slice(0, 10) : new Date(s.jour).toISOString().slice(0, 10);
      return sJour === iso;
    });
    return trouve ? Number(trouve.total) : 0;
  });
  const maxVal = Math.max(...totauxParJour, 1);
  const chart = document.getElementById('chart-7jours');
  chart.innerHTML = '';
  joursLabels.forEach((d, i) => {
    const pct = Math.round((totauxParJour[i] / maxVal) * 100);
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:6px; flex:1;';
    bar.innerHTML = `
      <div style="font-size:11px; color:var(--ink-soft); font-weight:700;">${totauxParJour[i] > 0 ? Math.round(totauxParJour[i] / 1000) + 'k' : '0'}</div>
      <div style="width:100%; max-width:32px; height:120px; display:flex; align-items:flex-end; background:var(--primary-soft); border-radius:4px; overflow:hidden;">
        <div style="width:100%; height:${pct}%; background:var(--primary);"></div>
      </div>
      <div style="font-size:11px; color:var(--ink-soft);">${d.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
    `;
    chart.appendChild(bar);
  });

  // Top produits
  const tbody = document.getElementById('table-top-produits');
  const emptyTop = document.getElementById('empty-top-produits');
  tbody.innerHTML = '';
  if (topProduits.length === 0) {
    emptyTop.style.display = 'block';
  } else {
    emptyTop.style.display = 'none';
    topProduits.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(row.nom)}</td><td>${row.total_vendu}</td><td>${formatFCFA(row.revenu)}</td>`;
      tbody.appendChild(tr);
    });
  }
}

async function exporterCSV() {
  let produitsData, ventesData;
  try {
    [produitsData, ventesData] = await Promise.all([apiFetch('/produits'), apiFetch('/ventes')]);
  } catch (err) { return; }

  let csv = "PRODUITS\nNom;Prix;Stock\n";
  produitsData.forEach(p => csv += `${p.nom};${p.prix};${p.quantite}\n`);
  csv += "\nVENTES\nDate;Total;Remise %;Client;Vendeur;Credit\n";
  ventesData.forEach(v => {
    csv += `${new Date(v.date_vente).toLocaleString('fr-FR')};${v.total};${v.remise_pct};${v.client_nom || 'Client de passage'};${v.vendeur_nom || ''};${v.credit ? 'Oui' : 'Non'}\n`;
  });
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `boutique-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast("Export CSV téléchargé ✓");
}

function imprimerRapport() {
  window.print();
}

// ============================================================
// UTILISATEURS
// ============================================================

async function renderUtilisateurs() {
  try {
    utilisateurs = await apiFetch('/utilisateurs');
  } catch (err) { return; }

  const tbody = document.getElementById('table-utilisateurs');
  const empty = document.getElementById('empty-utilisateurs');
  tbody.innerHTML = '';

  if (utilisateurs.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    utilisateurs.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(u.nom)}</td>
        <td>${escapeHtml(u.role)}</td>
        <td><button class="btn-danger-ghost" onclick="supprimerUtilisateur(${u.id})">Supprimer</button></td>
      `;
      tbody.appendChild(tr);
    });
  }
}

document.getElementById('btn-ajouter-utilisateur').addEventListener('click', async () => {
  const nom = document.getElementById('input-user-nom').value.trim();
  const role = document.getElementById('input-user-role').value;
  if (!nom) { toast("Entre un nom"); return; }
  try {
    await apiFetch('/utilisateurs', {
      method: 'POST',
      body: JSON.stringify({ nom, role })
    });
    document.getElementById('input-user-nom').value = '';
    await renderUtilisateurs();
    await renderCaisse();
    toast("Utilisateur ajouté ✓");
  } catch (err) {}
});

async function supprimerUtilisateur(id) {
  try {
    await apiFetch('/utilisateurs/' + id, { method: 'DELETE' });
    await renderUtilisateurs();
    await renderCaisse();
  } catch (err) {}
}

// ============================================================
// SAUVEGARDE / RESTAURATION
// ============================================================

async function exporterDonnees() {
  try {
    const sauvegarde = await apiFetch('/backup');
    const blob = new Blob([JSON.stringify(sauvegarde, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `boutique-sauvegarde-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("Sauvegarde téléchargée ✓");
  } catch (err) {}
}

function restaurerDonnees(file) {
  if (!file) return;
  const confirmation = confirm(
    "Restaurer cette sauvegarde va REMPLACER toutes les données actuelles (produits, clients, ventes, historique).\n\nContinuer ?"
  );
  if (!confirmation) {
    document.getElementById('input-restaurer').value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      await apiFetch('/backup/restaurer', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      await renderProduits();
      await renderCaisse();
      await renderInventaire();
      await renderClients();
      await renderUtilisateurs();
      toast("Données restaurées ✓");
    } catch (err) {
      toast("Fichier de sauvegarde invalide");
    }
    document.getElementById('input-restaurer').value = '';
  };
  reader.readAsText(file);
}

// ---------- Démarrage ----------
renderProduits();