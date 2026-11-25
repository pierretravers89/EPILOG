import re
p='/home/claude/v2/widget_pilotage.js'; s=open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n, (s.count(a), a[:110]); s=s.replace(a,b)
def rep_re(pat, fn, n=1, flags=re.S):
    global s
    s2, k = re.subn(pat, fn, s, flags=flags)
    assert k==n, (k, pat[:100]); s=s2
rep("var VERSION_EPILOG = '2026.5.30';","var VERSION_EPILOG = '2026.5.31';")

# ---- 1. alias : dernier controle et son resultat dans l'Inventaire ; colonne calculee de l'export
rep("""    commentaire: ['commentaire'], statut: ['statut'], sortie: ['sortie du parc', 'date de sortie']
  },
  categories: {""","""    commentaire: ['commentaire'], statut: ['statut'], sortie: ['sortie du parc', 'date de sortie'],
    dernierControle: ['dernier controle', 'date du dernier controle'],
    resultatControle: ['resultat', 'resultat du dernier controle', 'resultat du controle']
  },
  categories: {""")
rep("'facture', 'photo'];","'facture', 'photo', 'controle echu'];")
rep("""function impResultat(v) {
  var t = impNorm(v);
  if (!t) return null;""","""function impResultat(v) {
  var t = impNorm(v);
  if (!t) return null;
  if (/^jamais/.test(t)) return null;   /* l'export ecrit « jamais controle » pour un exemplaire jamais controle */""")
rep("function impNature(v) {","""/* date du dernier controle : vide, « jamais » ou « - » = pas de controle (mots que l'export CSV ecrit) */
function impDateControle(v) {
  var t = impNorm(v);
  if (!t || t === '-' || /^(jamais|aucun|n\\/?a)\\b/.test(t)) return null;
  return impDate(v);
}
function impNature(v) {""")

# ---- 2. validation des lignes : ligne d'exemple du modele, dernier controle
rep("""    if (quantite > 500) bad('quantit\\u00e9 excessive (500 maximum par ligne)');
    if (marq) {""","""    if (quantite > 500) bad('quantit\\u00e9 excessive (500 maximum par ligne)');
    if (marq && /^exemple\\b/.test(impNorm(marq))) bad('c\\u2019est la ligne d\\u2019exemple du mod\\u00e8le : supprimez-la');
    if (marq) {""")
rep("""    if (isNaN(prix) || (prix !== null && prix < 0)) bad('prix illisible');
    if (!ok) return;""","""    if (isNaN(prix) || (prix !== null && prix < 0)) bad('prix illisible');
    var dc = impDateControle(v.dernierControle), rc = impResultat(v.resultatControle);
    if (dc === undefined) bad('date du dernier contr\\u00f4le illisible (\\u00ab ' + impTexte(v.dernierControle) + ' \\u00bb) : jj/mm/aaaa');
    else if (dc && dc.approx) bad('date du dernier contr\\u00f4le incompl\\u00e8te : jj/mm/aaaa');
    if (rc === undefined) bad('r\\u00e9sultat du dernier contr\\u00f4le illisible (\\u00ab ' + impTexte(v.resultatControle) + ' \\u00bb) : Conforme, \\u00c0 surveiller, \\u00c0 r\\u00e9parer ou R\\u00e9form\\u00e9');
    if (ok && rc && !dc) av('resultat_sans_date', 'R\\u00e9sultats de dernier contr\\u00f4le sans date (ignor\\u00e9s)', 'ligne ' + n, 'donnees');
    if (!ok) return;""")
rep("motif: impMotifSortie(v.statut), sortie: sortie });","motif: impMotifSortie(v.statut), sortie: sortie, dernier: dc, resCtl: rc });")

# ---- 3. controles implicites (dernier controle de l'Inventaire)
rep("  var adh = {}, idAdh = prochain('adherents'), vus = {}, aControle = {};","""  var marqAvecFeuille = {};   /* exemplaires que la feuille Controles decrit deja : elle fait foi */
  if (F.controles) F.controles.o.lignes.forEach(function (l) { var k = normMarquage(impTexte(l.v.exemplaire)); if (k) marqAvecFeuille[k] = true; });
  var adh = {}, idAdh = prochain('adherents'), vus = {}, aControle = {};""")
rep("  var jamais = sansControle.filter(function (m) { return !aControle[normMarquage(m)]; });","""  /* « Dernier controle » de l'Inventaire (colonne courante d'un tableur, et de l'export CSV) : un controle par
     exemplaire, sauf si la feuille Controles en decrit deja pour lui. Resultat absent -> « Conforme » suppose. */
  unites.forEach(function (u) {
    var r = u.row, km = normMarquage(u.marq);
    if (!r.dernier || marqAvecFeuille[km] || !parMarq[km]) return;
    var res = r.resCtl || 'Conforme';
    if (!r.resCtl) av('controle_suppose', 'Dernier contr\\u00f4le repris SANS r\\u00e9sultat : \\u00ab Conforme \\u00bb suppos\\u00e9 (le mat\\u00e9riel est rest\\u00e9 en service)', u.marq, 'donnees');
    P.creer.controles.push({ id: idCtl++, materiel: parMarq[km].id, date_controle: r.dernier.ts, controleur: null, resultat: res,
      commentaire: 'Repris de l\\u2019inventaire d\\u2019origine', type_controle: 'Contr\\u00f4le p\\u00e9riodique' });
    aControle[km] = true;
  });
  var jamais = sansControle.filter(function (m) { return !aControle[normMarquage(m)]; });""")

# ---- 4. erreurs regroupees (aperçu et rapport)
rep("function impResume(P) {","""/* erreurs identiques regroupees : « categorie X inconnue — 80 lignes » au lieu de 80 messages */
function impGrouperErreurs(erreurs) {
  var groupes = [], index = {};
  erreurs.forEach(function (e) {
    var k = e.feuille + '|' + e.msg;
    if (!index[k]) { index[k] = { feuille: e.feuille, msg: e.msg, lignes: [] }; groupes.push(index[k]); }
    if (e.ligne) index[k].lignes.push(e.ligne);
  });
  return groupes;
}
function impLibelleLignes(g) {
  var l = g.lignes;
  if (!l.length) return '';
  var vues = l.slice(0, 8).join(', ') + (l.length > 8 ? ' \\u2026' : '');
  return l.length === 1 ? ', ligne ' + vues : ', ' + l.length + ' lignes (' + vues + ')';
}
function impResume(P) {""")
rep_re(r"  if \(P\.erreurs\.length\) \{\n    html \+= '<div class=\"encadre-warn\"><b>' \+ P\.erreurs\.length.*?\(liste compl\\u00e8te dans le rapport\)</li>' : ''\) \+ '</ul></div>' \+",
 lambda m: """  var colsIgn = P.ignorees.colonnes.length
    ? '<div class="encadre-warn" style="margin-top:8px"><b>Colonnes non reconnues, donc ignor\\u00e9es :</b> ' +
      P.ignorees.colonnes.slice(0, 12).map(function (c) { var i = c.indexOf(' : '); return '\\u00ab ' + esc(c.slice(i + 3)) + ' \\u00bb (' + esc(c.slice(0, i)) + ')'; }).join(', ') +
      (P.ignorees.colonnes.length > 12 ? ' \\u2026' : '') +
      '.<br>Si l\\u2019une contient des donn\\u00e9es \\u00e0 importer, renommez son titre comme dans le mod\\u00e8le.</div>' : '';
  if (P.erreurs.length) {
    var G = impGrouperErreurs(P.erreurs);
    html += '<div class="encadre-warn"><b>' + G.length + ' erreur' + (G.length > 1 ? 's' : '') + ' \\u00e0 corriger' +
      (P.erreurs.length > G.length ? ' (' + P.erreurs.length + ' lignes concern\\u00e9es)' : '') + ' \\u2014 rien n\\u2019est import\\u00e9.</b><ul style="margin:6px 0 0 18px">' +
      G.slice(0, 40).map(function (g) { return '<li><b>' + esc(g.feuille) + impLibelleLignes(g) + '</b> : ' + esc(g.msg) + '</li>'; }).join('') +
      (G.length > 40 ? '<li>\\u2026 et ' + (G.length - 40) + ' autres (liste compl\\u00e8te dans le rapport)</li>' : '') + '</ul></div>' + colsIgn +""")
rep("""      '</div>' +
      ((!impEtat.resultat && (rawRows.materiels || []).length)""","""      '</div>' + colsIgn +
      ((!impEtat.resultat && (rawRows.materiels || []).length)""")
rep_re(r"    \(P\.erreurs\.length \? '<h2>Erreurs \\u00e0 corriger avant l\\u2019import \(' \+ P\.erreurs\.length \+ '\)</h2><table>' \+.*?autres</td></tr>' : ''\) \+ '</table>' : ''\) \+",
 lambda m: """    (P.erreurs.length ? (function () {
      var G = impGrouperErreurs(P.erreurs);
      return '<h2>Erreurs \\u00e0 corriger avant l\\u2019import (' + G.length + ')</h2><table>' +
        G.slice(0, 200).map(function (g) { return '<tr><td style="width:24px">\\u2610</td><td><b>' + esc(g.feuille) + impLibelleLignes(g) + '</b> : ' + esc(g.msg) + '</td></tr>'; }).join('') +
        (G.length > 200 ? '<tr><td></td><td>\\u2026 et ' + (G.length - 200) + ' autres</td></tr>' : '') + '</table>';
    })() : '') +""")

# ---- 5. modele Excel : Dernier controle + son resultat (en fin de feuille : les lettres des menus ne bougent pas)
rep_re(r"(\['Sortie du parc', 16, 'fac', '[^']*'\])\n    \],", lambda m: m.group(1) + """,
      ['Dernier contr\\u00f4le', 16, 'fac', 'Date du dernier contr\\u00f4le (jj/mm/aaaa). \\u00c9vite que l\\u2019exemplaire arrive sans contr\\u00f4le : son \\u00e9ch\\u00e9ance part de cette date.'],
      ['R\\u00e9sultat du dernier contr\\u00f4le', 26, 'fac', 'Facultatif. \\u00c0 d\\u00e9faut : Conforme (le mat\\u00e9riel est rest\\u00e9 en service).']
    ],""")
rep("  nombre(inv, 'L2:L' + NB, 'whole', 1, 'Dur\\u00e9e de vie',","  menu(inv, 'S2:S' + NB, 'ListeResultats', 'information', 'R\\u00e9sultat', 'Conforme, \\u00c0 surveiller, \\u00c0 r\\u00e9parer ou R\\u00e9form\\u00e9.');\n  nombre(inv, 'L2:L' + NB, 'whole', 1, 'Dur\\u00e9e de vie',")
rep("Prix unitaire \\u2014 Dur\\u00e9e de vie (mois) \\u2014 Lot \\u2014 Quantit\\u00e9.'],","Prix unitaire \\u2014 Dur\\u00e9e de vie (mois) \\u2014 Lot \\u2014 Quantit\\u00e9 \\u2014 Dernier contr\\u00f4le (et son r\\u00e9sultat).'],",2)
rep("'La feuille \\u00ab Contr\\u00f4les \\u00bb reprend l\\u2019historique : une ligne par contr\\u00f4le","'Le plus simple : la colonne \\u00ab Dernier contr\\u00f4le \\u00bb de l\\u2019Inventaire (un contr\\u00f4le par exemplaire ; \\u00ab Conforme \\u00bb si le r\\u00e9sultat n\\u2019est pas indiqu\\u00e9). La feuille \\u00ab Contr\\u00f4les \\u00bb reprend tout l\\u2019historique : une ligne par contr\\u00f4le",2)
rep("'Statut', 'Sortie du parc']],\n      [14, 20, 22, 16, 18, 16, 12, 16, 22, 16, 18, 18, 14, 10, 30, 12, 16]);","'Statut', 'Sortie du parc', 'Dernier contr\\u00f4le', 'R\\u00e9sultat du dernier contr\\u00f4le']],\n      [14, 20, 22, 16, 18, 16, 12, 16, 22, 16, 18, 18, 14, 10, 30, 12, 16, 16, 26]);")

# ---- 6. export CSV : une seule liste de colonnes (INV_CSV) dont derive aussi le modele ; + Sortie du parc
rep("dateFab: lot.date_fabrication ? fmtDate(lot.date_fabrication) : '', dureeLot: lot.duree_vie_mois || '',",
    "dateFab: lot.date_fabrication ? fmtDate(lot.date_fabrication) : '', dureeLot: lot.duree_vie_mois || '',\n      sortieParc: (function () { var d = dateSortieParc(m); return d ? fmtDate(d) : ''; })(),")
rep_re(r"function exporterInventaireCsv\(\) \{.*?telechargerCsv\(lignes, 'inventaire-' \+ new Date\(\)\.toISOString\(\)\.slice\(0, 10\) \+ '\.csv', 'materiel-editor'\);\n\}",
 lambda m: """/* UNE SEULE liste de colonnes pour l'export CSV ET le modele CSV (2026.5.31) : `calc` = colonne que EPILOG
   calcule, absente du modele (on ne peut pas la remplir) ; les autres sont lues par l'import sous le meme titre.
   Un test verifie que chaque titre est reconnu par l'import ou connu comme calcule. */
var INV_CSV = [
  { t: 'Marquage', get: function (r) { return r.marquage; } },
  { t: 'Numero de serie', get: function (r) { return r.serie; } },
  { t: 'Couleur', get: function (r) { return r.couleur; } },
  { t: 'Taille ou longueur', get: function (r) { return r.taille; } },
  { t: 'Lot', get: function (r) { return r.lot; } },
  { t: 'Categorie', get: function (r) { return r.categorie; } },
  { t: 'Fabricant', get: function (r) { return r.fabricant; } },
  { t: 'Modele', get: function (r) { return r.modele; } },
  { t: 'Date de fabrication', get: function (r) { return r.dateFab; } },
  { t: 'Duree de vie (mois)', get: function (r) { return r.dureeLot; } },
  { t: 'Lieu', get: function (r) { return r.lieu; } },
  { t: 'Mise en service', get: function (r) { return r.miseEnService; } },
  { t: 'Fin de vie', calc: true, get: function (r) { return r.finDeVie; } },
  { t: 'Statut', get: function (r) { return r.statut; } },
  { t: 'Sortie du parc', get: function (r) { return r.sortieParc; } },
  { t: 'Motif', calc: true, get: function (r) { return r.raison; } },
  { t: 'Dernier controle', get: function (r) { return r.dernierControle; } },
  { t: 'Resultat', get: function (r) { return r.resultatControle; } },
  { t: 'Prochain controle', calc: true, get: function (r) { return r.prochainControle; } },
  { t: 'Controle echu', calc: true, get: function (r) { return r.echu; } },
  { t: 'Prix unitaire', get: function (r) { return r.prix; } },
  { t: 'Commentaire', get: function (r) { return r.commentaire; } },
  { t: 'Photos', calc: true, get: function (r) { return r.nbPhotos; } }
];
function exporterInventaireCsv() {
  if (!inventaireVisible.length) { flash('lotFlash', 'Aucun exemplaire a exporter.'); return; }
  var lignes = [INV_CSV.map(function (c) { return c.t; })].concat(inventaireVisible.map(function (r) {
    return INV_CSV.map(function (c) { return c.get(r); });
  }));
  telechargerCsv(lignes, 'inventaire-' + new Date().toISOString().slice(0, 10) + '.csv', 'materiel-editor');
}""")

# ---- 7. modele CSV + fenetre d'avertissement
rep("/* ------------------------------ interface ------------------------------ */\nfunction impBasculerPanneau() {", """/* ------------------------------ modele CSV (2026.5.31) ------------------------------
   Colle a l'export CSV (meme liste INV_CSV) moins les colonnes calculees, plus « Quantite ». Une fenetre DANS LA PAGE
   (pas confirm() : le cadre d'un widget peut bloquer les fenetres du navigateur) en rappelle les limites avant le
   telechargement. La ligne d'exemple est refusee par l'import tant qu'elle n'est pas supprimee. */
function impColonnesModeleCsv() {
  var cols = INV_CSV.filter(function (c) { return !c.calc; }).map(function (c) { return c.t; });
  cols.splice(cols.indexOf('Prix unitaire') + 1, 0, 'Quantite');
  return cols;
}
function impTelechargerModeleCsv() {
  var cols = impColonnesModeleCsv();
  var ex = { 'Marquage': 'EXEMPLE - A SUPPRIMER', 'Couleur': 'Rouge', 'Taille ou longueur': 'M',
    'Categorie': ((refLists.categories || [])[0] || {}).nom || 'Casques', 'Fabricant': 'Petzl', 'Modele': 'Boreo',
    'Date de fabrication': '15/03/2020', 'Lieu': ((refLists.lieux || [])[0] || {}).nom || 'Local club',
    'Mise en service': '01/09/2021', 'Dernier controle': '10/09/2025', 'Resultat': 'Conforme', 'Prix unitaire': '60',
    'Commentaire': 'Ligne d\\u2019exemple : a supprimer' };
  telechargerCsv([cols, cols.map(function (c) { return ex[c] === undefined ? '' : ex[c]; })], nomFichierDuJour('modele-import', 'csv'), 'importPanel');
  var msg = document.getElementById('impMsg');
  if (msg) { msg.style.color = ''; msg.textContent = 'Mod\\u00e8le CSV t\\u00e9l\\u00e9charg\\u00e9 : supprimez la ligne d\\u2019exemple avant d\\u2019importer.'; }
}
function impPopupModeleCsv() {
  if (document.getElementById('impPopup')) return;
  var cats = (refLists.categories || []).map(function (c) { return c.nom; });
  var fond = document.createElement('div');
  fond.id = 'impPopup';
  fond.setAttribute('role', 'dialog'); fond.setAttribute('aria-modal', 'true'); fond.setAttribute('aria-label', 'Mod\\u00e8le CSV : limites');
  fond.style.cssText = 'position:fixed;inset:0;background:rgba(15,25,45,.55);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px';
  fond.innerHTML = '<div style="background:#fff;border-radius:12px;max-width:600px;width:100%;max-height:90vh;overflow:auto;padding:20px 22px;box-shadow:0 10px 40px rgba(0,0,0,.35)">' +
    '<h3 style="margin:0 0 8px;color:#1B3668">Mod\\u00e8le CSV : \\u00e0 savoir avant de le t\\u00e9l\\u00e9charger</h3>' +
    '<p style="margin:0 0 8px">Ce fichier reprend les <b>m\\u00eames colonnes que l\\u2019export CSV</b> du mat\\u00e9riel (sans celles qu\\u2019EPILOG calcule). Plus simple que le mod\\u00e8le Excel, mais :</p>' +
    '<ul style="margin:0 0 10px 18px;line-height:1.5">' +
      '<li><b>Les cat\\u00e9gories doivent d\\u00e9j\\u00e0 exister dans EPILOG</b> : un CSV ne peut pas les d\\u00e9crire (nature r\\u00e9glementaire, dur\\u00e9e de vie). ' +
        (cats.length ? 'Celles de votre club : <b>' + cats.map(esc).join(', ') + '</b>.' : '<b>Aucune n\\u2019existe encore</b> : cr\\u00e9ez-les d\\u2019abord dans Listes du club, ou utilisez le mod\\u00e8le Excel.') + '</li>' +
      '<li>Ni mode d\\u2019emploi ni menus : <b>ne renommez pas les titres de colonnes</b>, et <b>supprimez la ligne d\\u2019exemple</b>.</li>' +
      '<li><b>Excel abime les CSV</b> \\u00e0 l\\u2019ouverture : z\\u00e9ros initiaux perdus (007 devient 7), longs num\\u00e9ros de s\\u00e9rie transform\\u00e9s, dates reformat\\u00e9es. Utilisez un \\u00e9diteur de texte, ou enregistrez au format \\u00ab CSV UTF-8 \\u00bb.</li>' +
      '<li>Dates au format <b>jj/mm/aaaa</b> (ou l\\u2019ann\\u00e9e seule pour la fabrication).</li>' +
      '<li>L\\u2019import <b>ne reprend pas</b> : photos, notices, factures, commandes, pr\\u00eats, incidents, r\\u00e9parations, ni l\\u2019historique complet des contr\\u00f4les (seulement le dernier).</li></ul>' +
    '<div class="form-actions"><button type="button" id="impPopupOk">J\\u2019ai compris, t\\u00e9l\\u00e9charger</button>' +
      '<button type="button" class="secondary" id="impPopupNon">Annuler</button></div></div>';
  document.body.appendChild(fond);
  function fermer() { fond.remove(); document.removeEventListener('keydown', surTouche); }
  function surTouche(e) { if (e.key === 'Escape') fermer(); }
  document.addEventListener('keydown', surTouche);
  fond.addEventListener('click', function (e) { if (e.target === fond) fermer(); });
  document.getElementById('impPopupNon').onclick = fermer;
  document.getElementById('impPopupOk').onclick = function () { fermer(); impTelechargerModeleCsv(); };
  document.getElementById('impPopupOk').focus();
}

/* ------------------------------ interface ------------------------------ */
function impBasculerPanneau() {""")
rep("""<button type="button" class="secondary" id="impModele">T\\u00e9l\\u00e9charger le mod\\u00e8le (Excel)</button>' +""",
    """<button type="button" class="secondary" id="impModele">T\\u00e9l\\u00e9charger le mod\\u00e8le (Excel)</button>' +
      '<button type="button" class="secondary" id="impModeleCsv">Mod\\u00e8le CSV\\u2026</button>' +""")
rep("  document.getElementById('impModele').onclick = impTelechargerModele;","  document.getElementById('impModele').onclick = impTelechargerModele;\n  document.getElementById('impModeleCsv').onclick = impPopupModeleCsv;")
open(p,'w',encoding='utf-8').write(s)

# ---------- aide ----------
h=open('/home/claude/v2/widget_pilotage.html',encoding='utf-8').read()
m=re.search(r"colonnes\s+qui\s+ne\s+sont\s+pas\s+reprises\s+sont\s+simplement\s+ignorées\.</p>", h)
assert m, "ancre aide import"
h=h[:m.end()]+"""
          <p><b>Modèle CSV.</b> Le bouton « Modèle CSV… » fournit un fichier aux <b>mêmes colonnes que
             l'export CSV</b> du matériel (sans les colonnes calculées). Plus simple que le modèle Excel, mais
             sans menus ni mode d'emploi : les <b>catégories doivent déjà exister</b> dans EPILOG, et un
             tableur abîme volontiers les CSV (zéros initiaux, longs numéros de série, dates). Une fenêtre
             rappelle ces limites avant le téléchargement. La ligne d'exemple doit être supprimée.</p>
          <p><b>Dernier contrôle.</b> Si votre tableur note la date du dernier contrôle, mettez-la dans la
             colonne « Dernier contrôle » (et le résultat dans « Résultat du dernier contrôle » ; « Conforme »
             est supposé à défaut) : l'exemplaire n'arrive pas « sans contrôle » et son échéance est correcte.</p>
          <p>L'aperçu <b>regroupe les erreurs identiques</b> (« catégorie inconnue — 80 lignes ») et signale les
             <b>colonnes non reconnues</b>, qui seraient sinon ignorées en silence.</p>"""+h[m.end():]
open('/home/claude/v2/widget_pilotage.html','w',encoding='utf-8').write(h)
print("ecrit")
