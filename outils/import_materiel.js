/* ======================= import d'un inventaire existant (2026.5.29) =======================
   Pour basculer un inventaire tenu dans un tableur vers EPILOG sans tout ressaisir.
   DECISIONS (Pierre, 09/11) : le demandeur s'adapte a EPILOG, pas l'inverse ; le modele a
   telecharger reprend les FEUILLES ET LES NOMS DE COLONNES de l'export lisible (un export complet
   est donc lui-meme importable) ; strict : la moindre erreur bloque tout, et l'ecriture se fait
   d'un bloc ; l'import AJOUTE seulement, il ne modifie jamais un exemplaire existant ; un rapport
   imprimable dit ce qui reste a faire (il se construit pendant l'analyse : consultable AVANT de
   confirmer).
   FEUILLES LUES : Inventaire (obligatoire), Categories, Lieux de stockage, Lots, Controles. Les
   autres (Resume, Commandes, Prets, Incidents, Reparations, Entretien, Fournisseurs, Adherents,
   Demandes) sont de l'historique produit par EPILOG : ignorees avec un message.
   LOTS : un lot = meme categorie + meme fabricant + meme modele + meme annee de fabrication ; une
   colonne facultative « Lot » force un regroupement, et la feuille Lots (facultative) en precise
   les valeurs. Colonnes lues PAR LEUR NOM (accents, casse et « * » sans importance), pas par position. */
var IMP_ALIAS = {
  inventaire: {
    marquage: ['marquage'], serie: ['numero de serie', 'n° de serie', 'n de serie'], couleur: ['couleur'],
    taille: ['taille ou longueur', 'taille', 'longueur'], lot: ['lot'], categorie: ['categorie'],
    fabricant: ['fabricant'], modele: ['modele'], lieu: ['lieu', 'lieu de stockage'],
    mes: ['mise en service', 'date de mise en service'], dateFab: ['date de fabrication'],
    duree: ['duree de vie (mois)', 'duree de vie'], prix: ['prix unitaire', 'prix'], quantite: ['quantite'],
    commentaire: ['commentaire'], statut: ['statut'], sortie: ['sortie du parc', 'date de sortie']
  },
  categories: {
    nom: ['nom'], nature: ['nature reglementaire'], duree: ['duree de vie par defaut (mois)', 'duree de vie (mois)', 'duree de vie'],
    prefixe: ['prefixe'], reparation: ['reparation prevue'], reparationsTxt: ['reparations acceptees'],
    decoupable: ['decoupable'], prolongation: ['prolongation par reparation']
  },
  lieux: { nom: ['nom'], description: ['description'] },
  lots: {
    designation: ['designation'], categorie: ['categorie'], fabricant: ['fabricant'], modele: ['modele'],
    dateFab: ['date de fabrication'], duree: ['duree de vie (mois)', 'duree de vie'], prix: ['prix unitaire'],
    commentaire: ['commentaire']
  },
  controles: {
    exemplaire: ['exemplaire', 'marquage'], date: ['date du controle', 'date'], controleur: ['controleur'],
    resultat: ['resultat'], commentaire: ['commentaire', 'observations'], type: ['type de controle', 'type']
  }
};
var IMP_NOMS_FEUILLES = { 'inventaire': 'inventaire', 'categories': 'categories', 'lieux de stockage': 'lieux', 'lieux': 'lieux',
                          'lots': 'lots', 'controles': 'controles' };
/* colonnes que l'export CALCULE : elles n'ont rien a faire dans un import, on ne s'en plaint pas */
var IMP_CALCULEES = ['fin de vie', 'prolongee par reparation', 'motif', 'prochain controle', 'controle en retard',
                     'photos', 'notice', 'commande', 'quantite achetee', 'facture', 'photo'];
var impEtat = { plan: null, fichier: '', resultat: null, enCours: false };

function impNorm(v) {
  return normRecherche(v === null || v === undefined ? '' : String(v)).replace(/\*+$/, '').trim();
}
function impTexte(v) {
  if (v === null || v === undefined || v instanceof Date) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}
/* Oui/Non -> true | false | null (vide) | undefined (illisible) */
function impOuiNon(v) {
  var t = impNorm(v);
  if (!t) return null;
  if (['oui', 'o', 'yes', 'y', 'vrai', 'true', '1', 'x'].indexOf(t) !== -1) return true;
  if (['non', 'n', 'no', 'faux', 'false', '0'].indexOf(t) !== -1) return false;
  return undefined;
}
/* nombre -> number | null (vide) | NaN (illisible) ; accepte « 12,5 », « 1 250 € » */
function impNombre(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  var t = String(v).replace(/[\u00a0\s€]/g, '').replace(',', '.');
  if (!t) return null;
  var n = Number(t);
  return isNaN(n) ? NaN : n;
}
function impDateJMA(j, mo, a, approx) {
  var d = new Date(Date.UTC(a, mo - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== j) return undefined;
  if (a < 1950 || a > 2100) return undefined;
  return { ts: Math.round(d.getTime() / 1000), approx: !!approx };
}
/* date -> { ts, approx } | null (vide) | undefined (illisible). Une ANNEE seule (« 2019 ») donne le
   1er janvier, marque approximative : la fin de vie qui en decoule ne peut etre que prudente. */
function impDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    if (isNaN(v)) return undefined;
    var d2 = new Date(v.getTime() + 12 * 3600 * 1000);   /* absorbe les decalages de fuseau de la lecture du classeur */
    return { ts: Math.round(Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate()) / 1000), approx: false };
  }
  if (typeof v === 'number') {
    if (Math.floor(v) === v && v >= 1950 && v <= 2100) return { ts: Math.round(Date.UTC(v, 0, 1) / 1000), approx: true };
    if (v > 20000 && v < 80000) return { ts: Math.round((Math.floor(v) - 25569) * 86400), approx: false };   /* numero de serie Excel */
    return undefined;
  }
  var t = String(v).trim(), m;
  if ((m = /^(\d{4})$/.exec(t))) return impDateJMA(1, 1, +m[1], true);
  if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/.exec(t))) { var a = +m[3]; if (a < 100) a += 2000; return impDateJMA(+m[1], +m[2], a); }
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(t))) return impDateJMA(+m[3], +m[2], +m[1]);
  if ((m = /^(\d{1,2})[\/.\-](\d{4})$/.exec(t))) return impDateJMA(1, +m[1], +m[2], true);
  return undefined;
}
function impNature(v) {
  var t = impNorm(v);
  if (!t) return null;
  if (/non[- ]?epi/.test(t)) return 'Non-EPI';
  if (/non soumis/.test(t)) return 'Non soumis a vieillissement';
  if (/soumis/.test(t)) return 'Soumis a vieillissement';
  return undefined;
}
function impResultat(v) {
  var t = impNorm(v);
  if (!t) return null;
  if (/surveill/.test(t)) return 'A surveiller';
  if (/repar/.test(t)) return 'A reparer';
  if (/reform/.test(t)) return 'Reforme';
  if (/^conforme/.test(t)) return 'Conforme';
  return undefined;
}
function impMotifSortie(v) {
  var t = impNorm(v);
  if (/^perdu/.test(t)) return 'Perdu';
  if (/^vol/.test(t)) return 'Vole';
  if (/^reform/.test(t)) return 'Reforme';
  if (/^ced|^vendu/.test(t)) return 'Cede';
  return null;   /* tout autre statut (En service, Prete...) est calcule par EPILOG : ignore */
}
function impPrefixe(nom) {
  var l = normRecherche(nom).replace(/[^a-z]/g, '').toUpperCase();
  return (l.slice(0, 4) || 'EPI');
}

/* ---------------------------- lecture du fichier ---------------------------- */
function impParserCsv(texte) {
  texte = texte.replace(/^\uFEFF/, '');
  var premiere = texte.split(/\r?\n/)[0] || '';
  var nb = { ';': (premiere.match(/;/g) || []).length, ',': (premiere.match(/,/g) || []).length, '\t': (premiere.match(/\t/g) || []).length };
  var fs = ';';
  if (nb[','] > nb[fs]) fs = ',';
  if (nb['\t'] > nb[fs]) fs = '\t';
  var lignes = [], ligne = [], champ = '', q = false;
  for (var i = 0; i < texte.length; i++) {
    var c = texte.charAt(i);
    if (q) {
      if (c === '"') { if (texte.charAt(i + 1) === '"') { champ += '"'; i++; } else q = false; }
      else champ += c;
    } else if (c === '"') q = true;
    else if (c === fs) { ligne.push(champ); champ = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte.charAt(i + 1) === '\n') i++;
      ligne.push(champ); champ = ''; lignes.push(ligne); ligne = [];
    } else champ += c;
  }
  if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes.map(function (l) { return l.map(function (c) { return c === '' ? null : c; }); });
}
/* -> { nomFeuille: [[cellules]] }. Un CSV est lu sans bibliotheque et devient la feuille Inventaire. */
async function impLireClasseur(fichier) {
  var buf = await fichier.arrayBuffer();
  if (/\.(csv|txt)$/i.test(fichier.name || '')) {
    var texte;
    try { texte = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) { texte = new TextDecoder('windows-1252').decode(buf); }   /* « CSV » d'Excel francais */
    return { 'Inventaire': impParserCsv(texte) };
  }
  var X = await chargerSheetJS();
  var wb = X.read(new Uint8Array(buf), { type: 'array', cellDates: true });
  var sortie = {};
  wb.SheetNames.forEach(function (nom) {
    sortie[nom] = X.utils.sheet_to_json(wb.Sheets[nom], { header: 1, defval: null, raw: true });
  });
  return sortie;
}
/* lignes brutes -> objets { n: numero de ligne du tableur, v: { champ: valeur } } */
function impObjets(lignes, alias) {
  var meilleur = -1, nb = 0;
  for (var i = 0; i < Math.min(lignes.length, 10); i++) {
    var n = 0;
    (lignes[i] || []).forEach(function (c) {
      var k = impNorm(c); if (!k) return;
      for (var f in alias) if (alias[f].indexOf(k) !== -1) { n++; break; }
    });
    if (n > nb) { nb = n; meilleur = i; }
  }
  if (meilleur < 0) return null;
  var cols = {}, inconnues = [];
  (lignes[meilleur] || []).forEach(function (c, j) {
    var k = impNorm(c); if (!k) return;
    var trouve = null;
    for (var f in alias) if (alias[f].indexOf(k) !== -1) { trouve = f; break; }
    if (trouve && cols[trouve] === undefined) cols[trouve] = j; else inconnues.push({ titre: impTexte(c), norm: k });
  });
  var objets = [];
  for (var r = meilleur + 1; r < lignes.length; r++) {
    var l = lignes[r] || [];
    if (l.every(function (c) { return c === null || c === undefined || String(c).trim() === ''; })) continue;
    var v = {};
    for (var f2 in cols) v[f2] = l[cols[f2]] === undefined ? null : l[cols[f2]];
    objets.push({ n: r + 1, v: v });
  }
  return { cols: cols, inconnues: inconnues, lignes: objets };
}

/* ------------------------------ analyse : le plan ------------------------------ */
function impPlages(marquages) {
  var items = marquages.map(function (m) {
    var r = /^(.*?)(\d+)$/.exec(String(m));
    return r ? { pref: r[1], num: parseInt(r[2], 10), larg: r[2].length, txt: String(m) } : { pref: String(m), num: null, larg: 0, txt: String(m) };
  }).sort(function (a, b) {
    return a.pref < b.pref ? -1 : a.pref > b.pref ? 1 : (a.num === null ? 0 : a.num - b.num);
  });
  var sortie = [], i = 0;
  while (i < items.length) {
    var j = i;
    while (items[i].num !== null && j + 1 < items.length && items[j + 1].pref === items[i].pref && items[j + 1].larg === items[i].larg &&
           items[j + 1].num === items[j].num + 1) j++;
    sortie.push(j > i ? items[i].txt + ' \u00e0 ' + items[j].txt : items[i].txt);
    i = j + 1;
  }
  return sortie;
}
function impConstruirePlan(classeur) {
  var P = { erreurs: [], av: {}, ignorees: { feuilles: [], colonnes: [], calculees: [], divers: [] },
            creer: { categories: [], lieux: [], adherents: [], lots: [], materiels: [], controles: [] },
            generes: [], infos: { lotsReutilises: 0, sorties: 0, controlesDoublons: 0 }, lotsDetail: [] };
  function err(feuille, n, msg) { P.erreurs.push({ feuille: feuille, ligne: n, msg: msg }); }
  function av(code, libelle, exemple, gravite) {
    var a = P.av[code] || (P.av[code] = { libelle: libelle, gravite: gravite || 'donnees', exemples: [] });
    a.exemples.push(exemple);
  }
  function prochain(cle) {
    var l = rawRows[cle] || refLists[cle] || [];
    return l.reduce(function (m, r) { return Math.max(m, r.id || 0); }, 0) + 1;
  }
  /* -- structure du document -- */
  ['categories', 'lieux', 'lots', 'materiels'].forEach(function (c) {
    if (!resolvedNames[c]) err('Document', 0, 'la table ' + c.toUpperCase() + ' est absente : installez d\u2019abord la structure (R\u00e9glages \u2192 Fonctionnement)');
  });
  if (P.erreurs.length) return P;

  /* -- feuilles reconnues -- */
  var F = {};
  Object.keys(classeur).forEach(function (nom) {
    var cle = IMP_NOMS_FEUILLES[impNorm(nom)];
    if (!cle) { P.ignorees.feuilles.push(nom); return; }
    var o = impObjets(classeur[nom], IMP_ALIAS[cle]);
    if (!o) { err(nom, 0, 'titres de colonnes introuvables (la premi\u00e8re ligne doit contenir les titres)'); return; }
    F[cle] = { nom: nom, o: o };
    o.inconnues.forEach(function (c) {
      (IMP_CALCULEES.indexOf(c.norm) !== -1 ? P.ignorees.calculees : P.ignorees.colonnes).push(nom + ' : ' + c.titre);
    });
  });
  if (!F.inventaire) { err('Inventaire', 0, 'la feuille \u00ab Inventaire \u00bb est introuvable'); return P; }
  var INV = F.inventaire.nom;
  if (F.inventaire.o.cols.marquage === undefined) err(INV, 0, 'colonne \u00ab Marquage \u00bb introuvable');
  if (F.inventaire.o.cols.categorie === undefined) err(INV, 0, 'colonne \u00ab Cat\u00e9gorie \u00bb introuvable');
  if (F.controles && !resolvedNames.controles) err(F.controles.nom, 0, 'la table CONTROLES est absente du document');
  if (P.erreurs.length) return P;
  if (F.inventaire.o.cols.dateFab === undefined) av('col_datefab', 'Colonne \u00ab Date de fabrication \u00bb absente : aucune fin de vie calendaire ne sera calcul\u00e9e', INV, 'securite');

  /* -- categories -- */
  var cats = {}, idCat = prochain('categories');
  refLists.categories.forEach(function (c) {
    cats[impNorm(c.nom)] = { id: c.id, nom: c.nom, nature: c.type_epi || '', duree: c.duree_vie_defaut_mois || null, prefixe: c.prefixe || '', existante: true };
  });
  if (F.categories) F.categories.o.lignes.forEach(function (l) {
    var f = F.categories.nom, nom = impTexte(l.v.nom);
    if (!nom) { err(f, l.n, 'nom de cat\u00e9gorie manquant'); return; }
    var k = impNorm(nom), nature = impNature(l.v.nature), duree = impNombre(l.v.duree);
    if (cats[k] && cats[k].existante) {
      if (nature && cats[k].nature && nature !== cats[k].nature) av('cat_diff', 'Cat\u00e9gories d\u00e9j\u00e0 pr\u00e9sentes dont la description du fichier diff\u00e8re (celle du document est conserv\u00e9e)', nom, 'donnees');
      return;
    }
    if (cats[k]) { err(f, l.n, 'cat\u00e9gorie \u00ab ' + nom + ' \u00bb en double'); return; }
    if (!nature) { err(f, l.n, 'nature r\u00e9glementaire manquante ou illisible pour \u00ab ' + nom + ' \u00bb (\u00ab EPI soumis au vieillissement \u00bb, \u00ab EPI non soumis au vieillissement \u00bb ou \u00ab Non-EPI \u00bb)'); return; }
    if (isNaN(duree) || (duree !== null && duree <= 0)) { err(f, l.n, 'dur\u00e9e de vie illisible pour \u00ab ' + nom + ' \u00bb'); return; }
    if (nature === 'Soumis a vieillissement' && duree === null) { err(f, l.n, 'dur\u00e9e de vie (mois) obligatoire pour \u00ab ' + nom + ' \u00bb : cat\u00e9gorie soumise au vieillissement'); return; }
    var rep = impOuiNon(l.v.reparation), dec = impOuiNon(l.v.decoupable), pro = impOuiNon(l.v.prolongation);
    if (rep === undefined || dec === undefined || pro === undefined) { err(f, l.n, 'valeur Oui/Non attendue pour \u00ab ' + nom + ' \u00bb (R\u00e9paration pr\u00e9vue, D\u00e9coupable, Prolongation)'); return; }
    var c = { id: idCat++, nom: nom, nature: nature, duree: duree, prefixe: impTexte(l.v.prefixe), existante: false };
    if (!c.prefixe) { c.prefixe = impPrefixe(nom); av('prefixe_derive', 'Pr\u00e9fixes de marquage d\u00e9duits du nom de la cat\u00e9gorie', nom + ' \u2192 ' + c.prefixe, 'donnees'); }
    cats[k] = c;
    P.creer.categories.push({ id: c.id, nom: nom, type_epi: nature, duree_vie_defaut_mois: duree, prefixe: c.prefixe,
      maintenance_fabricant: !!rep, reparations_acceptees: impTexte(l.v.reparationsTxt), peut_etre_decoupe: !!dec,
      prolongation_par_reparation: !!pro && !!rep && nature === 'Soumis a vieillissement' });
  });

  /* -- lieux -- */
  var lieux = {}, idLieu = prochain('lieux');
  refLists.lieux.forEach(function (l) { lieux[impNorm(l.nom)] = { id: l.id, nom: l.nom }; });
  function lieuPar(nom, description) {
    var k = impNorm(nom); if (!k) return null;
    if (!lieux[k]) {
      lieux[k] = { id: idLieu++, nom: nom };
      P.creer.lieux.push({ id: lieux[k].id, nom: nom, description: description || '' });
    }
    return lieux[k];
  }
  if (F.lieux) F.lieux.o.lignes.forEach(function (l) { lieuPar(impTexte(l.v.nom), impTexte(l.v.description)); });

  /* -- feuille Lots (facultative) -- */
  var lotsFeuille = {};
  if (F.lots) F.lots.o.lignes.forEach(function (l) {
    var d = impTexte(l.v.designation);
    if (!d) { err(F.lots.nom, l.n, 'd\u00e9signation de lot manquante'); return; }
    var k = impNorm(d);
    if (lotsFeuille[k]) { err(F.lots.nom, l.n, 'lot \u00ab ' + d + ' \u00bb en double (d\u00e9j\u00e0 ligne ' + lotsFeuille[k].n + ')'); return; }
    lotsFeuille[k] = { n: l.n, v: l.v, nom: d, utilise: false };
  });

  /* -- inventaire : validation ligne par ligne -- */
  function categorieInconnue(nom) {
    var k = impNorm(nom).replace(/s$/, '');
    var proches = Object.keys(cats).filter(function (c) {
      var cc = c.replace(/s$/, ''); return cc === k || cc.indexOf(k) === 0 || k.indexOf(cc) === 0;
    }).map(function (c) { return '\u00ab ' + cats[c].nom + ' \u00bb'; }).slice(0, 3);
    return 'cat\u00e9gorie \u00ab ' + nom + ' \u00bb inconnue' + (proches.length ? ' (vouliez-vous dire ' + proches.join(' ou ') + ' ?)' : '') +
      ' : choisissez-en une de la feuille Listes, ou d\u00e9crivez-la dans la feuille Cat\u00e9gories';
  }
  var marqFichier = {}, marqDoc = {}, rows = [];
  refLists.materiels.forEach(function (m) { marqDoc[normMarquage(m.numero_marquage)] = m; });
  F.inventaire.o.lignes.forEach(function (l) {
    var v = l.v, n = l.n, ok = true;
    function bad(msg) { err(INV, n, msg); ok = false; }
    var catNom = impTexte(v.categorie), cat = null;
    if (!catNom) bad('cat\u00e9gorie manquante'); else { cat = cats[impNorm(catNom)]; if (!cat) bad(categorieInconnue(catNom)); }
    var marq = impTexte(v.marquage), q = impNombre(v.quantite);
    if (isNaN(q) || (q !== null && (q < 1 || Math.floor(q) !== q))) bad('quantit\u00e9 illisible (nombre entier \u2265 1)');
    var quantite = (q === null || isNaN(q)) ? 1 : q;
    if (quantite > 500) bad('quantit\u00e9 excessive (500 maximum par ligne)');
    if (marq) {
      if (quantite > 1) bad('une quantit\u00e9 sup\u00e9rieure \u00e0 1 suppose un marquage vide : EPILOG num\u00e9rote lui-m\u00eame');
      var km = normMarquage(marq);
      if (marqFichier[km]) bad('marquage \u00ab ' + marq + ' \u00bb en double (d\u00e9j\u00e0 ligne ' + marqFichier[km] + ')');
      else if (marqDoc[km]) bad('marquage \u00ab ' + marq + ' \u00bb d\u00e9j\u00e0 pr\u00e9sent dans le document');
      else marqFichier[km] = n;
    }
    var dFab = impDate(v.dateFab), mes = impDate(v.mes), sortie = impDate(v.sortie), duree = impNombre(v.duree), prix = impNombre(v.prix);
    if (dFab === undefined) bad('date de fabrication illisible (\u00ab ' + impTexte(v.dateFab) + ' \u00bb) : jj/mm/aaaa ou ann\u00e9e');
    if (mes === undefined) bad('date de mise en service illisible (\u00ab ' + impTexte(v.mes) + ' \u00bb) : jj/mm/aaaa');
    if (sortie === undefined) bad('date de sortie illisible (\u00ab ' + impTexte(v.sortie) + ' \u00bb) : jj/mm/aaaa');
    if (isNaN(duree) || (duree !== null && duree <= 0)) bad('dur\u00e9e de vie illisible (nombre de mois)');
    if (isNaN(prix) || (prix !== null && prix < 0)) bad('prix illisible');
    if (!ok) return;
    rows.push({ n: n, marq: marq, quantite: quantite, cat: cat, lotNom: impTexte(v.lot), fab: impTexte(v.fabricant), mod: impTexte(v.modele),
      dFab: dFab, duree: duree, prix: prix, lieu: impTexte(v.lieu), mes: mes, serie: impTexte(v.serie), couleur: impTexte(v.couleur),
      taille: impTexte(v.taille), comm: impTexte(v.commentaire), motif: impMotifSortie(v.statut), sortie: sortie });
  });

  /* -- numerotation des exemplaires sans marquage -- */
  var utilises = {};
  Object.keys(marqDoc).forEach(function (k) { utilises[k] = true; });
  Object.keys(marqFichier).forEach(function (k) { utilises[k] = true; });
  var prefAvert = {};
  function prefixeDe(cat) {
    if (!cat.prefixe) {
      cat.prefixe = impPrefixe(cat.nom);
      if (!prefAvert[cat.nom]) { prefAvert[cat.nom] = true; av('prefixe_derive', 'Pr\u00e9fixes de marquage d\u00e9duits du nom de la cat\u00e9gorie', cat.nom + ' \u2192 ' + cat.prefixe, 'donnees'); }
    }
    return cat.prefixe;
  }
  function numeroSuivant(prefixe) {
    var pref = normMarquage(prefixe), max = 0;
    Object.keys(utilises).forEach(function (k) {
      if (k.indexOf(pref) === 0 && /^\d+$/.test(k.slice(pref.length))) max = Math.max(max, parseInt(k.slice(pref.length), 10));
    });
    return max + 1;
  }
  var unites = [];
  rows.forEach(function (r) {
    if (r.marq) { unites.push({ marq: r.marq, genere: false, row: r }); return; }
    for (var i = 0; i < r.quantite; i++) {
      var p = prefixeDe(r.cat), m = p + String(numeroSuivant(p)).padStart(3, '0');
      utilises[normMarquage(m)] = true;
      unites.push({ marq: m, genere: true, row: r });
    }
  });

  /* -- regroupement en lots -- */
  var groupes = {}, ordre = [];
  unites.forEach(function (u) {
    var r = u.row, cle = r.lotNom ? 'n:' + impNorm(r.lotNom)
      : 'a:' + [r.cat.id, impNorm(r.fab), impNorm(r.mod), r.dFab ? new Date(r.dFab.ts * 1000).getUTCFullYear() : ''].join('|');
    var g = groupes[cle];
    if (!g) { g = groupes[cle] = { cle: cle, explicite: !!r.lotNom, nom: r.lotNom, cat: r.cat, unites: [], lignes: [] }; ordre.push(g); }
    g.unites.push(u);
    if (g.lignes.indexOf(r) === -1) g.lignes.push(r);
  });
  var nomsLots = {}, lotsDoc = {}, idLot = prochain('lots');
  refLists.lots.forEach(function (l) { nomsLots[impNorm(l.designation)] = true; lotsDoc[impNorm(l.designation)] = l; });
  ordre.forEach(function (g) {
    var lf = null, premiere = g.lignes[0];
    if (g.explicite) {
      var kn = impNorm(g.nom), ex = lotsDoc[kn];
      lf = lotsFeuille[kn] || null; if (lf) lf.utilise = true;
      var autres = g.lignes.filter(function (r) { return r.cat.id !== g.cat.id; });
      if (autres.length) { err(INV, autres[0].n, 'le lot \u00ab ' + g.nom + ' \u00bb regroupe des cat\u00e9gories diff\u00e9rentes (lignes ' + g.lignes.map(function (r) { return r.n; }).join(', ') + ')'); return; }
      if (ex) {
        if (ex.categorie !== g.cat.id) { err(INV, premiere.n, 'le lot \u00ab ' + g.nom + ' \u00bb existe d\u00e9j\u00e0 dans le document avec une autre cat\u00e9gorie'); return; }
        g.lotId = ex.id; P.infos.lotsReutilises++; return;
      }
    }
    function lotTexte(champLot, champLigne) {
      var vals = [];
      if (lf && impTexte(lf.v[champLot])) vals.push(impTexte(lf.v[champLot]));
      g.lignes.forEach(function (r) { if (r[champLigne]) vals.push(r[champLigne]); });
      return vals[0] || '';
    }
    var fab = lotTexte('fabricant', 'fab'), mod = lotTexte('modele', 'mod');
    if (g.explicite) {
      ['fab', 'mod'].forEach(function (ch) {
        var diff = {}; g.lignes.forEach(function (r) { if (r[ch]) diff[impNorm(r[ch])] = true; });
        if (Object.keys(diff).length > 1) av('lot_diff', 'Lots dont les lignes donnent des valeurs diff\u00e9rentes (la premi\u00e8re est retenue)', g.nom + ' (' + (ch === 'fab' ? 'fabricant' : 'mod\u00e8le') + ')', 'donnees');
      });
    }
    var dFab = null, prixLot = null, dureeLot = null, commLot = '';
    if (lf) {
      var d1 = impDate(lf.v.dateFab), p1 = impNombre(lf.v.prix), u1 = impNombre(lf.v.duree);
      if (d1 === undefined) err(F.lots.nom, lf.n, 'date de fabrication illisible'); else dFab = d1;
      if (isNaN(p1)) err(F.lots.nom, lf.n, 'prix illisible'); else prixLot = p1;
      if (isNaN(u1)) err(F.lots.nom, lf.n, 'dur\u00e9e de vie illisible'); else dureeLot = u1;
      commLot = impTexte(lf.v.commentaire);
      var catF = impTexte(lf.v.categorie);
      if (catF && cats[impNorm(catF)] !== g.cat) err(F.lots.nom, lf.n, 'la cat\u00e9gorie du lot (\u00ab ' + catF + ' \u00bb) ne correspond pas \u00e0 celle de ses exemplaires (\u00ab ' + g.cat.nom + ' \u00bb)');
    }
    g.lignes.forEach(function (r) {
      if (!dFab && r.dFab) dFab = r.dFab;
      if (prixLot === null && r.prix !== null) prixLot = r.prix;
      if (dureeLot === null && r.duree !== null) dureeLot = r.duree;
    });
    var soumis = g.cat.nature === 'Soumis a vieillissement';
    if (dureeLot === null && soumis) dureeLot = g.cat.duree;
    var nom = g.nom;
    if (!nom) {
      var annee = dFab ? new Date(dFab.ts * 1000).getUTCFullYear() : '';
      var base = [g.cat.nom, fab, mod, annee].filter(Boolean).join(' '), c = 2;
      nom = base;
      while (nomsLots[impNorm(nom)]) nom = base + ' (' + (c++) + ')';
    }
    nomsLots[impNorm(nom)] = true;
    g.lotId = idLot++;
    g.lotNom = nom;
    if (soumis && !dFab) av('fab_manquante', 'Exemplaires soumis au vieillissement SANS date de fabrication : aucune fin de vie calendaire n\u2019est calcul\u00e9e', g.unites.map(function (u) { return u.marq; }), 'securite');
    if (soumis && dureeLot === null) av('duree_manquante', 'Lots soumis au vieillissement sans dur\u00e9e de vie connue', nom, 'securite');
    if (dFab && dFab.approx) av('fab_annee', 'Dates de fabrication donn\u00e9es par l\u2019ann\u00e9e seule (1er janvier retenu : la fin de vie ne peut \u00eatre que prudente)', nom, 'donnees');
    P.creer.lots.push({ id: g.lotId, designation: nom, categorie: g.cat.id, fabricant: fab, modele: mod,
      date_fabrication: dFab ? dFab.ts : null, duree_vie_mois: dureeLot, prix_unitaire: prixLot, quantite_achetee: g.unites.length, commentaire: commLot });
    P.lotsDetail.push({ nom: nom, cat: g.cat.nom, n: g.unites.length });
  });
  Object.keys(lotsFeuille).forEach(function (k) {
    if (!lotsFeuille[k].utilise) P.ignorees.divers.push('Lots, ligne ' + lotsFeuille[k].n + ' : le lot \u00ab ' + lotsFeuille[k].nom + ' \u00bb n\u2019a aucun exemplaire dans l\u2019Inventaire (non cr\u00e9\u00e9)');
  });
  if (P.erreurs.length) return P;

  /* -- exemplaires -- */
  var idMat = prochain('materiels'), parMarq = {}, sansControle = [];
  unites.forEach(function (u) {
    var r = u.row, g = groupes[r.lotNom ? 'n:' + impNorm(r.lotNom) : 'a:' + [r.cat.id, impNorm(r.fab), impNorm(r.mod), r.dFab ? new Date(r.dFab.ts * 1000).getUTCFullYear() : ''].join('|')];
    var lieu = r.lieu ? lieuPar(r.lieu) : null;
    var m = { id: idMat++, lot: g.lotId, numero_marquage: u.marq, lieu_stockage: lieu ? lieu.id : null,
      date_mise_en_service: r.mes ? r.mes.ts : null, hors_service_motif: r.motif || null, hors_service_date: null,
      couleur: r.couleur, taille: r.taille, commentaire: r.comm, numero_serie: r.serie };
    if (r.motif) {
      P.infos.sorties++;
      m.hors_service_date = r.sortie ? r.sortie.ts : null;
      if (!r.sortie) av('sortie_sans_date', 'Exemplaires sortis du parc sans date de sortie', u.marq, 'donnees');
      if (!m.commentaire) { m.commentaire = 'Sortie d\u2019inventaire reprise \u00e0 l\u2019import (cause non pr\u00e9cis\u00e9e)'; av('sortie_sans_cause', 'Exemplaires sortis du parc sans cause pr\u00e9cis\u00e9e (commentaire g\u00e9n\u00e9rique ajout\u00e9)', u.marq, 'donnees'); }
    }
    if (!r.lieu) av('sans_lieu', 'Exemplaires sans lieu de stockage', u.marq, 'donnees');
    if (!(g.lignes[0] && (g.lignes.some(function (x) { return x.fab; })))) av('sans_fabricant', 'Exemplaires sans fabricant', u.marq, 'donnees');
    if (!(g.lignes.some(function (x) { return x.mod; }))) av('sans_modele', 'Exemplaires sans mod\u00e8le (r\u00e9f\u00e9rence pr\u00e9cise de l\u2019\u00e9quipement)', u.marq, 'donnees');
    if (!r.serie) av('sans_serie', 'Exemplaires sans num\u00e9ro de s\u00e9rie (utile pour r\u00e9pondre \u00e0 un rappel du fabricant)', u.marq, 'donnees');
    if (u.genere) P.generes.push({ marq: u.marq, cat: r.cat.nom, lot: g.lotNom, lieu: r.lieu || '' });
    P.creer.materiels.push(m);
    parMarq[normMarquage(u.marq)] = { id: m.id, sortie: !!r.motif, explicite: !u.genere };
    if (!r.motif) sansControle.push(u.marq);
  });

  /* -- controles -- */
  var adh = {}, idAdh = prochain('adherents'), vus = {}, aControle = {};
  (refLists.adherents || []).forEach(function (a) { adh[impNorm(a.nom_complet)] = { id: a.id, nom: a.nom_complet }; });
  var dejaDoc = {};
  (rawRows.controles || []).forEach(function (c) { dejaDoc[c.materiel + '|' + (toDate(c.date_controle) ? Math.round(toDate(c.date_controle).getTime() / 1000) : '') + '|' + c.resultat] = true; });
  var idCtl = prochain('controles');
  if (F.controles) F.controles.o.lignes.forEach(function (l) {
    var f = F.controles.nom, v = l.v, n = l.n, ok = true;
    function bad(msg) { err(f, n, msg); ok = false; }
    var marq = impTexte(v.exemplaire), km = normMarquage(marq), cible = null, matId = null;
    if (!marq) bad('exemplaire manquant');
    else if (parMarq[km]) { matId = parMarq[km].id; cible = parMarq[km]; }
    else if (marqDoc[km]) matId = marqDoc[km].id;
    else bad('exemplaire \u00ab ' + marq + ' \u00bb introuvable (ni dans l\u2019Inventaire du fichier, ni dans le document)');
    var d = impDate(v.date), res = impResultat(v.resultat);
    if (d === null || d === undefined || d.approx) bad('date du contr\u00f4le obligatoire et compl\u00e8te (jj/mm/aaaa)');
    if (!res) bad('r\u00e9sultat obligatoire : Conforme, \u00c0 surveiller, \u00c0 r\u00e9parer ou R\u00e9form\u00e9');
    if (!ok) return;
    var cle = matId + '|' + d.ts + '|' + res;
    if (vus[cle] || dejaDoc[cle]) { P.infos.controlesDoublons++; return; }
    vus[cle] = true;
    var controleur = null, nomC = impTexte(v.controleur);
    if (nomC) {
      var kc = impNorm(nomC);
      if (!adh[kc]) {
        adh[kc] = { id: idAdh++, nom: nomC };
        P.creer.adherents.push({ id: adh[kc].id, nom_complet: nomC, role: 'Controleur EPI habilite' });
      }
      controleur = adh[kc].id;
    }
    var type = impTexte(v.type);
    if (type && typeControleChoices.indexOf(type) === -1) { av('type_ctl_defaut', 'Types de contr\u00f4le inconnus remplac\u00e9s par \u00ab Contr\u00f4le p\u00e9riodique \u00bb', type, 'donnees'); type = ''; }
    P.creer.controles.push({ id: idCtl++, materiel: matId, date_controle: d.ts, controleur: controleur, resultat: res,
      commentaire: impTexte(v.commentaire), type_controle: type || 'Contr\u00f4le p\u00e9riodique' });
    if (cible) aControle[km] = true;
  });
  if (P.erreurs.length) return P;
  var jamais = sansControle.filter(function (m) { return !aControle[normMarquage(m)]; });
  if (jamais.length) av('sans_controle', 'Exemplaires en circulation sans aucun contr\u00f4le enregistr\u00e9 (leur \u00e9ch\u00e9ance partira de la mise en service, ou \u00e0 d\u00e9faut de la fabrication)', jamais, 'securite');
  /* les exemplaires d'un meme avertissement sont parfois donnes en liste : on aplatit */
  Object.keys(P.av).forEach(function (k) {
    var a = P.av[k], plat = [];
    a.exemples.forEach(function (e) { if (Array.isArray(e)) plat = plat.concat(e); else plat.push(e); });
    a.exemples = plat;
  });
  return P;
}
function impResume(P) {
  return { categories: P.creer.categories.length, lieux: P.creer.lieux.length, lots: P.creer.lots.length, lotsReutilises: P.infos.lotsReutilises,
           exemplaires: P.creer.materiels.length, generes: P.generes.length, controles: P.creer.controles.length,
           adherents: P.creer.adherents.length, sorties: P.infos.sorties };
}

/* ------------------------------ ecriture (d'un bloc) ------------------------------ */
async function impExecuter(P) {
  var A = [];
  function ajouter(cle, lignes) {
    if (!lignes.length) return;
    var nomT = resolvedNames[cle];
    if (!nomT) throw new Error('table ' + cle + ' absente du document');
    var connues = colonnesConnues[cle] || [];
    var cols = Object.keys(lignes[0]).filter(function (c) { return c !== 'id' && connues.indexOf(c) !== -1; });
    var valeurs = {};
    cols.forEach(function (c) { valeurs[c] = lignes.map(function (l) { return l[c] === undefined ? null : l[c]; }); });
    A.push(['BulkAddRecord', nomT, lignes.map(function (l) { return l.id; }), valeurs]);
  }
  ajouter('categories', P.creer.categories); ajouter('lieux', P.creer.lieux); ajouter('adherents', P.creer.adherents);
  ajouter('lots', P.creer.lots); ajouter('materiels', P.creer.materiels); ajouter('controles', P.creer.controles);
  await appliquer(A);          /* un seul envoi : tout ou rien */
}

/* ------------------------------ rapport imprimable ------------------------------ */
function impRapportHtml(P, resultat) {
  var R = impResume(P), now = new Date();
  var statut = resultat ? 'import effectu\u00e9' : (P.erreurs.length ? 'import NON effectu\u00e9 : erreurs \u00e0 corriger' : 'aper\u00e7u avant import');
  function liste(a) {
    var pl = impPlages(a.exemples), reste = pl.length > 25 ? pl.length - 25 : 0;
    var txt = pl.slice(0, 25).map(esc).join(', ') + (reste ? ' \u2026 et ' + reste + ' autre' + (reste > 1 ? 's' : '') : '');
    return '<tr><td style="width:24px">\u2610</td><td><b>' + esc(a.libelle) + '</b> \u2014 ' + a.exemples.length +
      '<br><span style="color:#555">' + txt + '</span></td></tr>';
  }
  function section(titre, codes, vide) {
    var items = Object.keys(P.av).filter(function (k) { return codes(P.av[k]); });
    if (!items.length) return vide ? '<h2>' + titre + '</h2><p style="color:#666">' + vide + '</p>' : '';
    return '<h2>' + titre + '</h2><table>' + items.map(function (k) { return liste(P.av[k]); }).join('') + '</table>';
  }
  var corps =
    '<div class="entete"><span class="club">' + esc(clubImprimable()) + '</span><span>Rapport d\u2019import</span></div>' +
    '<h1>Rapport d\u2019import \u2014 ce qui reste \u00e0 faire</h1>' +
    '<p class="sous">' + esc(impEtat.fichier || 'fichier import\u00e9') + ' &middot; ' + now.toLocaleDateString('fr-FR') + ' &middot; ' + esc(statut) + '</p>' +
    '<h2>R\u00e9sum\u00e9</h2><div class="grid">' +
      ligneInfo('Exemplaires', R.exemplaires + (R.generes ? ' (dont ' + R.generes + ' num\u00e9rot\u00e9s par EPILOG)' : '')) +
      ligneInfo('Lots cr\u00e9\u00e9s', R.lots + (R.lotsReutilises ? ' (+ ' + R.lotsReutilises + ' lot(s) existant(s) compl\u00e9t\u00e9(s))' : '')) +
      ligneInfo('Cat\u00e9gories cr\u00e9\u00e9es', R.categories) + ligneInfo('Lieux cr\u00e9\u00e9s', R.lieux) +
      ligneInfo('Contr\u00f4les import\u00e9s', R.controles) + ligneInfo('Contr\u00f4leurs cr\u00e9\u00e9s', R.adherents) +
      ligneInfo('Sorties du parc reprises', R.sorties) +
    '</div>' +
    (P.erreurs.length ? '<h2>Erreurs \u00e0 corriger avant l\u2019import (' + P.erreurs.length + ')</h2><table>' +
      P.erreurs.slice(0, 200).map(function (e) { return '<tr><td style="width:24px">\u2610</td><td><b>' + esc(e.feuille) + (e.ligne ? ', ligne ' + e.ligne : '') + '</b> : ' + esc(e.msg) + '</td></tr>'; }).join('') +
      (P.erreurs.length > 200 ? '<tr><td></td><td>\u2026 et ' + (P.erreurs.length - 200) + ' autres</td></tr>' : '') + '</table>' : '') +
    section('1. \u00c0 traiter en priorit\u00e9 (s\u00e9curit\u00e9)', function (a) { return a.gravite === 'securite'; }, 'Rien de bloquant pour la s\u00e9curit\u00e9.') +
    (P.generes.length ? '<h2>2. \u00c0 \u00e9tiqueter sur le mat\u00e9riel</h2><p>Ces num\u00e9ros ont \u00e9t\u00e9 attribu\u00e9s par EPILOG : reportez-les sur chaque exemplaire.</p><table>' +
      Object.keys(P.generes.reduce(function (o, g) { o[g.cat + '|' + g.lot + '|' + g.lieu] = 1; return o; }, {})).map(function (k) {
        var p = k.split('|'), ms = P.generes.filter(function (g) { return g.cat + '|' + g.lot + '|' + g.lieu === k; }).map(function (g) { return g.marq; });
        return '<tr><td style="width:24px">\u2610</td><td><b>' + esc(p[1]) + '</b> (' + esc(p[0]) + (p[2] ? ', ' + esc(p[2]) : '') + ') \u2014 ' + ms.length +
          '<br><span style="color:#555">' + impPlages(ms).map(esc).join(', ') + '</span></td></tr>';
      }).join('') + '</table>' : '') +
    section('3. Donn\u00e9es \u00e0 compl\u00e9ter', function (a) { return a.gravite !== 'securite'; }, '') +
    '<h2>4. Cr\u00e9\u00e9 automatiquement \u2014 \u00e0 v\u00e9rifier</h2><table>' +
      (R.categories ? '<tr><td style="width:24px">\u2610</td><td><b>Cat\u00e9gories cr\u00e9\u00e9es (' + R.categories + ')</b> : ' + P.creer.categories.map(function (c) { return esc(c.nom); }).join(', ') +
        '<br><span style="color:#555">V\u00e9rifiez dans Listes du club : r\u00e9paration pr\u00e9vue, d\u00e9coupable, prolongation par r\u00e9paration, r\u00e9parations accept\u00e9es.</span></td></tr>' : '') +
      (R.lieux ? '<tr><td style="width:24px">\u2610</td><td><b>Lieux de stockage cr\u00e9\u00e9s (' + R.lieux + ')</b> : ' + P.creer.lieux.map(function (c) { return esc(c.nom); }).join(', ') +
        '<br><span style="color:#555">Ajoutez une description si utile.</span></td></tr>' : '') +
      (R.adherents ? '<tr><td style="width:24px">\u2610</td><td><b>Contr\u00f4leurs cr\u00e9\u00e9s (' + R.adherents + ')</b> : ' + P.creer.adherents.map(function (c) { return esc(c.nom_complet); }).join(', ') +
        '<br><span style="color:#555">Cr\u00e9\u00e9s avec leur seul nom, r\u00f4le \u00ab Contr\u00f4leur EPI habilit\u00e9 \u00bb : compl\u00e9tez licence, e-mail, t\u00e9l\u00e9phone.</span></td></tr>' : '') +
      (R.lots ? '<tr><td style="width:24px">\u2610</td><td><b>Lots cr\u00e9\u00e9s (' + R.lots + ')</b><br><span style="color:#555">' +
        P.lotsDetail.slice(0, 40).map(function (l) { return esc(l.nom) + ' (' + l.n + ')'; }).join(' &middot; ') + (P.lotsDetail.length > 40 ? ' \u2026' : '') +
        '<br>Regroupement automatique : m\u00eame cat\u00e9gorie, fabricant, mod\u00e8le et ann\u00e9e de fabrication. Renommez ou fusionnez au besoin (\u00c9diter le lot).</span></td></tr>' : '') +
    '</table>' +
    '<h2>5. Non repris par l\u2019import \u2014 \u00e0 saisir \u00e0 la main si besoin</h2><table>' +
      ['Photos des exemplaires et des mod\u00e8les, notices des fabricants, factures',
       'Commandes, fournisseurs et budget (les lots import\u00e9s n\u2019ont pas de commande rattach\u00e9e)',
       'Historique des pr\u00eats, incidents, r\u00e9parations et entretiens',
       'Coordonn\u00e9es des adh\u00e9rents, r\u00f4les, r\u00e9glages du club (nom, couleurs, liens)'].map(function (t) {
        return '<tr><td style="width:24px">\u2610</td><td>' + esc(t) + '</td></tr>';
      }).join('') + '</table>' +
    ((P.ignorees.feuilles.length || P.ignorees.colonnes.length || P.ignorees.divers.length || P.infos.controlesDoublons)
      ? '<h2>6. \u00c9l\u00e9ments du fichier ignor\u00e9s</h2><table>' +
        (P.ignorees.feuilles.length ? '<tr><td style="width:24px"></td><td><b>Feuilles non lues</b> : ' + P.ignorees.feuilles.map(esc).join(', ') + '</td></tr>' : '') +
        (P.ignorees.colonnes.length ? '<tr><td></td><td><b>Colonnes non reconnues</b> : ' + P.ignorees.colonnes.map(esc).join(' ; ') + '</td></tr>' : '') +
        (P.ignorees.divers.length ? '<tr><td></td><td>' + P.ignorees.divers.map(esc).join('<br>') + '</td></tr>' : '') +
        (P.infos.controlesDoublons ? '<tr><td></td><td><b>' + P.infos.controlesDoublons + '</b> contr\u00f4le(s) en double ignor\u00e9(s)</td></tr>' : '') + '</table>' : '') +
    '<p style="color:#666;margin-top:18px">Ce rapport liste ce que l\u2019import a constat\u00e9 : ce qu\u2019il n\u2019a pas pu reprendre et ce qu\u2019il a d\u00e9cid\u00e9 faute d\u2019information. ' +
      'Il ne peut pas savoir ce qui n\u2019\u00e9tait pas dans votre fichier.</p>';
  return enveloppeFiche('Rapport d\u2019import', corps);
}
function impOuvrirRapport() {
  if (!impEtat.plan) return;
  sortirDocument(impRapportHtml(impEtat.plan, impEtat.resultat), 'rapport-import.html', null);
}

/* ------------------------------ modele a telecharger ------------------------------ */
async function impTelechargerModele() {
  var msg = document.getElementById('impMsg');
  try {
    var X = await chargerSheetJS();
    var wb = X.utils.book_new();
    function feuille(nom, aoa, largeurs) {
      var ws = X.utils.aoa_to_sheet(aoa);
      ws['!cols'] = (largeurs || []).map(function (w) { return { wch: w }; });
      X.utils.book_append_sheet(wb, ws, nom);
    }
    var cats = (refLists.categories || []).map(function (c) { return c.nom; });
    var lieux = (refLists.lieux || []).map(function (l) { return l.nom; });
    feuille('Mode d\u2019emploi', [
      ['EPILOG \u2014 mod\u00e8le d\u2019import d\u2019un inventaire existant (version ' + VERSION_EPILOG + ')'],
      [''],
      ['COMMENT FAIRE'],
      ['1. Copiez votre inventaire dans la feuille \u00ab Inventaire \u00bb, une ligne par exemplaire. Utilisez \u00ab Collage sp\u00e9cial \u2192 Valeurs \u00bb pour ne pas \u00e9craser le mod\u00e8le.'],
      ['2. Si une cat\u00e9gorie n\u2019existe pas encore dans EPILOG, d\u00e9crivez-la dans la feuille \u00ab Cat\u00e9gories \u00bb (la feuille \u00ab Listes \u00bb donne celles qui existent d\u00e9j\u00e0).'],
      ['3. Dans EPILOG : onglet Mat\u00e9riel \u2192 \u00ab Importer un inventaire \u00bb. Un aper\u00e7u et un rapport s\u2019affichent AVANT toute \u00e9criture ; au moindre doute rien n\u2019est \u00e9crit.'],
      ['4. Imprimez le rapport : il liste ce qui reste \u00e0 faire \u00e0 la main (num\u00e9ros \u00e0 \u00e9tiqueter, donn\u00e9es \u00e0 compl\u00e9ter, photos\u2026).'],
      [''],
      ['LA FEUILLE \u00ab INVENTAIRE \u00bb (les titres de colonnes ne doivent pas \u00eatre modifi\u00e9s ; l\u2019ordre n\u2019a pas d\u2019importance)'],
      ['OBLIGATOIRE : Marquage (sauf si vous indiquez une Quantit\u00e9 : EPILOG num\u00e9rote alors lui-m\u00eame et vous donne la liste \u00e0 \u00e9tiqueter) \u2014 Cat\u00e9gorie.'],
      ['OBLIGATOIRE pour le mat\u00e9riel SOUMIS AU VIEILLISSEMENT : Date de fabrication (jj/mm/aaaa, ou seulement l\u2019ann\u00e9e). Elle fonde la fin de vie. \u00c0 d\u00e9faut, l\u2019ann\u00e9e d\u2019achat.'],
      ['FORTEMENT RECOMMAND\u00c9 (l\u2019import passe sans, le rapport le signale) : Fabricant \u2014 Mod\u00e8le \u2014 Lieu \u2014 Num\u00e9ro de s\u00e9rie (utile pour un rappel du fabricant).'],
      ['FACULTATIF : Mise en service \u2014 Couleur \u2014 Taille ou longueur \u2014 Commentaire \u2014 Prix unitaire \u2014 Dur\u00e9e de vie (mois) \u2014 Lot \u2014 Quantit\u00e9.'],
      ['MAT\u00c9RIEL D\u00c9J\u00c0 SORTI DU PARC : Statut = Perdu, Vol\u00e9, R\u00e9form\u00e9 ou C\u00e9d\u00e9, et Sortie du parc = la date. Pr\u00e9cisez la cause dans Commentaire.'],
      ['Laissez vide un Statut ordinaire : EPILOG le calcule lui-m\u00eame.'],
      [''],
      ['LES LOTS'],
      ['Un lot est un achat group\u00e9. EPILOG les constitue automatiquement : m\u00eame cat\u00e9gorie, m\u00eame fabricant, m\u00eame mod\u00e8le, m\u00eame ann\u00e9e de fabrication. Pour forcer un regroupement, remplissez la colonne \u00ab Lot \u00bb (m\u00eame nom = m\u00eame lot).'],
      ['La feuille \u00ab Lots \u00bb est facultative : elle sert \u00e0 pr\u00e9ciser un lot (prix, commentaire\u2026) dont le nom figure dans la colonne \u00ab Lot \u00bb.'],
      [''],
      ['LES CONTR\u00d4LES (facultatif)'],
      ['La feuille \u00ab Contr\u00f4les \u00bb reprend l\u2019historique : une ligne par contr\u00f4le (Exemplaire = marquage, Date, R\u00e9sultat obligatoires). Sans elle, les exemplaires sont \u00ab sans contr\u00f4le enregistr\u00e9 \u00bb.'],
      [''],
      ['CE QUE L\u2019IMPORT NE FAIT PAS'],
      ['Il AJOUTE seulement : il ne modifie jamais un exemplaire existant, et refuse un marquage d\u00e9j\u00e0 pr\u00e9sent. Il ne reprend ni photos, ni notices, ni factures, ni commandes, ni pr\u00eats, ni incidents, ni r\u00e9parations.'],
      ['Une cat\u00e9gorie de l\u2019export complet, ou une feuille que l\u2019import ne lit pas, est simplement ignor\u00e9e (le rapport le dit).']
    ], [150]);
    feuille('Inventaire', [['Marquage*', 'Cat\u00e9gorie*', 'Lot', 'Fabricant', 'Mod\u00e8le', 'Num\u00e9ro de s\u00e9rie', 'Couleur', 'Taille ou longueur',
      'Lieu', 'Mise en service', 'Date de fabrication', 'Dur\u00e9e de vie (mois)', 'Prix unitaire', 'Quantit\u00e9', 'Commentaire', 'Statut', 'Sortie du parc']],
      [14, 20, 22, 16, 18, 16, 12, 16, 22, 16, 18, 18, 14, 10, 30, 12, 16]);
    feuille('Cat\u00e9gories', [['Nom*', 'Nature r\u00e9glementaire*', 'Dur\u00e9e de vie par d\u00e9faut (mois)', 'Pr\u00e9fixe', 'R\u00e9paration pr\u00e9vue',
      'R\u00e9parations accept\u00e9es', 'D\u00e9coupable', 'Prolongation par r\u00e9paration']], [24, 28, 28, 12, 18, 30, 14, 26]);
    feuille('Lots', [['D\u00e9signation*', 'Cat\u00e9gorie', 'Fabricant', 'Mod\u00e8le', 'Date de fabrication', 'Dur\u00e9e de vie (mois)', 'Prix unitaire', 'Commentaire']],
      [28, 20, 16, 18, 18, 18, 14, 30]);
    feuille('Lieux de stockage', [['Nom*', 'Description']], [30, 40]);
    feuille('Contr\u00f4les', [['Exemplaire*', 'Date du contr\u00f4le*', 'R\u00e9sultat*', 'Contr\u00f4leur', 'Commentaire', 'Type de contr\u00f4le']], [16, 18, 16, 22, 36, 28]);
    var listes = [['Natures r\u00e9glementaires', 'Oui / Non', 'R\u00e9sultats de contr\u00f4le', 'Statuts de sortie', 'Cat\u00e9gories d\u00e9j\u00e0 dans EPILOG', 'Lieux d\u00e9j\u00e0 dans EPILOG']];
    var nat = ['EPI soumis au vieillissement', 'EPI non soumis au vieillissement', 'Non-EPI'], on = ['Oui', 'Non'],
        res = ['Conforme', '\u00c0 surveiller', '\u00c0 r\u00e9parer', 'R\u00e9form\u00e9'], st = ['Perdu', 'Vol\u00e9', 'R\u00e9form\u00e9', 'C\u00e9d\u00e9'];
    for (var i = 0; i < Math.max(nat.length, res.length, cats.length, lieux.length, 1); i++) {
      listes.push([nat[i] || '', on[i] || '', res[i] || '', st[i] || '', cats[i] || '', lieux[i] || '']);
    }
    feuille('Listes', listes, [32, 12, 22, 18, 30, 34]);
    X.writeFile(wb, nomFichierDuJour('modele-import', 'xlsx'));
    if (msg) { msg.textContent = 'Mod\u00e8le t\u00e9l\u00e9charg\u00e9.'; msg.style.color = ''; }
  } catch (e) {
    if (msg) { msg.textContent = 'Mod\u00e8le indisponible (' + e.message + ') : v\u00e9rifiez la connexion Internet et r\u00e9essayez.'; msg.style.color = '#a3242a'; }
  }
}

/* ------------------------------ interface ------------------------------ */
function impBasculerPanneau() {
  var z = document.getElementById('importPanel');
  if (!z) return;
  if (z.innerHTML) { z.innerHTML = ''; return; }
  z.innerHTML = '<div class="form-panel" style="margin-top:10px">' +
    '<p style="margin:0 0 6px"><b>Importer un inventaire existant</b> \u2014 pour passer d\u2019un tableur \u00e0 EPILOG sans tout ressaisir.</p>' +
    '<p class="hint" style="margin:0 0 8px">1. T\u00e9l\u00e9chargez le mod\u00e8le \u00b7 2. Collez-y votre inventaire (collage en valeurs) \u00b7 3. Importez-le ici : un aper\u00e7u et un rapport s\u2019affichent <b>avant</b> toute \u00e9criture.</p>' +
    '<div class="form-actions"><button type="button" class="secondary" id="impModele">T\u00e9l\u00e9charger le mod\u00e8le (Excel)</button>' +
      '<input type="file" id="impFichier" accept=".xlsx,.xls,.ods,.csv"> ' +
      '<button type="button" class="secondary" id="impFermer">Fermer</button></div>' +
    '<p class="form-msg" id="impMsg" style="display:block;margin:6px 0"></p><div id="impResultat"></div></div>';
  document.getElementById('impModele').onclick = impTelechargerModele;
  document.getElementById('impFermer').onclick = function () { z.innerHTML = ''; };
  document.getElementById('impFichier').onchange = function () { impAnalyser(this.files && this.files[0]); };
  if (impEtat.plan) impAfficherPlan();
}
async function impAnalyser(fichier) {
  if (!fichier) return;
  var msg = document.getElementById('impMsg'), zone = document.getElementById('impResultat');
  zone.innerHTML = ''; impEtat.plan = null; impEtat.resultat = null; impEtat.fichier = fichier.name || '';
  msg.style.color = ''; msg.textContent = 'Lecture du fichier...';
  try {
    var classeur = await impLireClasseur(fichier);
    impEtat.plan = impConstruirePlan(classeur);
    msg.textContent = '';
    impAfficherPlan();
  } catch (e) {
    msg.style.color = '#a3242a';
    msg.textContent = 'Lecture impossible : ' + e.message + (/\.(xlsx|xls|ods)$/i.test(fichier.name || '') ? ' (si la biblioth\u00e8que Excel ne se charge pas, enregistrez la feuille Inventaire en CSV)' : '');
  }
}
function impAfficherPlan() {
  var P = impEtat.plan, zone = document.getElementById('impResultat');
  if (!P || !zone) return;
  var R = impResume(P);
  var html = '';
  if (P.erreurs.length) {
    html += '<div class="encadre-warn"><b>' + P.erreurs.length + ' erreur' + (P.erreurs.length > 1 ? 's' : '') + ' \u00e0 corriger \u2014 rien n\u2019est import\u00e9.</b><ul style="margin:6px 0 0 18px">' +
      P.erreurs.slice(0, 40).map(function (e) { return '<li><b>' + esc(e.feuille) + (e.ligne ? ', ligne ' + e.ligne : '') + '</b> : ' + esc(e.msg) + '</li>'; }).join('') +
      (P.erreurs.length > 40 ? '<li>\u2026 et ' + (P.erreurs.length - 40) + ' autres (liste compl\u00e8te dans le rapport)</li>' : '') + '</ul></div>' +
      '<div class="form-actions" style="margin-top:8px"><button type="button" class="secondary" id="impRapport">Rapport des erreurs (PDF)</button></div>';
  } else {
    var secu = Object.keys(P.av).filter(function (k) { return P.av[k].gravite === 'securite'; });
    var autres = Object.keys(P.av).filter(function (k) { return P.av[k].gravite !== 'securite'; });
    html += '<div class="encadre"><b>' + (impEtat.resultat ? 'Import termin\u00e9.' : 'Pr\u00eat \u00e0 importer :') + '</b> ' + R.exemplaires + ' exemplaire' + (R.exemplaires > 1 ? 's' : '') +
      (R.generes ? ' (dont ' + R.generes + ' \u00e0 num\u00e9roter)' : '') + ', ' + R.lots + ' lot' + (R.lots > 1 ? 's' : '') + (R.lotsReutilises ? ' (+ ' + R.lotsReutilises + ' existant(s))' : '') +
      ', ' + R.categories + ' cat\u00e9gorie' + (R.categories > 1 ? 's' : '') + ' nouvelle' + (R.categories > 1 ? 's' : '') +
      ', ' + R.lieux + ' lieu' + (R.lieux > 1 ? 'x' : '') + ' nouveau' + (R.lieux > 1 ? 'x' : '') +
      ', ' + R.controles + ' contr\u00f4le' + (R.controles > 1 ? 's' : '') + (R.adherents ? ' (' + R.adherents + ' contr\u00f4leur(s) cr\u00e9\u00e9(s))' : '') + '.' +
      (secu.length ? '<ul style="margin:6px 0 0 18px;color:#a3242a">' + secu.map(function (k) { return '<li><b>' + P.av[k].exemples.length + '</b> \u2014 ' + esc(P.av[k].libelle) + '</li>'; }).join('') + '</ul>' : '') +
      (autres.length ? '<ul style="margin:6px 0 0 18px">' + autres.map(function (k) { return '<li><b>' + P.av[k].exemples.length + '</b> \u2014 ' + esc(P.av[k].libelle) + '</li>'; }).join('') + '</ul>' : '') +
      '</div>' +
      ((!impEtat.resultat && (rawRows.materiels || []).length)
        ? '<p class="hint" style="margin:6px 0">Ce document contient d\u00e9j\u00e0 des exemplaires : <a href="#" id="impSauvegarde">t\u00e9l\u00e9chargez d\u2019abord une sauvegarde</a>. L\u2019import ne modifie rien d\u2019existant, mais c\u2019est une bonne habitude.</p>' : '') +
      '<div class="form-actions" style="margin-top:8px">' +
        (impEtat.resultat ? '' : '<button type="button" id="impConfirmer">Importer</button>') +
        '<button type="button" class="secondary" id="impRapport">' + (impEtat.resultat ? 'Rapport d\u2019import (PDF)' : 'Voir le rapport (PDF)') + '</button>' +
        (impEtat.resultat ? '' : '<button type="button" class="secondary" id="impAnnuler">Annuler</button>') + '</div>';
  }
  zone.innerHTML = html;
  var b;
  if ((b = document.getElementById('impRapport'))) b.onclick = impOuvrirRapport;
  if ((b = document.getElementById('impAnnuler'))) b.onclick = function () { impEtat.plan = null; zone.innerHTML = ''; var f = document.getElementById('impFichier'); if (f) f.value = ''; };
  if ((b = document.getElementById('impSauvegarde'))) b.onclick = function (e) { e.preventDefault(); exporterSauvegarde(); };
  if ((b = document.getElementById('impConfirmer'))) b.onclick = async function () {
    var msg = document.getElementById('impMsg'); b.disabled = true;
    msg.style.color = ''; msg.textContent = 'Import en cours...';
    try {
      await impExecuter(impEtat.plan);
      impEtat.resultat = 'ok';
      await load();
      msg.textContent = 'Import termin\u00e9. Imprimez le rapport : il liste ce qui reste \u00e0 faire.';
      impAfficherPlan();
    } catch (e) {
      b.disabled = false; msg.style.color = '#a3242a';
      msg.textContent = 'Import annul\u00e9, rien n\u2019a \u00e9t\u00e9 \u00e9crit : ' + e.message;
    }
  };
}

