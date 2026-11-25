/* ================= sauvegarde, transfert et export lisible (2026.5.20) =================
   Decisions de Pierre (18/10) :
   - Export LISIBLE (humain) : classeur Excel (.xlsx, bibliotheque SheetJS chargee
     a la demande depuis cdnjs, version figee) OU fichiers CSV (un par theme).
     Noms a la place des numeros internes, dates jj/mm/aaaa. Non reimportable.
   - SAUVEGARDE (.json) : toutes les tables, valeurs brutes, numeros de ligne
     conserves. Pieces jointes HORS sauvegarde (listees dans le fichier).
   - IMPORT : uniquement dans un document VIDE ; apercu avant ; une seule ecriture
     (tout ou rien). Les numeros de ligne d'origine sont reutilises (tables vides :
     ils sont libres), donc tous les liens (lot, exemplaire, adherent...) restent
     justes sans recalcul. Colonnes absentes du document cible : ignorees et
     signalees ; colonnes nouvelles : vides. */
var VERSION_EPILOG = '2026.5.20';
var SHEETJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
/* ordre = parents d'abord (lisibilite du fichier ; l'ecriture est d'un bloc) */
var TABLES_SAUVEGARDE = ['categories', 'lieux', 'fournisseurs', 'adherents', 'achats', 'lots', 'materiels',
  'controles', 'emprunts', 'incidents', 'reparations', 'entretiens', 'demandes'];

var LIBELLES_COLONNES = {
  numero_marquage: 'Marquage', numero_serie: 'Num\u00e9ro de s\u00e9rie', lot: 'Lot', categorie: 'Cat\u00e9gorie',
  designation: 'D\u00e9signation', fabricant: 'Fabricant', modele: 'Mod\u00e8le', lieu_stockage: 'Lieu de stockage',
  date_mise_en_service: 'Mise en service', hors_service_motif: 'Motif de sortie', hors_service_date: 'Date de sortie',
  couleur: 'Couleur', taille: 'Taille / longueur', commentaire: 'Commentaire', origine_decoupe: 'D\u00e9coup\u00e9 de',
  materiel: 'Exemplaire', date_controle: 'Date du contr\u00f4le', controleur: 'Contr\u00f4leur', resultat: 'R\u00e9sultat',
  type_controle: 'Type de contr\u00f4le', photo: 'Photos', adherent: 'Adh\u00e9rent', date_emprunt: 'Date d\u2019emprunt',
  date_retour_prevue: 'Retour pr\u00e9vu', date_retour_effective: 'Retour effectif', etat_retour: '\u00c9tat au retour',
  sortie_activite: 'Sortie / activit\u00e9', numero_emprunt: 'N\u00b0 de bon', date_incident: 'Date de l\u2019incident',
  gravite: 'Gravit\u00e9', description: 'Description', suite: 'Suite donn\u00e9e', date_declaree: 'D\u00e9clar\u00e9e le',
  motif: 'Motif', date_effectuee: 'Effectu\u00e9e le', intervenant: 'Intervenant', intervenant_qui: 'R\u00e9par\u00e9 par',
  pieces_remplacees: 'Pi\u00e8ces remplac\u00e9es', date_fabrication_piece: 'Fabrication de la pi\u00e8ce',
  duree_vie_piece_mois: 'Dur\u00e9e de vie de la pi\u00e8ce (mois)', date_entretien: 'Date', auteur: 'R\u00e9alis\u00e9 par',
  ref_commande: 'R\u00e9f\u00e9rence', fournisseur: 'Fournisseur', date_commande: 'Command\u00e9e le',
  date_reception: 'Re\u00e7ue le', montant_total: 'Montant', financement: 'Financement', facture: 'Facture',
  note_financement: 'Note de financement', achat: 'Commande', date_fabrication: 'Date de fabrication',
  duree_vie_mois: 'Dur\u00e9e de vie (mois)', prix_unitaire: 'Prix unitaire', quantite_achetee: 'Quantit\u00e9 achet\u00e9e',
  notice: 'Notice', nom: 'Nom', type_epi: 'Nature r\u00e9glementaire', duree_vie_defaut_mois: 'Dur\u00e9e de vie par d\u00e9faut (mois)',
  prefixe: 'Pr\u00e9fixe', maintenance_fabricant: 'R\u00e9paration pr\u00e9vue', reparations_acceptees: 'R\u00e9parations accept\u00e9es',
  peut_etre_decoupe: 'D\u00e9coupable', prolongation_par_reparation: 'Prolongation par r\u00e9paration',
  nom_complet: 'Nom', numero_licence: 'N\u00b0 de licence', role: 'R\u00f4le', email: 'E-mail', telephone: 'T\u00e9l\u00e9phone',
  contact: 'Contact', demandeur: 'Demandeur', besoin: 'Besoin', traitee: 'Trait\u00e9e', description_lieu: 'Description'
};
var REFERENCES_LISIBLES = {
  lot: ['lots', 'designation'], materiel: ['materiels', 'numero_marquage'], origine_decoupe: ['materiels', 'numero_marquage'],
  categorie: ['categories', 'nom'], lieu_stockage: ['lieux', 'nom'], fournisseur: ['fournisseurs', 'nom'],
  achat: ['achats', 'ref_commande'], adherent: ['adherents', 'nom_complet'], controleur: ['adherents', 'nom_complet'],
  auteur: ['adherents', 'nom_complet'], intervenant_qui: ['adherents', 'nom_complet']
};
function colonneTechnique(c) { return c === 'id' || c === 'manualSort' || c.indexOf('gristHelper_') === 0; }
function estPieceJointe(v) { return Array.isArray(v) && v[0] === 'L'; }
function lignesDeCle(cle) {
  var r = rawRows[cle];
  return Array.isArray(r) && (r.length || !refLists[cle]) ? r : (refLists[cle] || []);
}
function libelleColonne(c) {
  return LIBELLES_COLONNES[c] || (c.charAt(0).toUpperCase() + c.slice(1)).replace(/_/g, ' ');
}
function valeurLisible(col, v) {
  if (v === null || v === undefined || v === '') return '';
  if (estPieceJointe(v)) { var n = v.length - 1; return n ? n + ' fichier' + (n > 1 ? 's' : '') : ''; }
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  var ref = REFERENCES_LISIBLES[col];
  if (ref && typeof v === 'number') {
    if (!v) return '';
    var cible = lignesDeCle(ref[0]).filter(function (x) { return x.id === v; })[0];
    return cible ? String(cible[ref[1]] || '#' + v) : '#' + v;
  }
  if (/(^date_|_date$|^date$)/.test(col) && typeof v === 'number') return fmtDate(v);
  return v;
}
/* feuille generique : toutes les colonnes de la table (presentes et futures) */
function feuilleGenerique(nom, cle, tri) {
  var cols = (colonnesConnues[cle] || []).filter(function (c) { return !colonneTechnique(c); });
  var lignes = lignesDeCle(cle).slice();
  if (tri) lignes.sort(function (a, b) { return (Number(b[tri]) || 0) - (Number(a[tri]) || 0); });
  return { nom: nom, entetes: cols.map(libelleColonne),
           lignes: lignes.map(function (r) { return cols.map(function (c) { return valeurLisible(c, r[c]); }); }) };
}
function donneesLisibles() {
  var mats = (rawRows.materiels || []).slice().sort(function (a, b) {
    return String(a.numero_marquage || '').localeCompare(String(b.numero_marquage || ''), 'fr', { numeric: true });
  });
  var avecSerie = aColonne('materiels', 'numero_serie');
  var inv = {
    nom: 'Inventaire',
    entetes: ['Marquage'].concat(avecSerie ? ['Num\u00e9ro de s\u00e9rie'] : []).concat(['Lot', 'Cat\u00e9gorie', 'Fabricant',
      'Mod\u00e8le', 'Lieu', 'Mise en service', 'Fin de vie', 'Prolong\u00e9e par r\u00e9paration', 'Statut', 'Motif',
      'Prochain contr\u00f4le', 'Contr\u00f4le en retard', 'Prix unitaire']),
    lignes: mats.map(function (m) {
      var lot = (rawRows.lots || []).filter(function (l) { return l.id === m.lot; })[0] || {};
      var cat = categorieDeMateriel(m) || {};
      var hors = HORS_STOCK.indexOf(m._statut) !== -1;
      return [m.numero_marquage || ''].concat(avecSerie ? [m.numero_serie || ''] : []).concat([
        lot.designation || '', cat.nom || '', lot.fabricant || '', lot.modele || '',
        valeurLisible('lieu_stockage', m.lieu_stockage), fmtDate(m.date_mise_en_service) === '-' ? '' : fmtDate(m.date_mise_en_service),
        m._finDeVie ? '31/12/' + m._finDeVie.getUTCFullYear() : 'Selon contr\u00f4le', m._prolongation ? 'Oui' : '',
        m._statut || '', m._raison || '',
        hors ? 'Sans objet' : (m._limiteControle ? fmtDate(m._limiteControle) : ''), m._controleEchu ? 'Oui' : '',
        Number(lot.prix_unitaire) || '']);
    })
  };
  var f = [inv,
    feuilleGenerique('Lots', 'lots'), feuilleGenerique('Commandes', 'achats', 'date_commande'),
    feuilleGenerique('Contr\u00f4les', 'controles', 'date_controle'), feuilleGenerique('Pr\u00eats', 'emprunts', 'date_emprunt'),
    feuilleGenerique('Incidents', 'incidents', 'date_incident'), feuilleGenerique('R\u00e9parations', 'reparations', 'date_declaree')];
  if (resolvedNames.entretiens) f.push(feuilleGenerique('Entretien', 'entretiens', 'date_entretien'));
  f.push(feuilleGenerique('Cat\u00e9gories', 'categories'), feuilleGenerique('Lieux de stockage', 'lieux'),
         feuilleGenerique('Fournisseurs', 'fournisseurs'), feuilleGenerique('Adh\u00e9rents', 'adherents'));
  if (resolvedNames.demandes) f.push(feuilleGenerique('Demandes', 'demandes'));
  var resume = { nom: 'R\u00e9sum\u00e9', entetes: ['', ''], lignes: [
    ['Club', CONFIG.nom_club || ''], ['Export du', fmtDate(new Date())], ['Logiciel', 'EPILOG ' + VERSION_EPILOG],
    ['', ''], ['Contenu', 'Nombre de lignes']
  ].concat(f.map(function (x) { return [x.nom, x.lignes.length]; })).concat([['', ''],
    ['Note', 'Export de lecture : les noms remplacent les num\u00e9ros internes. Pour transf\u00e9rer les donn\u00e9es, utiliser la sauvegarde (.json).']]) };
  return [resume].concat(f);
}
function nomFichierDuJour(prefixe, ext) { return 'epilog-' + prefixe + '-' + new Date().toISOString().slice(0, 10) + '.' + ext; }
function chargerSheetJS() {
  return new Promise(function (ok, ko) {
    if (window.XLSX) return ok(window.XLSX);
    var sc = document.createElement('script');
    var minuteur = setTimeout(function () { ko(new Error('d\u00e9lai d\u00e9pass\u00e9')); }, 15000);
    sc.src = SHEETJS_URL;
    sc.onload = function () { clearTimeout(minuteur); window.XLSX ? ok(window.XLSX) : ko(new Error('biblioth\u00e8que absente')); };
    sc.onerror = function () { clearTimeout(minuteur); ko(new Error('chargement impossible')); };
    document.head.appendChild(sc);
  });
}
function messageSauvegarde(txt, erreur) {
  var el = document.getElementById('sauvMsg');
  if (el) { el.textContent = txt; el.style.color = erreur ? '#a3242a' : ''; }
}
async function exporterLisibleXlsx() {
  var feuilles = donneesLisibles();
  messageSauvegarde('Pr\u00e9paration du classeur...');
  try {
    var X = await chargerSheetJS();
    var wb = X.utils.book_new();
    feuilles.forEach(function (fe) {
      var aoa = (fe.nom === 'R\u00e9sum\u00e9' ? [] : [fe.entetes]).concat(fe.lignes);
      var ws = X.utils.aoa_to_sheet(aoa);
      ws['!cols'] = (fe.entetes || []).map(function (h, i) {
        var max = String(h).length;
        aoa.forEach(function (l) { max = Math.max(max, String(l[i] === undefined ? '' : l[i]).length); });
        return { wch: Math.min(Math.max(max + 2, 8), 60) };
      });
      X.utils.book_append_sheet(wb, ws, fe.nom.replace(/[\\\/\?\*\[\]:]/g, '-').slice(0, 31));
    });
    X.writeFile(wb, nomFichierDuJour('export', 'xlsx'));
    messageSauvegarde('Classeur t\u00e9l\u00e9charg\u00e9 (' + feuilles.length + ' onglets).');
  } catch (e) {
    messageSauvegarde('Excel indisponible (' + e.message + ') : export en fichiers CSV \u00e0 la place.', true);
    exporterLisibleCsv(feuilles);
  }
}
function exporterLisibleCsv(feuilles) {
  feuilles = feuilles || donneesLisibles();
  /* un fichier par theme ; le navigateur peut demander d'autoriser les
     telechargements multiples */
  feuilles.forEach(function (fe, i) {
    setTimeout(function () {
      var nom = fe.nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      telechargerCsv((fe.nom === 'R\u00e9sum\u00e9' ? [] : [fe.entetes]).concat(fe.lignes), nomFichierDuJour(nom, 'csv'), 'reglagesSauvegarde');
    }, i * 400);
  });
  messageSauvegarde(feuilles.length + ' fichiers CSV en cours de t\u00e9l\u00e9chargement (un par th\u00e8me).');
}

/* ------------------------------ sauvegarde .json ------------------------------ */
async function construireSauvegarde() {
  var tables = {}, omises = [];
  for (var i = 0; i < TABLES_SAUVEGARDE.length; i++) {
    var cle = TABLES_SAUVEGARDE[i], nomT = resolvedNames[cle];
    if (!nomT) continue;
    var t = await grist.docApi.fetchTable(nomT);
    var cols = Object.keys(t).filter(function (c) { return !colonneTechnique(c); });
    var pj = cols.filter(function (c) { return (t[c] || []).some(estPieceJointe); });
    var lignes = (t.id || []).map(function (id, k) {
      var r = { id: id };
      cols.forEach(function (c) {
        var v = t[c][k];
        if (pj.indexOf(c) !== -1) {
          if (estPieceJointe(v) && v.length > 1) omises.push({ table: nomT, id: id, colonne: c, nombre: v.length - 1 });
          v = null;
        }
        r[c] = v === undefined ? null : v;
      });
      return r;
    });
    tables[cle] = { table: nomT, colonnes: cols, pieces_jointes: pj, lignes: lignes };
  }
  var config = (configRows || []).map(function (r) { return [r.cle, r.valeur]; })
    .filter(function (p) { return p[0]; });
  return { format: 'epilog-sauvegarde', version_format: 1, epilog: VERSION_EPILOG,
           date: new Date().toISOString(), club: CONFIG.nom_club || '', tables: tables, config: config,
           pieces_jointes_omises: omises };
}
async function exporterSauvegarde() {
  messageSauvegarde('Pr\u00e9paration de la sauvegarde...');
  try {
    var s = await construireSauvegarde();
    var blob = new Blob([JSON.stringify(s, null, 1)], { type: 'application/json' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nomFichierDuJour('sauvegarde', 'json');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    var n = Object.keys(s.tables).reduce(function (t, k) { return t + s.tables[k].lignes.length; }, 0);
    messageSauvegarde('Sauvegarde t\u00e9l\u00e9charg\u00e9e : ' + n + ' lignes' +
      (s.pieces_jointes_omises.length ? ', ' + s.pieces_jointes_omises.length + ' pi\u00e8ce(s) jointe(s) non incluse(s).' : '.'));
  } catch (e) {
    messageSauvegarde('Erreur : ' + e.message, true);
  }
}

/* ------------------------------ import ------------------------------ */
/* refus clair si le fichier n'est pas une sauvegarde EPILOG lisible */
function verifierSauvegarde(s) {
  if (!s || s.format !== 'epilog-sauvegarde' || !s.tables) return 'Ce fichier n\u2019est pas une sauvegarde EPILOG.';
  if (Number(s.version_format) > 1) return 'Sauvegarde produite par une version plus r\u00e9cente d\u2019EPILOG : mettez d\u2019abord le logiciel \u00e0 jour.';
  return null;
}
/* tables du document deja remplies (l'import exige un document vide) */
function tablesNonVides() {
  return TABLES_SAUVEGARDE.filter(function (k) { return resolvedNames[k] && lignesDeCle(k).length; })
    .map(function (k) { return resolvedNames[k]; });
}
function analyserImport(s) {
  var rapport = { tables: [], ignorees: [], colonnesIgnorees: [], total: 0 };
  TABLES_SAUVEGARDE.forEach(function (k) {
    var src = s.tables[k];
    if (!src || !src.lignes.length) return;
    if (!resolvedNames[k]) { rapport.ignorees.push(src.table + ' (' + src.lignes.length + ' lignes)'); return; }
    var cibles = colonnesConnues[k] || [];
    var ign = src.colonnes.filter(function (c) { return cibles.indexOf(c) === -1 && (src.pieces_jointes || []).indexOf(c) === -1; });
    ign.forEach(function (c) { rapport.colonnesIgnorees.push(src.table + '.' + c); });
    rapport.tables.push({ cle: k, table: resolvedNames[k], nb: src.lignes.length });
    rapport.total += src.lignes.length;
  });
  return rapport;
}
function actionsImport(s) {
  var actions = [];
  TABLES_SAUVEGARDE.forEach(function (k) {
    var src = s.tables[k];
    if (!src || !src.lignes.length || !resolvedNames[k]) return;
    var cibles = colonnesConnues[k] || [];
    var cols = src.colonnes.filter(function (c) { return cibles.indexOf(c) !== -1 && (src.pieces_jointes || []).indexOf(c) === -1; });
    var valeurs = {};
    cols.forEach(function (c) { valeurs[c] = src.lignes.map(function (l) { return l[c] === undefined ? null : l[c]; }); });
    actions.push(['BulkAddRecord', resolvedNames[k], src.lignes.map(function (l) { return l.id; }), valeurs]);
  });
  /* reglages : mis a jour par cle (la table CONFIG peut deja contenir des lignes) */
  if (configDiag && configDiag.table && (s.config || []).length) {
    var existantes = {};
    (configRows || []).forEach(function (r) { existantes[r.cle] = r.id; });
    (s.config || []).forEach(function (p) {
      var champs = {}; champs[configDiag.colCle] = p[0]; champs[configDiag.colVal] = p[1] === null ? '' : String(p[1]);
      if (existantes[p[0]]) actions.push(['UpdateRecord', configDiag.table, existantes[p[0]], champs]);
      else actions.push(['AddRecord', configDiag.table, null, champs]);
    });
  }
  return actions;
}
function lireFichierTexte(fichier) {
  return new Promise(function (ok, ko) {
    var rd = new FileReader();
    rd.onload = function () { ok(String(rd.result || '')); };
    rd.onerror = function () { ko(new Error('lecture du fichier impossible')); };
    rd.readAsText(fichier, 'utf-8');
  });
}
async function preparerImport(fichier) {
  var zone = document.getElementById('sauvApercu');
  if (!zone || !fichier) return;
  zone.innerHTML = '';
  var s;
  try { s = JSON.parse(await lireFichierTexte(fichier)); }
  catch (e) { messageSauvegarde('Fichier illisible : ce n\u2019est pas une sauvegarde EPILOG (.json).', true); return; }
  var err = verifierSauvegarde(s);
  if (err) { messageSauvegarde(err, true); return; }
  var pleines = tablesNonVides();
  if (pleines.length) {
    messageSauvegarde('Import refus\u00e9 : ce document contient d\u00e9j\u00e0 des donn\u00e9es (' + pleines.join(', ') +
      '). L\u2019import se fait uniquement dans un document vide, pour ne jamais m\u00e9langer deux parcs.', true);
    return;
  }
  var r = analyserImport(s);
  messageSauvegarde('');
  zone.innerHTML = '<div class="encadre"><b>Sauvegarde du ' + esc(fmtDate(s.date)) + '</b>' +
    (s.club ? ' \u2014 ' + esc(s.club) : '') + ' (EPILOG ' + esc(s.epilog || '?') + ')<br>' +
    r.tables.map(function (t) { return esc(t.table) + ' : ' + t.nb; }).join(' \u00b7 ') +
    (r.ignorees.length ? '<br><span class="alerte">Tables absentes de ce document, non import\u00e9es : ' + esc(r.ignorees.join(', ')) + '</span>' : '') +
    (r.colonnesIgnorees.length ? '<br><span class="alerte">Colonnes absentes de ce document, ignor\u00e9es : ' + esc(r.colonnesIgnorees.join(', ')) + '</span>' : '') +
    ((s.pieces_jointes_omises || []).length ? '<br>Pi\u00e8ces jointes non incluses dans la sauvegarde : ' + s.pieces_jointes_omises.length +
      ' (photos, notices, factures \u00e0 rattacher \u00e0 la main).' : '') +
    '<div class="form-actions" style="margin-top:8px"><button type="button" id="sauvConfirmer">Importer ' + r.total + ' lignes</button>' +
    '<button type="button" class="secondary" id="sauvAnnuler">Annuler</button></div></div>';
  document.getElementById('sauvAnnuler').onclick = function () { zone.innerHTML = ''; };
  document.getElementById('sauvConfirmer').onclick = async function () {
    if (tablesNonVides().length) { messageSauvegarde('Import refus\u00e9 : le document n\u2019est plus vide.', true); return; }
    messageSauvegarde('Import en cours...');
    try {
      await appliquer(actionsImport(s));          /* un seul envoi : tout ou rien */
      zone.innerHTML = '';
      await load();
      messageSauvegarde('Import termin\u00e9 : ' + r.total + ' lignes.' +
        ((s.pieces_jointes_omises || []).length ? ' Pensez \u00e0 rattacher les pi\u00e8ces jointes.' : ''));
    } catch (e) {
      messageSauvegarde('Import annul\u00e9, rien n\u2019a \u00e9t\u00e9 \u00e9crit : ' + e.message, true);
    }
  };
}
function renderSauvegarde(zone) {
  if (!zone) return;
  zone.innerHTML =
    '<p class="reglages-intro">Exporter les donn\u00e9es du club, pour les lire ou pour les transf\u00e9rer vers un autre document. ' +
      'Grist garde aussi son propre historique des versions et permet de t\u00e9l\u00e9charger une copie compl\u00e8te du document.</p>' +
    '<h4 class="reglages-groupe">Export lisible</h4>' +
    '<p class="hint">Tout le parc en clair (noms, dates), un th\u00e8me par onglet ou par fichier. Pour consulter ou transmettre, pas pour r\u00e9importer.</p>' +
    '<div class="form-actions"><button type="button" id="sauvXlsx">Classeur Excel (.xlsx)</button>' +
      '<button type="button" class="secondary" id="sauvCsv">Fichiers CSV</button></div>' +
    '<h4 class="reglages-groupe">Sauvegarde et transfert</h4>' +
    '<p class="hint">Fichier complet (.json), r\u00e9importable dans un autre document EPILOG, m\u00eame d\u2019une version plus r\u00e9cente. ' +
      'Les pi\u00e8ces jointes (photos, notices, factures) n\u2019y sont pas incluses.</p>' +
    '<div class="form-actions"><button type="button" id="sauvJson">T\u00e9l\u00e9charger la sauvegarde</button></div>' +
    '<p class="hint" style="margin-top:10px"><b>Importer une sauvegarde</b> \u2014 uniquement dans un document vide. ' +
      'Un aper\u00e7u s\u2019affiche avant toute \u00e9criture.</p>' +
    '<input type="file" id="sauvFichier" accept=".json,application/json">' +
    '<div id="sauvApercu" style="margin-top:8px"></div>' +
    '<p id="sauvMsg" class="form-msg" style="display:block;margin-top:8px"></p>';
  document.getElementById('sauvXlsx').onclick = exporterLisibleXlsx;
  document.getElementById('sauvCsv').onclick = function () { exporterLisibleCsv(); };
  document.getElementById('sauvJson').onclick = exporterSauvegarde;
  document.getElementById('sauvFichier').onchange = function () { preparerImport(this.files && this.files[0]); };
}

