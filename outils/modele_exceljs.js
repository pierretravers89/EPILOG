/* ------------------------------ modele a telecharger (ExcelJS) ------------------------------
   Demande de Pierre (capture du 09/11) : les listes de la feuille « Listes » ne communiquaient pas
   avec les autres feuilles : pas de menus deroulants. SheetJS (version gratuite) ne sait pas ecrire
   de validation de donnees ; ExcelJS (MIT, meme hebergeur cdnjs) le sait. On l'utilise UNIQUEMENT
   pour FABRIQUER le modele ; la LECTURE reste a SheetJS (xlsx, xls, ods, csv).
   Les menus se nourrissent de noms definis (ListeCategories, ListeLieux...) qui pointent vers la
   feuille « Listes ». Les listes « utilisables » (categories, lieux, lots) sont l'UNION des
   elements deja presents dans EPILOG (valeurs) et de ceux decrits dans les feuilles du classeur
   (formules) : une categorie nouvellement decrite apparait donc dans le menu de l'Inventaire.
   LIMITE : un collage normal remplace la validation des cellules collees ; « Collage special >
   Valeurs » la conserve. L'import controle de toute facon : le tableur n'est qu'une aide. */
var EXCELJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
function chargerExcelJS() {
  return new Promise(function (ok, ko) {
    if (window.ExcelJS) return ok(window.ExcelJS);
    var sc = document.createElement('script');
    var minuteur = setTimeout(function () { ko(new Error('d\u00e9lai d\u00e9pass\u00e9')); }, 20000);
    sc.src = EXCELJS_URL;
    sc.onload = function () { clearTimeout(minuteur); window.ExcelJS ? ok(window.ExcelJS) : ko(new Error('biblioth\u00e8que absente')); };
    sc.onerror = function () { clearTimeout(minuteur); ko(new Error('chargement impossible')); };
    document.head.appendChild(sc);
  });
}
function impDeclencherTelechargement(blob, nom) {
  var url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
}
/* importance d'un titre de colonne -> couleurs (legende dans le mode d'emploi) */
var IMP_NIVEAUX = {
  oblig: { fond: 'FF1B3668', texte: 'FFFFFFFF', libelle: 'Titre bleu fonc\u00e9 = OBLIGATOIRE' },
  cond:  { fond: 'FFB45309', texte: 'FFFFFFFF', libelle: 'Titre orange = OBLIGATOIRE pour le mat\u00e9riel soumis au vieillissement (date de fabrication)' },
  reco:  { fond: 'FF5B7DB1', texte: 'FFFFFFFF', libelle: 'Titre bleu moyen = FORTEMENT RECOMMAND\u00c9 (l\u2019import passe sans, le rapport le signale)' },
  fac:   { fond: 'FFDCE6F5', texte: 'FF1B2A44', libelle: 'Titre bleu clair = FACULTATIF' }
};
async function impModeleExcelJS() {
  var E = await chargerExcelJS();
  var wb = new E.Workbook();
  wb.creator = 'EPILOG'; wb.created = new Date();
  var cats = (refLists.categories || []).map(function (c) { return c.nom; });
  var lieux = (refLists.lieux || []).map(function (l) { return l.nom; });
  var lotsDoc = (refLists.lots || []).map(function (l) { return l.designation; }).slice(0, 300);
  var NB = 2000, NBP = 200;   /* lignes couvertes par les menus (Inventaire / feuilles annexes) */

  /* ---- 1. Mode d'emploi ---- */
  var wsM = wb.addWorksheet('Mode d\u2019emploi', { properties: { tabColor: { argb: 'FFB45309' } } });
  wsM.getColumn(1).width = 150;
  var lignesM = [
    ['t', 'EPILOG \u2014 mod\u00e8le d\u2019import d\u2019un inventaire existant (version ' + VERSION_EPILOG + ')'],
    ['', ''],
    ['h', 'COMMENT FAIRE'],
    ['', '1. Copiez votre inventaire dans la feuille \u00ab Inventaire \u00bb, une ligne par exemplaire. Utilisez \u00ab Collage sp\u00e9cial \u2192 Valeurs \u00bb : un collage normal remplace les menus d\u00e9roulants du mod\u00e8le.'],
    ['', '2. Si une cat\u00e9gorie n\u2019existe pas encore dans EPILOG, d\u00e9crivez-la dans la feuille \u00ab Cat\u00e9gories \u00bb : elle appara\u00eet alors dans le menu \u00ab Cat\u00e9gorie \u00bb de l\u2019Inventaire. Les cat\u00e9gories d\u00e9j\u00e0 dans EPILOG y sont d\u00e9j\u00e0.'],
    ['', '3. Dans EPILOG : rubrique Mat\u00e9riel \u2192 \u00ab Importer un inventaire \u00bb. Un aper\u00e7u et un rapport s\u2019affichent AVANT toute \u00e9criture ; au moindre doute rien n\u2019est \u00e9crit.'],
    ['', '4. Imprimez le rapport : il liste ce qui reste \u00e0 faire \u00e0 la main (num\u00e9ros \u00e0 \u00e9tiqueter, donn\u00e9es \u00e0 compl\u00e9ter, photos\u2026).'],
    ['', ''],
    ['h', 'LES COULEURS DES TITRES DE COLONNES']
  ];
  Object.keys(IMP_NIVEAUX).forEach(function (k) { lignesM.push(['n:' + k, IMP_NIVEAUX[k].libelle]); });
  lignesM = lignesM.concat([
    ['', ''],
    ['h', 'LES MENUS D\u00c9ROULANTS'],
    ['', 'Les cellules Cat\u00e9gorie, Lieu, Lot, Statut, R\u00e9sultat\u2026 proposent un menu. Les menus Cat\u00e9gorie, Lieu et Lot regroupent ce qui est d\u00e9j\u00e0 dans EPILOG ET ce que vous d\u00e9crivez dans les autres feuilles (voir la feuille \u00ab Listes \u00bb). Un menu qui indique \u00ab Choisissez dans la liste \u00bb refuse une autre valeur ; les autres acceptent une saisie libre (un lieu nouveau, par exemple).'],
    ['', ''],
    ['h', 'LA FEUILLE \u00ab INVENTAIRE \u00bb (les titres ne doivent pas \u00eatre modifi\u00e9s ; l\u2019ordre n\u2019a pas d\u2019importance)'],
    ['', 'OBLIGATOIRE : Marquage (sauf si vous indiquez une Quantit\u00e9 : EPILOG num\u00e9rote alors lui-m\u00eame et vous donne la liste \u00e0 \u00e9tiqueter) \u2014 Cat\u00e9gorie.'],
    ['', 'OBLIGATOIRE pour le mat\u00e9riel SOUMIS AU VIEILLISSEMENT : Date de fabrication (jj/mm/aaaa, ou seulement l\u2019ann\u00e9e). Elle fonde la fin de vie. \u00c0 d\u00e9faut, l\u2019ann\u00e9e d\u2019achat.'],
    ['', 'FORTEMENT RECOMMAND\u00c9 (l\u2019import passe sans, le rapport le signale) : Fabricant \u2014 Mod\u00e8le \u2014 Lieu \u2014 Num\u00e9ro de s\u00e9rie (utile pour un rappel du fabricant).'],
    ['', 'FACULTATIF : Mise en service \u2014 Couleur \u2014 Taille ou longueur \u2014 Commentaire \u2014 Prix unitaire \u2014 Dur\u00e9e de vie (mois) \u2014 Lot \u2014 Quantit\u00e9.'],
    ['', 'MAT\u00c9RIEL D\u00c9J\u00c0 SORTI DU PARC : Statut = Perdu, Vol\u00e9, R\u00e9form\u00e9 ou C\u00e9d\u00e9, et Sortie du parc = la date. Pr\u00e9cisez la cause dans Commentaire. Laissez vide un Statut ordinaire : EPILOG le calcule lui-m\u00eame.'],
    ['', ''],
    ['h', 'LES LOTS'],
    ['', 'Un lot est un achat group\u00e9. EPILOG les constitue automatiquement : m\u00eame cat\u00e9gorie, m\u00eame fabricant, m\u00eame mod\u00e8le, m\u00eame ann\u00e9e de fabrication. Pour forcer un regroupement, remplissez la colonne \u00ab Lot \u00bb (m\u00eame nom = m\u00eame lot). La feuille \u00ab Lots \u00bb est facultative : elle pr\u00e9cise un lot (prix, commentaire\u2026) dont le nom figure dans la colonne \u00ab Lot \u00bb.'],
    ['', ''],
    ['h', 'LES CONTR\u00d4LES (facultatif)'],
    ['', 'La feuille \u00ab Contr\u00f4les \u00bb reprend l\u2019historique : une ligne par contr\u00f4le (Exemplaire = marquage, Date, R\u00e9sultat obligatoires). Sans elle, les exemplaires sont \u00ab sans contr\u00f4le enregistr\u00e9 \u00bb.'],
    ['', ''],
    ['h', 'CE QUE L\u2019IMPORT NE FAIT PAS'],
    ['', 'Il AJOUTE seulement : il ne modifie jamais un exemplaire existant, et refuse un marquage d\u00e9j\u00e0 pr\u00e9sent. Il ne reprend ni photos, ni notices, ni factures, ni commandes, ni pr\u00eats, ni incidents, ni r\u00e9parations. Les feuilles \u00ab Mode d\u2019emploi \u00bb et \u00ab Listes \u00bb ne sont pas lues.']
  ]);
  lignesM.forEach(function (l, i) {
    var c = wsM.getCell('A' + (i + 1));
    c.value = l[1]; c.alignment = { wrapText: true, vertical: 'top' };
    if (l[0] === 't') c.font = { bold: true, size: 15, color: { argb: 'FF1B3668' } };
    else if (l[0] === 'h') c.font = { bold: true, color: { argb: 'FF1B3668' } };
    else if (l[0].indexOf('n:') === 0) {
      var n = IMP_NIVEAUX[l[0].slice(2)];
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: n.fond } }; c.font = { bold: true, color: { argb: n.texte } };
    }
  });

  /* ---- 2. feuilles de saisie ---- */
  var DEF = {
    'Inventaire': [
      ['Marquage*', 14, 'oblig', 'Le num\u00e9ro port\u00e9 par l\u2019exemplaire. Laissez vide et indiquez une Quantit\u00e9 : EPILOG num\u00e9rote lui-m\u00eame.'],
      ['Cat\u00e9gorie*', 20, 'oblig', 'Choisissez dans le menu. Une cat\u00e9gorie absente se d\u00e9crit d\u2019abord dans la feuille \u00ab Cat\u00e9gories \u00bb.'],
      ['Lot', 22, 'fac', 'Facultatif. M\u00eame nom = m\u00eame lot. Sinon EPILOG regroupe : m\u00eame cat\u00e9gorie, fabricant, mod\u00e8le et ann\u00e9e de fabrication.'],
      ['Fabricant', 16, 'reco', ''],
      ['Mod\u00e8le', 18, 'reco', 'R\u00e9f\u00e9rence pr\u00e9cise de l\u2019\u00e9quipement (exig\u00e9e par l\u2019arr\u00eat\u00e9 de 2009).'],
      ['Num\u00e9ro de s\u00e9rie', 16, 'reco', 'Utile pour r\u00e9pondre \u00e0 un rappel du fabricant.'],
      ['Couleur', 12, 'fac', ''],
      ['Taille ou longueur', 16, 'fac', ''],
      ['Lieu', 22, 'reco', 'Menu : lieux d\u00e9j\u00e0 dans EPILOG + ceux de la feuille \u00ab Lieux de stockage \u00bb. Un lieu nouveau peut \u00eatre saisi : il sera cr\u00e9\u00e9.'],
      ['Mise en service', 16, 'fac', 'jj/mm/aaaa'],
      ['Date de fabrication', 18, 'cond', 'OBLIGATOIRE pour le mat\u00e9riel soumis au vieillissement : jj/mm/aaaa, ou seulement l\u2019ann\u00e9e. Elle fonde la fin de vie.'],
      ['Dur\u00e9e de vie (mois)', 18, 'fac', 'Par d\u00e9faut : celle de la cat\u00e9gorie.'],
      ['Prix unitaire', 14, 'fac', ''],
      ['Quantit\u00e9', 10, 'fac', 'Pour du mat\u00e9riel sans marquage individuel : laissez le Marquage vide ; EPILOG num\u00e9rote.'],
      ['Commentaire', 30, 'fac', ''],
      ['Statut', 12, 'fac', 'Seulement pour du mat\u00e9riel d\u00e9j\u00e0 sorti du parc : Perdu, Vol\u00e9, R\u00e9form\u00e9 ou C\u00e9d\u00e9. Sinon laissez vide.'],
      ['Sortie du parc', 16, 'fac', 'Date de la sortie (jj/mm/aaaa). Pr\u00e9cisez la cause dans Commentaire.']
    ],
    'Cat\u00e9gories': [
      ['Nom*', 24, 'oblig', 'Nom de la cat\u00e9gorie (ex. Casques).'],
      ['Nature r\u00e9glementaire*', 30, 'oblig', 'Choisissez dans le menu : EPI soumis au vieillissement, EPI non soumis au vieillissement ou Non-EPI.'],
      ['Dur\u00e9e de vie par d\u00e9faut (mois)', 28, 'cond', 'OBLIGATOIRE pour une cat\u00e9gorie soumise au vieillissement (ex. 120).'],
      ['Pr\u00e9fixe', 12, 'fac', 'Sert \u00e0 num\u00e9roter (ex. CAS-). \u00c0 d\u00e9faut : les 4 premi\u00e8res lettres du nom.'],
      ['R\u00e9paration pr\u00e9vue', 18, 'fac', 'Oui si le fabricant pr\u00e9voit une r\u00e9paration pour cette cat\u00e9gorie. Par d\u00e9faut : Non.'],
      ['R\u00e9parations accept\u00e9es', 30, 'fac', ''],
      ['D\u00e9coupable', 14, 'fac', 'Oui pour les cordes et sangles que l\u2019on peut d\u00e9couper. Par d\u00e9faut : Non.'],
      ['Prolongation par r\u00e9paration', 26, 'fac', 'Oui si une r\u00e9paration prolonge la dur\u00e9e de vie (ex. d\u00e9gaines : sangle remplac\u00e9e).']
    ],
    'Lots': [
      ['D\u00e9signation*', 28, 'oblig', 'Le nom du lot, tel qu\u2019il figure dans la colonne \u00ab Lot \u00bb de l\u2019Inventaire.'],
      ['Cat\u00e9gorie', 20, 'fac', ''], ['Fabricant', 16, 'fac', ''], ['Mod\u00e8le', 18, 'fac', ''],
      ['Date de fabrication', 18, 'fac', 'jj/mm/aaaa ou ann\u00e9e'], ['Dur\u00e9e de vie (mois)', 18, 'fac', ''],
      ['Prix unitaire', 14, 'fac', ''], ['Commentaire', 30, 'fac', '']
    ],
    'Lieux de stockage': [['Nom*', 30, 'oblig', ''], ['Description', 40, 'fac', '']],
    'Contr\u00f4les': [
      ['Exemplaire*', 16, 'oblig', 'Le marquage de l\u2019exemplaire (celui de l\u2019Inventaire, ou d\u00e9j\u00e0 dans EPILOG).'],
      ['Date du contr\u00f4le*', 18, 'oblig', 'jj/mm/aaaa'],
      ['R\u00e9sultat*', 16, 'oblig', 'Choisissez dans le menu.'],
      ['Contr\u00f4leur', 22, 'fac', 'Un contr\u00f4leur inconnu est cr\u00e9\u00e9 (r\u00f4le \u00ab Contr\u00f4leur EPI habilit\u00e9 \u00bb).'],
      ['Commentaire', 36, 'fac', ''], ['Type de contr\u00f4le', 28, 'fac', 'Par d\u00e9faut : Contr\u00f4le p\u00e9riodique.']
    ]
  };
  var feuilles = {};
  Object.keys(DEF).forEach(function (nom) {
    var ws = wb.addWorksheet(nom, { views: [{ state: 'frozen', ySplit: 1 }] });
    feuilles[nom] = ws;
    DEF[nom].forEach(function (d, i) {
      var col = ws.getColumn(i + 1); col.width = d[1];
      var c = ws.getCell(1, i + 1), n = IMP_NIVEAUX[d[2]];
      c.value = d[0];
      c.font = { bold: true, color: { argb: n.texte } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: n.fond } };
      c.alignment = { vertical: 'middle', wrapText: true };
      if (d[3]) c.note = d[3];
    });
    ws.getRow(1).height = 30;
  });

  /* ---- 3. feuille Listes : valeurs fixes + unions (existant + decrit dans le classeur) ---- */
  var wsL = wb.addWorksheet('Listes', { properties: { tabColor: { argb: 'FF5B7DB1' } } });
  var specs = [], colL = 1;
  function titreListe(t) { var c = wsL.getCell(1, colL); c.value = t; c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F5' } }; wsL.getColumn(colL).width = 34; return colL++; }
  function lettre(n) { return String.fromCharCode(64 + n); }
  function fixe(titre, nom, valeurs) {
    var n = titreListe(titre);
    valeurs.forEach(function (v, i) { wsL.getCell(i + 2, n).value = v; });
    wb.definedNames.add('Listes!$' + lettre(n) + '$2:$' + lettre(n) + '$' + (valeurs.length + 1), nom);
  }
  function union(titre, nom, existants, feuilleSource, nbFormules) {
    var n = titreListe(titre);
    existants.forEach(function (v, i) { wsL.getCell(i + 2, n).value = v; });
    for (var i = 0; i < nbFormules; i++) {
      var src = "'" + feuilleSource + "'!A" + (i + 2);
      wsL.getCell(existants.length + 2 + i, n).value = { formula: 'IF(' + src + '="","",' + src + ')', result: '' };
    }
    wb.definedNames.add('Listes!$' + lettre(n) + '$2:$' + lettre(n) + '$' + (existants.length + 1 + nbFormules), nom);
  }
  fixe('Natures r\u00e9glementaires', 'ListeNatures', ['EPI soumis au vieillissement', 'EPI non soumis au vieillissement', 'Non-EPI']);
  fixe('Oui / Non', 'ListeOuiNon', ['Oui', 'Non']);
  fixe('R\u00e9sultats de contr\u00f4le', 'ListeResultats', ['Conforme', '\u00c0 surveiller', '\u00c0 r\u00e9parer', 'R\u00e9form\u00e9']);
  fixe('Statuts de sortie', 'ListeStatuts', ['Perdu', 'Vol\u00e9', 'R\u00e9form\u00e9', 'C\u00e9d\u00e9']);
  fixe('Types de contr\u00f4le', 'ListeTypesControle', typeControleChoices.filter(Boolean));
  union('Cat\u00e9gories utilisables (d\u00e9j\u00e0 dans EPILOG + d\u00e9crites dans la feuille Cat\u00e9gories)', 'ListeCategories', cats, 'Cat\u00e9gories', 40);
  union('Lieux utilisables (d\u00e9j\u00e0 dans EPILOG + feuille Lieux de stockage)', 'ListeLieux', lieux, 'Lieux de stockage', 40);
  union('Lots utilisables (d\u00e9j\u00e0 dans EPILOG + feuille Lots)', 'ListeLots', lotsDoc, 'Lots', 100);
  wb.definedNames.add('Inventaire!$A$2:$A$' + NB, 'ListeMarquagesFichier');

  /* ---- 4. menus deroulants et controles de saisie ---- */
  function menu(ws, plage, nom, style, titre, msg) {
    ws.dataValidations.add(plage, { type: 'list', allowBlank: true, formulae: [nom], showErrorMessage: true, errorStyle: style, errorTitle: titre, error: msg });
  }
  function nombre(ws, plage, type, min, titre, msg) {
    ws.dataValidations.add(plage, { type: type, operator: 'greaterThanOrEqual', formulae: [min], allowBlank: true, showErrorMessage: true, errorStyle: 'stop', errorTitle: titre, error: msg });
  }
  var inv = feuilles['Inventaire'], cat = feuilles['Cat\u00e9gories'], lot = feuilles['Lots'], ctl = feuilles['Contr\u00f4les'];
  menu(inv, 'B2:B' + NB, 'ListeCategories', 'stop', 'Cat\u00e9gorie inconnue', 'Choisissez dans le menu. Une cat\u00e9gorie absente se d\u00e9crit d\u2019abord dans la feuille \u00ab Cat\u00e9gories \u00bb.');
  menu(inv, 'C2:C' + NB, 'ListeLots', 'information', 'Lot', 'Ce lot n\u2019est pas dans la liste : il sera cr\u00e9\u00e9 (m\u00eame nom = m\u00eame lot).');
  menu(inv, 'I2:I' + NB, 'ListeLieux', 'information', 'Lieu', 'Ce lieu n\u2019est pas dans la liste : il sera cr\u00e9\u00e9.');
  menu(inv, 'P2:P' + NB, 'ListeStatuts', 'information', 'Statut', 'Seuls Perdu, Vol\u00e9, R\u00e9form\u00e9 et C\u00e9d\u00e9 sont repris ; tout autre statut est calcul\u00e9 par EPILOG.');
  nombre(inv, 'L2:L' + NB, 'whole', 1, 'Dur\u00e9e de vie', 'Un nombre entier de mois (ex. 120).');
  nombre(inv, 'M2:M' + NB, 'decimal', 0, 'Prix', 'Un montant positif ou nul.');
  nombre(inv, 'N2:N' + NB, 'whole', 1, 'Quantit\u00e9', 'Un nombre entier sup\u00e9rieur ou \u00e9gal \u00e0 1.');
  menu(cat, 'B2:B' + NBP, 'ListeNatures', 'stop', 'Nature r\u00e9glementaire', 'Choisissez dans le menu.');
  ['E', 'G', 'H'].forEach(function (c) { menu(cat, c + '2:' + c + NBP, 'ListeOuiNon', 'stop', 'Oui ou Non', 'Choisissez Oui ou Non.'); });
  nombre(cat, 'C2:C' + NBP, 'whole', 1, 'Dur\u00e9e de vie', 'Un nombre entier de mois (ex. 120).');
  menu(lot, 'B2:B' + NBP, 'ListeCategories', 'stop', 'Cat\u00e9gorie inconnue', 'Choisissez dans le menu, ou d\u00e9crivez la cat\u00e9gorie dans la feuille \u00ab Cat\u00e9gories \u00bb.');
  menu(ctl, 'A2:A' + NB, 'ListeMarquagesFichier', 'information', 'Exemplaire', 'Ce marquage n\u2019est pas dans l\u2019Inventaire du fichier : il doit alors d\u00e9j\u00e0 exister dans EPILOG.');
  menu(ctl, 'C2:C' + NBP, 'ListeResultats', 'stop', 'R\u00e9sultat', 'Choisissez dans le menu.');
  menu(ctl, 'F2:F' + NBP, 'ListeTypesControle', 'information', 'Type de contr\u00f4le', 'Type inconnu : \u00ab Contr\u00f4le p\u00e9riodique \u00bb sera retenu.');

  var buf = await wb.xlsx.writeBuffer();
  impDeclencherTelechargement(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nomFichierDuJour('modele-import', 'xlsx'));
}
/* essaie ExcelJS (menus deroulants) ; repli sur SheetJS (modele sans menus) si la bibliotheque ne se charge pas */
async function impTelechargerModele() {
  var msg = document.getElementById('impMsg');
  if (msg) { msg.style.color = ''; msg.textContent = 'Pr\u00e9paration du mod\u00e8le...'; }
  try {
    await impModeleExcelJS();
    if (msg) msg.textContent = 'Mod\u00e8le t\u00e9l\u00e9charg\u00e9 (avec menus d\u00e9roulants).';
  } catch (e) {
    await impModeleSheetJS();
    if (msg && msg.style.color === '') msg.textContent = 'Mod\u00e8le t\u00e9l\u00e9charg\u00e9 SANS menus d\u00e9roulants (biblioth\u00e8que indisponible : ' + e.message + ').';
  }
}

