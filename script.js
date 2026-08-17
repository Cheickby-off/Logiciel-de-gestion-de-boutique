// ---------- Stockage local ----------
  const STORAGE_KEY = 'boutique_produits_v1';
  const MOUVEMENTS_KEY = 'boutique_mouvements_v1';
  const CLIENTS_KEY = 'boutique_clients_v1';
  const VENTES_KEY = 'boutique_ventes_v1';
  const UTILISATEURS_KEY = 'boutique_utilisateurs_v1';
  const FIDELITE_KEY = 'boutique_fidelite_v1';
  let produits = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  let mouvements = JSON.parse(localStorage.getItem(MOUVEMENTS_KEY) || '[]');
  let clients = JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]');
  let ventes = JSON.parse(localStorage.getItem(VENTES_KEY) || '[]');
  let utilisateurs = JSON.parse(localStorage.getItem(UTILISATEURS_KEY) || '[]');
  let fidelite = JSON.parse(localStorage.getItem(FIDELITE_KEY) || 'null') || { fcfaParPoint: 100, seuilRecompense: 500 };
  let panier = {}; // { produitId: quantite }
  let panierTotalActuel = 0;

  function sauvegarder(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(produits));
  }

  function sauvegarderMouvements(){
    localStorage.setItem(MOUVEMENTS_KEY, JSON.stringify(mouvements));
  }

  function sauvegarderClients(){
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  }

  function sauvegarderVentes(){
    localStorage.setItem(VENTES_KEY, JSON.stringify(ventes));
  }

  function sauvegarderUtilisateurs(){
    localStorage.setItem(UTILISATEURS_KEY, JSON.stringify(utilisateurs));
  }

  function sauvegarderFidelite(){
    localStorage.setItem(FIDELITE_KEY, JSON.stringify(fidelite));
  }

  function ajouterMouvement(produitNom, type, quantite){
    mouvements.unshift({
      date: new Date().toLocaleString('fr-FR'),
      produit: produitNom,
      type: type,
      quantite: quantite
    });
    sauvegarderMouvements();
  }

  function formatFCFA(n){
    return Number(n).toLocaleString('fr-FR') + ' FCFA';
  }

  function toast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(()=> t.classList.remove('show'), 2200);
  }

  // ---------- Navigation ----------
  document.querySelectorAll('.nav-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('page-' + btn.dataset.page).classList.add('active');
      if(btn.dataset.page === 'caisse') renderCaisse();
      if(btn.dataset.page === 'inventaire') renderInventaire();
      if(btn.dataset.page === 'clients') renderClients();
      if(btn.dataset.page === 'statistiques') renderStatistiques();
      if(btn.dataset.page === 'utilisateurs') renderUtilisateurs();
    });
  });

  // ---------- Ajout produit ----------
  document.getElementById('btn-ajouter-produit').addEventListener('click', ()=>{
    const nom = document.getElementById('input-nom').value.trim();
    const prix = parseFloat(document.getElementById('input-prix').value);
    const qte = parseInt(document.getElementById('input-qte').value);
    let carton = parseInt(document.getElementById('input-carton').value);
    if(isNaN(carton) || carton < 1) carton = 1;

    if(!nom){ toast("Entre un nom de produit"); return; }
    if(isNaN(prix) || prix < 0){ toast("Entre un prix valide"); return; }
    if(isNaN(qte) || qte < 0){ toast("Entre une quantité valide"); return; }

    produits.push({
      id: 'p_' + Date.now(),
      nom, prix, qte, carton
    });
    sauvegarder();
    if(qte > 0) ajouterMouvement(nom, 'Ajout initial', '+' + qte);
    document.getElementById('input-nom').value = '';
    document.getElementById('input-prix').value = '';
    document.getElementById('input-qte').value = '';
    document.getElementById('input-carton').value = '';
    renderProduits();
    toast("Produit ajouté ✓");
  });

  function supprimerProduit(id){
    produits = produits.filter(p => p.id !== id);
    delete panier[id];
    sauvegarder();
    renderProduits();
  }

  // ---------- Rendu page Produits ----------
  function renderProduits(){
    const tbody = document.getElementById('table-produits');
    const empty = document.getElementById('empty-produits');
    tbody.innerHTML = '';

    if(produits.length === 0){
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      produits.forEach(p=>{
        const tr = document.createElement('tr');
        const stockClass = p.qte <= 3 ? 'stock-low' : 'stock-ok';
        const carton = p.carton || 1;
        let stockDisplay = `${p.qte}`;
        if(carton > 1){
          const nbCartons = Math.floor(p.qte / carton);
          const reste = p.qte % carton;
          stockDisplay = `${p.qte} <span class="qty-badge">(${nbCartons} carton${nbCartons>1?'s':''}${reste ? ' + ' + reste : ''})</span>`;
        }
        tr.innerHTML = `
          <td>${escapeHtml(p.nom)}${carton > 1 ? ` <span class="qty-badge">· carton = ${carton}</span>` : ''}</td>
          <td>${formatFCFA(p.prix)}</td>
          <td class="${stockClass}">${stockDisplay}</td>
          <td><button class="btn-danger-ghost" onclick="supprimerProduit('${p.id}')">Supprimer</button></td>
        `;
        tbody.appendChild(tr);
      });
    }

    document.getElementById('kpi-nb-produits').textContent = produits.length;
    document.getElementById('kpi-valeur-stock').textContent = formatFCFA(
      produits.reduce((sum,p)=> sum + p.prix * p.qte, 0)
    );
    document.getElementById('kpi-stock-faible').textContent =
      produits.filter(p=> p.qte <= 3).length;
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Rendu page Caisse ----------
  function renderCaisse(){
    const liste = document.getElementById('liste-caisse-produits');
    const empty = document.getElementById('empty-caisse');
    liste.innerHTML = '';

    if(produits.length === 0){
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      produits.forEach(p=>{
        const row = document.createElement('div');
        row.className = 'product-pick';
        const disponible = p.qte - (panier[p.id] || 0);
        const carton = p.carton || 1;
        row.innerHTML = `
          <div class="product-pick-info">
            <div class="product-pick-name">${escapeHtml(p.nom)}</div>
            <div class="product-pick-price">${formatFCFA(p.prix)} · <span class="qty-badge">${disponible} restant(s)</span></div>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="number" min="1" placeholder="Qté" class="qte-manuelle" id="qte_${p.id}" style="width:56px; padding:7px 8px; border-radius:6px; border:1px solid var(--line); font-size:13px;">
            <button class="btn btn-ghost btn-sm" ${disponible <= 0 ? 'disabled' : ''} onclick="ajouterQteManuelle('${p.id}')">Ajouter</button>
            ${carton > 1 ? `<button class="btn btn-ghost btn-sm" ${disponible < carton ? 'disabled' : ''} onclick="ajouterAuPanier('${p.id}', ${carton})">+1 carton (${carton})</button>` : ''}
          </div>
        `;
        liste.appendChild(row);
      });
    }
    renderPanier();

    // Remplir les listes déroulantes client et vendeur
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

  function ajouterAuPanier(id, quantite = 1){
    const p = produits.find(pr => pr.id === id);
    const dansPanier = panier[id] || 0;
    if(dansPanier + quantite > p.qte){ toast("Stock insuffisant"); return; }
    panier[id] = dansPanier + quantite;
    renderCaisse();
  }

  function ajouterQteManuelle(id){
    const input = document.getElementById('qte_' + id);
    const val = parseInt(input.value);
    if(isNaN(val) || val <= 0){ toast("Entre une quantité valide"); return; }
    ajouterAuPanier(id, val);
  }

  function retirerDuPanier(id){
    delete panier[id];
    renderCaisse();
  }

  function renderPanier(){
    const cont = document.getElementById('panier-liste');
    const empty = document.getElementById('empty-panier');
    cont.innerHTML = '';
    const ids = Object.keys(panier);

    if(ids.length === 0){
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      ids.forEach(id=>{
        const p = produits.find(pr => pr.id === id);
        if(!p) return;
        const item = document.createElement('div');
        item.className = 'cart-item';
        item.innerHTML = `
          <span>${escapeHtml(p.nom)} × ${panier[id]}</span>
          <span style="display:flex; align-items:center; gap:8px;">
            ${formatFCFA(p.prix * panier[id])}
            <button class="remove-x" onclick="retirerDuPanier('${id}')">✕</button>
          </span>
        `;
        cont.appendChild(item);
      });
    }

    const sousTotal = ids.reduce((sum, id)=>{
      const p = produits.find(pr => pr.id === id);
      return sum + (p ? p.prix * panier[id] : 0);
    }, 0);

    let remisePct = parseFloat(document.getElementById('input-remise').value);
    if(isNaN(remisePct) || remisePct < 0) remisePct = 0;
    if(remisePct > 100) remisePct = 100;
    const montantRemise = sousTotal * (remisePct / 100);
    const total = sousTotal - montantRemise;

    document.getElementById('panier-sous-total').textContent = formatFCFA(sousTotal);
    const ligneRemise = document.getElementById('ligne-remise');
    if(remisePct > 0){
      ligneRemise.style.display = 'flex';
      document.getElementById('panier-remise-montant').textContent = '-' + formatFCFA(montantRemise) + ` (${remisePct}%)`;
    } else {
      ligneRemise.style.display = 'none';
    }
    document.getElementById('panier-total').textContent = formatFCFA(total);
    panierTotalActuel = total;
    calculerMonnaie();
  }

  function calculerMonnaie(){
    const recu = parseFloat(document.getElementById('input-montant-recu').value);
    const ligne = document.getElementById('ligne-monnaie');
    if(isNaN(recu) || recu <= 0){
      ligne.style.display = 'none';
      return;
    }
    const monnaie = recu - panierTotalActuel;
    ligne.style.display = 'flex';
    const span = document.getElementById('montant-monnaie');
    if(monnaie < 0){
      span.textContent = `Manque ${formatFCFA(Math.abs(monnaie))}`;
      span.style.color = 'var(--danger)';
    } else {
      span.textContent = formatFCFA(monnaie);
      span.style.color = 'var(--money)';
    }
  }

  document.getElementById('btn-finaliser').addEventListener('click', ()=>{
    const ids = Object.keys(panier);
    if(ids.length === 0){ toast("Le panier est vide"); return; }

    const clientId = document.getElementById('select-client').value;
    const vendeurId = document.getElementById('select-vendeur').value;
    const estCredit = document.getElementById('check-credit').checked;

    if(estCredit && !clientId){ toast("Sélectionne un client pour une vente à crédit"); return; }

    let sousTotal = 0;
    const items = ids.map(id=>{
      const p = produits.find(pr=>pr.id===id);
      sousTotal += p.prix * panier[id];
      return { produitId: id, nom: p.nom, qte: panier[id], prixUnitaire: p.prix };
    });

    let remisePct = parseFloat(document.getElementById('input-remise').value);
    if(isNaN(remisePct) || remisePct < 0) remisePct = 0;
    if(remisePct > 100) remisePct = 100;
    const total = sousTotal - (sousTotal * remisePct / 100);

    ids.forEach(id=>{
      const p = produits.find(pr => pr.id === id);
      if(p){
        p.qte -= panier[id];
        ajouterMouvement(p.nom, 'Vente', '-' + panier[id]);
      }
    });
    sauvegarder();

    ventes.push({
      id: 'v_' + Date.now(),
      date: new Date().toISOString(),
      items, sousTotal, remisePct, total,
      clientId: clientId || null,
      vendeurId: vendeurId || null,
      credit: estCredit
    });
    sauvegarderVentes();

    if(estCredit && clientId){
      const client = clients.find(c => c.id === clientId);
      if(client){
        client.dette = (client.dette || 0) + total;
        sauvegarderClients();
      }
    }

    let pointsGagnes = 0;
    let clientPourToast = null;
    if(clientId){
      const client = clients.find(c => c.id === clientId);
      if(client){
        pointsGagnes = Math.floor(total / fidelite.fcfaParPoint);
        client.points = (client.points || 0) + pointsGagnes;
        sauvegarderClients();
        clientPourToast = client;
      }
    }

    panier = {};
    document.getElementById('input-remise').value = '';
    document.getElementById('check-credit').checked = false;
    document.getElementById('input-montant-recu').value = '';
    document.getElementById('ligne-monnaie').style.display = 'none';
    renderProduits();
    renderCaisse();
    renderClients();

    if(clientPourToast && clientPourToast.points >= fidelite.seuilRecompense){
      toast(`Vente enregistrée ✓ — ${clientPourToast.nom} est éligible à une récompense 🎁`);
    } else if(pointsGagnes > 0){
      toast(`Vente enregistrée ✓ (+${pointsGagnes} points)`);
    } else {
      toast(estCredit ? "Vente à crédit enregistrée ✓" : "Vente enregistrée ✓");
    }
  });

  // ---------- Inventaire ----------
  function renderInventaire(){
    const tbody = document.getElementById('table-inventaire');
    const empty = document.getElementById('empty-inventaire');
    tbody.innerHTML = '';

    if(produits.length === 0){
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      produits.forEach(p=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(p.nom)}</td>
          <td>${p.qte}</td>
          <td><input type="number" min="0" placeholder="${p.qte}" id="compte_${p.id}" style="width:70px; padding:7px 8px; border-radius:6px; border:1px solid var(--line); font-size:13.5px;" oninput="previewEcart('${p.id}')"></td>
          <td id="ecart_${p.id}" style="color:var(--ink-soft);">—</td>
          <td><button class="btn btn-ghost btn-sm" onclick="corrigerStock('${p.id}')">Corriger le stock</button></td>
        `;
        tbody.appendChild(tr);
      });
    }
    renderMouvements();
  }

  function previewEcart(id){
    const input = document.getElementById('compte_' + id);
    const p = produits.find(pr => pr.id === id);
    const val = parseInt(input.value);
    const cell = document.getElementById('ecart_' + id);
    if(isNaN(val)){ cell.textContent = '—'; cell.style.color = 'var(--ink-soft)'; return; }
    const ecart = val - p.qte;
    cell.textContent = (ecart > 0 ? '+' : '') + ecart;
    cell.style.color = ecart === 0 ? 'var(--money)' : (ecart < 0 ? 'var(--danger)' : 'var(--warn)');
  }

  function corrigerStock(id){
    const input = document.getElementById('compte_' + id);
    const val = parseInt(input.value);
    if(isNaN(val) || val < 0){ toast("Entre un nombre compté valide"); return; }
    const p = produits.find(pr => pr.id === id);
    const ecart = val - p.qte;
    if(ecart === 0){ toast("Aucun écart, rien à corriger"); return; }
    p.qte = val;
    sauvegarder();
    ajouterMouvement(p.nom, 'Ajustement inventaire', (ecart > 0 ? '+' : '') + ecart);
    renderProduits();
    renderInventaire();
    toast("Stock corrigé ✓");
  }

  function renderMouvements(){
    const tbody = document.getElementById('table-mouvements');
    const empty = document.getElementById('empty-mouvements');
    tbody.innerHTML = '';

    if(mouvements.length === 0){
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    mouvements.forEach(m=>{
      const tr = document.createElement('tr');
      const couleur = m.quantite.toString().startsWith('-') ? 'var(--danger)' : 'var(--money)';
      tr.innerHTML = `
        <td style="font-size:13px; color:var(--ink-soft);">${m.date}</td>
        <td>${escapeHtml(m.produit)}</td>
        <td>${m.type}</td>
        <td style="color:${couleur}; font-weight:700;">${m.quantite}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ---------- Clients ----------
  function renderClients(){
    const tbody = document.getElementById('table-clients');
    const empty = document.getElementById('empty-clients');
    tbody.innerHTML = '';

    if(clients.length === 0){
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      clients.forEach(c=>{
        const dette = c.dette || 0;
        const points = c.points || 0;
        const eligible = points >= fidelite.seuilRecompense;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(c.nom)}</td>
          <td>${escapeHtml(c.telephone || '—')}</td>
          <td style="color:${dette > 0 ? 'var(--danger)' : 'var(--money)'}; font-weight:700;">${formatFCFA(dette)}</td>
          <td>${points} ${eligible ? '<span style="color:var(--warn); font-weight:700;">🎁 éligible</span>' : ''}</td>
          <td style="display:flex; gap:6px; flex-wrap:wrap;">
            ${dette > 0 ? `<button class="btn btn-ghost btn-sm" onclick="encaisserPaiement('${c.id}')">Encaisser</button>` : ''}
            ${eligible ? `<button class="btn btn-money btn-sm" onclick="donnerRecompense('${c.id}')">Donner récompense</button>` : ''}
            <button class="btn-danger-ghost" onclick="supprimerClient('${c.id}')">Supprimer</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
    document.getElementById('kpi-nb-clients').textContent = clients.length;
    document.getElementById('kpi-total-dette').textContent = formatFCFA(clients.reduce((s,c)=> s + (c.dette || 0), 0));
    document.getElementById('kpi-eligibles').textContent = clients.filter(c => (c.points || 0) >= fidelite.seuilRecompense).length;

    document.getElementById('input-fcfa-par-point').value = fidelite.fcfaParPoint;
    document.getElementById('input-seuil-recompense').value = fidelite.seuilRecompense;
  }

  document.getElementById('btn-sauver-fidelite').addEventListener('click', ()=>{
    const fcfa = parseInt(document.getElementById('input-fcfa-par-point').value);
    const seuil = parseInt(document.getElementById('input-seuil-recompense').value);
    if(isNaN(fcfa) || fcfa < 1 || isNaN(seuil) || seuil < 1){ toast("Entre des valeurs valides"); return; }
    fidelite.fcfaParPoint = fcfa;
    fidelite.seuilRecompense = seuil;
    sauvegarderFidelite();
    renderClients();
    toast("Programme de fidélité mis à jour ✓");
  });

  function donnerRecompense(id){
    const client = clients.find(c => c.id === id);
    if(!client) return;
    const description = prompt(`Quelle récompense donnes-tu à ${client.nom} ? (ex: bon restaurant, réduction, cadeau...)`);
    if(description === null || description.trim() === '') return;
    client.points = (client.points || 0) - fidelite.seuilRecompense;
    sauvegarderClients();
    ajouterMouvement(client.nom, 'Récompense fidélité : ' + description.trim(), '');
    renderClients();
    toast("Récompense enregistrée ✓");
  }

  document.getElementById('btn-ajouter-client').addEventListener('click', ()=>{
    const nom = document.getElementById('input-client-nom').value.trim();
    const tel = document.getElementById('input-client-tel').value.trim();
    if(!nom){ toast("Entre un nom de client"); return; }
    clients.push({ id: 'c_' + Date.now(), nom, telephone: tel, dette: 0, points: 0 });
    sauvegarderClients();
    document.getElementById('input-client-nom').value = '';
    document.getElementById('input-client-tel').value = '';
    renderClients();
    toast("Client ajouté ✓");
  });

  function encaisserPaiement(id){
    const client = clients.find(c => c.id === id);
    if(!client) return;
    const montant = parseFloat(prompt(`Montant payé par ${client.nom} (dette actuelle : ${formatFCFA(client.dette || 0)}) :`));
    if(isNaN(montant) || montant <= 0) return;
    client.dette = Math.max(0, (client.dette || 0) - montant);
    sauvegarderClients();
    renderClients();
    toast("Paiement enregistré ✓");
  }

  function supprimerClient(id){
    clients = clients.filter(c => c.id !== id);
    sauvegarderClients();
    renderClients();
    renderCaisse();
  }

  // ---------- Statistiques ----------
  function renderStatistiques(){
    const debutJour = new Date(); debutJour.setHours(0,0,0,0);
    const debutMois = new Date(debutJour.getFullYear(), debutJour.getMonth(), 1);

    let venteJour = 0, venteMois = 0, totalEncaisse = 0;
    ventes.forEach(v=>{
      const d = new Date(v.date);
      totalEncaisse += v.total;
      if(d >= debutJour) venteJour += v.total;
      if(d >= debutMois) venteMois += v.total;
    });
    const totalCredit = clients.reduce((s,c)=> s + (c.dette || 0), 0);

    document.getElementById('kpi-vente-jour').textContent = formatFCFA(venteJour);
    document.getElementById('kpi-vente-mois').textContent = formatFCFA(venteMois);
    document.getElementById('kpi-total-encaisse').textContent = formatFCFA(totalEncaisse);
    document.getElementById('kpi-credit-cours').textContent = formatFCFA(totalCredit);

    // Graphique 7 derniers jours
    const jours = [];
    for(let i = 6; i >= 0; i--){
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
      jours.push(d);
    }
    const totauxParJour = jours.map(d=>{
      const dFin = new Date(d); dFin.setDate(dFin.getDate() + 1);
      return ventes.filter(v=>{ const vd = new Date(v.date); return vd >= d && vd < dFin; })
                   .reduce((s,v)=> s + v.total, 0);
    });
    const maxVal = Math.max(...totauxParJour, 1);
    const chart = document.getElementById('chart-7jours');
    chart.innerHTML = '';
    jours.forEach((d,i)=>{
      const pct = Math.round((totauxParJour[i] / maxVal) * 100);
      const bar = document.createElement('div');
      bar.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:6px; flex:1;';
      bar.innerHTML = `
        <div style="font-size:11px; color:var(--ink-soft); font-weight:700;">${totauxParJour[i] > 0 ? Math.round(totauxParJour[i]/1000) + 'k' : '0'}</div>
        <div style="width:100%; max-width:32px; height:120px; display:flex; align-items:flex-end; background:var(--primary-soft); border-radius:4px; overflow:hidden;">
          <div style="width:100%; height:${pct}%; background:var(--primary);"></div>
        </div>
        <div style="font-size:11px; color:var(--ink-soft);">${d.toLocaleDateString('fr-FR',{weekday:'short'})}</div>
      `;
      chart.appendChild(bar);
    });

    // Top produits
    const parProduit = {};
    ventes.forEach(v=>{
      v.items.forEach(it=>{
        if(!parProduit[it.nom]) parProduit[it.nom] = { qte: 0, revenu: 0 };
        parProduit[it.nom].qte += it.qte;
        parProduit[it.nom].revenu += it.qte * it.prixUnitaire;
      });
    });
    const top = Object.entries(parProduit).sort((a,b)=> b[1].revenu - a[1].revenu).slice(0,5);
    const tbody = document.getElementById('table-top-produits');
    const emptyTop = document.getElementById('empty-top-produits');
    tbody.innerHTML = '';
    if(top.length === 0){
      emptyTop.style.display = 'block';
    } else {
      emptyTop.style.display = 'none';
      top.forEach(([nom, data])=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${escapeHtml(nom)}</td><td>${data.qte}</td><td>${formatFCFA(data.revenu)}</td>`;
        tbody.appendChild(tr);
      });
    }
  }

  function exporterCSV(){
    let csv = "PRODUITS\nNom;Prix;Stock\n";
    produits.forEach(p=> csv += `${p.nom};${p.prix};${p.qte}\n`);
    csv += "\nVENTES\nDate;Total;Remise %;Client;Vendeur;Credit\n";
    ventes.forEach(v=>{
      const client = clients.find(c => c.id === v.clientId);
      const vendeur = utilisateurs.find(u => u.id === v.vendeurId);
      csv += `${new Date(v.date).toLocaleString('fr-FR')};${v.total};${v.remisePct};${client ? client.nom : 'Client de passage'};${vendeur ? vendeur.nom : ''};${v.credit ? 'Oui' : 'Non'}\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boutique-export-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("Export CSV téléchargé ✓");
  }

  function imprimerRapport(){
    window.print();
  }

  // ---------- Utilisateurs ----------
  function renderUtilisateurs(){
    const tbody = document.getElementById('table-utilisateurs');
    const empty = document.getElementById('empty-utilisateurs');
    tbody.innerHTML = '';

    if(utilisateurs.length === 0){
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      utilisateurs.forEach(u=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(u.nom)}</td>
          <td>${escapeHtml(u.role)}</td>
          <td><button class="btn-danger-ghost" onclick="supprimerUtilisateur('${u.id}')">Supprimer</button></td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  document.getElementById('btn-ajouter-utilisateur').addEventListener('click', ()=>{
    const nom = document.getElementById('input-user-nom').value.trim();
    const role = document.getElementById('input-user-role').value;
    if(!nom){ toast("Entre un nom"); return; }
    utilisateurs.push({ id: 'u_' + Date.now(), nom, role });
    sauvegarderUtilisateurs();
    document.getElementById('input-user-nom').value = '';
    renderUtilisateurs();
    renderCaisse();
    toast("Utilisateur ajouté ✓");
  });

  function supprimerUtilisateur(id){
    utilisateurs = utilisateurs.filter(u => u.id !== id);
    sauvegarderUtilisateurs();
    renderUtilisateurs();
    renderCaisse();
  }

  // ---------- Sauvegarde / Restauration ----------
  function exporterDonnees(){
    const sauvegarde = {
      version: 3,
      dateExport: new Date().toISOString(),
      produits: produits,
      mouvements: mouvements,
      clients: clients,
      ventes: ventes,
      utilisateurs: utilisateurs,
      fidelite: fidelite
    };
    const blob = new Blob([JSON.stringify(sauvegarde, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `boutique-sauvegarde-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("Sauvegarde téléchargée ✓");
  }

  function restaurerDonnees(file){
    if(!file) return;
    const confirmation = confirm(
      "Restaurer cette sauvegarde va REMPLACER toutes les données actuelles (produits, clients, ventes, historique).\n\nContinuer ?"
    );
    if(!confirmation){
      document.getElementById('input-restaurer').value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try{
        const data = JSON.parse(e.target.result);
        if(!Array.isArray(data.produits)){ throw new Error('format invalide'); }
        produits = data.produits;
        mouvements = Array.isArray(data.mouvements) ? data.mouvements : [];
        clients = Array.isArray(data.clients) ? data.clients : [];
        ventes = Array.isArray(data.ventes) ? data.ventes : [];
        utilisateurs = Array.isArray(data.utilisateurs) ? data.utilisateurs : [];
        fidelite = data.fidelite && typeof data.fidelite === 'object' ? data.fidelite : { fcfaParPoint: 100, seuilRecompense: 500 };
        sauvegarder();
        sauvegarderMouvements();
        sauvegarderClients();
        sauvegarderVentes();
        sauvegarderUtilisateurs();
        sauvegarderFidelite();
        renderProduits();
        renderCaisse();
        renderInventaire();
        renderClients();
        renderUtilisateurs();
        toast("Données restaurées ✓");
      } catch(err){
        toast("Fichier de sauvegarde invalide");
      }
      document.getElementById('input-restaurer').value = '';
    };
    reader.readAsText(file);
  }

  // ---------- Démarrage ----------
  renderProduits();