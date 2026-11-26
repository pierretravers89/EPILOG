/**
 * EPILOG - Logiciel de gestion des EPI pour clubs alpins et de montagne
 * © 2026 Pierre Travers
 * Licensed under the EUPL v1.2 - Sous licence publique de l'Union europeenne (EUPL) v1.2
 * SPDX-License-Identifier: EUPL-1.2
 * Texte officiel en francais (toutes les versions linguistiques ont la meme valeur) : https://interoperable-europe.ec.europa.eu/sites/default/files/custom-page/attachment/eupl_v1.2_fr.pdf
 * 
 * Ce fichier fait partie d'EPILOG (EPI + LOG = Journal)
 * Pour plus d'infos et documentation : voir aide embarquée
 * 
 * ---------------------------------------------------------------
   Widget de pilotage - CAF Auxerre - v2 (schema avec LOTS)
   Toutes les valeurs calculees (fin de vie, stock, compteurs) sont
   derivees ici a partir des champs bruts : les colonnes formule
   Grist sont facultatives.
   ---------------------------------------------------------------

   SOMMAIRE (les titres ci-dessous existent comme bannieres dans le
   fichier : chercher le libelle pour sauter a la section)

     Constantes et etat global ....... haut du fichier
     Erreurs visibles ................ afficherErreurGlobale, window.onerror
     Utilitaires ..................... dates, esc, money, mapById, options
     Controle des types de colonnes .. verifierReferences (references en Texte)
     Statut derive ................... deriverStatut, controleEchu  [coeur metier]
     Lecture des tables .............. load() : lit Grist, derive, puis rend tout
     Rendu ........................... vue d'ensemble, materiel, prets, EPI...
     Editeur generique ............... openEditor / openCreator + config EDITABLE
     Ecritures Grist ................. appliquer(), ajouterEtObtenirId()
     Creation rapide ................. quick-add categorie/lieu/fournisseur
     Formulaire nouveau lot .......... creerLot + grisage duree de vie
     Prets ........................... liste, pret groupe, retour groupe
     Controles EPI / Incidents ....... saisie, feuille imprimable, registre
     Suivi du remplissage ............ jauges plan gratuit, archivage
     Statistiques .................... bilan AG (rotation, dormant, depenses)
     Fiche exemplaire ................ ouvrirFicheExemplaire + actions inline
     Exports ......................... inventaire, registre, CSV (telechargerCsv)
     Selecteur de materiel filtre .... cascade categorie/lot des formulaires
     Suppression ..................... SUPPRIMABLE + demanderSuppression
     Referentiels .................... onglet "Listes du club"
 */

/* ---------------------------------------------------------------
     Diagnostic ...................... sortie de controle (bouton dans l'aide)
     Aide / A propos / Init .......... bas du fichier

   REPERES POUR REPRENDRE LE CODE
     - Le statut n'est jamais stocke : il est calcule par deriverStatut()
       a chaque load(). Ne pas reintroduire de colonne "statut".
     - Toute ecriture passe par appliquer(), qui rejette les undefined.
     - Editeur et createur partagent la config EDITABLE : un seul endroit
       decrit les champs de chaque entite.
     - Les colonnes de reference DOIVENT etre de type Reference dans Grist
       (pas Texte) : verifierReferences() le controle au demarrage.
   --------------------------------------------------------------- */

/* ---------------------- erreurs visibles ---------------------- */

/* Trois pannes de ce projet ont ete muettes. Toute erreur JS s'affiche
   desormais dans le widget plutot que dans une console que personne n'ouvre. */
function afficherErreurGlobale(texte) {
  var box = document.getElementById('erreurGlobale');
  var el = document.getElementById('erreurTexte');
  if (!box || !el) return;
  el.textContent = (el.textContent ? el.textContent + '\n\n' : '') + texte;
  box.hidden = false;
}

window.addEventListener('error', function (e) {
  afficherErreurGlobale(e.message + (e.lineno ? '  (ligne ' + e.lineno + ')' : ''));
});
window.addEventListener('unhandledrejection', function (e) {
  var r = e.reason;
  afficherErreurGlobale('Promesse rejetée : ' + ((r && r.message) ? r.message : String(r)));
});

document.querySelectorAll('.tab').forEach(function (t) {
  t.onclick = function () {
    document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
    document.querySelectorAll('.pane').forEach(function (x) { x.classList.remove('active'); });
    t.classList.add('active');
    document.getElementById('pane-' + t.dataset.t).classList.add('active');
    if (t.dataset.t === 'donnees' && typeof renderDonnees === 'function') renderDonnees();
  };
});

grist.ready({ requiredAccess: 'full' });

var STATUTS = ['En service', 'Prete', 'Examen requis', 'En reparation', 'Reforme', 'Perdu'];
var HORS_STOCK = ['Reforme', 'Perdu', 'Vole', 'Cede'];

/* Sortie definitive decidee par un humain : le seul levier manuel qui reste.
   Chaque motif garde son propre mot affiche (Vole distinct de Perdu, Cede distinct
   de Reforme) : les fondre effacerait silencieusement une distinction qu'on demande
   par ailleurs d'expliquer avec un commentaire. */
var MOTIFS_HORS_SERVICE = ['Perdu', 'Vole', 'Reforme', 'Cede'];
var STATUT_SELON_MOTIF = { 'Perdu': 'Perdu', 'Vole': 'Vole', 'Reforme': 'Reforme', 'Cede': 'Cede' };

/* La coupure reglementaire n'est pas la matiere mais le vieillissement :
   un casque plastique se perime, un mousqueton non.
   Le libelle a l'ecran ("Nature reglementaire") ne reprend plus mot a mot ces
   cles techniques : voir NATURE_EPI_LABELS et NATURE_EPI_NOTES, ligne ~115. */
var TYPES_EPI = ['Soumis a vieillissement', 'Non soumis a vieillissement', 'Non-EPI'];

/* Libelles a l'ecran pour TYPES_EPI. Le libelle d'origine ("Soumis au
   vieillissement ?") n'annonce qu'une des deux choses que le champ decide
   (la fin de vie ET, depuis l'evolution reparation, l'acces a la reparation) :
   un club qui repond "non" par bon sens pour une categorie non-EPI cochait en
   realite "EPI non soumis a vieillissement". Les libelles ci-dessous rendent
   les trois options explicites sans changer les valeurs stockees. */
var NATURE_EPI_LABELS = {
  'Soumis a vieillissement':     'EPI \u2014 soumis au vieillissement',
  'Non soumis a vieillissement': 'EPI \u2014 non soumis au vieillissement',
  'Non-EPI':                     'Mat\u00e9riel non-EPI'
};
/* Note affichee sous le champ, mise a jour au vol quand on change la
   selection OU la case a cocher (voir lier() de l'editeur categorie).
   Rendue en HTML riche (encadre colore), pas en simple texte gris : un
   premier essai en texte discret a ete signale comme "pas assez visible"
   et, pire, l'etat "non-EPI = reparation libre" n'avait AUCUN encadre du
   tout (la case a cocher etait juste masquee) — lu a tort comme "la
   reparation n'est pas prevue pour ce materiel", l'inverse de la regle
   reelle. Les 4 etats possibles ont donc chacun leur encadre explicite :
   aucun des quatre ne doit se deduire d'une absence d'indice. */
function blocReparationCategorie(estEpiCat, avecMaintenance, coche, noteReparation) {
  /* (2026.5.14) plus de cas "reparation libre" pour le non-EPI : meme regle */
  if (!avecMaintenance) {
    return '<div class="encadre-warn"><b>\u26a0 R\u00e9paration ferm\u00e9e \u2014 configuration manquante.</b> '
      + 'La colonne \u00ab\u00a0maintenance_fabricant\u00a0\u00bb n\u2019existe pas encore dans Grist (table '
      + 'CATÉGORIES, type Basculer). Tant qu\u2019elle n\u2019est pas cr\u00e9\u00e9e, <b>aucun EPI du club</b> '
      + 'ne peut \u00eatre d\u00e9clar\u00e9 r\u00e9parable, quelle que soit la cat\u00e9gorie. '
      + 'Voir Aide \u2192 Diagnostic.</div>';
  }
  if (!coche) {
    return '<div class="encadre-warn"><b>\u26a0 R\u00e9paration ferm\u00e9e pour cette cat\u00e9gorie.</b> '
      + 'Un exemplaire endommag\u00e9 devra \u00eatre r\u00e9form\u00e9, sauf si vous cochez ci-dessous '
      + (estEpiCat ? 'que le fabricant pr\u00e9voit une r\u00e9paration.' : 'que ce mat\u00e9riel se r\u00e9pare.') + '</div>';
  }
  return '<div class="encadre-ok"><b>\u2713 R\u00e9paration ouverte pour cette cat\u00e9gorie.</b> '
    + 'Le fabricant pr\u00e9voit une r\u00e9paration ou un remplacement de pi\u00e8ces\u00a0: un exemplaire '
    + 'endommag\u00e9 pourra \u00eatre mis \u00ab\u00a0\u00c0 r\u00e9parer\u00a0\u00bb plut\u00f4t que r\u00e9form\u00e9.'
    + ((noteReparation || '').trim()
        ? '<br><br><b>R\u00e9parations g\u00e9n\u00e9ralement accept\u00e9es\u00a0:</b><br>'
          + esc(noteReparation.trim()).replace(/\n/g, '<br>')
        : '')
    + '</div>';
}

var NATURE_EPI_NOTES = {
  'Soumis a vieillissement': function (avecMaintenance, coche, noteReparation) {
    return '<p class="hint" style="margin:2px 0 6px">Prot\u00e8ge une personne d\u2019un risque '
      + 'de blessure grave, et se p\u00e9rime. Fin de vie calendaire.</p>'
      + blocReparationCategorie(true, avecMaintenance, coche, noteReparation);
  },
  'Non soumis a vieillissement': function (avecMaintenance, coche, noteReparation) {
    return '<p class="hint" style="margin:2px 0 6px">Prot\u00e8ge une personne d\u2019un risque '
      + 'de blessure grave, sans p\u00e9remption calendaire. Fin de vie d\u00e9cid\u00e9e par le '
      + 'contr\u00f4le.</p>'
      + blocReparationCategorie(true, avecMaintenance, coche, noteReparation);
  },
  'Non-EPI': function (avecMaintenance, coche, noteReparation) {
    return '<p class="hint" style="margin:2px 0 6px">Ne prot\u00e8ge pas directement d\u2019un '
      + 'risque de blessure grave. Pas de fin de vie calendaire.</p>'
      + blocReparationCategorie(false, avecMaintenance, coche, noteReparation);
  }
};


/* Filtres de l'onglet Materiel. L'export suit le filtre : on exporte
   ce qu'on voit, jamais autre chose. */
var filtresMat = { q: '', cat: '', lieu: '', statut: '', echu: false, vetuste: false };
var inventaireVisible = [];
var inventaireTout = [];   /* 2026.5.33 : tout le parc, sans les filtres de l'onglet Materiel (rubrique Import / export) */

/* Suite donnee a un incident. "Sans suite" est indispensable : sinon une
   rayure benigne reste signalee en rouge indefiniment dans les alertes.
   "Reparation a prevoir" partage avec le controle (resultat "A reparer") la
   meme logique de statut derive et la meme garde EPI : voir deriverStatut()
   et validerResultatReparation(). */
var SUITES = ['Controle a realiser', 'Sans suite', 'Reparation a prevoir', 'Mise au rebut immediate'];

/* Resultats possibles d'un controle. "A reparer" est distinct de "Reforme" :
   le premier retire du parc EN ATTENDANT une decision reversible (reparation
   puis nouveau controle), le second est la sortie. Meme garde EPI que pour
   SUITES ci-dessus : voir validerResultatReparation(). */
var RESULTATS_CONTROLE = ['Conforme', 'A surveiller', 'A reparer', 'Reforme'];
function optionsResultatsControle() {
  return RESULTATS_CONTROLE.map(function (r) { return '<option>' + r + '</option>'; }).join('');
}
/* Roles : liste par defaut, REMPLACEE au chargement par les choix reels definis dans Grist
   (colonne 'role' de ADHERENTS). roleChoices est un tableau PARTAGE, reference par les
   formulaires ; on mute son contenu en place pour que l'ajout d'un role dans Grist apparaisse. */
var ROLES_DEFAUT = ['Adherent', 'Responsable materiel', 'Controleur EPI habilite'];
var roleChoices = ROLES_DEFAUT.slice();
var FINANCEMENT_DEFAUT = ['Club', 'Subvention', 'Don'];
var financementChoices = FINANCEMENT_DEFAUT.slice();
var TYPE_CONTROLE_DEFAUT = ['Contrôle périodique', 'Contrôle suite à incident', 'Contrôle avant mise en service'];
var typeControleChoices = TYPE_CONTROLE_DEFAUT.slice();
var choixCharges = false;

var missingTables = [];
var resolvedNames = {
  categories: 'CATEGORIES', lieux: 'LIEUX_STOCKAGE', fournisseurs: 'FOURNISSEURS',
  adherents: 'ADHERENTS', achats: 'ACHATS', lots: 'LOTS', materiels: 'MATERIELS',
  controles: 'CONTROLES', emprunts: 'EMPRUNTS', incidents: 'INCIDENTS'
};

/* CONFIG : personnalisation par club, sans toucher au code. Ces valeurs
   par defaut sont celles du CAF Auxerre : si la table CONFIG est absente ou
   une cle vide, le widget garde ce comportement (aucune regression).
   Un autre club remplit la table CONFIG dans Grist, rien d'autre. */
var configDiag = null;
var configRows = [];   /* lignes de la table CONFIG : {id, cle, valeur} — pour ecrire depuis le panneau */
var vueControles = 'historique';  /* onglet Controles, incidents et reparations : historique | retard | jamais | aprevoir */
var vueIncidents = 'tous';         /* sous-onglet Incidents : tous | attente */
var JOURS_AVANT_CONTROLE = 60;  /* n°9 : fenetre d'anticipation des controles annuels */
var MAX_PHOTOS_PJ = 4;  /* limite de photos multiples : controles et incidents uniquement */
var sousOngletEPI = 'controles';   /* Controles, incidents et reparations : controles | incidents | reparations (sous-onglets) */
var sousOngletRefs = 'categories'; /* Listes du club : categories | lieux | fournisseurs | adherents */
var sousOngletReglages = 'identite'; /* Reglages du club : identite | fonctionnement | sauvegarde */
/* sous-rubrique Sauvegarde (2026.5.20) : ses boutons agissent tout de suite,
   le bouton Enregistrer du pied de panneau n'y a pas de sens -> masque */
function majZoneSauvegarde() {
  var z = document.getElementById('reglagesSauvegarde');
  var save = document.getElementById('reglagesSave');
  if (!z) return;
  var actif = sousOngletReglages === 'sauvegarde';
  z.hidden = !actif;
  if (actif) {
    z.innerHTML = '<p class="reglages-intro">La sauvegarde, la restauration, l\u2019import d\u2019un inventaire et les exports ont leur propre rubrique.</p>' +
      '<div class="form-actions"><button type="button" id="reglagesVersDonnees">Ouvrir \u00ab Import / export \u00bb</button></div>';
    document.getElementById('reglagesVersDonnees').onclick = function () {
      fermerReglages(); naviguer('donnees');
    };
  }
  if (save) save.style.display = actif ? 'none' : '';
}
var vuePrets = 'tous';            /* onglet Prets : tous | retard (retours en retard) */
var filtresAchats = { annee: '', financement: '' };  /* onglet Achats et budget */
var CONFIG = {
  /* Valeurs NEUTRES (2026.5.13) : un club qui installe l'outil voit des
     champs a remplir, pas l'identite du CAF d'Auxerre. Auteur et contact
     restent ceux du createur de l'outil (credits, licence). */
  nom_club: 'Mon club',
  sous_titre: 'Mon club · Fédération',
  titre_appli: 'Gestion du matériel',
  email_contact: 'pierre.travers@gmail.com',
  auteur: 'Pierre Travers',
  description: 'Gestion du matériel et suivi EPI',
  annee: '2026',
  couleur_principale: '',   /* vide = garde le navy de la charte */
  couleur_accent: '',       /* vide = garde le rouge de la charte */
  lien1_libelle: '', lien1_url: '',   /* liens utiles (regles fede, norme...) affiches dans l'A propos */
  lien2_libelle: '', lien2_url: '',
  /* 'systematique' (defaut, comportement d'origine) : chaque controle decale
     la date du prochain d'un an, quelle que soit sa raison.
     'routine' : seuls les controles de routine (type_controle) decalent
     cette date — un controle suite a incident ou qui cloture une reparation
     n'y touche pas, evitant la fragmentation d'un lot controle groupe.
     Voir ctx.dernierControleRoutine dans load(). */
  mode_prochain_controle: 'systematique'
};

/* libelle sans accent pour les documents imprimables (en-tete PDF) */
function clubImprimable() {
  return CONFIG.nom_club.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
var refLists = {
  categories: [], lieux: [], fournisseurs: [], adherents: [],
  achats: [], lots: [], materiels: []
};
var lotOfMateriel = {};
var openLots = {};
var rawRows = { lots: [], materiels: [], emprunts: [], controles: [], incidents: [], achats: [],
                categories: [], lieux: [], fournisseurs: [], adherents: [], demandes: [], reparations: [],
                entretiens: [] };
var demandeEnCours = null;   /* id de la demande qu'on materialise en bon (null sinon) */
var colonnesConnues = {};

/* Grist renvoie les colonnes meme quand la table est vide : on peut donc
   savoir si une colonne facultative existe avant d'ecrire dedans. */
function aColonne(key, col) {
  return (colonnesConnues[key] || []).indexOf(col) !== -1;
}

/* ---------------------- utilitaires ---------------------- */

function rowsOf(table) {
  var keys = Object.keys(table).filter(function (k) { return k !== 'id'; });
  return table.id.map(function (id, i) {
    var r = { id: id };
    keys.forEach(function (k) { r[k] = table[k][i]; });
    return r;
  });
}

function mapById(rowsArr, labelCol) {
  var m = {};
  rowsArr.forEach(function (r) {
    m[r.id] = (r[labelCol] !== undefined && r[labelCol] !== null && r[labelCol] !== '') ? r[labelCol] : r.id;
  });
  return m;
}

function toDate(v) {
  if (!v) return null;
  var d = (typeof v === 'number') ? new Date(v * 1000) : new Date(v);
  return isNaN(d) ? null : d;
}

/* Affichage d'une date au format francais jj/mm/aaaa (composantes UTC,
   comme toute la gestion des dates ici). AFFICHAGE SEULEMENT : les valeurs
   des champs <input type="date"> (tsInput, 'auj'), les noms de fichiers
   et les comparaisons restent en ISO. Audit du 07/10 : aucun code ne relit
   ni ne trie une date formatee. Avant 2026.5.3, renvoyait l'ISO
   (2026-08-28), d'ou un melange avec la fin de vie deja en 31/12/aaaa. */
function fmtDate(v) {
  var d = toDate(v);
  if (!d) return '-';
  var j = d.getUTCDate(), m = d.getUTCMonth() + 1;
  return (j < 10 ? '0' : '') + j + '/' + (m < 10 ? '0' : '') + m + '/' + d.getUTCFullYear();
}

/* Compare deux Date au jour calendaire UTC pres (a >= b), pas a l'instant pres.
   Sans ca, un controle enregistre a minuit peut paraitre "avant" un incident
   cree plus tard dans la meme journee — cf. _reprise_dev.md. Utilise partout
   ou l'on decide si un controle "traite" un incident anterieur, pour que le
   statut derive du materiel et l'affichage de la liste des incidents
   s'accordent toujours. */
function memeJourOuApres(a, b) {
  if (!a || !b) return false;
  var jA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  var jB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return jA >= jB;
}

function dateToTimestamp(dateStr) {
  if (!dateStr) return null;
  var t = new Date(dateStr + 'T00:00:00Z').getTime();
  return isNaN(t) ? null : Math.round(t / 1000);
}

function money(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' \u20ac';
}

function num(v) {
  return (v === '' || v === null || v === undefined) ? null : Number(v);
}

/* Fin de vie = 31/12 de l'annee civile atteinte apres duree_vie_mois
   ajoutes a la date de fabrication (regle FFCAM). */
/* La regle FFCAM : le non soumis au vieillissement n'a pas de fin de vie
   calendaire. Une duree saisie dessus fausserait la derivation (reforme
   automatique d'un mousqueton au calendrier) : on grise partout. */
function categorieNonSoumise(catId) {
  if (!catId || catId === '__new__') return false;
  var cat = refLists.categories.filter(function (c) { return String(c.id) === String(catId); })[0];
  return !!cat && cat.type_epi === 'Non soumis a vieillissement';
}

/* Resout la categorie d'un exemplaire en remontant materiel -> lot -> categorie.
   Meme chemin que celui deja emprunte partout ailleurs (ligne ~2870, 5509,
   5677) ; centralise ici pour la logique reparation, qui en a besoin a
   plusieurs endroits (garde de validation, libelle du bouton, aide en ligne). */
function categorieDeMateriel(m) {
  if (!m) return null;
  var lot = refLists.lots.filter(function (l) { return l.id === m.lot; })[0];
  if (!lot) return null;
  return refLists.categories.filter(function (c) { return c.id === lot.categorie; })[0] || null;
}

/* Une categorie est un EPI (au sens reglementaire, pas seulement "protege du
   vieillissement") des que sa nature n'est PAS "Non-EPI". Volontairement une
   fonction a part : le nom dit ce qu'on teste, pas la valeur technique testee. */
function estEpi(cat) {
  return !!cat && cat.type_epi !== 'Non-EPI';
}

/* La reparation est ouverte pour une categorie si :
     - (jusqu'a 2026.5.13 : tout materiel non-EPI, "reparation libre" --
       supprime en 2026.5.14 a la demande de Pierre), OU
     - la colonne facultative "maintenance_fabricant" est cochee, pour TOUTE
       nature (le club atteste que la reparation est prevue / possible).
   Colonne absente => false : le defaut le plus sur est le plus ferme, pas
   besoin d'un geste pour FERMER la reparation d'un EPI, seulement pour
   l'OUVRIR (voir AFFINAGE_REPARATION_EPI.md, choix assume).
   Categorie absente (cat null, lot/materiel orphelin) => true, PAS par
   analogie avec la colonne absente : c'est une donnee cassee sans rapport
   avec la reglementation EPI, bloquer la saisie ne ferait que masquer un
   probleme de donnees derriere un message qui parlerait d'autre chose. */
function reparationOuverte(cat) {
  if (!cat) return true;
  /* 2026.5.14 (decision de Pierre) : plus d'exemption pour le non-EPI. La
     reparation est ouverte, pour toute categorie, seulement si la case
     "maintenance / reparation prevue" est cochee. */
  return aColonne('categories', 'maintenance_fabricant') && !!cat.maintenance_fabricant;
}

/* Contrairement a reparationOuverte(), pas d'exemption automatique pour le
   non-EPI : la decoupe n'est pas une question de statut reglementaire mais
   de nature physique de l'objet (une corde se decoupe, une raquette a
   neige non, EPI ou pas). Categorie absente => false : la decoupe cree de
   nouveaux exemplaires rattaches a un lot, inutile d'aggraver une donnee
   deja cassee en lui donnant une action supplementaire a proposer. */
function decoupeOuverte(cat) {
  if (!cat) return false;
  return aColonne('categories', 'peut_etre_decoupe') && !!cat.peut_etre_decoupe;
}

/* Genere les N prochaines lettres de suffixe disponibles pour la decoupe
   d'un exemplaire donne (COR-004 -> A, B, C...), en verifiant l'existant
   pour ne jamais generer un marquage deja pris — cas rare mais possible
   si un exemplaire a deja ete partiellement decoupe par le passe. Jamais
   modifiable a la main ensuite (voir la fenetre de decoupe) : la
   filiation doit rester previsible, pas retapee. */
function prochainesLettresDecoupe(marquageOrigine, nombre) {
  var prefixe = normMarquage(marquageOrigine) + '-';
  var utilisees = {};
  refLists.materiels.forEach(function (m) {
    var num = normMarquage(m.numero_marquage);
    if (num.indexOf(prefixe) === 0) {
      var suffixe = num.slice(prefixe.length).toUpperCase();
      if (/^[A-Z]+$/.test(suffixe)) utilisees[suffixe] = true;
    }
  });
  var lettres = [];
  var code = 65;  /* 'A' */
  var garde = 0;  /* filet de securite : jamais plus de 1000 tours, meme en cas de bug */
  while (lettres.length < nombre && garde < 1000) {
    var lettre = String.fromCharCode(code);
    if (!utilisees[lettre]) { lettres.push(lettre); utilisees[lettre] = true; }
    code = (code >= 90) ? 65 : code + 1;  /* au-dela de Z, on reboucle sur A (tres improbable en pratique) */
    garde++;
  }
  return lettres;
}

/* ============ Exemplaire retrouve (2026.5.35) ============
   Un exemplaire declare Perdu ou Vole revient au parc. Retirer la sortie d'inventaire
   ne suffit pas : l'EPI est reste on ne sait ou (utilise ? mal stocke ?), il doit etre
   examine avant tout pret. On enregistre donc le FAIT, comme partout : un incident
   « Controle a realiser » date du jour ou il a ete retrouve, qui met l'exemplaire en
   « Examen requis » et garde l'episode dans la fiche de vie. Le commentaire de perte est
   recopie dans l'incident puis vide (sinon un exemplaire revenu afficherait encore
   « perdu dans le ravin »). Meme ecriture depuis le bouton et depuis l'editeur. */
function estPerduOuVole(motif) { return motif === 'Perdu' || motif === 'Vole'; }
function descriptionRetrouve(m, dateTs, observation) {
  var dl = toDate(m.hors_service_date);
  var com = aColonne('materiels', 'commentaire') ? String(m.commentaire || '').trim() : '';
  return 'Retrouv\u00e9 le ' + fmtDate(dateTs) + ' \u2014 d\u00e9clar\u00e9 ' +
    (m.hors_service_motif === 'Vole' ? 'vol\u00e9' : 'perdu') + (dl ? ' le ' + fmtDate(m.hors_service_date) : '') +
    (com ? ' : ' + com : '') + ((observation || '').trim() ? '. ' + observation.trim() : '');
}
/* m = ligne brute (rawRows.materiels) AVANT retour ; champsMat = champs deja ecrits sur
   l'exemplaire (editeur) ou null (bouton : on ecrit nous-memes la levee de sortie). */
function actionsRetrouve(m, dateTs, observation, champsMat) {
  var actions = [];
  var levee = { hors_service_motif: '', hors_service_date: null };
  if (aColonne('materiels', 'commentaire')) {
    /* editeur : on ne vide le commentaire que s'il n'a pas ete retouche */
    var inchange = !champsMat || String(champsMat.commentaire || '') === String(m.commentaire || '');
    if (inchange) levee.commentaire = '';
  }
  actions.push(['UpdateRecord', resolvedNames.materiels, m.id, levee]);
  if (resolvedNames.incidents) {
    actions.push(['AddRecord', resolvedNames.incidents, null, champsIncident({
      materiel: m.id, date_incident: dateTs, gravite: 'Moderee',
      description: descriptionRetrouve(m, dateTs, observation), suite: 'Controle a realiser'
    })]);
  }
  return actions;
}

/* Exemplaire unique (2026.5.34) : raccourci de saisie, sans donnee stockee. La case
   met la quantite a 1 et masque le champ ; l'aide dit en une phrase ce que cela
   signifie. Un lot d'un exemplaire reste un lot : on pourra en ajouter plus tard. */
function majUnique() {
  var uni = document.getElementById('lotUnique'), q = document.getElementById('lotQuantite'), aide = document.getElementById('lotUniqueAide');
  if (!uni || !q) return;
  var on = uni.checked;
  q.parentElement.style.display = on ? 'none' : '';
  if (!aide) return;
  if (on) aide.textContent = 'Exemplaire unique : le lot ne contiendra qu\u2019un exemplaire. Vous pourrez en ajouter d\u2019autres plus tard avec \u00ab Ajouter des exemplaires \u00bb.';
  else if (Number(q.value) === 1) aide.textContent = 'Quantit\u00e9 1 : le lot ne contiendra qu\u2019un exemplaire. Cochez \u00ab Exemplaire unique \u00bb pour masquer ce champ.';
  else aide.textContent = '';
  aide.hidden = !aide.textContent;
}

/* ============ Fenetre de decoupe (Declarer une reparation -> Decoupee) ============
   S'ouvre automatiquement des qu'un exemplaire unique est coche en mode
   Decoupee (voir brancherRadioDecoupee / le cablage radio de
   majListeSelectionnable). Fenetre en surimpression plutot qu'integree au
   formulaire principal : les champs n'ont rien a voir (longueur, sort de
   chaque morceau) avec intervenant/pieces remplacees du reste du formulaire
   de reparation, et un nombre de morceaux variable aurait ete difficile a
   integrer proprement dans une grille de formulaire deja chargee. */
function ouvrirFenetreDecoupe(matId) {
  var m = rawRows.materiels.filter(function (x) { return x.id === matId; })[0];
  if (!m) return;
  var lot = refLists.lots.filter(function (l) { return l.id === m.lot; })[0];
  var auj = new Date().toISOString().slice(0, 10);

  var ancien = document.getElementById('decoupeModale');
  if (ancien) ancien.remove();

  var div = document.createElement('div');
  div.className = 'reglages';
  div.id = 'decoupeModale';
  div.innerHTML =
    '<div class="reglages-fond" id="decoupeFond"></div>' +
    '<div class="reglages-modale" role="dialog" aria-modal="true" aria-label="D\u00e9couper un exemplaire">' +
      '<div class="reglages-head">' +
        '<span>D\u00e9couper ' + esc(m.numero_marquage) + ' \u2014 ' + esc(lot ? lot.designation : '') + '</span>' +
        '<button type="button" class="reglages-close" id="decoupeClose" aria-label="Fermer">\u00d7</button>' +
      '</div>' +
      '<div class="reglages-corps" style="padding:16px;overflow-y:auto">' +
        '<div class="form-grid">' +
          field('Date', '<input id="decoupeDate" type="date" value="' + auj + '">') +
          field('Motif', '<input id="decoupeMotif" type="text" placeholder="Ex. usure gaine sur passage fr\u00e9quent">') +
          field('Nombre de morceaux r\u00e9sultants', '<input id="decoupeNombre" type="number" min="1" max="10" value="2">') +
        '</div>' +
        '<div id="decoupeMorceaux" style="margin-top:14px"></div>' +
        '<p id="decoupeErreur" class="form-msg" style="color:#a3242a;margin-top:8px"></p>' +
        '<div style="margin-top:14px;display:flex;gap:8px">' +
          '<button id="decoupeValider" disabled>Valider la d\u00e9coupe</button>' +
          '<button class="secondary" id="decoupeAnnuler">Annuler</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(div);

  var fermer = function () { fermerFenetreDecoupe(matId); };
  document.getElementById('decoupeClose').onclick = fermer;
  document.getElementById('decoupeAnnuler').onclick = fermer;
  var boiteDec = document.querySelector('#decoupeModale .reglages-modale');
  suivreSaisie(boiteDec);
  document.getElementById('decoupeFond').onclick = function () { fermetureDouce(boiteDec, fermer); };
  document.getElementById('decoupeNombre').oninput = function () { redessinerMorceauxDecoupe(m); };
  document.getElementById('decoupeValider').onclick = function () { validerDecoupe(m); };

  redessinerMorceauxDecoupe(m);
}

/* Annuler la fenetre de decoupe revient au choix precedent (A prevoir si
   la categorie est aussi reparable, sinon rien de coche) : rester sur
   "Decoupee" coche sans exemplaire selectionnable derriere serait un
   etat mort, ni utile ni logique. */
function fermerFenetreDecoupe(matId) {
  var modale = document.getElementById('decoupeModale');
  if (modale) modale.remove();
  SELECTION.rep = {};
  majListeSelectionnable('rep');
}

/* Reconstruit les lignes "morceau" selon le nombre demande (borne entre 1
   et 10 : au-dela, prochainesLettresDecoupe reste correcte mais la
   fenetre deviendrait peu maniable — une vraie limite technique n'a pas
   lieu d'etre, celle-ci est une limite d'ergonomie). Chaque ligne nait
   SANS rien de precoche (ni "Nouvel exemplaire" ni "Mis au rebut") : une
   attestation ne part jamais d'un choix favorable silencieux, meme
   statistiquement probable — meme principe que l'inspection de securite
   des reparations. */
function redessinerMorceauxDecoupe(m) {
  var nombreEl = document.getElementById('decoupeNombre');
  var n = Math.max(1, Math.min(10, Number(nombreEl.value) || 1));
  nombreEl.value = n;
  var zone = document.getElementById('decoupeMorceaux');
  var lieuxOptions = optionsFor(refLists.lieux, 'nom', m.lieu_stockage);
  var html = '';
  for (var i = 0; i < n; i++) {
    html += '<div class="encadre" style="margin-bottom:10px" data-morceau="' + i + '">' +
      '<b>Morceau ' + (i + 1) + '</b>' +
      '<div class="form-grid" style="margin-top:8px">' +
        field('Longueur', '<input type="text" data-mrc="longueur" placeholder="Ex. 35 m">') +
      '</div>' +
      '<div style="margin:8px 0">' +
        '<label class="coche" style="display:inline-block;margin-right:16px">' +
          '<input type="radio" name="decoupeSort' + i + '" data-mrc="sort" value="nouveau"> <b>Nouvel exemplaire</b></label>' +
        '<label class="coche" style="display:inline-block">' +
          '<input type="radio" name="decoupeSort' + i + '" data-mrc="sort" value="rebut"> <b>Mis au rebut</b></label>' +
      '</div>' +
      '<div data-mrc="champsNouveau" class="form-grid" style="display:none">' +
        field('Couleur', '<input type="text" data-mrc="couleur" value="' + esc(m.couleur || '') + '">') +
        field('Lieu de stockage', '<select data-mrc="lieu">' + lieuxOptions + '</select>') +
        '<p class="hint" style="grid-column:1/-1;margin:0" data-mrc="apercu"></p>' +
      '</div>' +
    '</div>';
  }
  zone.innerHTML = html;
  zone.querySelectorAll('[data-mrc="sort"]').forEach(function (r) {
    r.onchange = function () { rafraichirEtatDecoupe(m); };
  });
  rafraichirEtatDecoupe(m);
}

/* Recalcule, a chaque changement de choix sur une ligne : les apercus de
   marquage (en ordre des lignes "Nouvel exemplaire", jamais retapes a la
   main) et si le bouton Valider peut s'activer (TOUTES les lignes doivent
   avoir un choix explicite, pas de reste indetermine). */
function rafraichirEtatDecoupe(m) {
  var lignes = document.querySelectorAll('#decoupeMorceaux [data-morceau]');
  var nouveaux = [];
  var toutesTranchees = true;
  lignes.forEach(function (ligne) {
    var sort = ligne.querySelector('[data-mrc="sort"]:checked');
    var champsNouveau = ligne.querySelector('[data-mrc="champsNouveau"]');
    if (!sort) { toutesTranchees = false; if (champsNouveau) champsNouveau.style.display = 'none'; return; }
    if (sort.value === 'nouveau') {
      champsNouveau.style.display = '';
      nouveaux.push(ligne);
    } else if (champsNouveau) {
      champsNouveau.style.display = 'none';
    }
  });
  var lettres = prochainesLettresDecoupe(m.numero_marquage, nouveaux.length);
  nouveaux.forEach(function (ligne, idx) {
    var apercu = ligne.querySelector('[data-mrc="apercu"]');
    if (apercu) apercu.textContent = '\u2192 ' + m.numero_marquage + '-' + lettres[idx];
  });
  var btn = document.getElementById('decoupeValider');
  if (btn) btn.disabled = !toutesTranchees;
}

/* Ecrit la decoupe : reforme l'exemplaire d'origine avec un commentaire
   genere resumant l'operation, cree un nouvel exemplaire par morceau
   "Nouvel exemplaire" (marquage filiatif, jamais retape a la main — voir
   prochainesLettresDecoupe), et ne cree RIEN pour les morceaux "Mis au
   rebut" : leur trace suffit dans le commentaire de l'origine, inutile de
   faire vivre des objets fantomes qui ne serviront plus jamais. */
async function validerDecoupe(m) {
  var erreurEl = document.getElementById('decoupeErreur');
  erreurEl.textContent = '';

  var dateEl = document.getElementById('decoupeDate');
  var motifEl = document.getElementById('decoupeMotif');
  var date = dateEl.value;
  var motif = motifEl.value.trim();

  var err = erreurDates([{ date: date, si: 'La date ne peut pas \u00eatre dans le futur.' }]);
  if (err) { erreurEl.textContent = err; return; }
  if (!motif) { erreurEl.textContent = 'Pr\u00e9cisez le motif.'; return; }

  var lignes = document.querySelectorAll('#decoupeMorceaux [data-morceau]');
  var morceaux = [];
  var toutesTranchees = true;
  lignes.forEach(function (ligne) {
    var sort = ligne.querySelector('[data-mrc="sort"]:checked');
    if (!sort) { toutesTranchees = false; return; }
    var longueurEl = ligne.querySelector('[data-mrc="longueur"]');
    var longueur = longueurEl ? longueurEl.value.trim() : '';
    if (sort.value === 'nouveau') {
      morceaux.push({
        sort: 'nouveau', longueur: longueur,
        couleur: ligne.querySelector('[data-mrc="couleur"]').value.trim(),
        lieu: ligne.querySelector('[data-mrc="lieu"]').value
      });
    } else {
      morceaux.push({ sort: 'rebut', longueur: longueur });
    }
  });
  if (!toutesTranchees) { erreurEl.textContent = 'Choisissez le sort de chaque morceau.'; return; }

  var nouveaux = morceaux.filter(function (mo) { return mo.sort === 'nouveau'; });
  var lettres = prochainesLettresDecoupe(m.numero_marquage, nouveaux.length);
  var dateTs = dateToTimestamp(date);
  var avecOrigine = aColonne('materiels', 'origine_decoupe');

  var actions = [];
  var i = 0;
  var nomsNouveaux = [];
  morceaux.forEach(function (mo) {
    if (mo.sort !== 'nouveau') return;
    var marquage = m.numero_marquage + '-' + lettres[i];
    i++;
    nomsNouveaux.push(marquage + (mo.longueur ? ' (' + mo.longueur + ')' : ''));
    var champs = {
      numero_marquage: marquage,
      lot: m.lot,
      date_mise_en_service: dateTs,
      couleur: mo.couleur || null,
      lieu_stockage: mo.lieu ? Number(mo.lieu) : null,
      taille: mo.longueur || null
    };
    if (avecOrigine) champs.origine_decoupe = m.id;
    actions.push(['AddRecord', resolvedNames.materiels, null, champs]);
  });

  var nbRebut = morceaux.filter(function (mo) { return mo.sort === 'rebut'; }).length;
  var parties = [];
  if (nomsNouveaux.length) parties.push(nomsNouveaux.length + ' morceau' + (nomsNouveaux.length > 1 ? 'x' : '') + ' : ' + nomsNouveaux.join(', '));
  if (nbRebut) parties.push(nbRebut + ' morceau' + (nbRebut > 1 ? 'x' : '') + ' mis au rebut');
  var commentaire = 'D\u00e9coup\u00e9e le ' + date + ' : ' + motif + '. ' + parties.join(' ; ') + '.';

  actions.push(['UpdateRecord', resolvedNames.materiels, m.id, {
    hors_service_motif: 'Reforme',
    hors_service_date: dateTs,
    commentaire: commentaire
  }]);

  var btnValider = document.getElementById('decoupeValider');
  if (btnValider) btnValider.disabled = true;
  try {
    await grist.docApi.applyUserActions(actions);
  } catch (e) {
    erreurEl.textContent = 'Erreur \u00e0 l\u2019enregistrement : ' + (e && e.message ? e.message : e);
    if (btnValider) btnValider.disabled = false;
    return;
  }

  var modale = document.getElementById('decoupeModale');
  if (modale) modale.remove();
  SELECTION.rep = {};
  flashToast(m.numero_marquage + ' r\u00e9form\u00e9e, ' + nomsNouveaux.length + ' nouvel(aux) exemplaire(s) cr\u00e9\u00e9(s).');
  setTimeout(function () { load(); }, 100);
}

/* ============ Fenetre de scission d'un lot ============
   Detache une partie des exemplaires d'un lot vers un nouveau lot ou un
   lot existant de la meme categorie — utile quand une reprise d'inventaire
   revele que des exemplaires achetes a des moments differents ont ete
   groupes a tort dans un meme lot. Contrairement a la decoupe (qui cree de
   nouveaux objets physiques), les exemplaires eux-memes ne changent pas
   ici : seule leur reference "lot" est reaffectee — leur historique
   (controles, incidents, prets, reparations) reste intact de fait, ces
   tables referencant l'exemplaire directement, jamais le lot (verifie
   avant de commencer ce chantier, pas suppose). */
function ouvrirFenetreScission(lotId) {
  var lot = refLists.lots.filter(function (l) { return l.id === lotId; })[0];
  if (!lot) return;
  var exemplaires = refLists.materiels.filter(function (m) { return m.lot === lotId; });
  var autresLotsMemeCategorie = refLists.lots.filter(function (l) { return l.id !== lotId && l.categorie === lot.categorie; });

  var ancien = document.getElementById('scissionModale');
  if (ancien) ancien.remove();

  var div = document.createElement('div');
  div.className = 'reglages';
  div.id = 'scissionModale';
  div.innerHTML =
    '<div class="reglages-fond" id="scissionFond"></div>' +
    '<div class="reglages-modale" role="dialog" aria-modal="true" aria-label="Scinder un lot">' +
      '<div class="reglages-head">' +
        '<span>Scinder ' + esc(lot.designation) + '</span>' +
        '<button type="button" class="reglages-close" id="scissionClose" aria-label="Fermer">\u00d7</button>' +
      '</div>' +
      '<div class="reglages-corps" style="padding:16px;overflow-y:auto">' +
        '<div class="form-field" style="margin-bottom:10px">' +
          '<label class="coche" style="display:inline-block;margin-right:16px">' +
            '<input type="radio" name="scissionCible" id="scissionNouveauLot" checked> <b>Cr\u00e9er un nouveau lot</b></label>' +
          (autresLotsMemeCategorie.length ?
            '<label class="coche" style="display:inline-block">' +
              '<input type="radio" name="scissionCible" id="scissionLotExistant"> <b>Rattacher \u00e0 un lot existant</b></label>'
            : '') +
        '</div>' +
        '<div id="scissionChampsNouveau" class="form-grid"></div>' +
        '<div id="scissionChampLotExistant" style="display:none"></div>' +
        '<div style="margin-top:14px">' +
          '<label class="hint" style="display:block;margin-bottom:6px">Exemplaires \u00e0 d\u00e9tacher</label>' +
          '<label class="coche" style="display:block;margin-bottom:4px">' +
            '<input type="checkbox" id="scissionTout"> Tout cocher / d\u00e9cocher</label>' +
          '<div id="scissionListe" class="grille-coches"></div>' +
        '</div>' +
        '<p id="scissionErreur" class="form-msg" style="color:#a3242a;margin-top:8px"></p>' +
        '<div style="margin-top:14px;display:flex;gap:8px">' +
          '<button id="scissionValider" disabled>Valider la scission</button>' +
          '<button class="secondary" id="scissionAnnuler">Annuler</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(div);

  var fermer = function () { fermerFenetreScission(); };
  document.getElementById('scissionClose').onclick = fermer;
  document.getElementById('scissionAnnuler').onclick = fermer;
  var boiteSci = document.querySelector('#scissionModale .reglages-modale');
  suivreSaisie(boiteSci);
  document.getElementById('scissionFond').onclick = function () { fermetureDouce(boiteSci, fermer); };

  redessinerChampsScission(lot, autresLotsMemeCategorie);
  redessinerListeScission(exemplaires);

  document.getElementById('scissionNouveauLot').onchange = function () { redessinerChampsScission(lot, autresLotsMemeCategorie); rafraichirEtatScission(); };
  var rLotExistant = document.getElementById('scissionLotExistant');
  if (rLotExistant) rLotExistant.onchange = function () { redessinerChampsScission(lot, autresLotsMemeCategorie); rafraichirEtatScission(); };

  document.getElementById('scissionTout').onchange = function (ev) {
    document.querySelectorAll('#scissionListe input[type="checkbox"]').forEach(function (c) { c.checked = ev.target.checked; });
    rafraichirEtatScission();
  };
  document.getElementById('scissionValider').onclick = function () { validerScission(lot); };
}

function fermerFenetreScission() {
  var modale = document.getElementById('scissionModale');
  if (modale) modale.remove();
}

/* Reconstruit la zone de champs selon le choix nouveau-lot / lot-existant.
   Nouveau lot : designation toujours vide (a la main, jamais suggeree),
   fabricant/modele pre-remplis depuis l'origine (modifiables), categorie
   heritee et fixe (tous les exemplaires du lot d'origine la partagent
   deja, aucune raison d'en changer ici), le reste (date de fabrication,
   duree de vie, prix) vide par defaut — precisement les champs propres a
   UN achat, qu'on ne peut plus garantir identique pour un sous-groupe
   qu'on detache. Construite une seule fois par choix (dataset.construit),
   pas reconstruite a chaque bascule : un champ deja rempli par la
   personne ne doit pas se vider si elle regarde l'autre option puis
   revient. */
function redessinerChampsScission(lot, autresLotsMemeCategorie) {
  var champsNouveau = document.getElementById('scissionChampsNouveau');
  var champLotExistant = document.getElementById('scissionChampLotExistant');
  var versNouveau = document.getElementById('scissionNouveauLot').checked;
  champsNouveau.style.display = versNouveau ? '' : 'none';
  champLotExistant.style.display = versNouveau ? 'none' : '';

  if (versNouveau && !champsNouveau.dataset.construit) {
    var catObj = refLists.categories.filter(function (c) { return c.id === lot.categorie; })[0];
    var catNom = catObj ? catObj.nom : '';
    champsNouveau.innerHTML =
      field('D\u00e9signation', '<input id="scissionDesignation" type="text" placeholder="Ex. Baudriers Petzl Corax (achat 2024)">') +
      field('Cat\u00e9gorie', '<input type="text" value="' + esc(catNom) + '" disabled>') +
      '<p class="hint" style="grid-column:1/-1;margin:-6px 0 2px">Cat\u00e9gorie fix\u00e9e ici, pour ' +
        'rester coh\u00e9rente avec les exemplaires d\u00e9tach\u00e9s \u2014 elle pilote leur cadence de contr\u00f4le, leur ' +
        'dur\u00e9e de vie et leur \u00e9ligibilit\u00e9 \u00e0 la r\u00e9paration ou \u00e0 la d\u00e9coupe. Pour un lot fourre-tout ' +
        'volontairement mixte, changez-la ensuite sur le nouveau lot, via \u00ab\u00a0\u00c9diter le lot\u00a0\u00bb.</p>' +
      field('Fabricant', '<input id="scissionFabricant" type="text" value="' + esc(lot.fabricant || '') + '">') +
      field('Mod\u00e8le', '<input id="scissionModele" type="text" value="' + esc(lot.modele || '') + '">') +
      field('Date de fabrication', '<input id="scissionDateFab" type="date">') +
      field('Dur\u00e9e de vie (mois)', '<input id="scissionDureeVie" type="number" placeholder="vide = selon contrôle">') +
      field('Prix unitaire (\u20ac)', '<input id="scissionPrix" type="number">') +
      '<p class="hint" style="grid-column:1/-1;margin:-6px 0 2px">Ces trois derniers champs sont volontairement ' +
        'vides\u00a0: ils d\u00e9pendent d\u2019un achat pr\u00e9cis, qu\u2019on ne peut plus garantir identique pour ce sous-groupe. ' +
        'Compl\u00e9tez-les si vous avez retrouv\u00e9 la facture correspondante, sinon laissez-les vides.</p>' +
      field('Commentaire', '<input id="scissionCommentaire" type="text" value="' +
        esc('Issu d\u2019une scission du lot ' + lot.designation + ' le ' + new Date().toISOString().slice(0, 10) + '.') + '">');
    champsNouveau.dataset.construit = '1';
    document.getElementById('scissionDesignation').oninput = rafraichirEtatScission;
    /* avertissement nom = categorie : le nouveau lot garde la categorie du lot
       d'origine (addEventListener, pour ne pas remplacer le oninput ci-dessus) */
    var nomScission = document.getElementById('scissionDesignation');
    brancherAlerteNomLot(nomScission, function () { return lot.categorie; }, nomScission.closest('.form-field'));
  } else if (!versNouveau && !champLotExistant.dataset.construit) {
    var options = (autresLotsMemeCategorie || []).map(function (l) {
      return '<option value="' + l.id + '">' + esc(l.designation) + '</option>';
    }).join('');
    champLotExistant.innerHTML = field('Lot de destination', '<select id="scissionLotCible"><option value="">-</option>' + options + '</select>');
    champLotExistant.dataset.construit = '1';
    document.getElementById('scissionLotCible').onchange = rafraichirEtatScission;
  }
}

function redessinerListeScission(exemplaires) {
  var zone = document.getElementById('scissionListe');
  zone.innerHTML = exemplaires.length
    ? exemplaires.map(function (m) {
        return '<label class="coche"><input type="checkbox" class="scission-item" value="' + m.id + '"> ' +
          esc(m.numero_marquage || '#' + m.id) + (m.couleur ? ' \u00b7 ' + esc(m.couleur) : '') + '</label>';
      }).join('')
    : '<p class="hint">Aucun exemplaire dans ce lot.</p>';
  zone.querySelectorAll('.scission-item').forEach(function (c) { c.onchange = rafraichirEtatScission; });
}

/* Active le bouton Valider seulement si : au moins un exemplaire coche, ET
   (nouveau lot avec designation non vide) OU (lot existant choisi). */
function rafraichirEtatScission() {
  var btn = document.getElementById('scissionValider');
  if (!btn) return;
  var auMoinsUn = document.querySelectorAll('#scissionListe .scission-item:checked').length > 0;
  var versNouveau = document.getElementById('scissionNouveauLot').checked;
  var cibleValide;
  if (versNouveau) {
    var desig = document.getElementById('scissionDesignation');
    cibleValide = !!(desig && desig.value.trim());
  } else {
    var sel = document.getElementById('scissionLotCible');
    cibleValide = !!(sel && sel.value);
  }
  btn.disabled = !(auMoinsUn && cibleValide);
}

/* Ecrit la scission : cree le nouveau lot (via ajouterEtObtenirId, deja
   utilisee ailleurs dans ce fichier pour ce meme besoin) ou reutilise le
   lot existant choisi, puis reaffecte le champ "lot" des exemplaires
   coches vers cette cible. Aucune table d'historique a toucher :
   controles/incidents/prets/reparations referencent l'exemplaire, jamais
   le lot — rien ne se casse en deplacant une reference de lot. */
async function validerScission(lot) {
  var erreurEl = document.getElementById('scissionErreur');
  erreurEl.textContent = '';
  var idsCoches = Array.prototype.map.call(
    document.querySelectorAll('#scissionListe .scission-item:checked'),
    function (c) { return Number(c.value); }
  );
  if (!idsCoches.length) { erreurEl.textContent = 'Cochez au moins un exemplaire.'; return; }

  var versNouveau = document.getElementById('scissionNouveauLot').checked;
  var btnValider = document.getElementById('scissionValider');
  var lotCibleId;

  if (versNouveau) {
    if (!document.getElementById('scissionDesignation').value.trim()) {
      erreurEl.textContent = 'Donnez un nom au nouveau lot.'; return;
    }
  } else {
    lotCibleId = Number(document.getElementById('scissionLotCible').value);
    if (!lotCibleId) { erreurEl.textContent = 'Choisissez un lot de destination.'; return; }
  }

  if (btnValider) btnValider.disabled = true;
  try {
    if (versNouveau) {
      var champsLot = {
        designation: document.getElementById('scissionDesignation').value.trim(),
        categorie: lot.categorie,
        fabricant: document.getElementById('scissionFabricant').value.trim() || null,
        modele: document.getElementById('scissionModele').value.trim() || null,
        date_fabrication: dateToTimestamp(document.getElementById('scissionDateFab').value),
        duree_vie_mois: num(document.getElementById('scissionDureeVie').value),
        prix_unitaire: num(document.getElementById('scissionPrix').value),
        commentaire: document.getElementById('scissionCommentaire').value.trim() || null
      };
      lotCibleId = await ajouterEtObtenirId('lots', champsLot);
    }

    var actions = idsCoches.map(function (matId) {
      return ['UpdateRecord', resolvedNames.materiels, matId, { lot: lotCibleId }];
    });
    /* Trace sur le lot d'origine dans l'autre sens — utile a quelqu'un qui
       rouvrirait ce lot plus tard et se demanderait ou sont passes certains
       exemplaires. Ajoutee au commentaire existant, jamais ecrasee. */
    var noteOrigine = (lot.commentaire ? lot.commentaire + ' ' : '') +
      idsCoches.length + ' exemplaire(s) d\u00e9tach\u00e9(s) le ' + new Date().toISOString().slice(0, 10) + '.';
    actions.push(['UpdateRecord', resolvedNames.lots, lot.id, { commentaire: noteOrigine }]);
    await appliquer(actions);
  } catch (e) {
    erreurEl.textContent = 'Erreur \u00e0 l\u2019enregistrement : ' + (e && e.message ? e.message : e);
    if (btnValider) btnValider.disabled = false;
    return;
  }

  fermerFenetreScission();
  flashToast(idsCoches.length + ' exemplaire(s) d\u00e9tach\u00e9(s) de ' + lot.designation + '.');
  setTimeout(function () { load(); }, 100);
}

/* Parmi les identifiants d'exemplaires donnes, renvoie les categories EPI
   fermees a la reparation, sans doublon. Vide si tout est ouvert. Utilisee
   par les 3 formulaires de controle (un seul exemplaire ou plusieurs coches)
   et par le formulaire d'incident, au moment de valider un choix qui menerait
   a "A reparer" / "Reparation a prevoir". */
function categoriesFermeesReparation(matIds) {
  var vues = {}, fermees = [];
  (matIds || []).forEach(function (id) {
    var m = rawRows.materiels.filter(function (x) { return x.id === id; })[0];
    var cat = categorieDeMateriel(m);
    if (!cat || reparationOuverte(cat)) return;
    if (vues[cat.id]) return;
    vues[cat.id] = true;
    fermees.push(cat);
  });
  return fermees;
}

/* Pendant de categoriesFermeesReparation() pour le cas ouvert : les
   categories dont la reparation est ouverte ET qui portent une note "ce
   qui est generalement accepte". Remontee au moment ou le controleur
   choisit "A reparer" / "Reparation a prevoir" — c'est la que la question
   se pose vraiment (ex. dégaine : sangle oui, mousqueton fatigue non),
   pas dans les reglages de categorie qu'il ne rouvrira pas en pleine
   verification. Uniquement informatif, jamais bloquant : pas de garde a
   la validation, contrairement a categoriesFermeesReparation. */
function categoriesAvecNoteReparation(matIds) {
  var vues = {}, avecNote = [];
  (matIds || []).forEach(function (id) {
    var m = rawRows.materiels.filter(function (x) { return x.id === id; })[0];
    var cat = categorieDeMateriel(m);
    if (!cat || !reparationOuverte(cat)) return;
    if (!(cat.reparations_acceptees || '').trim()) return;
    if (vues[cat.id]) return;
    vues[cat.id] = true;
    avecNote.push(cat);
  });
  return avecNote;
}

function panneauNotesReparation(categories) {
  return categories.map(function (c) {
    return '<div class="encadre"><b>R\u00e9parations g\u00e9n\u00e9ralement accept\u00e9es \u2014 '
      + esc(c.nom) + '</b><br>'
      + esc((c.reparations_acceptees || '').trim()).replace(/\n/g, '<br>')
      + '</div>';
  }).join('');
}

/* Determine si "Decoupee" doit apparaitre comme option dans le selecteur
   d'etat de "Declarer une reparation" — UNIQUEMENT pour ce formulaire,
   sans toucher categoriesFermeesReparation() ni ses autres appelants
   (3 formulaires de controle + incident, dont le comportement reste
   inchange). Renvoie null si l'option ne doit pas etre proposee (aucune
   categorie connue, ou categories visibles qui ne sont pas UNIFORMEMENT
   decoupables) — dans ce cas, le formulaire se comporte exactement comme
   avant l'existence de la decoupe. Renvoie {reparable: bool} si "Decoupee"
   doit apparaitre, pour savoir s'il faut EN PLUS garder "A prevoir" /
   "Deja effectuee" (categorie a la fois reparable et decoupable) ou les
   masquer entierement (categorie decoupable mais pas reparable, ex. cordes). */
function eligibiliteDecoupeVisible(matIds) {
  var categories = {};
  (matIds || []).forEach(function (id) {
    var m = rawRows.materiels.filter(function (x) { return x.id === id; })[0];
    var cat = categorieDeMateriel(m);
    if (cat) categories[cat.id] = cat;
  });
  var liste = Object.keys(categories).map(function (k) { return categories[k]; });
  if (!liste.length) return null;
  var toutesDecoupables = liste.every(function (c) { return decoupeOuverte(c); });
  if (!toutesDecoupables) return null;
  var toutesReparables = liste.every(function (c) { return reparationOuverte(c); });
  return { reparable: toutesReparables };
}

/* true seulement quand TOUTES les categories visibles sont fermees a la
   fois a la reparation ET a la decoupe (aucune des deux portes ouverte,
   pour aucune) — le cas signale par Pierre le 22/08 : sans elle, les
   radios "A prevoir"/"Deja effectuee" restaient cliquables et revelaient
   des champs (Intervenant, inspection...) pour une categorie ou tout ca ne
   menera jamais qu'au meme avertissement bloquant deja affiche. Volontairement
   stricte : un melange (certaines categories visibles ouvertes, d'autres
   non) garde le comportement historique inchange — seules les radios sont
   masquees ici, jamais le panneau d'avertissement lui-meme, qui reste la
   seule explication et ne doit pas disparaitre. */
function toutFermeVisible(matIds) {
  var categories = {};
  (matIds || []).forEach(function (id) {
    var m = rawRows.materiels.filter(function (x) { return x.id === id; })[0];
    var cat = categorieDeMateriel(m);
    if (cat) categories[cat.id] = cat;
  });
  var liste = Object.keys(categories).map(function (k) { return categories[k]; });
  if (!liste.length) return false;
  return liste.every(function (c) { return !reparationOuverte(c) && !decoupeOuverte(c); });
}

/* Selecteur "A prevoir / Deja effectuee", partage par les deux points d'entree
   de "Declarer une reparation" (fiche individuelle et formulaire groupe) —
   pas par les formulaires de controle, ou la question n'a pas de sens : on
   ne peut pas decouvrir en controlant un objet qu'il est deja repare, ce
   serait alors "Conforme". field()/esc() sont deja globales dans ce fichier.
   Convention volontairement en id simples (pas data-ff) : le formulaire
   groupe n'a pas ce mecanisme, un seul jeu d'id partage evite de dupliquer
   la logique une troisieme fois. */
function blocEtatRadios(prefix, decoupeInfo, toutFerme) {
  if (toutFerme) {
    /* Ni reparation ni decoupe possibles pour ce qui est visible : des
       radios cliquables qui revelent des champs (Intervenant, inspection...)
       pour finalement aboutir au meme blocage silencieux a la sauvegarde
       n'apportait que de la confusion (signale par Pierre le 22/08). Le
       panneau d'avertissement (repPanneauCategorie, construit a part) reste
       la seule explication affichee — rien a dupliquer ici, juste une zone
       vide plutot que des choix qui ne menent nulle part. */
    return '<div class="form-field" id="' + prefix + 'ZoneEtat" style="grid-column:1/-1"></div>';
  }

  var radioDecoupee = decoupeInfo ? (
    '<label class="coche" style="display:block;margin:4px 0">' +
      '<input type="radio" name="' + prefix + 'EtatRep" id="' + prefix + 'EtatDecoupee"' +
      (decoupeInfo.reparable ? '' : ' checked') + '> ' +
      '<b>D\u00e9coup\u00e9e</b> \u2014 l\'exemplaire est recoup\u00e9 en plusieurs morceaux</label>'
  ) : '';

  if (decoupeInfo && !decoupeInfo.reparable) {
    /* Categorie decoupable mais pas reparable (cordes, typiquement) :
       "Decoupee" est la SEULE option, "A prevoir"/"Deja effectuee" n'ont
       pas de sens ici et disparaissent entierement plutot que de rester
       visibles sans effet. Le message neutre remplace l'ancien
       avertissement "reparation fermee" — quelque chose EST possible ici,
       ce n'est pas un blocage. */
    return '<div class="form-field" id="' + prefix + 'ZoneEtat" style="grid-column:1/-1">' +
      '<label>État de la r\u00e9paration</label>' +
      radioDecoupee +
      '<div id="' + prefix + 'EtatRepNote" style="margin:6px 0">' +
        '<div class="encadre">Cette cat\u00e9gorie n\'admet pas de r\u00e9paration classique \u2014 mais ' +
        'peut \u00eatre d\u00e9coup\u00e9e pour donner de nouveaux exemplaires. S\u00e9lectionnez ' +
        'l\'exemplaire concern\u00e9 ci-dessous.</div></div>' +
    '</div>';
  }

  return '<div class="form-field" id="' + prefix + 'ZoneEtat" style="grid-column:1/-1">' +
    '<label>État de la r\u00e9paration</label>' +
    '<label class="coche" style="display:block;margin:4px 0">' +
      '<input type="radio" name="' + prefix + 'EtatRep" id="' + prefix + 'EtatAPrevoir" checked> ' +
      '<b>A pr\u00e9voir</b> \u2014 l\'exemplaire est mis de c\u00f4t\u00e9, en attente</label>' +
    '<label class="coche" style="display:block;margin:4px 0">' +
      '<input type="radio" name="' + prefix + 'EtatRep" id="' + prefix + 'EtatDejaFaite"> ' +
      '<b>D\u00e9j\u00e0 effectu\u00e9e</b> \u2014 la r\u00e9paration a d\u00e9j\u00e0 \u00e9t\u00e9 r\u00e9alis\u00e9e</label>' +
    radioDecoupee +
    '<div id="' + prefix + 'EtatRepNote" style="margin:6px 0"></div>' +
  '</div>';
}

/* Champs reveles quand "Deja effectuee" est choisi. Intervenant reste une
   entite (Club / Atelier agree / Fabricant) — le champ "Qui" (personne
   physique) n'apparait que si Intervenant = Club ET que la colonne
   facultative existe : distinction demandee explicitement (l'un ne remplace
   pas l'autre, "Club" en general n'implique pas forcement une personne
   nommee si le club ne veut pas suivre ce detail). */
function blocEtatChamps(prefix, toujoursVisible) {
  var avecQui = aColonne('reparations', 'intervenant_qui');
  return '<div id="' + prefix + 'EtatRepChamps" style="display:' + (toujoursVisible ? 'block' : 'none') + ';grid-column:1/-1">' +
    '<div class="form-grid">' +
      field('Intervenant', '<select id="' + prefix + 'EtatIntervenant"><option>Club</option><option>Atelier agree</option><option>Fabricant</option></select>') +
      field('Pi\u00e8ces remplac\u00e9es (facultatif)', '<input id="' + prefix + 'EtatPieces" type="text">') +
    '</div>' +
    blocProlongation(prefix) +
    (avecQui
      ? '<div id="' + prefix + 'EtatQuiWrap" style="display:none;margin-top:6px">' +
          field('Qui', '<select id="' + prefix + 'EtatQui">' + optionsFor(adherentsControleurs(), 'nom_complet') + '</select>') +
        '</div>'
      : '') +
  '</div>';
}

/* Prolongation de la duree de vie (2026.5.6). Toujours rendu si les colonnes
   existent, mais MASQUE tant qu'aucun exemplaire vise n'est d'une categorie
   ou la prolongation est ouverte : majProlongation() decide. Cibles : data-mats
   (fiche d'un exemplaire) ou, a defaut, la selection du formulaire groupe.
   Partage par les cinq chemins ou une reparation est enregistree effectuee. */
function blocProlongation(prefix) {
  if (!prolongationDisponible()) return '';
  return '<div id="' + prefix + 'ProlongBloc" class="encadre" style="display:none;margin-top:8px">' +
    '<p style="margin:0 0 6px"><b>Prolonger la dur\u00e9e de vie</b> (facultatif) \u2014 si la pi\u00e8ce ' +
      'remplac\u00e9e est celle qui vieillit (ex. sangle d\u2019une d\u00e9gaine), la nouvelle fin de vie part ' +
      'de sa date de fabrication. Remplacement selon la notice du fabricant, avec une pi\u00e8ce compatible.</p>' +
    '<div class="form-grid">' +
      field('Date de fabrication de la pi\u00e8ce neuve', '<input id="' + prefix + 'ProlongDate" type="date">') +
      field('Dur\u00e9e de vie de la pi\u00e8ce (mois)', '<input id="' + prefix + 'ProlongDuree" type="number" min="1">') +
    '</div>' +
    '<p class="hint" id="' + prefix + 'ProlongApercu" style="margin:4px 0 0"></p>' +
  '</div>';
}

/* exemplaires vises par le bloc de prolongation du prefixe */
function ciblesProlongation(prefix) {
  var bloc = document.getElementById(prefix + 'ProlongBloc');
  if (!bloc) return [];
  var ids = bloc.dataset.mats
    ? bloc.dataset.mats.split(',').map(Number)
    : (SELECTION[prefix] ? idsSelectionnes(prefix) : []);
  return ids.map(function (id) { return rawRows.materiels.filter(function (m) { return m.id === id; })[0]; })
    .filter(function (m) { return m && prolongationOuverte(categorieDeMateriel(m)); });
}

/* Affiche / masque le bloc, pre-remplit la duree (celle de la categorie),
   montre la nouvelle fin de vie avant d'enregistrer. */
function majProlongation(prefix) {
  var bloc = document.getElementById(prefix + 'ProlongBloc');
  if (!bloc) return;
  var cibles = ciblesProlongation(prefix);
  bloc.style.display = cibles.length ? 'block' : 'none';
  if (!cibles.length) return;
  var dureeEl = document.getElementById(prefix + 'ProlongDuree');
  var dateEl = document.getElementById(prefix + 'ProlongDate');
  var cat = categorieDeMateriel(cibles[0]);
  if (dureeEl && !dureeEl.value && cat && cat.duree_vie_defaut_mois) dureeEl.value = cat.duree_vie_defaut_mois;
  if (!bloc.dataset.branche) {
    bloc.dataset.branche = '1';
    [dateEl, dureeEl].forEach(function (el) { if (el) el.addEventListener('input', function () { majProlongation(prefix); }); });
  }
  var ap = document.getElementById(prefix + 'ProlongApercu');
  var lu = lireProlongation(prefix);
  if (!ap) return;
  ap.style.color = '';
  if (lu && lu.erreur) { ap.textContent = lu.erreur; ap.style.color = '#a3242a'; return; }
  if (!lu) { ap.textContent = 'Laissez la date vide pour ne pas prolonger.'; return; }
  var fin = finDepuis(lu.date_fabrication_piece, lu.duree_vie_piece_mois);
  var m0 = cibles[0];
  ap.textContent = 'Nouvelle fin de vie\u00a0: 31/12/' + fin.getUTCFullYear() +
    (cibles.length === 1
      ? (m0._finDeVie ? ' (actuellement 31/12/' + m0._finDeVie.getUTCFullYear() + ')' : '')
      : ' pour ' + cibles.length + ' exemplaires') + '.';
}

/* null = rien saisi ; { erreur } = saisie invalide (pas de prolongation) ;
   sinon les deux champs a ecrire sur la reparation. */
function lireProlongation(prefix) {
  var bloc = document.getElementById(prefix + 'ProlongBloc');
  if (!bloc || bloc.style.display === 'none') return null;
  var dateEl = document.getElementById(prefix + 'ProlongDate');
  var dureeEl = document.getElementById(prefix + 'ProlongDuree');
  if (!dateEl || !dateEl.value) return null;
  var duree = Number(dureeEl && dureeEl.value);
  if (dateEl.value > new Date().toISOString().slice(0, 10)) {
    return { erreur: 'La date de fabrication de la pi\u00e8ce ne peut pas \u00eatre dans le futur\u00a0: pas de prolongation.' };
  }
  if (!duree || duree <= 0) return { erreur: 'Indiquez la dur\u00e9e de vie de la pi\u00e8ce, en mois.' };
  return { date_fabrication_piece: dateToTimestamp(dateEl.value), duree_vie_piece_mois: duree };
}

/* Ajoute les champs de prolongation a une reparation, pour CET exemplaire
   seulement si sa categorie l'autorise (formulaire groupe : categories mixtes). */
function appliquerProlongation(champs, extra, matId) {
  if (!extra || !extra.prolongation || extra.prolongation.erreur) return;
  var m = rawRows.materiels.filter(function (x) { return x.id === matId; })[0];
  if (!m || !prolongationOuverte(categorieDeMateriel(m))) return;
  champs.date_fabrication_piece = extra.prolongation.date_fabrication_piece;
  champs.duree_vie_piece_mois = extra.prolongation.duree_vie_piece_mois;
}

/* Remontee pres du choix "Deja effectuee" (dont elle depend directement) au
   lieu d'etre enfouie sous Date/Motif/Intervenant/Pieces — la consequence la
   plus lourde (retour immediat en service) doit se voir tout de suite, pas
   apres trois autres champs administratifs. La boite change de couleur
   (encadre neutre -> encadre-ok) quand la case est cochee : mise en valeur
   demandee, sans pour autant la precocher — c'est une attestation, pas une
   supposition favorable par defaut. */
function blocInspection(prefix, toujoursVisible) {
  return '<div id="' + prefix + 'BlocInspection" style="display:' + (toujoursVisible ? 'block' : 'none') + ';grid-column:1/-1;margin-top:6px">' +
    '<div id="' + prefix + 'InspectionBox" class="encadre">' +
      '<label class="coche" style="align-items:flex-start">' +
        '<input type="checkbox" id="' + prefix + 'EtatInspecte" style="margin-top:2px"> ' +
        '<span><b>Inspection de s\u00e9curit\u00e9 r\u00e9alis\u00e9e lors de la r\u00e9paration</b> \u2014 le mat\u00e9riel ' +
        'peut \u00eatre remis en service imm\u00e9diatement</span></label>' +
      '<div id="' + prefix + 'EtatInspecteChamps" style="display:none;margin-top:8px">' +
        field('Contr\u00f4leur', '<select id="' + prefix + 'EtatControleur">' + optionsFor(adherentsControleurs(), 'nom_complet') + '</select>') +
      '</div>' +
    '</div>' +
  '</div>';
}

/* Conservee pour l'usage historique dans "Declarer un incident" (suite =
   Reparation a prevoir) : simple composition des deux blocs ci-dessus. */
function blocEtatReparation(prefix) {
  return blocEtatRadios(prefix) + blocEtatChamps(prefix);
}

/* Cablage minimal, partage entre les deux contextes ou blocInspection()
   apparait : le formulaire de declaration (radio "Deja effectuee") ET la
   fenetre de cloture d'une reparation deja en cours (ou l'inspection est
   toujours pertinente, sans etat a choisir au prealable — cloturer EST
   deja la declaration "c'est fait"). */
function brancherInspection(prefix) {
  var inspBox = document.getElementById(prefix + 'InspectionBox');
  var cI = document.getElementById(prefix + 'EtatInspecte');
  var champsInsp = document.getElementById(prefix + 'EtatInspecteChamps');
  if (!cI) return;
  var maj = function () {
    var inspecte = cI.checked;
    if (champsInsp) champsInsp.style.display = inspecte ? 'block' : 'none';
    if (inspBox) inspBox.className = inspecte ? 'encadre-ok' : 'encadre';
  };
  cI.onchange = maj;
  maj();
}

/* matIdUnique : fourni uniquement par le contexte fiche individuelle (un
   seul exemplaire deja connu, pas de liste a cocher) — permet a
   brancherRadioDecoupee() d'ouvrir la fenetre de decoupe directement sur
   CET exemplaire, sans passer par la selection dans une liste qui n'existe
   pas dans ce contexte. Absent (undefined) pour le formulaire groupe :
   comportement inchange, la selection se fait toujours dans la liste. */
function brancherEtatReparation(prefix, matIdUnique) {
  var rA = document.getElementById(prefix + 'EtatAPrevoir');
  var rD = document.getElementById(prefix + 'EtatDejaFaite');
  var rDec = document.getElementById(prefix + 'EtatDecoupee');
  var champs = document.getElementById(prefix + 'EtatRepChamps');
  var blocInsp = document.getElementById(prefix + 'BlocInspection');
  var note = document.getElementById(prefix + 'EtatRepNote');
  var cI = document.getElementById(prefix + 'EtatInspecte');
  var intervenantSel = document.getElementById(prefix + 'EtatIntervenant');
  var quiWrap = document.getElementById(prefix + 'EtatQuiWrap');
  /* Cablage de "Decoupee" independant de rA/rD : doit fonctionner meme
     quand ils sont absents (categorie decoupable mais pas reparable,
     "Decoupee" est alors la SEULE option du formulaire). */
  if (rDec) brancherRadioDecoupee(prefix, rDec, matIdUnique);
  if (!rA || !rD) return;
  brancherInspection(prefix);
  var maj = function () {
    if (rDec && rDec.checked) {
      /* categorie a la fois reparable et decoupable : "Decoupee" prend le
         pas sur les champs de reparation classique, qui n'ont pas de sens
         ici — la fenetre de decoupe s'occupe de tout, cf. brancherRadioDecoupee. */
      if (champs) champs.style.display = 'none';
      if (blocInsp) blocInsp.style.display = 'none';
      if (note) note.innerHTML = '<div class="encadre">S\u00e9lectionnez un seul exemplaire ' +
        'ci-dessous : la fen\u00eatre de d\u00e9coupe s\u2019ouvrira automatiquement.</div>';
      return;
    }
    var dejaFaite = rD.checked;
    if (champs) champs.style.display = dejaFaite ? 'block' : 'none';
    if (blocInsp) blocInsp.style.display = dejaFaite ? 'block' : 'none';
    if (!dejaFaite && cI && cI.checked) { cI.checked = false; cI.onchange(); }   /* incoherent de rester coche si on revient a "a prevoir" */
    var inspecte = dejaFaite && cI && cI.checked;
    if (quiWrap) quiWrap.style.display = (dejaFaite && intervenantSel && intervenantSel.value === 'Club') ? 'block' : 'none';
    if (note) note.innerHTML = !dejaFaite
      ? '<div class="encadre">L\'exemplaire passe imm\u00e9diatement en <b>En r\u00e9paration</b> et sort du parc ' +
        'pr\u00eatable, en attendant que la r\u00e9paration soit faite.</div>'
      : inspecte
      ? '<div class="encadre-ok">L\'exemplaire repasse directement <b>En service</b>, disponible ' +
        'imm\u00e9diatement : la r\u00e9paration vaut aussi contr\u00f4le.</div>'
      : '<div class="encadre-ok">La r\u00e9paration est d\u00e9j\u00e0 faite : l\'exemplaire passe en ' +
        '<b>Examen requis</b>, en attente de son prochain contr\u00f4le avant de redevenir disponible.</div>';
  };
  rA.onchange = maj; rD.onchange = maj;
  if (rDec) rDec.onchange = maj;
  if (intervenantSel) intervenantSel.onchange = maj;
  maj();
}

/* Cablage dedie a l'option "Decoupee", commun aux deux contextes ou
   blocEtatRadios peut la proposer (categorie decoupable seule, ou
   decoupable+reparable a la fois) — separe de brancherEtatReparation pour
   rester valide meme quand rA/rD n'existent pas (categorie decoupable
   mais pas reparable, "Decoupee" est alors la seule option du formulaire).
   matIdUnique : voir le commentaire de brancherEtatReparation. */
function brancherRadioDecoupee(prefix, rDec, matIdUnique) {
  var declencher = function () {
    if (!rDec.checked) return;
    if (matIdUnique) {
      /* Fiche individuelle : rien a selectionner, l'exemplaire est deja
         connu — la fenetre s'ouvre directement dessus. */
      ouvrirFenetreDecoupe(matIdUnique);
      return;
    }
    /* Formulaire groupe : bascule vers une selection UNIQUE (la decoupe
       ne s'applique jamais a plusieurs exemplaires a la fois). On vide
       toute selection multiple en cours plutot que de la conserver a
       moitie et de laisser deviner lequel sera decoupe. */
    SELECTION[prefix] = {};
    majListeSelectionnable(prefix);
  };
  rDec.addEventListener('change', declencher);
  /* Categorie decoupable-seule sur la fiche individuelle : le radio nait
     DEJA coche (seule option possible, voir blocEtatRadios), donc aucun
     evenement 'change' ne se declenchera jamais naturellement — sans cet
     appel immediat, la fenetre ne s'ouvrirait qu'apres un clic inutile
     (decocher puis recocher). */
  if (matIdUnique && rDec.checked) declencher();
}

/* Pour la fenetre de cloture ("Declarer la reparation effectuee") : pas de
   choix d'etat a cabler, la cloture EST la declaration "c'est fait". Juste
   le reveal Intervenant -> Qui, et l'inspection (partagee via
   brancherInspection). */
function brancherChampsReparationToujoursVisible(prefix) {
  var intervenantSel = document.getElementById(prefix + 'EtatIntervenant');
  var quiWrap = document.getElementById(prefix + 'EtatQuiWrap');
  if (intervenantSel && quiWrap) {
    var majQui = function () { quiWrap.style.display = intervenantSel.value === 'Club' ? 'block' : 'none'; };
    intervenantSel.onchange = majQui; majQui();
  }
  brancherInspection(prefix);
}

function etatReparationEstDejaFaite(prefix) {
  var r = document.getElementById(prefix + 'EtatDejaFaite');
  return !!(r && r.checked);
}

function etatReparationEstInspectee(prefix) {
  /* Ne depend QUE de la case elle-meme : dans le formulaire de declaration,
     l'invariant "cochee => deja faite" est deja garanti par le reset dans
     brancherEtatReparation() (la case est decochee d'office si on repasse
     sur "a prevoir"). Dans la fenetre de cloture, il n'y a pas de radio du
     tout — la cloture EST deja la declaration "c'est fait", inutile de
     verifier un etat qui n'existe pas dans ce contexte. */
  var c = document.getElementById(prefix + 'EtatInspecte');
  return !!(c && c.checked);
}

function champsExtraReparationDejaFaite(prefix) {
  var intervenantEl = document.getElementById(prefix + 'EtatIntervenant');
  var piecesEl = document.getElementById(prefix + 'EtatPieces');
  var quiEl = document.getElementById(prefix + 'EtatQui');
  var intervenant = intervenantEl ? intervenantEl.value : 'Club';
  var res = {
    intervenant: intervenant,
    pieces_remplacees: piecesEl ? piecesEl.value.trim() : ''
  };
  if (intervenant === 'Club' && quiEl && quiEl.value && aColonne('reparations', 'intervenant_qui')) {
    res.intervenant_qui = Number(quiEl.value);
  }
  var prolong = lireProlongation(prefix);
  if (prolong && !prolong.erreur) res.prolongation = prolong;
  return res;
}

/* LE formulaire dedie a "Declarer une reparation", visuellement distinct de
   "Declarer un incident" (pas de gravite, pas de suite a donner, pas de
   photo — aucun sens dans ce contexte) meme si il ecrit dans les memes
   tables en coulisses (meme principe que partout ailleurs dans ce logiciel).
   Etat de la reparation en toute premiere position : c'est le choix qui
   conditionne tout le reste du formulaire, pas une option parmi d'autres.
   matIds : tableau (un seul id pour la fiche, plusieurs pour le groupe) —
   sert uniquement au panneau pedagogique de categorie fermee/notee. */
/* Isole dans sa propre fonction (au lieu d'un IIFE local) : le formulaire
   groupe doit pouvoir rafraichir CE panneau seul quand la selection change,
   sans reconstruire tout le formulaire et perdre ce que l'utilisateur a deja
   rempli (motif, intervenant...). */
function panneauCategoriePourReparation(matIds) {
  var fermees = categoriesFermeesReparation(matIds);
  if (fermees.length) return panneauReparationFermee(fermees);
  var avecNote = categoriesAvecNoteReparation(matIds);
  return avecNote.length ? panneauNotesReparation(avecNote) : '';
}

function formulaireDeclarerReparation(prefix, matIds) {
  var auj = new Date().toISOString().slice(0, 10);
  var decoupeInfo = eligibiliteDecoupeVisible(matIds);
  var toutFerme = toutFermeVisible(matIds);
  /* Le nouveau message neutre de blocEtatRadios() remplace l'ancien
     avertissement "reparation fermee" dans le cas decoupable-seul — les
     deux affiches ensemble feraient double emploi et se contrediraient
     presque (l'un dit "ferme", l'autre dit "possible autrement"). Dans
     tous les autres cas (reparable, ou reparable+decoupable), le panneau
     garde son role habituel sans changement. Le panneau reste, lui, TOUJOURS
     affiche quand toutFerme : c'est la seule explication du blocage,
     contrairement au cas decoupable-seul qui a sa propre explication. */
  var panneauCategorie = (decoupeInfo && !decoupeInfo.reparable) ? '' : panneauCategoriePourReparation(matIds);
  return '<div class="form-grid">' +
    blocEtatRadios(prefix, decoupeInfo, toutFerme) +
    blocInspection(prefix) +
    '<div id="' + prefix + 'PanneauCategorie" style="grid-column:1/-1">' + panneauCategorie + '</div>' +
    field('Date', '<input id="' + prefix + 'RepDate" type="date" value="' + auj + '">') +
    field('Motif', '<input id="' + prefix + 'RepDescription" type="text" placeholder="Ex. sangle usée">') +
    blocEtatChamps(prefix) +
  '</div>';
}

/* Le controle "gratuit" issu de l'inspection de securite au moment de la
   reparation : un fait de plus, exactement comme n'importe quel autre
   controle — c'est ce qui permet a deriverStatut() de renvoyer l'exemplaire
   directement En service sans code specifique a ecrire pour ce cas. */
function actionControleApresReparation(prefix, matId, dateTs) {
  if (!etatReparationEstInspectee(prefix)) return null;
  var controleurEl = document.getElementById(prefix + 'EtatControleur');
  var ch = {
    materiel: matId, date_controle: dateTs,
    controleur: controleurEl ? Number(controleurEl.value) || null : null,
    resultat: 'Conforme',
    commentaire: 'Inspection de sécurité réalisée au moment de la réparation.'
  };
  if (aColonne('controles', 'type_controle')) ch.type_controle = TYPE_CONTROLE_DEFAUT[1];
  return ['AddRecord', resolvedNames.controles, null, ch];
}

/* Panneau pedagogique affiche a la place du message d'erreur habituel quand
   la validation est bloquee par la nature reglementaire de la categorie.
   Texte valide avec l'utilisateur (AFFINAGE_REPARATION_EPI.md §4c) : on
   n'affirme jamais que "la loi interdit", on renvoie a la notice du
   fabricant et au geste concret pour ouvrir la categorie si elle l'autorise.
   Le second paragraphe change selon que la colonne "maintenance_fabricant"
   existe : sinon, "cochez la case" pointerait vers une case invisible —
   c'est precisement ce qui a ete signale comme non implemente. */
function panneauReparationFermee(categories) {
  var noms = categories.map(function (c) { return c.nom; }).filter(Boolean);
  var sujet = noms.length > 1
    ? 'des catégories ' + noms.map(function (n) { return '« ' + esc(n) + ' »'; }).join(', ')
    : 'la catégorie ' + (noms[0] ? '« ' + esc(noms[0]) + ' »' : 'sélectionnée');
  var avecMaintenance = aColonne('categories', 'maintenance_fabricant');
  var geste = avecMaintenance
    ? 'Si c\u2019est le cas ici, ouvrez la catégorie dans <b>Listes du club</b> en ' +
      'cochant « maintenance prévue par le fabricant ». En cas de doute, c\u2019est ' +
      'la notice du fabricant qui tranche.'
    : 'Si c\u2019est le cas ici, cette autorisation n\u2019est pas encore activable : la ' +
      'colonne <b>maintenance_fabricant</b> reste à créer dans la table CATÉGORIES ' +
      '(type Basculer). Voir Aide → Diagnostic pour le détail.';
  return '<div class="encadre-warn">' +
    '<b>\u26a0 R\u00e9paration non ouverte pour ' + sujet + '</b><br>' +
    'Un équipement de protection individuelle endommagé au point d\u2019être retiré ' +
    'du service se réforme, sauf si le fabricant prévoit explicitement une ' +
    'réparation ou un remplacement de pièces.<br>' +
    geste +
    '</div>';
}

/* Ligne REPARATIONS ouverte (declaree, pas encore effectuee) pour un
   exemplaire donne. Meme principe que dernierReparation dans load(), mais
   appele ponctuellement au clic sur "Declarer la reparation effectuee"
   plutot que precalcule pour tout le parc. */
function reparationOuverteDe(matId) {
  var candidates = (rawRows.reparations || []).filter(function (r) {
    return r.materiel === matId && !r.date_effectuee;
  });
  if (!candidates.length) return null;
  candidates.sort(function (a, b) {
    return (toDate(b.date_declaree) || 0) - (toDate(a.date_declaree) || 0);
  });
  return candidates[0];
}

function griserDuree(champ, non, placeholderActif) {
  if (!champ) return;
  champ.disabled = non;
  if (non) champ.value = '';
  champ.placeholder = non ? 'non soumis au vieillissement' : (placeholderActif || '');
  champ.title = non ? 'La duree de vie est pilotee par le controle, pas par le calendrier.' : '';
}

/* Regle FFCAM : 31/12 de l'annee civile atteinte apres <mois> ajoutes a la
   date de fabrication. Partagee par le lot et par la piece neuve d'une
   reparation prolongeante (2026.5.6). */
function finDepuis(dateFabrication, mois) {
  var d = toDate(dateFabrication);
  mois = Number(mois);
  if (!d || !mois) return null;
  var total = d.getUTCMonth() + mois;
  return new Date(Date.UTC(d.getUTCFullYear() + Math.floor(total / 12), 11, 31));
}

function finDeVieLot(lot) {
  return finDepuis(lot.date_fabrication, lot.duree_vie_mois);
}

/* ---------------------- prolongation par reparation ----------------------
   Quand la piece qui vieillit se remplace (sangle d'une degaine : les
   mousquetons ne se perime pas), la reparation porte la date de fabrication
   de la piece neuve et sa duree de vie. La fin de vie de l'exemplaire part
   alors de la piece neuve, pas de l'ancienne date (decision du 07/10 : une
   sangle fabriquee en 2025 et posee en 2026 vit jusqu'au 31/12/2035, pas
   2036). Stocke SUR LA REPARATION, jamais sur l'exemplaire : une seule source
   de verite, la tracabilite d'office, et supprimer la reparation rend
   l'ancienne date. La DERNIERE reparation effectuee qui porte ces deux champs
   fait foi. Colonnes facultatives : CATEGORIES.prolongation_par_reparation
   (Booleen), REPARATIONS.date_fabrication_piece (Date),
   REPARATIONS.duree_vie_piece_mois (Entier). */
function prolongationDisponible() {
  return aColonne('reparations', 'date_fabrication_piece') && aColonne('reparations', 'duree_vie_piece_mois');
}
function prolongationOuverte(cat) {
  return prolongationDisponible() && aColonne('categories', 'prolongation_par_reparation') &&
    !!cat && !!cat.prolongation_par_reparation &&
    cat.type_epi === 'Soumis a vieillissement' && reparationOuverte(cat);
}
/* { matId: { rep, fin } } d'apres les reparations effectuees, datees de piece */
function calculerProlongations(reparations) {
  var res = {};
  if (!prolongationDisponible()) return res;
  (reparations || []).forEach(function (r) {
    if (!r.date_effectuee || !r.date_fabrication_piece || !Number(r.duree_vie_piece_mois)) return;
    var cle = (toDate(r.date_effectuee) || 0) - 0;
    var actuel = res[r.materiel];
    if (actuel && (actuel.cle > cle || (actuel.cle === cle && actuel.rep.id > r.id))) return;
    res[r.materiel] = { rep: r, cle: cle, fin: finDepuis(r.date_fabrication_piece, r.duree_vie_piece_mois) };
  });
  return res;
}
/* "prolongee le 07/10/2026 par remplacement de : sangle (initialement
   31/12/2026)" -- la premiere question posee lors d'un controle. */
function texteProlongation(p) {
  if (!p) return '';
  var r = p.rep;
  return 'prolong\u00e9e le ' + fmtDate(r.date_effectuee) +
    (r.pieces_remplacees ? ' par remplacement de\u00a0: ' + r.pieces_remplacees : ' par r\u00e9paration') +
    ' (pi\u00e8ce fabriqu\u00e9e le ' + fmtDate(r.date_fabrication_piece) + ', ' + r.duree_vie_piece_mois + ' mois' +
    (p.initiale ? ' ; initialement 31/12/' + p.initiale.getUTCFullYear() : '') + ')';
}

function finDeVieExemplaire(m, ctx) {
  var p = ctx.prolongation && ctx.prolongation[m.id];
  return p ? p.fin : ctx.finDeVie[m.lot];
}

/* ---------------------- controle des types de colonnes ---------------------- */

/* Une colonne de reference restee en Texte contient "MOU-1" au lieu de 4.
   Les listes l'affichent quand meme (repli sur la valeur brute), mais la fiche
   de vie et la derivation du statut, qui comparent des identifiants, ne
   trouvent plus rien. Symptome muet, consequence grave : un incident ne sort
   plus le materiel du circuit. */
var REFERENCES_ATTENDUES = [
  { key: 'achats',    col: 'fournisseur',    vers: 'FOURNISSEURS' },
  { key: 'lots',      col: 'categorie',      vers: 'CATEGORIES' },
  { key: 'lots',      col: 'achat',          vers: 'ACHATS' },
  { key: 'materiels', col: 'lot',            vers: 'LOTS' },
  { key: 'materiels', col: 'lieu_stockage',  vers: 'LIEUX_STOCKAGE' },
  { key: 'controles', col: 'materiel',       vers: 'MATERIELS' },
  { key: 'controles', col: 'controleur',     vers: 'ADHERENTS' },
  { key: 'emprunts',  col: 'materiel',       vers: 'MATERIELS' },
  { key: 'emprunts',  col: 'adherent',       vers: 'ADHERENTS' },
  { key: 'incidents', col: 'materiel',       vers: 'MATERIELS' }
];

var referencesSignalees = false;

/* Grist renvoie un entier pour une reference valide. Une chaine signifie
   soit que la colonne est restee en Texte, soit qu'une cellule contient une
   valeur sans correspondance (texte alternatif). Ce n'est pas le meme
   probleme et ce n'est pas la meme reparation : on distingue. */
function referencesFautives() {
  return REFERENCES_ATTENDUES.map(function (r) {
    var rows = rawRows[r.key] || [];
    var renseignes = rows.filter(function (x) {
      var v = x[r.col];
      return v !== '' && v !== null && v !== undefined && v !== 0;
    });
    var textes = renseignes.filter(function (x) { return typeof x[r.col] === 'string'; });
    if (!textes.length) return null;
    return {
      table: resolvedNames[r.key], col: r.col, vers: r.vers,
      total: renseignes.length, nb: textes.length,
      entiere: textes.length === renseignes.length,
      exemples: textes.slice(0, 3).map(function (x) { return x[r.col]; })
    };
  }).filter(Boolean);
}

function texteFautive(f) {
  var ex = f.exemples.map(function (v) { return '"' + v + '"'; }).join(', ');
  if (f.entiere) {
    return '  - ' + f.table + '.' + f.col + ' : colonne en TEXTE (' + f.nb + '/' + f.total +
      '), ex. ' + ex + '\n      -> Column Options > Type > Référence vers ' + f.vers;
  }
  return '  - ' + f.table + '.' + f.col + ' : colonne Référence correcte, mais ' + f.nb +
    ' cellule(s) sur ' + f.total + ' sans correspondance, ex. ' + ex +
    '\n      -> corriger ces cellules dans Grist (elles apparaissent en rose)';
}

function verifierReferences() {
  if (referencesSignalees) return;
  var f = referencesFautives();
  if (!f.length) return;
  referencesSignalees = true;
  var entieres = f.filter(function (x) { return x.entiere; });
  afficherErreurGlobale(
    'Colonnes de référence a corriger (' + f.length + ') :\n' +
    f.map(texteFautive).join('\n') +
    (entieres.length
      ? '\n\nUne colonne en TEXTE est invisible pour les fiches de vie et le calcul des statuts.'
      : '\n\nLes colonnes sont du bon type : seules quelques cellules n\'ont pas trouve leur correspondance.')
  );
}

/* ---------------------- statut derive ---------------------- */

/* Le statut n'est pas une donnee : c'est une consequence des faits.
   Une seule regle, un seul endroit. Toute la synchronisation manuelle
   qui existait auparavant (12 chemins d'ecriture) disparait avec. */
/* Ajoute la remarque humaine (commentaire ou description) a une raison courte,
   uniquement si elle existe : c'est ce qui rend une raison consultable partout
   ou elle s'affiche (fiche de l'exemplaire, tableau du lot, listes) plutot que
   seulement dans les tableaux d'historique ou elle a ete saisie. */
function avecNote(base, note) {
  return base + ((note || '').trim() ? ' \u2014 ' + note.trim() : '');
}

function deriverStatut(m, ctx) {
  var dc = ctx.dernierControle[m.id];

  if (m.hors_service_motif) {
    var commentM = aColonne('materiels', 'commentaire') ? m.commentaire : '';
    return { statut: STATUT_SELON_MOTIF[m.hors_service_motif] || 'Reforme',
             raison: avecNote(m.hors_service_motif + (m.hors_service_date ? ' le ' + fmtDate(m.hors_service_date) : ''), commentM) };
  }
  if (dc && dc.resultat === 'Reforme') {
    return { statut: 'Reforme', raison: avecNote('Contrôle du ' + fmtDate(dc.date_controle) + ' : reforme', dc.commentaire) };
  }
  if (ctx.rebutImmediat[m.id]) {
    return { statut: 'Reforme', raison: avecNote('Mise au rebut après incident du ' + fmtDate(ctx.rebutImmediat[m.id].date_incident), ctx.rebutImmediat[m.id].description) };
  }
  /* n'existe que si une duree de vie est renseignee : le metallique
     n'a pas de fin de vie calendaire, il ne sort que par le controle */
  var fin = finDeVieExemplaire(m, ctx);
  /* Exception (2026.5.6) : fin de vie atteinte, MAIS une reparation est en
     cours dans une categorie ou elle peut prolonger la duree de vie (sangle
     de degaine a changer) -> l'exemplaire est "En reparation", pas reforme :
     c'est justement la reparation qui decidera de sa nouvelle fin de vie. */
  var finLevable = fin && fin < ctx.now && ctx.reparationEnCours[m.id] &&
    prolongationOuverte(categorieDeMateriel(m));
  if (fin && fin < ctx.now && !finLevable) {
    /* calendaire : la SEULE reforme qu'une reparation prolongeante peut lever */
    return { statut: 'Reforme', raison: 'Fin de vie atteinte le 31/12/' + fin.getUTCFullYear(), calendaire: true };
  }
  var pret = ctx.pretOuvert[m.id];
  if (pret) {
    return { statut: 'Prete', raison: 'Prete a ' + (ctx.adhMap[pret.adherent] || '?') +
             ' depuis le ' + fmtDate(pret.date_emprunt) };
  }
  /* La reparation est un fait date, comme l'incident juste apres : voir la
     construction de ctx.reparationEnCours / reparationAttenteControle dans
     load(). Elle est verifiee avant l'incident "en attente" pour que le motif
     affiche a l'utilisateur soit le plus specifique des deux quand ils
     coincident (rare, mais un objet ecarte pour reparation ne doit pas
     afficher "en attente d'examen" si la reparation elle-meme est l'action
     en cours). */
  var rep = ctx.reparationEnCours[m.id];
  if (rep) {
    return { statut: 'En reparation', raison: avecNote(
      'Retire pour réparation le ' + fmtDate(rep.date_declaree), rep.motif) };
  }
  var inc = ctx.incidentEnAttente[m.id];
  if (inc) {
    return { statut: 'Examen requis', raison: avecNote('Incident du ' + fmtDate(inc.date_incident) + ' en attente de contrôle', inc.description) };
  }
  var repFaite = ctx.reparationAttenteControle[m.id];
  if (repFaite) {
    return { statut: 'Examen requis', raison: avecNote(
      'Reparation du ' + fmtDate(repFaite.date_effectuee) + ' effectuée'
      + (repFaite.intervenant ? ' (' + repFaite.intervenant + ')' : '')
      + ' : contrôle requis avant remise en service', repFaite.description) };
  }
  if (dc && dc.resultat === 'A surveiller') {
    return { statut: 'Examen requis', raison: avecNote('Contrôle du ' + fmtDate(dc.date_controle) + ' : examen requis', dc.commentaire) };
  }
  return { statut: 'En service', raison: '' };
}

/* Controle annuel echu : on alerte, on ne bloque pas.
   Un club de benevoles ne peut pas s'arreter parce qu'un registre a pris du retard. */
function controleEchu(m, ctx) {
  /* En mode "routine" (CONFIG.mode_prochain_controle), seul un controle de
     routine fait avancer l'echeance : un controle force par un incident ou
     une reparation ne doit pas masquer artificiellement un lot qui aurait,
     sans lui, besoin d'un controle groupe. deriverStatut() garde lui
     ctx.dernierControle (n'importe quel controle) : c'est une question
     differente, le RESULTAT du dernier controle compte toujours quel qu'il
     soit, seule l'ECHEANCE suit desormais une regle a part. */
  var routine = CONFIG.mode_prochain_controle === 'routine';
  var dc = routine ? ctx.dernierControleRoutine[m.id] : ctx.dernierControle[m.id];
  var jamais = !dc || !dc.date_controle;
  /* Le premier controle est du 12 mois apres la mise en service : un materiel
     neuf jamais controle n'est PAS echu. Chaine de repli : dernier controle,
     sinon mise en service, sinon fabrication du lot. */
  var base = jamais
    ? (toDate(m.date_mise_en_service) || ctx.fabricationLot[m.lot] || null)
    : toDate(dc.date_controle);
  if (!base) {
    /* aucune date connue : impossible de dater l'echeance, on reste prudent */
    return { echu: true, jamais: jamais, limite: null };
  }
  var limite = new Date(Date.UTC(base.getUTCFullYear() + 1, base.getUTCMonth(), base.getUTCDate()));
  return { echu: limite < ctx.now, jamais: jamais, limite: limite };
}

/* ---------------------- lecture des tables ---------------------- */

async function fetchAny(key, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    try {
      var t = await grist.docApi.fetchTable(candidates[i]);
      resolvedNames[key] = candidates[i];
      colonnesConnues[key] = Object.keys(t);
      return t;
    } catch (e) { /* nom suivant */ }
  }
  missingTables.push(candidates[0]);
  console.error('Table introuvable parmi : ' + candidates.join(', '));
  return { id: [] };
}

/* Table FACULTATIVE : absente => la fonctionnalite est simplement inactive,
   aucune alerte (contrairement a fetchAny qui signale un manque). */
async function fetchOptionnel(key, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    try {
      var t = await grist.docApi.fetchTable(candidates[i]);
      resolvedNames[key] = candidates[i];
      colonnesConnues[key] = Object.keys(t);
      return t;
    } catch (e) { /* nom suivant */ }
  }
  return { id: [] };
}

/* Lit la table CONFIG si elle existe (cle, valeur). Table absente => defauts.
   On ne signale pas son absence : elle est facultative par conception. */
async function chargerConfig() {
  configDiag = null; configRows = [];   /* repli propre si la table a disparu */
  var noms = ['CONFIG', 'Config', 'config', 'PARAMETRES', 'Parametres'];
  for (var i = 0; i < noms.length; i++) {
    try {
      var t = await grist.docApi.fetchTable(noms[i]);
      /* manualSort (ordre des lignes, numerique) et gristHelper_* sont des
         colonnes TECHNIQUES de Grist, renvoyees par fetchTable. Dans une table
         CONFIG vide (archive sans donnees), manualSort ne contenait rien, n'etait
         donc pas reconnue comme numerique, et etait prise pour la colonne des
         valeurs : Grist refusait alors d'y ecrire du texte ("'<' not supported
         between instances of 'float' and 'str'", 08/10). On les exclut. */
      var cols = Object.keys(t).filter(function (c) {
        return c !== 'id' && c !== 'manualSort' && c.indexOf('gristHelper_') !== 0;
      });
      if (cols.length < 2) continue;

      /* On ne se fie pas au nom exact des colonnes (libelle vs identifiant,
         majuscule, accent varient selon les clubs) : on identifie la colonne
         des cles comme celle qui contient le plus de cles connues de CONFIG,
         et la colonne des valeurs comme l'autre. Robuste a tout renommage. */
      var clesConnues = Object.keys(CONFIG);
      function toutNumerique(c) {
        var vus = t[c].filter(function (v) { return String(v == null ? '' : v).trim() !== ''; });
        return vus.length > 0 && vus.every(function (v) { return /^\d+$/.test(String(v).trim()); });
      }
      var score = cols.map(function (c) {
        var n = 0;
        t[c].forEach(function (v) {
          if (clesConnues.indexOf(String(v == null ? '' : v).trim()) !== -1) n++;
        });
        /* une colonne entierement numerique (souvent un id) ne peut pas etre
           la colonne des cles : on l'ecarte d'office */
        return { col: c, n: toutNumerique(c) ? -1 : n };
      }).sort(function (a, b) { return b.n - a.n; });

      var colCle = score[0].n > 0 ? score[0].col : null;
      /* repli : si rien ne matche (cles mal orthographiees), on tente les
         noms usuels pour au moins tenter une lecture */
      if (!colCle) {
        colCle = ['cle', 'Cle', 'key', 'parametre', 'Parametre'].filter(function (c) { return cols.indexOf(c) !== -1; })[0];
      }
      if (!colCle) continue;
      /* la colonne des valeurs : la premiere autre colonne qui n'est pas
         entierement numerique (evite de prendre un id pour des valeurs) */
      /* noms usuels d'abord : decisif quand la table est vide (rien a analyser) */
      var colVal = ['valeur', 'Valeur', 'value', 'Value'].filter(function (c) {
                     return c !== colCle && cols.indexOf(c) !== -1; })[0]
                || cols.filter(function (c) { return c !== colCle && !toutNumerique(c); })[0]
                || cols.filter(function (c) { return c !== colCle; })[0];
      if (!colVal) continue;

      var rows = rowsOf(t);
      configRows = rows.map(function (r) {
        return { id: r.id, cle: String(r[colCle] == null ? '' : r[colCle]).trim(), valeur: r[colVal] };
      });
      var appliquees = 0, inconnues = [];
      rows.forEach(function (r) {
        var k = String(r[colCle] == null ? '' : r[colCle]).trim();
        var v = r[colVal];
        if (!k) return;
        if (!(k in CONFIG)) { inconnues.push(k); return; }
        if (v !== null && v !== undefined && String(v).trim() !== '') {
          CONFIG[k] = String(v).trim();
          appliquees++;
        }
      });
      configDiag = { table: noms[i], colCle: colCle, colVal: colVal,
                     appliquees: appliquees, inconnues: inconnues };
      return;
    } catch (e) { /* table suivante, ou aucune : on garde les defauts */ }
  }
}

async function load() {
  missingTables.length = 0;
  await chargerConfig();
  var t = await Promise.all([
    fetchAny('categories', ['CATEGORIES', 'Categories', 'categories']),
    fetchAny('lieux', ['LIEUX_STOCKAGE', 'Lieux_stockage', 'Lieux_Stockage', 'lieux_stockage']),
    fetchAny('fournisseurs', ['FOURNISSEURS', 'Fournisseurs', 'fournisseurs']),
    fetchAny('adherents', ['ADHERENTS', 'Adherents', 'adherents']),
    fetchAny('achats', ['ACHATS', 'Achats', 'achats']),
    fetchAny('lots', ['LOTS', 'Lots', 'lots']),
    fetchAny('materiels', ['MATERIELS', 'Materiels', 'materiels']),
    fetchAny('controles', ['CONTROLES', 'Controles', 'controles']),
    fetchAny('emprunts', ['EMPRUNTS', 'Emprunts', 'emprunts']),
    fetchAny('incidents', ['INCIDENTS', 'Incidents', 'incidents'])
  ]);

  var catRows = rowsOf(t[0]), lieuRows = rowsOf(t[1]), fourRows = rowsOf(t[2]),
      adhRows = rowsOf(t[3]), achRows = rowsOf(t[4]), lotRows = rowsOf(t[5]),
      matRows = rowsOf(t[6]), ctrlRows = rowsOf(t[7]), empRows = rowsOf(t[8]),
      incRows = rowsOf(t[9]);

  refLists.categories = catRows;
  refLists.lieux = lieuRows;
  refLists.fournisseurs = fourRows;
  refLists.adherents = adhRows;
  refLists.achats = achRows;

  if (!choixCharges) {
    choixCharges = true;
    /* Bloquant, mais une seule fois par chargement de page (garde) : garantit que TOUS
       les panneaux, y compris ceux rendus des ce load, partent avec les bons choix. */
    var _choix = await Promise.all([
      chargerChoixColonne('adherents', 'role', ROLES_DEFAUT),
      chargerChoixColonne('achats', 'financement', FINANCEMENT_DEFAUT),
      aColonne('controles','type_controle')
        ? chargerChoixColonne('controles','type_controle',TYPE_CONTROLE_DEFAUT)
        : Promise.resolve(null)
    ]);
    roleChoices.length=0; _choix[0].forEach(function(c){roleChoices.push(c);});
    financementChoices.length=0; _choix[1].forEach(function(c){financementChoices.push(c);});
    if (_choix[2]) { typeControleChoices.length=0; _choix[2].forEach(function(c){typeControleChoices.push(c);}); }
  }
  refLists.lots = lotRows;
  refLists.materiels = matRows;

  rawRows.lots = lotRows;
  rawRows.materiels = matRows;
  rawRows.emprunts = empRows;
  rawRows.controles = ctrlRows;
  rawRows.incidents = incRows;
  rawRows.achats = achRows;
  rawRows.categories = catRows;
  rawRows.lieux = lieuRows;
  rawRows.fournisseurs = fourRows;
  rawRows.adherents = adhRows;

  var tDem = await fetchOptionnel('demandes', ['DEMANDES', 'DEMANDES_EMPRUNT', 'Demandes', 'demandes']);
  rawRows.demandes = rowsOf(tDem);

  /* Table facultative : le club qui ne l'a pas creee garde le comportement
     d'avant l'evolution reparation (le resultat "A reparer" et la suite
     "Reparation a prevoir" restent saisissables, mais aucune ligne de suivi
     n'est tenue et deriverStatut() ne trouvera jamais de reparation en cours -
     voir la garde plus bas). */
  var tRep = await fetchOptionnel('reparations', ['REPARATIONS', 'Reparations', 'reparations']);
  rawRows.reparations = rowsOf(tRep);

  /* Table facultative ENTRETIENS (nettoyage, lavage, desinfection) : simple
     declaration datee, sans effet sur le statut ni sur l'echeance de
     controle. Absente = sous-onglet et sections masques. On efface d'abord
     le nom resolu : fetchOptionnel ne le pose qu'en cas de succes, et une
     table supprimee entre deux chargements ne doit pas rester "connue". */
  delete resolvedNames.entretiens;
  var tEnt = await fetchOptionnel('entretiens', ['ENTRETIENS', 'Entretiens', 'entretiens']);
  rawRows.entretiens = rowsOf(tEnt);

  /* Structure du document (2026.5.27) : cree ce qui est nouveau depuis la derniere mise a
     jour ; si quelque chose a ete cree, on recharge pour que tout le reste en tienne compte. */
  if (await assurerStructure()) return load();

  var catMap = mapById(catRows, 'nom');
  var lieuMap = mapById(lieuRows, 'nom');
  var fourMap = mapById(fourRows, 'nom');
  var adhMap = mapById(adhRows, 'nom_complet');
  var matMap = mapById(matRows, 'numero_marquage');
  var lotMap = mapById(lotRows, 'designation');

  var now = new Date();
  var soon = new Date(); soon.setDate(soon.getDate() + 90);
  var unAnPlusTard = new Date(); unAnPlusTard.setFullYear(unAnPlusTard.getFullYear() + 1);

  /* --- index necessaires a la derivation du statut --- */
  var ctx = { now: now, adhMap: adhMap, dernierControle: {}, pretOuvert: {},
              incidentEnAttente: {}, rebutImmediat: {}, finDeVie: {},
              reparationEnCours: {}, reparationAttenteControle: {},
              dernierControleRoutine: {} };
  ctx.prolongation = calculerProlongations(rawRows.reparations);

  ctx.fabricationLot = {};
  lotRows.forEach(function (l) {
    ctx.finDeVie[l.id] = finDeVieLot(l);
    ctx.fabricationLot[l.id] = toDate(l.date_fabrication);
  });

  ctrlRows.forEach(function (c) {
    var d = toDate(c.date_controle);
    var actuel = ctx.dernierControle[c.materiel];
    if (!actuel || (d && d >= toDate(actuel.date_controle))) ctx.dernierControle[c.materiel] = c;
  });

  /* Pour l'option "routine" (mode_prochain_controle) : le dernier controle
     DE ROUTINE, pas n'importe lequel. Un controle sans type_controle rempli
     compte comme routine par defaut — sinon un historique ancien, cree avant
     que la colonne existe, bloquerait le calcul au lieu de le laisser
     fonctionner des le premier jour (choix assume avec l'utilisateur). Ne
     sert que si le club a active ce mode ; sans effet et sans cout sinon. */
  ctrlRows.forEach(function (c) {
    var typeCtrl = (c.type_controle || '').trim();
    var estRoutine = !typeCtrl || typeCtrl === typeControleChoices[0];
    if (!estRoutine) return;
    var d = toDate(c.date_controle);
    var actuel = ctx.dernierControleRoutine[c.materiel];
    if (!actuel || (d && d >= toDate(actuel.date_controle))) ctx.dernierControleRoutine[c.materiel] = c;
  });

  empRows.forEach(function (e) {
    if (!e.date_retour_effective && e.materiel) ctx.pretOuvert[e.materiel] = e;
  });

  incRows.forEach(function (i) {
    if (!i.materiel) return;
    if (i.suite === 'Sans suite') return;
    if (i.suite === 'Mise au rebut immediate') { ctx.rebutImmediat[i.materiel] = i; return; }
    var di = toDate(i.date_incident);
    var dc = ctx.dernierControle[i.materiel];
    var traite = dc && di && memeJourOuApres(toDate(dc.date_controle), di);
    if (!traite) ctx.incidentEnAttente[i.materiel] = i;
  });

  /* La reparation suit le meme principe que l'incident : c'est un fait daté,
     pas un statut saisi. On ne retient que la DERNIERE ligne REPARATIONS de
     chaque exemplaire (comme dernierControle) : un objet reparé deux fois
     dans sa vie ne doit pas rester coince sur un episode clos par une ligne
     plus ancienne restee ouverte par erreur. */
  var dernierReparation = {};
  rawRows.reparations.forEach(function (r) {
    if (!r.materiel) return;
    var actuel = dernierReparation[r.materiel];
    var d = toDate(r.date_declaree);
    if (!actuel || (d && d >= toDate(actuel.date_declaree))) dernierReparation[r.materiel] = r;
  });
  Object.keys(dernierReparation).forEach(function (matId) {
    var r = dernierReparation[matId];
    if (!r.date_effectuee) { ctx.reparationEnCours[matId] = r; return; }
    var dr = toDate(r.date_effectuee);
    var dc = ctx.dernierControle[matId];
    var traite = dc && dr && memeJourOuApres(toDate(dc.date_controle), dr);
    if (!traite) ctx.reparationAttenteControle[matId] = r;
  });

  /* --- derivation : une seule fois, pour tout le monde --- */
  matRows.forEach(function (m) {
    var d = deriverStatut(m, ctx);
    m._statut = d.statut;
    m._raison = d.raison;
    /* personne qui a l'exemplaire en ce moment (recherche de l'onglet Materiel, 2026.5.28) */
    var poE = ctx.pretOuvert[m.id];
    m._emprunteur = poE ? (ctx.adhMap[poE.adherent] || '') : '';
    m._reformeCalendaire = !!d.calendaire;
    var ce = controleEchu(m, ctx);
    m._controleEchu = ce.echu;
    m._jamaisControle = ce.jamais;
    m._limiteControle = ce.limite;
    /* vetuste : fin de vie dans moins de 90 jours (et pas deja sorti). Fin de
       vie PROPRE a l'exemplaire : celle du lot, sauf reparation prolongeante. */
    var fin = finDeVieExemplaire(m, ctx);
    m._finDeVie = fin;
    var pr = ctx.prolongation[m.id];
    m._prolongation = pr ? { rep: pr.rep, fin: pr.fin, initiale: ctx.finDeVie[m.lot] } : null;
    m._vetuste = !!(fin && fin <= soon && HORS_STOCK.indexOf(m._statut) === -1);
  });

  /* Calculee ici (une seule fois, juste apres la derivation des statuts) pour
     alimenter a la fois la carte "En reparation" de la Vue d'ensemble
     (plus bas) et le sous-onglet Reparations (bien plus bas, avec
     Controles/Incidents) : pas de recalcul redondant entre les deux. */
  var enReparation = matRows.filter(function (m) { return m._statut === 'En reparation'; })
    .map(function (m) {
      var cat = categorieDeMateriel(m);
      var rep = reparationOuverteDe(m.id);
      return {
        matId: m.id, marquage: m.numero_marquage || ('#' + m.id),
        categorie: (cat && cat.nom) || '-',
        dateDeclaree: rep ? rep.date_declaree : null,
        motif: rep ? (rep.motif || '') : ''
      };
    })
    .sort(function (a, b) { return (toDate(a.dateDeclaree) || 0) - (toDate(b.dateDeclaree) || 0); });

  /* --- filtrage (affichage seul : la derivation a deja vu toutes les donnees) --- */
  function passeFiltre(m) {
    var lot = lotRows.filter(function (l) { return l.id === m.lot; })[0];
    if (filtresMat.q) {
      var cible = (m.numero_marquage || '') + ' ' + (m.numero_serie || '') + ' ' +
        (lot ? lot.designation + ' ' + (lot.fabricant || '') + ' ' + (lot.modele || '') : '') + ' ' + (m._emprunteur || '');
      if (!correspondRecherche(filtresMat.q, cible)) return false;
    }
    if (filtresMat.cat && (!lot || String(lot.categorie) !== filtresMat.cat)) return false;
    if (filtresMat.lieu && String(m.lieu_stockage || '') !== filtresMat.lieu) return false;
    if (filtresMat.statut && m._statut !== filtresMat.statut) return false;
    if (filtresMat.echu && !m._controleEchu) return false;
    if (filtresMat.vetuste && !m._vetuste) return false;
    return true;
  }
  var visibles = matRows.filter(passeFiltre);
  var filtreActif = !!(filtresMat.q || filtresMat.cat || filtresMat.lieu || filtresMat.statut || filtresMat.echu || filtresMat.vetuste);

  /* on memorise exactement ce qui est affiche : l'export s'appuie dessus */
  var versInventaire = function (m) {
    var lot = lotRows.filter(function (l) { return l.id === m.lot; })[0] || {};
    var dc = ctx.dernierControle[m.id];
    /* Le "prochain controle" affiche suit la meme regle que controleEchu() :
       dernier controle de routine en mode "routine", n'importe lequel sinon.
       dc lui-meme (resultat, date affichee) reste "n'importe quel controle",
       c'est un fait different — voir le commentaire dans controleEchu(). */
    var dcProchain = CONFIG.mode_prochain_controle === 'routine' ? ctx.dernierControleRoutine[m.id] : dc;
    var prochain = dcProchain && dcProchain.date_controle
      ? new Date(Date.UTC(toDate(dcProchain.date_controle).getUTCFullYear() + 1,
                          toDate(dcProchain.date_controle).getUTCMonth(),
                          toDate(dcProchain.date_controle).getUTCDate()))
      : null;
    var fin = m._finDeVie !== undefined ? m._finDeVie : ctx.finDeVie[m.lot];
    return {
      marquage: m.numero_marquage || '', serie: m.numero_serie || '', lot: lot.designation || '',
      categorie: catMap[lot.categorie] || '', fabricant: lot.fabricant || '', modele: lot.modele || '',
      lieu: lieuMap[m.lieu_stockage] || '', miseEnService: fmtDate(m.date_mise_en_service),
      finDeVie: fin ? '31/12/' + fin.getUTCFullYear() : 'Selon controle',
      statut: m._statut, raison: m._raison || '',
      dernierControle: dc ? fmtDate(dc.date_controle) : '',
      resultatControle: dc ? (dc.resultat || '') : 'jamais contrôle',
      prochainControle: prochain ? fmtDate(prochain) : '',
      echu: m._controleEchu ? 'oui' : 'non',
      prix: lot.prix_unitaire || '',
      /* details de l'exemplaire (2026.5.25) : inventaire imprime, CSV, Excel */
      couleur: m.couleur || '', taille: m.taille || '', commentaire: m.commentaire || '',
      id: m.id, lotId: lot.id, nbPhotos: aColonne('materiels', 'photo') ? (idsPiecesJointes(m.photo).length || '') : '',
      dateFab: lot.date_fabrication ? fmtDate(lot.date_fabrication) : '', dureeLot: lot.duree_vie_mois || '',
      sortieParc: (function () { var d = dateSortieParc(m); return d ? fmtDate(d) : ''; })(),
      decoupable: decoupeOuverte(categorieDeMateriel(m))
    };
  };
  inventaireVisible = visibles.map(versInventaire);
  inventaireTout = filtreActif ? matRows.map(versInventaire) : inventaireVisible;

  /* --- agregation par lot --- */
  var lots = {};
  lotRows.forEach(function (l) {
    var fin = ctx.finDeVie[l.id];
    lots[l.id] = {
      row: l, fin: fin,
      finLabel: fin ? String(fin.getUTCFullYear()) : 'Selon controle',
      alerte: false,   /* recalcule par exemplaire apres agregation (2026.5.6) */
      nbVetuste: 0, nbFinAnnee: 0, nbProlonges: 0,
      incoherent: !!(Number(l.duree_vie_mois) && categorieNonSoumise(l.categorie)),
      items: [], enStock: 0, dispo: 0, prete: 0, horsStock: 0, reforme: 0, perdu: 0,
      vole: 0, cede: 0, enControle: 0, enReparation: 0, echus: 0, jamais: 0
    };
  });
  lots._none = {
    row: { designation: 'Sans lot', fabricant: '', categorie: null, prix_unitaire: null },
    fin: null, finLabel: '-', alerte: false, nbVetuste: 0, nbFinAnnee: 0, nbProlonges: 0,
    items: [], enStock: 0, dispo: 0, prete: 0, horsStock: 0, reforme: 0, perdu: 0,
    vole: 0, cede: 0, enControle: 0, enReparation: 0, echus: 0, jamais: 0
  };

  lotOfMateriel = {};
  matRows.forEach(function (m) { lotOfMateriel[m.id] = (m.lot && lots[m.lot]) ? m.lot : null; });
  visibles.forEach(function (m) {
    var key = (m.lot && lots[m.lot]) ? m.lot : '_none';
    var L = lots[key];
    L.items.push(m);
    if (HORS_STOCK.indexOf(m._statut) !== -1) {
      L.horsStock++;
      if (m._statut === 'Reforme') L.reforme++;
      else if (m._statut === 'Vole') L.vole++;
      else if (m._statut === 'Cede') L.cede++;
      else L.perdu++;
    } else {
      L.enStock++;
      if (m._statut === 'Prete') L.prete++;
      else if (m._statut === 'Examen requis') L.enControle++;
      else if (m._statut === 'En reparation') L.enReparation++;
      else if (m._statut === 'En service') L.dispo++;
      if (m._controleEchu) L.echus++;
      if (m._controleEchu && m._jamaisControle) L.jamais++;
      /* compteurs PAR EXEMPLAIRE : un exemplaire prolonge par reparation ne
         doit ni declencher l'alerte de vetuste du lot, ni compter dans le
         budget de renouvellement (2026.5.6) */
      if (m._vetuste) L.nbVetuste++;
      if (m._finDeVie && m._finDeVie <= unAnPlusTard) L.nbFinAnnee++;
    }
    if (m._prolongation) L.nbProlonges++;
  });
  Object.keys(lots).forEach(function (k) { lots[k].alerte = lots[k].nbVetuste > 0; });

  /* un lot sans exemplaire visible n'a rien a montrer quand un filtre est actif */
  var lotKeys = Object.keys(lots).filter(function (k) {
    if (filtreActif) return lots[k].items.length > 0;
    return lots[k].items.length > 0 || k !== '_none';
  });

  /* Regroupe les lots par categorie plutot que par ordre chronologique
     d'achat (l'ordre naturel des cles numeriques Grist) : plus simple de
     retrouver "tous nos mousquetons" quand ils sont voisins, meme achetes
     a des annees d'intervalle. Tri stable (garanti par le moteur JS
     depuis ES2019) : a l'interieur d'une meme categorie, l'ordre
     chronologique d'origine est conserve tel quel, rien d'autre ne change.
     "Sans lot" toujours en dernier : ce n'est pas une vraie categorie. */
  lotKeys.sort(function (a, b) {
    if (a === '_none') return 1;
    if (b === '_none') return -1;
    var nomCatA = catMap[lots[a].row.categorie] || '';
    var nomCatB = catMap[lots[b].row.categorie] || '';
    return nomCatA.localeCompare(nomCatB, 'fr');
  });

  var totalMateriels = matRows.length;
  /* meme perimetre que la valeur du parc : les reformes et perdus sont a part */
  var enParc = matRows.filter(function (m) { return HORS_STOCK.indexOf(m._statut) === -1; }).length;
  var horsParc = totalMateriels - enParc;
  var valeurParc = 0;
  var alertesCount = 0;


  lotKeys.forEach(function (k) {
    var L = lots[k];
    valeurParc += (Number(L.row.prix_unitaire) || 0) * L.enStock;
    alertesCount += L.nbVetuste;
  });

  /* --- emprunts --- */
  var emprunts = empRows.map(function (r) {
    var prevu = toDate(r.date_retour_prevue);
    var retourne = !!r.date_retour_effective;
    return {
      id: r.id, matId: r.materiel, photo: r.photo,
      materiel: matMap[r.materiel] || r.materiel,
      adherent: adhMap[r.adherent] || r.adherent,
      emprunte: fmtDate(r.date_emprunt), prevu: fmtDate(r.date_retour_prevue),
      rendu: fmtDate(r.date_retour_effective),
      tsEmprunt: Number(r.date_emprunt) || 0,
      tsRetour: Number(r.date_retour_effective) || 0,
      sortie: r.sortie_activite || '',
      numero: r.numero_emprunt || '',
      etat: r.etat_retour || '',
      retourne: retourne,
      retard: !retourne && prevu && prevu < now
    };
  });
  var pretsOuverts = emprunts.filter(function (e) { return !e.retourne; });
  var enCours = pretsOuverts.length;                          /* exemplaires sortis */
  var enRetard = emprunts.filter(function (e) { return e.retard; }).length;
  var aNum = aColonne('emprunts', 'numero_emprunt');
  /* un "pret" = un acte d'emprunt = un bon (plusieurs exemplaires). Le compteur
     affiche des bons ; le nombre d'exemplaires passe en sous-titre. */
  var nbBons = aNum ? compterBons(pretsOuverts) : enCours;
  var nbBonsRetard = aNum ? compterBons(emprunts.filter(function (e) { return e.retard; })) : enRetard;

  /* --- controles --- */
  var matLotId = {}; matRows.forEach(function (m) { matLotId[m.id] = m.lot; });
  var controles = ctrlRows.map(function (r) {
    var d = toDate(r.date_controle);
    var prochain = d ? new Date(Date.UTC(d.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate())) : null;
    return {
      id: r.id, matId: r.materiel,
      materiel: matMap[r.materiel] || r.materiel,
      lot: matLotId[r.materiel],
      lotNom: lotMap[matLotId[r.materiel]] || '',
      controleur: adhMap[r.controleur] || r.controleur,
      date: fmtDate(r.date_controle), dateObj: d,
      resultat: r.resultat || '-',
      commentaire: r.commentaire || '',
      typeControle: (aColonne('controles','type_controle') ? r.type_controle || '' : ''),
      photo: r.photo,
      prochain: prochain ? fmtDate(prochain) : '-',
      retard: !!(prochain && prochain < now)
    };
  });
  controles.sort(function (a, b) { return (b.dateObj || 0) - (a.dateObj || 0); });

  var dernierParMateriel = {};
  controles.forEach(function (c) {
    if (!dernierParMateriel[c.matId]) dernierParMateriel[c.matId] = c;
  });
  /* echuParId sert de reference independante pour "est-ce en retard", au lieu
     de relire dernierParMateriel[...].retard (calcule sans tenir compte du
     mode "routine"). On ne mute jamais dernierParMateriel : ses entrees sont
     les MEMES objets que dans controles[], utilises aussi pour l'affichage
     ligne par ligne de l'historique (ou chaque ligne doit garder sa propre
     date +1an, un fait neutre, distinct du calendrier actif de l'exemplaire).
     m._controleEchu et m._jamaisControle sont deja calcules une fois pour
     toutes plus haut, avec la bonne reference (routine ou non). */
  var echuParId = {};
  matRows.forEach(function (m) { echuParId[m.id] = { echu: m._controleEchu, jamais: m._jamaisControle }; });
  /* Listes des exemplaires a controler : ce sont des MATERIELS (pas des
     controles), donc ils n'apparaissent dans aucune ligne d'historique.
     Les cartes cliquables sont le seul moyen de les faire surgir. */
  var matAControler = {};  /* matId -> raison */
  var listeJamais = matRows.filter(function (m) {
    return HORS_STOCK.indexOf(m._statut) === -1 && !dernierParMateriel[m.id] && m._controleEchu;
  });
  var listeRetard = matRows.filter(function (m) {
    if (HORS_STOCK.indexOf(m._statut) !== -1) return false;
    return dernierParMateriel[m.id] && m._controleEchu && !m._jamaisControle;
  });
  var jamaisControle = listeJamais.length;
  var ctrlEnRetard = listeRetard.length;
  /* n°9 : controles a PREVOIR = pas encore echus, mais dont l'echeance tombe dans les JOURS_AVANT_CONTROLE jours.
     Complete "En retard" (deja du) par l'anticipation. Point de depart deja gere par controleEchu
     (dernier controle, sinon mise en service, sinon fabrication du lot). */
  var horizonCtrl = new Date(ctx.now.getTime() + JOURS_AVANT_CONTROLE * 86400000);
  var listeAPrevoir = matRows.filter(function (m) {
    if (HORS_STOCK.indexOf(m._statut) !== -1) return false;
    var lim = m._limiteControle;
    return lim && !m._controleEchu && lim >= ctx.now && lim <= horizonCtrl;
  });
  var ctrlAPrevoir = listeAPrevoir.length;

  /* --- incidents --- */
  var incidents = incRows.map(function (r) {
    var d = toDate(r.date_incident);
    /* un incident est "traite" si un controle du meme exemplaire lui est posterieur
       (au jour calendaire pres — meme regle que ctx.incidentEnAttente, pour que le
       statut du materiel et cette liste ne divergent jamais) */
    var suivi = controles.some(function (c) {
      return c.matId === r.materiel && memeJourOuApres(c.dateObj, d);
    });
    /* la DECISION prise lors du traitement : le dernier controle reel de l'exemplaire
       (meme donnee qui pilote son statut actuel), s'il est bien posterieur a l'incident.
       Sans ca, "Controle realise" ne disait jamais si le materiel avait ete garde ou
       reforme a l'issue du controle. */
    var dcTrait = ctx.dernierControle[r.materiel];
    var resultatTrait = (suivi && dcTrait && memeJourOuApres(toDate(dcTrait.date_controle), d)) ? dcTrait.resultat : '';
    return {
      id: r.id, matId: r.materiel,
      materiel: matMap[r.materiel] || r.materiel,
      date: fmtDate(r.date_incident), dateObj: d,
      gravite: r.gravite || '-',
      description: r.description || '',
      suite: r.suite || '',
      photo: r.photo,
      suivi: suivi,
      resultatTrait: resultatTrait,
      ts: d ? d.getTime() : 0
    };
  });
  incidents.sort(function (a, b) { return (b.dateObj || 0) - (a.dateObj || 0); });
  /* Exemplaires actuellement en reparation : le meme materiau que
     ctx.reparationEnCours (deriverStatut), reconstitue ici sous forme
     d'ensemble pour un test d'appartenance en O(1) par incident. */
  var matIdsEnReparation = {};
  matRows.forEach(function (m) { if (m._statut === 'En reparation') matIdsEnReparation[m.id] = true; });
  /* un incident classe "Sans suite" ou mis au rebut n'attend plus rien :
     le laisser en alerte rouge rendrait le tableau de bord inutilisable.
     Un incident dont l'exemplaire est "En reparation" n'attend pas non plus
     un controle EN CE MOMENT : deriverStatut() donne deja la priorite a la
     reparation sur "Examen requis" pour le statut affiche (m._statut) — sans
     ce filtre, cette liste continuait a le compter "en attente de controle"
     alors que sa fiche affichait "En reparation", et il apparaissait a la
     fois ici et dans l'onglet Reparations. Il n'est pas "cloture" pour
     autant (rien n'a ete decide) : il redevient "en attente" de lui-meme des
     que la reparation est declaree effectuee et que le statut repasse en
     Examen requis (voir ctx.reparationAttenteControle), sans intervention
     supplementaire ici. */
  var incEnAttente = incidents.filter(function (i) {
    return !i.suivi && i.suite !== 'Sans suite' && i.suite !== 'Mise au rebut immediate'
      && !matIdsEnReparation[i.matId];
  });

  /* --- achats --- */
  var achats = achRows.map(function (a) {
    var lotsDeLAchat = lotRows.filter(function (l) { return l.achat === a.id; });
    return {
      id: a.id,
      ref: a.ref_commande || ('#' + a.id),
      fournisseur: fourMap[a.fournisseur] || '-',
      date: fmtDate(a.date_commande),
      montant: Number(a.montant_total) || 0,
      financement: a.financement || '-',
      note: a.note_financement || '',
      lots: lotsDeLAchat.map(function (l) { return l.designation; }).join(', ') || '-',
      facture: a.facture,
      ts: (toDate(a.date_commande) || toDate(a.date_reception) || 0) &&
          (toDate(a.date_commande) || toDate(a.date_reception)).getTime(),
      annee: (function () {
        var d = toDate(a.date_commande) || toDate(a.date_reception);
        return d ? String(d.getUTCFullYear()) : '';
      })()
    };
  });
  var totalAchats = achats.reduce(function (s, a) { return s + a.montant; }, 0);

  var anneeEnCours = now.getUTCFullYear();
  var depenseAnnee = achRows.reduce(function (s, a) {
    var d = toDate(a.date_commande);
    return (d && d.getUTCFullYear() === anneeEnCours) ? s + (Number(a.montant_total) || 0) : s;
  }, 0);

  var renouvellement = 0;
  lotKeys.forEach(function (k) {
    var L = lots[k];
    /* par exemplaire : un exemplaire prolonge par reparation ne se rachete pas */
    if (L.nbFinAnnee) {
      renouvellement += (Number(L.row.prix_unitaire) || 0) * L.nbFinAnnee;
    }
  });

  /* ---------------------- rendu ---------------------- */

  var warn = (missingTables.length && !(etatStructure && etatStructure.sansStructure))
    ? '<div class="badge danger" style="display:block;margin-bottom:12px;padding:8px 12px">Table(s) introuvable(s) : ' +
      missingTables.join(', ') + '. Verifie le nom exact dans Grist.</div>'
    : '';
  warn += bandeauStructureHtml();

  /* Vue d'ensemble */
  var lotsAlerte = lotKeys.filter(function (k) { return lots[k].nbVetuste > 0; });

  var lignesAlerte =
    lotsAlerte.map(function (k) {
      var L = lots[k];
      return '<tr class="alerte-clic" data-go="vetuste"><td>' + L.row.designation + '</td><td>' + L.nbVetuste + ' exemplaire(s) en stock</td>' +
        '<td><span class="badge danger">Fin de vie ' + L.finLabel + '</span></td></tr>';
    }).join('') +
    emprunts.filter(function (e) { return e.retard; }).map(function (e) {
      return '<tr class="alerte-clic" data-go="prets"><td>' + e.materiel + '</td><td>' + e.adherent + ' - retour prévu ' + e.prevu + '</td>' +
        '<td><span class="badge danger">Retour en retard</span></td></tr>';
    }).join('') +
    Object.keys(dernierParMateriel).filter(function (k) {
      var e = echuParId[k];
      return !!(e && e.echu && !e.jamais);
    }).map(function (k) {
      var c = dernierParMateriel[k];
      return '<tr class="alerte-clic" data-go="ctrlretard"><td>' + c.materiel + '</td><td>Dernier controle ' + c.date + '</td>' +
        '<td><span class="badge warn">Contrôle EPI en retard</span></td></tr>';
    }).join('') +
    incEnAttente.map(function (i) {
      return '<tr class="alerte-clic" data-go="incidents"><td>' + i.materiel + '</td><td>Incident du ' + i.date + ' (' + i.gravite + ')</td>' +
        '<td><span class="badge danger">En attente de contrôle</span></td></tr>';
    }).join('') +
    (jamaisControle ? '<tr class="alerte-clic" data-go="ctrljamais"><td>' + jamaisControle + ' exemplaire(s)</td><td>Aucun contrôle enregistré</td>' +
      '<td><span class="badge warn">Controle echu</span></td></tr>' : '');

  document.getElementById('pane-apercu').innerHTML =
    warn +
    checklistPremiersPas() +
    '<div class="cards">' +
      '<div class="card"><p class="label">Matériel en parc</p><p class="value">' + enParc + '</p>' +
        (horsParc ? '<p class="card-sous">+ ' + horsParc + ' reforme(s) ou perdu(s)</p>' : '') + '</div>' +
      '<div class="card"><p class="label">Lots</p><p class="value">' + lotRows.length + '</p></div>' +
      '<div class="card' + (alertesCount ? ' card-clic card-alerte' : '') + '" ' +
        (alertesCount ? 'data-va="vetuste"' : '') + '><p class="label">Alertes vétuste (90j)</p><p class="value">' + alertesCount + '</p>' +
        (alertesCount ? '<p class="card-sous">cliquer pour voir</p>' : '') + '</div>' +
      '<div class="card' + (ctrlAPrevoir ? ' card-clic card-alerte' : '') + '" ' +
        (ctrlAPrevoir ? 'data-va="ctrlaprevoir"' : '') + '><p class="label">Contrôles a prévoir (' + JOURS_AVANT_CONTROLE + 'j)</p><p class="value">' + ctrlAPrevoir + '</p>' +
        (ctrlAPrevoir ? '<p class="card-sous">cliquer pour voir</p>' : '') + '</div>' +
      /* Meme traitement que sur l'onglet Controles : ce chiffre est souvent
         le plus grave de toute la page (un parc jamais controle n'est pas
         une simple statistique), il merite sa propre carte plutot que
         d'etre noye dans une ligne du tableau "A traiter en priorite". */
      '<div class="card' + (jamaisControle ? ' card-clic card-alerte' : '') + '" ' +
        (jamaisControle ? 'data-va="ctrljamais"' : '') + '><p class="label">Jamais contrôles</p><p class="value">' + jamaisControle + '</p>' +
        (jamaisControle ? '<p class="card-sous">cliquer pour voir</p>' : '') + '</div>' +
      '<div class="card' + (enCours ? ' card-clic' : '') + '" ' +
        (enCours ? 'data-va="prets"' : '') + '><p class="label">Prêts en cours</p><p class="value">' + nbBons + '</p>' +
        (enCours ? '<p class="card-sous">' + (aNum ? enCours + ' exemplaire' + (enCours > 1 ? 's' : '') + ' sortis' : 'cliquer pour voir') + '</p>' : '') + '</div>' +
      /* Neutre comme "Prets en cours" (card-clic SANS card-alerte) : une
         reparation en cours n'est pas un probleme a signaler en rouge,
         juste une information qu'on peut vouloir consulter. */
      /* Meme logique que "Prets en cours" (qui detaille bons vs exemplaires) :
         "cliquer pour voir" seul etait la seule carte cliquable sans aucun
         detail specifique en dessous — ici, la ou les categories concernees
         donne une info aussi utile. enReparation est deja transforme (voir
         sa construction plus haut) : matId/marquage/categorie/..., PAS les
         champs bruts du materiel (pas de .lot ici, piege deja tombe dedans
         une fois — categorie est le champ deja resolu et disponible). */
      '<div class="card' + (enReparation.length ? ' card-clic' : '') + '" ' +
        (enReparation.length ? 'data-va="reparations"' : '') + '><p class="label">En reparation</p><p class="value">' + enReparation.length + '</p>' +
        (enReparation.length ? '<p class="card-sous">' + esc((function () {
          var noms = {};
          enReparation.forEach(function (m) { noms[m.categorie || 'Sans cat\u00e9gorie'] = true; });
          var liste = Object.keys(noms);
          return liste.length === 1 ? liste[0] : liste.length + ' cat\u00e9gories concern\u00e9es';
        })()) + '</p>' : '') + '</div>' +
      '<div class="card"><p class="label">Valeur du parc</p><p class="value">' + money(valeurParc) + '</p></div>' +
    '</div>' +
    '<h4 style="margin:0 0 8px;font-size:13px;color:#2C4A3E">A traiter en priorité</h4>' +
    '<table id="tableAlertesPriorite"><tr><th>Objet</th><th>Détail</th><th>Alerte</th></tr>' +
    (lignesAlerte || '<tr><td colspan="3">Aucune alerte</td></tr>') +
    '</table>' +
    /* 2026.5.33 : les exports ont rejoint la rubrique Import / export (un seul emplacement) */
    '<div class="export-parc" id="apercu-export" style="margin-top:20px">' +
      '<button type="button" class="secondary" id="lienDonnees">Exporter / importer des donn\u00e9es \u2192</button>' +
    '</div>' +
    '<details class="repli" style="margin-top:12px"><summary>Statistiques du club (bilan, AG)</summary>' +
      '<div id="apercu-stats"></div>' +
    '</details>' +
    '<details class="repli" style="margin-top:8px"><summary>Remplissage et archivage</summary>' +
      '<div id="apercu-remplissage"></div>' +
    '</details>';
  var repliList = document.querySelectorAll('#pane-apercu details.repli');
  if (repliList[0]) repliList[0].addEventListener('toggle', function () { if (repliList[0].open) renderStatistiques(); });
  if (repliList[1]) repliList[1].addEventListener('toggle', function () { if (repliList[1].open) renderRemplissage(); });
  var bD = document.getElementById('lienDonnees');
  if (bD) bD.onclick = function () { naviguer('donnees'); };

  document.querySelectorAll('#pane-apercu tr.alerte-clic').forEach(function (tr) {
    tr.onclick = function () {
      var g = tr.dataset.go;
      var allerControles = function () { var e = document.querySelector('.tab[data-t="controles"]'); if (e) e.click(); load(); majSousOngletEPI(); };
      if (g === 'vetuste') ouvrirMaterielFiltre({ vetuste: true });
      else if (g === 'prets') { var o = document.querySelector('.tab[data-t="prets"]'); if (o) o.click(); }
      else if (g === 'ctrlretard') { vueControles = 'retard'; sousOngletEPI = 'controles'; allerControles(); }
      else if (g === 'ctrljamais') { vueControles = 'jamais'; sousOngletEPI = 'controles'; allerControles(); }
      else if (g === 'incidents') { sousOngletEPI = 'incidents'; allerControles(); }
    };
  });

  document.querySelectorAll('#pane-apercu .card-clic').forEach(function (c) {
    c.onclick = function () {
      if (c.dataset.va === 'vetuste') ouvrirMaterielFiltre({ vetuste: true });
      else if (c.dataset.va === 'prets') { var o = document.querySelector('.tab[data-t="prets"]'); if (o) o.click(); }
      else if (c.dataset.va === 'ctrlaprevoir') { vueControles = 'aprevoir'; var e = document.querySelector('.tab[data-t="controles"]'); if (e) e.click(); load(); }
      else if (c.dataset.va === 'ctrljamais') { vueControles = 'jamais'; var j = document.querySelector('.tab[data-t="controles"]'); if (j) j.click(); load(); majSousOngletEPI(); }
      else if (c.dataset.va === 'reparations') { sousOngletEPI = 'reparations'; var p = document.querySelector('.tab[data-t="controles"]'); if (p) p.click(); majSousOngletEPI(); }
    };
  });

  /* Materiel : liste groupee par lot */
  function htmlLot(k) {
    var L = lots[k];
    var r = L.row;
    var orphelins = (k === '_none');
    var meta = orphelins
      ? L.items.length + ' exemplaire(s) rattaché(s) a aucun lot'
      : [r.fabricant, catMap[r.categorie], r.modele].filter(Boolean).join(' \u00b7 ') +
        ([r.fabricant, catMap[r.categorie], r.modele].filter(Boolean).length ? ' \u00b7 ' : '') +
        (L.items.length === 1 ? 'exemplaire unique' : 'lot de ' + L.items.length) + ' \u00b7 fin de vie ' + L.finLabel +
        (L.nbProlonges ? ' (' + L.nbProlonges + ' prolong\u00e9' + (L.nbProlonges > 1 ? 's' : '') + ' par r\u00e9paration)' : '');
    return '<div class="lot' + (orphelins ? ' lot-orphelins' : '') + (openLots[k] ? ' open' : '') +
      '" data-lot="' + k + '">' +
      '<div class="lot-head">' +
        '<span class="lot-caret">\u25b6</span>' +
        (orphelins ? '' : '<span class="lot-vignette" id="vignetteLot-' + k + '" hidden></span>') +
        '<span class="lot-title">' + (orphelins ? 'Sans lot' : esc(r.designation)) + '</span>' +
        '<span class="lot-meta">' + meta + '</span>' +
        '<span class="lot-counts">' +
          (L.dispo ? '<span class="badge ok">' + L.dispo + ' dispo</span>' : '') +
          (L.prete ? '<span class="badge info">' + L.prete + ' prete(s)</span>' : '') +
          (L.enControle ? '<span class="badge warn">' + L.enControle + ' examen requis</span>' : '') +
          (L.enReparation ? '<span class="badge repair">' + L.enReparation + ' en reparation</span>' : '') +
          /* Resume au niveau du lot plutot qu'une repetition du meme badge
             sur chaque ligne : uniquement quand la totalite du stock en
             cours du lot partage cet etat (aucune exception), sinon le
             per-ligne reste seul juge — un lot mixte a besoin du detail
             ligne par ligne, un lot uniforme n'a besoin que d'une phrase. */
          (L.jamais && L.jamais === L.enStock
            ? '<span class="badge warn" title="Aucun exemplaire de ce lot n\'a jamais ete controle">' + L.jamais + ' jamais contrôles</span>'
            : '') +
          (L.reforme ? '<span class="badge danger">' + L.reforme + ' reforme(s)</span>' : '') +
          (L.perdu ? '<span class="badge muted">' + L.perdu + ' perdu(s)</span>' : '') +
          (L.vole ? '<span class="badge muted">' + L.vole + ' vole(s)</span>' : '') +
          (L.cede ? '<span class="badge muted">' + L.cede + ' cede(s)</span>' : '') +
          (L.alerte ? '<span class="badge danger">vetuste</span>' : '') +
          (L.incoherent ? '<span class="badge warn" title="Categorie non soumise au vieillissement mais duree de vie renseignee : la reforme calendaire s\'appliquera. Editez le lot pour vider la duree.">duree a verifier</span>' : '') +
          /* Ordre (2026.5.8) : du geste le plus courant au plus rare, le plus
             risque en dernier. Partout dans l'onglet Materiel : avant-dernier
             = Editer, dernier = Supprimer. */
          (k !== '_none' ?
            '<button class="secondary btn-fiche" data-type="lot" data-id="' + k + '">Fiche du lot</button>' +
            /* (2026.5.18) telephone : actions rares derriere "..." ; ailleurs le
               bouton est masque et le conteneur transparent (display: contents) */
            '<button type="button" class="secondary btn-plus-actions" aria-label="Autres actions du lot" aria-expanded="false">\u22ef</button>' +
            '<span class="actions-rares">' +
            '<button class="secondary btn-registre" data-id="' + k + '" title="Toutes les fiches de vie du lot en un PDF">Registre (PDF)</button>' +
            '<button class="secondary btn-scinder-lot" data-id="' + k + '" title="D\u00e9tacher certains exemplaires vers un nouveau lot ou un lot existant">Scinder le lot</button>' +
            btnEditer('lot', k, 'Éditer le lot') +
            btnSupprimer('lot', k) +
            '</span>'
            : '<button class="secondary" id="btnRattacher">Rattacher a un lot</button>') +
        '</span>' +
      '</div>' +
      '<div class="lot-body">' +
        (orphelins ? '' : '<div class="lot-docs" id="lotDocs-' + k + '" hidden></div>') +
        (orphelins
          ? '<p class="hint" style="margin:8px 0 10px">Ces exemplaires n\'appartiennent a aucun lot. ' +
            'Ils n\'ont donc ni fabricant, ni date de fabrication, ni fin de vie, ni prix : ces informations ' +
            'sont portées par le lot. Rattachez-les pour rétablir leur suivi de vétuste.</p>'
          : '') +
        '<table><tr><th>Marquage</th>' +
          (aColonne('materiels','couleur') ? '<th>Couleur</th>' : '') +
          /* "Taille" convient pour S/M/L (baudriers, casques...), mais pas
             pour une corde ou une sangle, ou ce meme champ porte une
             longueur en metres — reutilise tel quel (voir le chantier
             decoupe), juste relabelle ici pour rester lisible sans creer
             un second champ pour la meme donnee. */
          (aColonne('materiels','taille') ? '<th>' + (decoupeOuverte(refLists.categories.filter(function (c) { return c.id === r.categorie; })[0]) ? 'Longueur' : 'Taille') + '</th>' : '') +
          '<th>Lieu</th><th>Mise en service</th><th>Statut</th><th></th></tr>' +
        L.items.map(function (m) {
          var horsService = HORS_STOCK.indexOf(m._statut) !== -1;
          var cls = classeStatut(m._statut);
          return '<tr' + (horsService ? ' style="opacity:.5"' : '') + '>' +
            '<td><span class="badge-ref badge-clic" data-mat="' + m.id + '" title="Ouvrir la fiche"' +
              (horsService ? ' style="text-decoration:line-through;background:var(--muted-fg)"' : '') + '>' +
              esc(m.numero_marquage || '-') + '</span></td>' +
            (aColonne('materiels','couleur') ? '<td>' + esc(m.couleur || '-') + '</td>' : '') +
            (aColonne('materiels','taille') ? '<td>' + esc(m.taille || '-') + '</td>' : '') +
            '<td>' + (lieuMap[m.lieu_stockage] || '-') + '</td>' +
            '<td>' + fmtDate(m.date_mise_en_service) + '</td>' +
            '<td>' +
              /* badge statut : cliquable selon contexte */
              (m._statut === 'Examen requis'
                ? '<span class="badge warn badge-action" data-mat="' + m.id + '" data-action="controler" title="Cliquer pour ouvrir le formulaire de contrôle" style="cursor:pointer">' + m._statut + '</span>'
                : m._statut === 'En reparation'
                  ? '<span class="badge repair badge-action" data-mat="' + m.id + '" data-action="reparation" title="Cliquer pour voir dans Réparations" style="cursor:pointer">' + m._statut + '</span>'
                  : m._statut === 'Prete'
                  ? (function () {
                      var pe = rawRows.emprunts.filter(function (e) { return e.materiel === m.id && !e.date_retour_effective; })[0];
                      var bon = pe && aColonne('emprunts', 'numero_emprunt') ? pe.numero_emprunt : null;
                      return '<span class="badge info badge-goto-pret" data-mat="' + m.id + '"' +
                        (bon ? ' data-bon="' + esc(bon) + '"' : '') +
                        ' title="Cliquer pour voir le bon de prêt" style="cursor:pointer">Prete</span>';
                    })()
                  : '<span class="badge ' + cls + '">' + m._statut + '</span>') +
              /* badge controle echu : cliquable -> bascule sur Contrôles, incidents et reparations.
                 Supprime ligne par ligne quand le resume du lot (ci-dessus) couvre deja TOUT
                 le stock — inutile de repeter "jamais controle" dix fois si le badge d'en-tete
                 dit deja "10 jamais controles" ; L.jamais === L.enStock garantit qu'aucun
                 exemplaire de ce lot n'est dans le cas "echu mais pas jamais" (juste en retard),
                 donc rien n'est perdu en le masquant ici. */
              (m._controleEchu && !horsService && !(L.jamais && L.jamais === L.enStock)
                ? ' <span class="badge warn badge-goto-ctrl" data-mat="' + m.id + '" title="Cliquer pour aller au suivi des contrôles" style="cursor:pointer">' +
                  (m._jamaisControle ? 'Jamais controle' : 'Controle echu') + '</span>' : '') +
              (m._raison && m._raison !== m._statut ? '<div class="raison">' + esc(m._raison) + '</div>' : '') +
            '</td>' +
            '<td class="td-actions"><div>' +
              /* bouton Contrôler contextuel : uniquement si examen requis */
              (m._statut === 'Examen requis'
                ? '<button class="secondary btn-controler-rapide" data-mat="' + m.id + '">Contrôler</button>'
                : '') +
              /* meme principe pour la reparation, label court (comme "Controler")
                 pour ne pas deborder cette colonne deja etroite : le libelle
                 complet "Declarer la reparation effectuee" reste sur la fiche,
                 ou l'espace est plus genereux. */
              (m._statut === 'En reparation'
                ? '<button class="secondary btn-reparation-rapide" data-mat="' + m.id + '">R\u00e9parer</button>'
                : '') +
              (estPerduOuVole(m.hors_service_motif) && HORS_STOCK.indexOf(m._statut) !== -1
                ? '<button class="secondary btn-retrouve-rapide" data-mat="' + m.id + '">Retrouv\u00e9</button>'
                : '') +
              '<button class="secondary btn-fiche" data-type="materiel" data-id="' + m.id + '">Fiche de vie</button>' +
              btnEditer('materiel', m.id, "Éditer l'exemplaire") +
              btnSupprimer('materiel', m.id) +
            '</div></td></tr>';
        }).join('') +
        '</table>' +
      '</div>' +
    '</div>';
  }

  /* Partition : un lot reste ACTIF tant qu'il a au moins un exemplaire en stock (ou s'il est encore
     vide). Il ne descend dans le volet repliable que lorsque TOUS ses exemplaires sont hors service
     — la seule situation ou il n'y a plus rien a decider. Un lot qui se reforme peu a peu reste donc
     visible : voir ses exemplaires grisis s'accumuler aide a decider (rachat, reforme en bloc...). */
  var lotsActifs = lotKeys.filter(function (k) { return k === '_none' || lots[k].items.length === 0 || lots[k].enStock > 0; });
  var lotsMorts = lotKeys.filter(function (k) { return k !== '_none' && lots[k].items.length > 0 && lots[k].enStock === 0; });
  var htmlActifs = lotsActifs.map(htmlLot).join('');
  var corpsActifs = htmlActifs || (lotsMorts.length
    ? '<p class="hint">Aucun lot actif \u2014 voir les lots hors service ci-dessous.</p>'
    : '<p class="hint">Aucun lot enregistré.</p>');
  var htmlMorts = lotsMorts.length
    ? '<details class="repli lots-hs" style="margin-top:16px"><summary>Lots enti\u00e8rement hors service (' + lotsMorts.length + ')</summary>' +
      '<p class="hint" style="margin:8px 2px 4px">Tous les exemplaires de ces lots sont r\u00e9form\u00e9s ou perdus. Ils restent consultables ' +
      '(le registre est conserv\u00e9) mais sont rang\u00e9s ici pour ne pas encombrer les lots actifs.</p>' +
      lotsMorts.map(htmlLot).join('') + '</details>'
    : '';
  document.getElementById('materiel-list').innerHTML = onboardingMateriel() + corpsActifs + htmlMorts;

  document.querySelectorAll('#materiel-list .lot-head').forEach(function (h) {
    h.onclick = function (ev) {
      if (ev.target.tagName === 'SELECT' || ev.target.tagName === 'BUTTON') return;
      var lotEl = h.parentElement;
      lotEl.classList.toggle('open');
      openLots[lotEl.dataset.lot] = lotEl.classList.contains('open');
    };
  });
  majFiltresMateriel(visibles.length, matRows.length, filtreActif);
  brancherBoutonsEdit('materiel-list');
  var btnRat = document.getElementById('btnRattacher');
  if (btnRat) btnRat.onclick = function (ev) { ev.stopPropagation(); ouvrirRattachement(); };
  document.querySelectorAll('#materiel-list .btn-plus-actions').forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation();
      var ouvert = b.parentNode.classList.toggle('rares-ouverts');
      b.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
    };
  });
  document.querySelectorAll('#materiel-list .btn-registre').forEach(function (b) {
    b.onclick = function (e) { e.stopPropagation(); exporterRegistreLot(Number(b.dataset.id)); };
  });
  document.querySelectorAll('#materiel-list .btn-fiche').forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      if (b.dataset.type === 'lot') ficheDeVieLot(Number(b.dataset.id));
      else ficheDeVieMateriel(Number(b.dataset.id));
    };
  });
  document.querySelectorAll('#materiel-list .btn-scinder-lot').forEach(function (b) {
    b.onclick = function (ev) { ev.stopPropagation(); ouvrirFenetreScission(Number(b.dataset.id)); };
  });
  populateLotFormOptions();
  remplirVignettes('lots', rawRows.lots, 'vignetteLot-', 'lot-vignette-img', 'Photo du modèle');
  remplirDocsLots();

  /* Prets : deux fenetres, en cours puis termines, du plus recent au plus ancien */
  /* total d'origine par bon (ouverts + deja rendus) : sert a reperer et signaler
     les retours partiels, que le simple compte des lignes encore ouvertes masquerait. */
  var totalParBon = {};
  emprunts.forEach(function (e) {
    var k = e.numero || '__sans__';
    totalParBon[k] = (totalParBon[k] || 0) + 1;
  });
  var pretsEnCours = emprunts.filter(function (e) { return !e.retourne; })
    .filter(function (e) { return vuePrets === 'retard' ? e.retard : true; })
    .sort(function (a, b) { return b.tsEmprunt - a.tsEmprunt; });
  var pretsTermines = emprunts.filter(function (e) { return e.retourne; })
    .sort(function (a, b) { return (b.tsRetour - a.tsRetour) || (b.tsEmprunt - a.tsEmprunt); });

  function ligneEnCours(e) {
    return '<tr><td><input type="checkbox" class="ret-cb" data-emp="' + e.id + '" data-mat="' + e.matId + '"></td>' +
      '<td><span class="badge-ref badge-clic" data-mat="' + e.matId + '" title="Ouvrir la fiche">' + esc(e.materiel) + '</span></td>' +
      '<td>' + e.adherent + '</td><td>' + e.emprunte + '</td>' +
      '<td' + (e.retard ? ' style="color:var(--red);font-weight:600"' : '') + '>' + e.prevu +
        (e.retard ? ' <span class="badge danger">Retard</span>' : '') + '</td>' +
      '<td>' + e.sortie + '</td>' +
      '<td class="td-actions"><div>' + btnSupprimer('emprunt', e.id) + '</div></td></tr>';
  }
  function ligneTerminee(e) {
    var etatCell = e.etat
      ? '<span class="badge ' +
          (e.etat === 'Bon etat' ? 'ok' : (e.etat === 'Degrade' ? 'warn' : 'danger')) +
        '">' + esc(e.etat) + '</span>'
      : '<span style="color:#999">-</span>';
    return '<tr><td><span class="badge-ref badge-clic" data-mat="' + e.matId + '" title="Ouvrir la fiche">' + esc(e.materiel) + '</span></td>' +
      '<td>' + e.adherent + '</td><td>' + e.emprunte + '</td>' +
      '<td>' + e.rendu + '</td><td>' + etatCell + '</td><td>' + e.sortie + '</td>' +
      '<td class="td-actions"><div>' + btnSupprimer('emprunt', e.id) + '</div></td></tr>';
  }

  var demandesEnAttente = resolvedNames.demandes
    ? (rawRows.demandes || []).filter(function (dm) { return !dm.traitee; })
    : [];
  document.getElementById('prets-list').innerHTML =
    onboardingSansMateriel('Rien à prêter pour l\'instant \u2014 commencez par ajouter du matériel dans la rubrique Matériel.') +
    (demandesEnAttente.length ? blocDemandes(demandesEnAttente) : '') +
    '<div class="cards">' +
      '<div class="card' + (enRetard ? ' card-clic' + (vuePrets === 'tous' ? ' actif' : '') : '') + '" ' +
        (enRetard ? 'data-vp="tous"' : '') + '><p class="label">Prêts en cours</p><p class="value">' + nbBons + '</p>' +
        '<p class="card-sous">' + (aNum ? enCours + ' exemplaire' + (enCours > 1 ? 's' : '') + ' sortis' : (enRetard ? (vuePrets === 'tous' ? 'affiche ci-dessous' : 'cliquer pour tout voir') : '')) + '</p></div>' +
      '<div class="card' + (enRetard ? ' card-clic card-alerte' + (vuePrets === 'retard' ? ' actif' : '') : '') + '" ' +
        (enRetard ? 'data-vp="retard"' : '') + '><p class="label">Retours en retard</p><p class="value">' + nbBonsRetard + '</p>' +
        (enRetard ? '<p class="card-sous">' + (aNum ? enRetard + ' exemplaire' + (enRetard > 1 ? 's' : '') + ' · ' : '') + (vuePrets === 'retard' ? 'filtre actif' : 'cliquer pour filtrer') + '</p>' : '') + '</div>' +
    '</div>' +

    /* recherche (2026.5.28) : au-dessus des DEUX listes, visible meme sans pret en cours */
    ((pretsEnCours.length || pretsTermines.length)
      ? '<div style="max-width:480px;margin:14px 0 0"><input id="filtreBon" type="text" value="' + esc(rechercheBons) + '" ' +
          'placeholder="Rechercher un pr\u00eat : personne, n\u00b0 de bon, sortie, marquage..."></div>' +
        '<p class="hint" id="filtreBonCompte" style="margin:4px 0 0;min-height:16px"></p>'
      : '') +
    '<h2 class="section-titre" style="margin-top:16px">' +
      (vuePrets === 'retard' ? 'Prets en cours — en retard' : 'Prêts en cours') +
      (pretsEnCours.length ? ' <span class="titre-compte">' + (aColonne('emprunts', 'numero_emprunt') ? compterBons(pretsEnCours) : pretsEnCours.length) + '</span>' : '') +
      (vuePrets === 'retard' ? ' <button class="secondary" id="btnPretsTous" style="margin-left:8px">Voir tous</button>' : '') +
      '</h2>' +
    (pretsEnCours.length
      ? (aColonne('emprunts', 'numero_emprunt')
          ? renderBonsEnCours(pretsEnCours, totalParBon)
          : '<div class="barre-actions" style="margin:2px 0 8px;flex-wrap:wrap">' +
              '<label class="coche"><input type="checkbox" id="retTous"> <b>Tout cocher / décocher</b></label>' +
              '<select id="retEtat" style="width:auto">' +
                '<option>Bon etat</option><option>Degrade</option><option>Perdu</option><option>Vole</option>' +
              '</select>' +
              (aColonne('materiels', 'commentaire')
                ? '<input type="text" id="retCommentaire" placeholder="Commentaire si perte..." style="width:220px">'
                : '') +
              (aColonne('incidents', 'suite')
                ? '<span id="retSuiteWrap" style="display:none">' +
                    '<select id="retSuite" style="width:auto">' +
                      '<option value="Controle a realiser">Contr\u00f4le \u00e0 pr\u00e9voir</option>' +
                      '<option value="Reparation a prevoir">R\u00e9paration \u00e0 pr\u00e9voir</option>' +
                    '</select>' +
                    '<input type="text" id="retMotifReparation" placeholder="Motif de la r\u00e9paration..." ' +
                      'style="width:220px;display:none">' +
                  '</span>'
                : '') +
              '<button class="secondary" id="btnRetourGroupe">Valider le retour des cochés</button>' +
              '<span class="form-msg" id="retMsg"></span>' +
              '<div id="retReparationBloc" style="flex-basis:100%"></div>' +
            '</div>' +
            '<div class="scroll-y">' +
            '<table><tr><th></th><th>Matériel</th><th>Adhérent</th><th>Emprunte le</th><th>Retour prevu</th><th>Sortie</th><th></th></tr>' +
            pretsEnCours.map(ligneEnCours).join('') + '</table></div>')
      : '<p class="hint">Aucun prêt en cours : tout le matériel est rentré.</p>') +

    '<h2 class="section-titre" style="margin-top:22px">Prêts terminés' +
      (pretsTermines.length ? ' <span class="titre-compte">' + (aColonne('emprunts', 'numero_emprunt') ? compterBons(pretsTermines) : pretsTermines.length) + '</span>' : '') + '</h2>' +
    (pretsTermines.length
      ? (aColonne('emprunts', 'numero_emprunt')
          ? renderBonsTermines(pretsTermines)
          : '<div class="scroll-y">' +
            '<table><tr><th>Matériel</th><th>Adhérent</th><th>Emprunte le</th><th>Rendu le</th><th>État</th><th>Sortie</th><th></th></tr>' +
            pretsTermines.map(ligneTerminee).join('') + '</table></div>')
      : '<p class="hint">Aucun prêt terminé pour le moment.</p>');

  var retTous = document.getElementById('retTous');
  if (retTous) {
    retTous.onchange = function () {
      var etat = this.checked;
      document.querySelectorAll('#prets-list .ret-cb').forEach(function (c) { c.checked = etat; });
    };
    document.getElementById('btnRetourGroupe').onclick = retourGroupe;
  }
  var retEtatSel = document.getElementById('retEtat');
  var retSuiteSel = document.getElementById('retSuite');
  if (retEtatSel && retSuiteSel) {
    var retSuiteWrap = document.getElementById('retSuiteWrap');
    var retMotifInp = document.getElementById('retMotifReparation');
    var retBlocRep = document.getElementById('retReparationBloc');
    var majRetSuite = function () {
      var estDegrade = retEtatSel.value === 'Degrade';
      if (retSuiteWrap) retSuiteWrap.style.display = estDegrade ? '' : 'none';
      var estRepar = estDegrade && retSuiteSel.value === 'Reparation a prevoir';
      if (retMotifInp) retMotifInp.style.display = estRepar ? '' : 'none';
      if (retBlocRep) {
        if (!estRepar) { retBlocRep.innerHTML = ''; return; }
        var idsRet = Array.prototype.map.call(
          document.querySelectorAll('#prets-list .ret-cb:checked'),
          function (c) { return Number(c.dataset.mat); }
        );
        var fermeesRet = categoriesFermeesReparation(idsRet);
        if (fermeesRet.length) { retBlocRep.innerHTML = panneauReparationFermee(fermeesRet); return; }
        var avecNoteRet = categoriesAvecNoteReparation(idsRet);
        retBlocRep.innerHTML = avecNoteRet.length ? panneauNotesReparation(avecNoteRet) : '';
      }
    };
    retEtatSel.onchange = majRetSuite;
    retSuiteSel.onchange = majRetSuite;
  }
  document.querySelectorAll('#prets-list .btn-bon-modifier').forEach(function (b) {
    b.onclick = function () { ouvrirEditeurBon(b.closest('.bon').dataset.bon); };
  });
  document.querySelectorAll('#prets-list .btn-dem-creer').forEach(function (b) {
    b.onclick = function () { demarrerBonDepuisDemande(Number(b.closest('.demande').dataset.dem)); };
  });
  document.querySelectorAll('#prets-list .btn-dem-ignorer').forEach(function (b) {
    b.onclick = function () { ignorerDemande(Number(b.closest('.demande').dataset.dem)); };
  });
  /* Choisir un etat DANS le menu vaut declaration de retour : plus de case a cocher
     redondante. Les lignes laissees sur "Non rendu" (valeur vide) restent en cours,
     ce qui preserve le retour partiel. Le bouton s'adapte : tant qu'aucun etat n'est
     choisi, il propose le raccourci "Tout rendre en bon etat" ; des qu'une ligne est
     renseignee, il devient "Valider la saisie" et ne traite que les lignes remplies. */
  function lignesRenseignees(bloc) {
    return Array.prototype.filter.call(bloc.querySelectorAll('.ret-etat'), function (sel) {
      return sel.value !== '';
    });
  }
  function bonEstVierge(bloc) {
    return lignesRenseignees(bloc).length === 0;
  }
  function majBoutonBon(bloc) {
    var btn = bloc.querySelector('.btn-bon-coches');
    if (!btn) return;
    btn.textContent = bonEstVierge(bloc) ? 'Tout rendre en bon etat' : 'Valider la saisie';
  }
  document.querySelectorAll('#prets-list .ret-etat').forEach(function (sel) {
    sel.onchange = function () {
      var tr = sel.closest('tr');
      var detail = tr.nextElementSibling;
      if (detail && detail.classList.contains('ret-detail')) {
        var estPerte = (sel.value === 'Perdu' || sel.value === 'Vole');
        var estDegrade = (sel.value === 'Degrade');
        detail.hidden = !(estPerte || estDegrade);
        var partePerte = detail.querySelector('.ret-detail-perte');
        var parteDegrade = detail.querySelector('.ret-detail-degrade');
        if (partePerte) partePerte.hidden = !estPerte;
        if (parteDegrade) parteDegrade.hidden = !estDegrade;
      }
      majBoutonBon(sel.closest('.bon'));
    };
  });
  /* Sous-menu "Controle a prevoir / Reparation a prevoir" revele quand l'etat
     passe a Degrade (cable ci-dessus). Meme logique de panneau que les 5
     autres points d'entree "A reparer" : ferme + pedagogie si la categorie
     n'admet pas la reparation, note si elle en porte une, rien sinon. */
  document.querySelectorAll('#prets-list .ret-suite').forEach(function (suiteSel) {
    var maj = function () {
      var wrap = suiteSel.closest('.ret-detail-degrade');
      if (!wrap) return;
      var motifInp = wrap.querySelector('.ret-motif-item');
      var blocRep = wrap.querySelector('.ret-reparation-bloc');
      var estRepar = suiteSel.value === 'Reparation a prevoir';
      if (motifInp) motifInp.hidden = !estRepar;
      if (blocRep) {
        if (!estRepar) { blocRep.innerHTML = ''; return; }
        var detailRow = wrap.closest('.ret-detail');
        var matId = detailRow ? Number(detailRow.dataset.detailMat) : null;
        var fermees = categoriesFermeesReparation([matId]);
        if (fermees.length) { blocRep.innerHTML = panneauReparationFermee(fermees); return; }
        var avecNote = categoriesAvecNoteReparation([matId]);
        blocRep.innerHTML = avecNote.length ? panneauNotesReparation(avecNote) : '';
      }
    };
    suiteSel.onchange = maj; maj();
  });
  document.querySelectorAll('#prets-list .btn-bon-coches').forEach(function (b) {
    b.onclick = function () {
      var bloc = b.closest('.bon');
      var msgLocal = bloc.querySelector('.bon-msg');
      function erreurLocale(texte) {
        if (msgLocal) {
          msgLocal.textContent = texte;
          msgLocal.style.color = '#a3242a';
          defilerVers(msgLocal, { block: 'nearest' });
        }
      }
      if (bonEstVierge(bloc)) {
        var actionsTout = [], nTout = 0;
        bloc.querySelectorAll('.ret-etat').forEach(function (sel) {
          actionsTout = actionsTout.concat(actionsRetour(Number(sel.dataset.emp), Number(sel.dataset.mat), 'Bon etat')); nTout++;
        });
        validerRetours(actionsTout, nTout, 'en bon état');
        return;
      }
      var remplies = lignesRenseignees(bloc);
      if (msgLocal) msgLocal.textContent = '';
      /* chaque exemplaire perdu/vole porte son propre commentaire : des circonstances
         partagees entre plusieurs objets rendus ensemble seraient rarement les memes. */
      var manquant = null, manquantRaison = '';
      remplies.forEach(function (sel) {
        if (manquant) return;
        if (sel.value === 'Perdu' || sel.value === 'Vole') {
          var detail = sel.closest('tr').nextElementSibling;
          var champ = detail && detail.querySelector('.ret-commentaire-item');
          if (champ && !champ.value.trim()) { manquant = sel; manquantRaison = 'circonstances'; }
        }
        if (sel.value === 'Degrade') {
          var detailD = sel.closest('tr').nextElementSibling;
          var suiteSel = detailD && detailD.querySelector('.ret-suite');
          if (suiteSel && suiteSel.value === 'Reparation a prevoir') {
            var fermeesSub = categoriesFermeesReparation([Number(sel.dataset.mat)]);
            if (fermeesSub.length) { manquant = sel; manquantRaison = 'ferme'; return; }
            var motifInp = detailD.querySelector('.ret-motif-item');
            if (motifInp && !motifInp.value.trim()) { manquant = sel; manquantRaison = 'motif'; }
          }
        }
      });
      if (manquant) {
        var nomManquant = bloc.querySelector('[data-mat="' + manquant.dataset.mat + '"].badge-ref').textContent.trim();
        var detailManquant = manquant.closest('tr').nextElementSibling;
        if (manquantRaison === 'circonstances') {
          erreurLocale('Précisez les circonstances pour « ' + nomManquant + ' ».');
          if (detailManquant) detailManquant.querySelector('.ret-commentaire-item').focus();
        } else if (manquantRaison === 'motif') {
          erreurLocale('Précisez le motif de la réparation pour « ' + nomManquant + ' ».');
          if (detailManquant) detailManquant.querySelector('.ret-motif-item').focus();
        } else {
          erreurLocale('La réparation n\'est pas ouverte pour « ' + nomManquant + ' » : voir le message ci-dessus.');
          if (detailManquant) detailManquant.querySelector('.ret-suite').focus();
        }
        return;
      }
      var actions = [], n = 0;
      remplies.forEach(function (sel) {
        var detail = sel.closest('tr').nextElementSibling;
        var champ = detail && detail.querySelector('.ret-commentaire-item');
        var commentaire = champ ? champ.value.trim() : '';
        var suiteSel = detail && detail.querySelector('.ret-suite');
        var motifInp = detail && detail.querySelector('.ret-motif-item');
        var suite = suiteSel ? suiteSel.value : '';
        var motifReparation = motifInp ? motifInp.value.trim() : '';
        actions = actions.concat(actionsRetour(Number(sel.dataset.emp), Number(sel.dataset.mat), sel.value, commentaire, suite, motifReparation)); n++;
      });
      validerRetours(actions, n, null);
    };
  });
  document.querySelectorAll('#prets-list .bon-tete').forEach(function (t) {
    t.onclick = function (ev) {
      if (ev.target.closest('.bon-tete-actions')) return;   /* le bouton n'ouvre pas */
      var bon = t.closest('.bon');
      var cle = bon.dataset.bon;
      if (bon.classList.toggle('ouvert')) bonsDeplies[cle] = true; else delete bonsDeplies[cle];
    };
  });
  document.querySelectorAll('#prets-list .btn-recap-pdf').forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      var items = bonsTerminesItems[b.dataset.bon];
      if (!items) return;
      var numero = items[0].numero || '';
      exporterRecapBonPdf(numero, items);
    };
  });
  document.querySelectorAll('#prets-list .btn-recap-csv').forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      var items = bonsTerminesItems[b.dataset.bon];
      if (!items) return;
      var numero = items[0].numero || '';
      exporterRecapBonCsv(numero, items);
    };
  });
  var filtreBon = document.getElementById('filtreBon');
  if (filtreBon) { filtreBon.oninput = appliquerRechercheBons; appliquerRechercheBons(); }
  document.querySelectorAll('#prets-list .card-clic[data-vp]').forEach(function (c) {
    c.onclick = function () {
      var v = c.dataset.vp;
      vuePrets = (vuePrets === v && v !== 'tous') ? 'tous' : v;
      load();
    };
  });
  var btnTous = document.getElementById('btnPretsTous');
  if (btnTous) btnTous.onclick = function () { vuePrets = 'tous'; load(); };
  brancherBoutonsEdit('prets-list');
  populatePretFormOptions();

  /* Controles : trois cartes cliquables qui pilotent la zone du dessous.
     Par defaut on montre l'historique ; les deux autres revelent le
     materiel a controler, invisible partout ailleurs. */
  function carteCtrl(cle, libelle, valeur, danger) {
    var actif = vueControles === cle;
    return '<div class="card card-clic' + (actif ? ' actif' : '') + (danger && valeur ? ' card-alerte' : '') +
      '" data-vuectrl="' + cle + '">' +
      '<p class="label">' + libelle + '</p><p class="value">' + valeur + '</p>' +
      '<p class="card-sous">' + (actif ? 'affiche ci-dessous' : 'cliquer pour voir') + '</p></div>';
  }

  function tableAControler(liste, colProchain) {
    if (!liste.length) return '<p class="hint">Aucun exemplaire dans ce cas. Tout est à jour.</p>';
    /* Meme mecanique que le retour groupe des prets : on coche, on valide une
       fois. Sans cela, la liste dit quoi controler mais oblige a le faire un
       par un. Le bouton "Controler" par ligne reste, pour un cas isole
       necessitant un commentaire particulier. */
    return '<div class="barre-actions" style="margin:2px 0 8px;align-items:flex-end;flex-wrap:wrap">' +
        '<label class="coche" style="margin-bottom:8px"><input type="checkbox" id="ctTous"> <b>Tout cocher / décocher</b></label>' +
        field('Date', '<input id="cgDate" type="date" value="' + new Date().toISOString().slice(0, 10) + '">') +
        fieldAide('Contrôleur', '<select id="cgControleur">' + optionsFor(adherentsControleurs(), 'nom_complet') + '</select>', 'Seuls les adhérents marqués « Contrôleur EPI habilité » (Listes du club → Adhérents) apparaissent ici. Si personne n’est encore marqué, tous les adhérents sont proposés.') +
        fieldAide('Résultat du contrôle', '<select id="cgResultat">' + optionsResultatsControle() + '</select>', 'Conforme : reste en service. À surveiller : reste en service, à re-vérifier de près la prochaine fois. À réparer : mis de côté, en attente de réparation. Réforme : retiré définitivement du parc.') +
        field('Commentaire', '<input id="cgCommentaire" type="text" placeholder="facultatif">') +
        (aColonne('controles','type_controle') ? fieldAide('Type',"<select id=\"cgType\">" + typeControleChoices.map(function(v){return '<option>'+v+'</option>';}).join('') + "</select>", 'Un contrôle périodique ou avant mise en service décale toujours la prochaine échéance. Un contrôle suite à incident ne la décale que si le réglage du club (Réglages → Fonctionnement) est en mode « systématique ».') : '') +
        '<p class="hint" id="cgMotifHint" style="flex-basis:100%;margin:-4px 0 2px"></p>' +
        '<div id="cgReparationBloc" style="flex-basis:100%"></div>' +
        '<button class="secondary" id="btnCtrlGroupe" style="margin-bottom:8px">Enregistrer le contrôle des cochés</button>' +
        '<span class="form-msg" id="cgMsg" style="margin-bottom:8px"></span>' +
        '<div id="cgPretsBloc" style="flex-basis:100%"></div>' +
      '</div>' +
      '<div class="scroll-y"><table><tr><th></th><th>Matériel</th><th>Lot</th><th>Mise en service</th>' +
      '<th>' + (colProchain ? 'Controle a refaire avant' : 'État') + '</th><th></th></tr>' +
      liste.map(function (m) {
        var lot = (m.lot && lots[m.lot]) ? lots[m.lot].row : null;
        var quand = m._limiteControle ? fmtDate(m._limiteControle) : 'des que possible';
        return '<tr><td><input type="checkbox" class="ct-cb" data-mat="' + m.id + '"></td>' +
          '<td><span class="badge-ref badge-clic" data-mat="' + m.id + '" title="Ouvrir la fiche">' +
            esc(m.numero_marquage || '#' + m.id) + '</span></td>' +
          '<td>' + esc(lot ? lot.designation : '-') + '</td>' +
          '<td>' + fmtDate(m.date_mise_en_service) + '</td>' +
          '<td style="color:#a3242a">' + quand + '</td>' +
          '<td><button class="secondary btn-ct-fiche" data-mat="' + m.id + '">Contrôler</button></td></tr>';
      }).join('') + '</table></div>';
  }

  var zoneCtrl;
  if (vueControles === 'retard') {
    zoneCtrl = '<h2 class="section-titre" style="margin-top:14px">Contrôle en retard' +
      ' <span class="titre-compte">' + listeRetard.length + '</span></h2>' + tableAControler(listeRetard, true);
  } else if (vueControles === 'jamais') {
    zoneCtrl = '<h2 class="section-titre" style="margin-top:14px">Jamais contrôlés' +
      ' <span class="titre-compte">' + listeJamais.length + '</span></h2>' + tableAControler(listeJamais, true);
  } else if (vueControles === 'aprevoir') {
    zoneCtrl = '<h2 class="section-titre" style="margin-top:14px">Contrôles à prévoir (' + JOURS_AVANT_CONTROLE + ' jours)' +
      ' <span class="titre-compte">' + listeAPrevoir.length + '</span></h2>' +
      '<p class="hint" style="margin:2px 0 8px">Exemplaires dont le contrôle annuel arrive à échéance prochainement. Les traiter maintenant évite qu\'ils basculent en retard.</p>' +
      tableAControler(listeAPrevoir, true);
  } else {
    var controlesAffiches = regrouperControlesLot(controles);
    zoneCtrl = '<h2 class="section-titre" style="margin-top:14px">Historique des contrôles' +
      (controles.length ? ' <span class="titre-compte">' + controles.length + '</span>' : '') + '</h2>' +
      (controlesAffiches.length
        ? rendreVoletsAnnee('ctrl', controlesAffiches,
            '<tr><th>Matériel</th><th>Date</th><th>Contrôleur</th><th>Résultat</th><th>Observations</th>' + (aColonne('controles','type_controle') ? '<th>Type</th>' : '') + (aColonne('controles','photo') ? '<th>Photo</th>' : '') + '<th>Prochain</th><th></th></tr>',
            function (c) {
              var rst = c.resultat === 'Conforme' ? 'ok' : (c.resultat === 'Reforme' ? 'danger' : 'warn');
              if (c._groupe) {
                var detail = c._membres.map(function (m) {
                  return '<span class="badge-ref badge-clic" data-mat="' + m.matId + '" title="Ouvrir la fiche">' + esc(m.materiel) + '</span>';
                }).join(' ');
                return '<tr class="ctrl-ligne-groupe"><td>' +
                    '<span class="ctrl-grp-toggle" data-grp="' + esc(c.id) + '" style="cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:4px">' +
                      '<span class="ctrl-grp-chevron">\u25B8</span>' + esc(c.lotNom || 'Lot') + ' \u2014 ' + c._membres.length + ' exemplaires</span>' +
                    '<div class="ctrl-grp-detail" data-grp="' + esc(c.id) + '" hidden>' + detail + '</div>' +
                  '</td>' +
                  '<td>' + c.date + '</td><td>' + c.controleur + '</td>' +
                  '<td><span class="badge ' + rst + '">' + c.resultat + '</span></td>' +
                  '<td>' + esc(c.commentaire) + '</td>' + (aColonne('controles','type_controle') ? '<td>' + esc(c.typeControle) + '</td>' : '') +
                  (aColonne('controles','photo') ? '<td></td>' : '') +
                  '<td style="' + (c.retard ? 'color:#a3242a' : '') + '">' + c.prochain + '</td>' +
                  '<td class="td-actions"><div><span class="ctrl-grp-toggle" data-grp="' + esc(c.id) + '" style="cursor:pointer;color:var(--navy);font-size:11px;text-decoration:underline">voir le d\u00e9tail</span></div></td></tr>';
              }
              return '<tr><td><span class="badge-ref badge-clic" data-mat="' + c.matId + '" title="Ouvrir la fiche">' + esc(c.materiel) + '</span></td>' +
                '<td>' + c.date + '</td><td>' + c.controleur + '</td>' +
                '<td><span class="badge ' + rst + '">' + c.resultat + '</span></td>' +
                '<td>' + esc(c.commentaire) + '</td>' + (aColonne('controles','type_controle') ? '<td>' + esc(c.typeControle) + '</td>' : '') +
                (aColonne('controles','photo')
                  ? '<td><span class="galerie-pj" id="galerieCtrl-' + c.id + '" hidden></span></td>'
                  : '') +
                '<td style="' + (c.retard ? 'color:#a3242a' : '') + '">' + c.prochain + '</td>' +
                '<td class="td-actions"><div>' + btnEditer('controle', c.id, 'Éditer le contrôle') + btnSupprimer('controle', c.id) + '</div></td></tr>';
            }, 'controle', function (c) { return c.dateObj ? c.dateObj.getFullYear() : null; })
        : '<p class="hint">Aucun contrôle enregistré.</p>');
  }

  document.getElementById('controles-list').innerHTML =
    onboardingSansMateriel('Aucun exemplaire à contrôler \u2014 ajoutez d\'abord du matériel dans la rubrique Matériel.') +
    '<div class="cards">' +
      carteCtrl('historique', 'Controles enregistres', controles.length, false) +
      carteCtrl('retard', 'En retard', ctrlEnRetard, true) +
      carteCtrl('jamais', 'Jamais controles', jamaisControle, true) +
      carteCtrl('aprevoir', 'A prévoir (' + JOURS_AVANT_CONTROLE + 'j)', ctrlAPrevoir, true) +
    '</div>' + zoneCtrl;

  document.querySelectorAll('#controles-list .card-clic').forEach(function (c) {
    c.onclick = function () {
      var v = c.dataset.vuectrl;
      vueControles = (vueControles === v && v !== 'historique') ? 'historique' : v;
      load();
    };
  });
  var ctTous = document.getElementById('ctTous');
  var cgResultatSel = document.getElementById('cgResultat');
  var cgBlocPrets = document.getElementById('cgPretsBloc');
  var cgMotifHint = document.getElementById('cgMotifHint');
  var cgBlocRep = document.getElementById('cgReparationBloc');
  var majBlocCg = function () {
    if (cgMotifHint && cgResultatSel) {
      cgMotifHint.textContent = cgResultatSel.value === 'Reforme'
        ? 'Précisez la cause dans le commentaire : usure constatée, rappel fabricant (référence), décision du bureau...'
        : cgResultatSel.value === 'A surveiller'
        ? 'Précisez ce qu\'il faut surveiller dans le commentaire (facultatif) : usure localisée, corrosion naissante...'
        : cgResultatSel.value === 'A reparer'
        ? 'Précisez le motif de la réparation dans le commentaire : c\'est ce qui figurera sur la fiche de vie.'
        : '';
    }
    var cochesIds = Array.prototype.map.call(
      document.querySelectorAll('#controles-list .ct-cb:checked'),
      function (c) { return Number(c.dataset.mat); }
    );
    if (cgBlocRep) {
      cgBlocRep.innerHTML = (cgResultatSel && cgResultatSel.value === 'A reparer')
        ? (function () {
            var fermees = categoriesFermeesReparation(cochesIds);
            if (fermees.length) return panneauReparationFermee(fermees);
            var avecNote = categoriesAvecNoteReparation(cochesIds);
            return avecNote.length ? panneauNotesReparation(avecNote) : '';
          })()
        : '';
    }
    if (!cgBlocPrets) return;
    cgBlocPrets.innerHTML = (cgResultatSel && cgResultatSel.value === 'Reforme')
      ? blocFermerPretsMultiples(cochesIds) : '';
  };
  if (ctTous) {
    ctTous.onchange = function () {
      var etat = this.checked;
      document.querySelectorAll('#controles-list .ct-cb').forEach(function (c) { c.checked = etat; });
      majBlocCg();
    };
    document.getElementById('btnCtrlGroupe').onclick = controleGroupe;
  }
  if (cgResultatSel) cgResultatSel.onchange = majBlocCg;
  document.querySelectorAll('#controles-list .ct-cb').forEach(function (c) {
    c.addEventListener('change', majBlocCg);
  });
  document.querySelectorAll('#controles-list .btn-ct-fiche').forEach(function (b) {
    b.onclick = function () {
      var ong = document.querySelector('.tab[data-t="materiel"]');
      if (ong) ong.click();
      ouvrirFicheExemplaire(Number(b.dataset.mat));
      /* ouvre directement le mini-formulaire de controle sur la fiche */
      setTimeout(function () {
        var bc = document.querySelector('#ficheBoutons [data-act="controler"]');
        if (bc) bc.click();
      }, 60);
    };
  });
  brancherBoutonsEdit('controles-list');
  brancherVoletsAnnee('controles-list');
  populateControleFormOptions();
  /* vignettes/upload photo : uniquement pour les controles NON regroupes (un controle
     groupe n'a jamais de photo individuelle, par construction de regrouperControlesLot) */
  remplirGaleriePhotos('controles', controles.filter(function (c) { return idsPiecesJointes(c.photo).length; }), 'galerieCtrl-', 'Photo du controle', true);
  document.querySelectorAll('#controles-list input[type="file"][data-pj-table]').forEach(function (inp) {
    inp.onchange = function () { surChoixPieceJointe(inp); };
  });
  /* repli du detail d'un controle groupe (liste des exemplaires concernes) : deux points
     d'entree (le titre du groupe et "voir le detail" dans la colonne actions) partagent
     la meme classe et le meme data-grp -- le chevron doit se mettre a jour sur les DEUX,
     pas seulement sur celui qui a ete clique. */
  document.querySelectorAll('#controles-list .ctrl-grp-toggle').forEach(function (t) {
    t.onclick = function () {
      var grp = t.dataset.grp;
      var detail = document.querySelector('#controles-list .ctrl-grp-detail[data-grp="' + grp + '"]');
      if (!detail) return;
      detail.hidden = !detail.hidden;
      document.querySelectorAll('#controles-list .ctrl-grp-toggle[data-grp="' + grp + '"] .ctrl-grp-chevron').forEach(function (chev) {
        chev.innerHTML = detail.hidden ? '&#9656;' : '&#9662;';
      });
    };
  });

  /* Incidents — deux listes : en attente en haut, clotures en bas (comme prets termines).
     Un incident dont l'exemplaire est "En reparation" n'est ni l'un ni l'autre au
     sens strict (rien n'est encore decide, mais rien n'attend un controle non
     plus) : il rejoint "clotures" plutot que de disparaitre sans laisser de
     trace, sinon "Incidents enregistres" (16) ne correspondrait plus a
     "en attente" + "clotures" (2 + 13 = 15) — un ecart qui aurait l'air d'un
     bug plutot que d'un etat delibere. Le badge dit honnetement "En reparation",
     jamais "Controle" (rien n'a ete controle) : voir ligneIncident() plus bas. */
  var incClotures = incidents.filter(function (i) {
    return i.suivi || i.suite === 'Sans suite' || i.suite === 'Mise au rebut immediate'
      || matIdsEnReparation[i.matId];
  });
  function ligneIncident(i, enAttente) {
    var g = i.gravite === 'Grave' ? 'danger' : (i.gravite === 'Moderee' ? 'warn' : 'muted');
    var suite;
    if (i.suite === 'Sans suite') suite = '<span class="badge muted">Classe sans suite</span>';
    else if (i.suite === 'Mise au rebut immediate') suite = '<span class="badge muted">Mis au rebut</span>';
    else if (matIdsEnReparation[i.matId]) suite = '<span class="badge repair">En r\u00e9paration</span>';
    else if (i.suivi) {
      /* le badge dit desormais CE QUI A ETE DECIDE, pas seulement qu'un controle existe */
      if (i.resultatTrait === 'Reforme') suite = '<span class="badge danger">Contrôlé — réformé</span>';
      else if (i.resultatTrait === 'A surveiller') suite = '<span class="badge warn">Contrôlé — sous surveillance</span>';
      else suite = '<span class="badge ok">Contrôlé — conforme</span>';
    }
    else suite = '<span class="badge danger">En attente de contrôle</span>';
    return '<tr><td><span class="badge-ref badge-clic" data-mat="' + i.matId + '" title="Ouvrir la fiche">' + esc(i.materiel) + '</span></td>' +
      '<td>' + i.date + '</td>' +
      '<td><span class="badge ' + g + '">' + i.gravite + '</span></td>' +
      '<td>' + esc(i.suite || '-') + '</td>' +
      '<td>' + i.description + '</td>' +
      (aColonne('incidents', 'photo')
        ? '<td><span class="galerie-pj" id="galerieInc-' + i.id + '" hidden></span></td>' : '') +
      '<td>' + suite + '</td>' +
      '<td class="td-actions"><div>' +
        (enAttente && i.suite === 'Controle a realiser'
          ? '<button class="secondary btn-realiser-ctrl" data-mat="' + i.matId + '"' +
            ' title="Ouvrir le formulaire de contrôle pour cet exemplaire">Réaliser le contrôle</button>'
          : btnEditer('incident', i.id, "Editer l'incident")) +
        btnSupprimer('incident', i.id) + '</div></td></tr>';
  }
  var enTeteInc = '<tr><th>Matériel</th><th>Date</th><th>Gravite</th><th>Suite \u00e0 donner</th><th>Description</th>' +
    (aColonne('incidents', 'photo') ? '<th>Photo</th>' : '') + '<th>\u00c9tat</th><th></th></tr>';
  document.getElementById('incidents-list').innerHTML =
    '<div class="cards">' +
      '<div class="card"><p class="label">Incidents enregistrés</p><p class="value">' + incidents.length + '</p></div>' +
      '<div class="card' + (incEnAttente.length ? ' card-alerte' : '') + '"><p class="label">En attente</p><p class="value">' + incEnAttente.length + '</p></div>' +
      '<div class="card"><p class="label">Clôtures</p><p class="value">' + incClotures.length + '</p></div>' +
    '</div>' +
    '<h2 class="section-titre" style="margin-top:14px">Incidents en attente' +
      (incEnAttente.length ? ' <span class="titre-compte">' + incEnAttente.length + '</span>' : '') + '</h2>' +
    (incEnAttente.length
      ? rendreVoletsAnnee('incA', incEnAttente.slice().sort(function (a, b) { return b.ts - a.ts; }),
          enTeteInc, function (i) { return ligneIncident(i, true); }, 'incident', function (i) { return i.dateObj ? i.dateObj.getFullYear() : null; })
      : '<p class="hint">Aucun incident en attente de contrôle — tout est traité.</p>') +
    (incClotures.length
      ? '<details class="bon-termine" style="margin-top:18px">' +
          '<summary class="section-titre" style="cursor:pointer;user-select:none">' +
            'Incidents clôturés <span class="titre-compte">' + incClotures.length + '</span>' +
            ' <span style="font-size:11px;color:var(--text-light);font-weight:400">(pour audit)</span>' +
          '</summary>' +
          rendreVoletsAnnee('incC', incClotures.slice().sort(function (a, b) { return b.ts - a.ts; }),
            enTeteInc, function (i) { return ligneIncident(i, false); }, 'incident', function (i) { return i.dateObj ? i.dateObj.getFullYear() : null; }) +
        '</details>'
      : '');
  brancherBoutonsEdit('incidents-list');
  brancherVoletsAnnee('incidents-list');
  remplirGaleriePhotos('incidents', rawRows.incidents, 'galerieInc-', 'Photo de l\'incident', true);
  document.querySelectorAll('#incidents-list input[type="file"][data-pj-table]').forEach(function (inp) {
    inp.onchange = function () { surChoixPieceJointe(inp); };
  });
  var soC = document.getElementById('epiCompteCtrl');
  if (soC) soC.textContent = ctrlEnRetard ? ' (' + ctrlEnRetard + ' en retard)' : '';
  var soI = document.getElementById('epiCompteInc');
  if (soI) soI.textContent = incEnAttente.length ? ' (' + incEnAttente.length + ' en attente)' : '';
  populateIncidentFormOptions();

  /* Reparations : liste plate (pas d'accordeon par annee, l'effectif est
     toujours faible) des exemplaires actuellement "En reparation". Chaque
     ligne agit directement sans passer par la fiche complete — meme
     principe que "Controles a realiser" (bouton -> ouvre la fiche et
     enchaine sur le bon formulaire), pour eviter le detour. Neutre, pas
     "alerte" : une reparation en cours n'attend pas une action immediate
     dans l'outil, juste que l'objet revienne physiquement de l'atelier.
     Liste deja calculee plus haut (juste apres la derivation des statuts),
     partagee avec la carte de la Vue d'ensemble : pas de recalcul ici. */
  var reparationsToutes = rawRows.reparations || [];
  var reparationsEffectuees = reparationsToutes.filter(function (r) { return r.date_effectuee; });
  document.getElementById('reparations-list').innerHTML =
    /* Memes 3 cartes statiques qu'Incidents (enregistrees / en cours / effectuees) —
       cette famille de trois onglets partageait deja Controles (4 cartes,
       interactives) et Incidents (3 cartes, statiques) ; Reparations n'avait
       aucune carte, rupture du motif commun sans raison de fond. */
    '<div class="cards">' +
      '<div class="card"><p class="label">R\u00e9parations enregistr\u00e9es</p><p class="value">' + reparationsToutes.length + '</p></div>' +
      '<div class="card' + (enReparation.length ? ' card-alerte' : '') + '"><p class="label">En cours</p><p class="value">' + enReparation.length + '</p></div>' +
      '<div class="card"><p class="label">Effectu\u00e9es</p><p class="value">' + reparationsEffectuees.length + '</p></div>' +
    '</div>' +
    /* Formulaire dedie, vivant ici (pas de redirection vers Incidents) :
       meme mecanisme de selection multiple filtrable (categorie/lot/recherche,
       cases a cocher, tout cocher) que Controles et Incidents, prefixe 'rep' —
       rien de nouveau a inventer pour cette brique. */
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
      '<button id="btnToggleRep">+ D\u00e9clarer une r\u00e9paration</button>' +
    '</div>' +
    '<span id="repFlash" class="form-msg" style="margin-left:12px"></span>' +
    '<div id="formDeclarerRep" class="form-panel" style="display:none">' +
      '<div class="form-grid">' +
        filtresMaterielHtml('rep') +
      '</div>' +
      formulaireDeclarerReparation('rep', []) +
      '<div class="form-field" style="margin-top:12px"><label>Matériel concern\u00e9 (cochez)</label>' +
        '<label class="coche" style="margin:4px 0 6px"><input type="checkbox" id="repFormTous"> <b>Tout cocher / décocher</b></label>' +
        '<div id="repListe" class="grille-coches"></div>' +
        '<div id="repResume" class="selection-resume" hidden></div>' +
      '</div>' +
      '<div class="form-actions">' +
        '<button id="btnSubmitRep">Enregistrer</button>' +
        '<button type="button" class="secondary" id="btnCancelRep">Annuler</button>' +
        '<span id="repMsg" class="form-msg"></span>' +
      '</div>' +
    '</div>' +
    (enReparation.length
    ? '<table><tr><th>Exemplaire</th><th>Catégorie</th><th style="width:100px">Depuis le</th>' +
        '<th>Motif</th><th></th></tr>' +
      enReparation.map(function (r) {
        return '<tr><td><span class="badge-ref badge-clic" data-mat="' + r.matId + '" title="Ouvrir la fiche">' +
            esc(r.marquage) + '</span></td>' +
          '<td>' + esc(r.categorie) + '</td>' +
          '<td>' + fmtDate(r.dateDeclaree) + '</td>' +
          '<td>' + esc(r.motif) + '</td>' +
          '<td class="td-actions"><button class="secondary btn-rep-fiche" data-mat="' + r.matId + '">' +
            'D\u00e9clarer la r\u00e9paration effectu\u00e9e</button></td></tr>';
      }).join('') +
      '</table>'
    : '<p class="hint">Aucun exemplaire en r\u00e9paration.</p>');
  document.getElementById('btnToggleRep').onclick = function () {
    var f = document.getElementById('formDeclarerRep');
    f.style.display = (f.style.display === 'none') ? 'block' : 'none';
    if (f.style.display === 'block') {
      viderSelection('rep');
      document.getElementById('repFormTous').checked = false;
      majListeSelectionnable('rep');
      var panneau = document.getElementById('repPanneauCategorie');
      if (panneau) panneau.innerHTML = '';
      var dateEl = document.getElementById('repRepDate');
      if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
      var descEl = document.getElementById('repRepDescription');
      if (descEl) descEl.value = '';
      var repEtatAPrevoir = document.getElementById('repEtatAPrevoir');
      if (repEtatAPrevoir) repEtatAPrevoir.checked = true;
      brancherEtatReparation('rep');
    }
  };
  document.getElementById('repFormTous').onchange = function () {
    var etat = this.checked;
    document.querySelectorAll('#repListe .rep-item').forEach(function (c) {
      if (c.disabled) return;   /* jamais coche via "tout cocher" si ferme a la reparation */
      if (etat) SELECTION.rep[c.value] = true; else delete SELECTION.rep[c.value];
    });
    majListeSelectionnable('rep');
  };
  document.getElementById('btnSubmitRep').onclick = declarerReparationGroupe;
  document.getElementById('btnCancelRep').onclick = function () {
    document.getElementById('formDeclarerRep').style.display = 'none';
    viderSelection('rep');
  };
  brancherFiltres('rep', function () { majListeSelectionnable('rep'); });

  document.querySelectorAll('#reparations-list .btn-rep-fiche').forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      var ong = document.querySelector('.tab[data-t="materiel"]');
      if (ong) ong.click();
      ouvrirFicheExemplaire(Number(b.dataset.mat));
      /* ouvre directement le formulaire de cloture, comme "Controler" depuis
         la liste "Controles a realiser" (meme pattern, meme delai). */
      setTimeout(function () {
        var bc = document.querySelector('#ficheBoutons [data-act="reparation"]');
        if (bc) bc.click();
      }, 60);
    };
  });
  var soR = document.getElementById('epiCompteRep');
  if (soR) soR.textContent = enReparation.length ? ' (' + enReparation.length + ')' : '';

  /* Entretien : rendu dans la meme passe que les autres sous-onglets, AVANT
     le cablage global des .badge-clic plus bas (les marquages de
     l'historique en dependent). */
  renderEntretiens();

  /* Budget */
  document.getElementById('budget-actions').innerHTML =
    '<div class="barre-actions">' +
      '<button id="btnToggleAchat">+ Nouvelle commande</button>' +
      '<span id="budgetFlash" class="form-msg"></span>' +
    '</div>' +
    '<div id="formAchat" class="form-panel" style="display:none">' +
      '<p class="hint">Pour une commande qui ne cree pas de lot : reassort, réparation, ' +
        'ou achat saisi après coup. Rattachez ensuite les lots concernes en les éditant.</p>' +
      '<div class="form-grid">' +
        field('Référence', '<input id="naRef" type="text" placeholder="CMD-2026-02">') +
        field('Fournisseur', '<select id="naFournisseur"></select>') +
        field('Date de commande', '<input id="naDateCommande" type="date">') +
        field('Date de réception', '<input id="naDateReception" type="date">') +
        field('Montant total (\u20ac)', '<input id="naMontant" type="number" step="0.01">') +
        field('Financement', '<select id="naFinancement">' + optionsChoix(financementChoices) + '</select>') +
        (aColonne('achats', 'note_financement') ? field('Note financement (facultatif)', '<input id="naNote" type="text" placeholder="provenance du don / de la subvention">') : '') +
      '</div>' +
      '<div class="form-actions">' +
        '<button id="btnSubmitAchat">Enregistrer</button>' +
        '<button type="button" class="secondary" id="btnCancelAchat">Annuler</button>' +
        '<span id="naMsg" class="form-msg"></span>' +
      '</div>' +
    '</div>';
  document.getElementById('btnToggleAchat').onclick = function () {
    var f = document.getElementById('formAchat');
    f.style.display = (f.style.display === 'none') ? 'block' : 'none';
  };
  document.getElementById('naFournisseur').innerHTML = optionsFor(refLists.fournisseurs, 'nom');
  document.getElementById('btnSubmitAchat').onclick = creerAchat;
  document.getElementById('btnCancelAchat').onclick = function () { document.getElementById('formAchat').style.display = 'none'; viderFormulaire('formAchat'); };

  /* Filtre annee + financement. Les deux premieres cartes suivent le filtre ;
     le renouvellement reste une fenetre glissante, donc explicitement hors filtre. */
  var achatsVisibles = achats.filter(function (a) {
    if (filtresAchats.annee && a.annee !== filtresAchats.annee) return false;
    if (filtresAchats.financement && a.financement !== filtresAchats.financement) return false;
    return true;
  }).sort(function (a, b) { return b.ts - a.ts; });

  var anneesDispo = {};
  achats.forEach(function (a) { if (a.annee) anneesDispo[a.annee] = true; });
  var listeAnnees = Object.keys(anneesDispo).sort().reverse();

  var totalVisible = achatsVisibles.reduce(function (s2, a) { return s2 + a.montant; }, 0);
  var filtreAchatActif = !!(filtresAchats.annee || filtresAchats.financement);
  var portee = filtresAchats.annee || 'toutes années';
  if (filtresAchats.financement) portee += ' \u00b7 ' + filtresAchats.financement;

  document.getElementById('budget-list').innerHTML =
    '<div class="cards">' +
      '<div class="card"><p class="label">Dépense &mdash; ' + esc(portee) + '</p>' +
        '<p class="value">' + money(totalVisible) + '</p></div>' +
      '<div class="card"><p class="label">Commandes</p><p class="value">' + achatsVisibles.length + '</p>' +
        (filtreAchatActif ? '<p class="card-sous">sur ' + achats.length + ' au total</p>' : '') + '</div>' +
      '<div class="card"><p class="label">Renouvellement 12 mois</p><p class="value">' + money(renouvellement) + '</p>' +
        '<p class="card-sous">12 derniers mois, hors filtre</p></div>' +
    '</div>' +

    '<div class="filtres">' +
      '<div class="filtre-champ"><label>Année</label><select id="faAnnee">' +
        '<option value="">Toutes</option>' +
        listeAnnees.map(function (an) {
          return '<option value="' + an + '"' + (an === filtresAchats.annee ? ' selected' : '') + '>' + an + '</option>';
        }).join('') +
      '</select></div>' +
      '<div class="filtre-champ"><label>Financement</label><select id="faFin">' +
        '<option value="">Tous</option>' +
        optionsChoix(financementChoices, filtresAchats.financement) +
      '</select></div>' +
      '<div class="filtre-champ" style="flex:0 0 auto"><label>&nbsp;</label>' +
        '<button class="secondary" id="faExport">Exporter (CSV)</button></div>' +
      (filtreAchatActif
        ? '<div class="filtre-champ" style="flex:0 0 auto"><label>&nbsp;</label>' +
          '<button class="secondary" id="faReset">Reinitialiser</button></div>'
        : '') +
    '</div>' +

    '<div class="encadre">Les achats se créent depuis la rubrique Matériel, avec le lot correspondant.</div>' +
    '<h2 class="section-titre" style="margin-top:14px">Commandes' +
      (achatsVisibles.length ? ' <span class="titre-compte">' + achatsVisibles.length + '</span>' : '') + '</h2>' +
    '<div class="scroll-y">' +
    '<table><tr><th>Commande</th><th>Fournisseur</th><th>Date</th><th>Lots</th><th>Montant</th><th>Financement</th>' +
    (aColonne('achats', 'facture') ? '<th>Facture</th>' : '') + '<th></th></tr>' +
    (achatsVisibles.map(function (a) {
      return '<tr><td>' + a.ref + '</td><td>' + a.fournisseur + '</td><td>' + a.date + '</td>' +
        '<td>' + a.lots + '</td><td>' + money(a.montant) + '</td><td>' + esc(a.financement) + (a.note ? ' <span class="hint">\u2014 ' + esc(a.note) + '</span>' : '') + '</td>' +
        (aColonne('achats', 'facture') ? '<td><span id="achatFacture-' + a.id + '"></span></td>' : '') +
        '<td class="td-actions"><div>' +
          (aColonne('achats', 'facture') ? boutonPJ({
            cleTable: 'achats', colonne: 'facture', ligneId: a.id, accept: 'image/*,application/pdf', remplacer: true,
            dejaPresent: idsPiecesJointes(a.facture).length > 0,
            texteAjout: 'Facture +', texteModifier: 'Modifier la facture',
            titreAjout: 'Ajouter la facture',
            titreModifier: 'Remplacer la facture de cet achat',
            confirmMsg: 'Une facture est déjà associée à cet achat. Voulez-vous vraiment la remplacer ?'
          }) : '') +
          btnEditer('achat', a.id, "Editer l'achat") + btnSupprimer('achat', a.id) + '</div></td></tr>';
    }).join('') || '<tr><td colspan="' + (aColonne('achats', 'facture') ? 8 : 7) + '">' +
        (filtreAchatActif ? 'Aucune commande avec ces filtres.' : 'Aucun achat enregistré.') + '</td></tr>') +
    '</table></div>';

  document.getElementById('faAnnee').onchange = function () { filtresAchats.annee = this.value; load(); };
  document.getElementById('faFin').onchange = function () { filtresAchats.financement = this.value; load(); };
  document.getElementById('faExport').onclick = function () { exporterAchats(achatsVisibles, portee); };
  var faR = document.getElementById('faReset');
  if (faR) faR.onclick = function () { filtresAchats = { annee: '', financement: '' }; load(); };
  brancherBoutonsEdit('budget-list');
  document.querySelectorAll('#budget-list input[type="file"][data-pj-table]').forEach(function (inp) {
    inp.onchange = function () { surChoixPieceJointe(inp); };
  });
  remplirDocsAchats();

  appliquerConfig();
  renderRefs();

  /* un marquage clique, ou qu'il soit, ouvre la fiche de l'exemplaire */
  document.querySelectorAll('.badge-clic').forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      var ongletMat = document.querySelector('.tab[data-t="materiel"]');
      if (ongletMat && !ongletMat.classList.contains('active')) ongletMat.click();
      ouvrirFicheExemplaire(Number(b.dataset.mat));
    };
  });

  /* badge "Examen requis" : navigate vers le sous-onglet Incidents pour voir le contexte
     de l'incident avant de realiser le controle. Le bouton "Contrôler" du tableau reste
     pour l'acces direct au formulaire de controle. */
  brancherBadgesAction();

  /* badge "Controle echu / Jamais controle" cliquable : bascule sur Controles, incidents et reparations */
  document.querySelectorAll('.badge-goto-ctrl').forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      var ongletCtrl = document.querySelector('.tab[data-t="controles"]');
      if (ongletCtrl) ongletCtrl.click();
    };
  });

  /* badge "Prêté" cliquable : bascule sur Prêts et filtre le bon de cet exemplaire */
  document.querySelectorAll('.badge-goto-pret').forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      var ongletPrets = document.querySelector('.tab[data-t="prets"]');
      if (ongletPrets) ongletPrets.click();
      /* filtrer sur le bon si le numero est connu */
      var bon = b.dataset.bon;
      if (bon) {
        setTimeout(function () {
          var filtre = document.getElementById('filtreBon');
          if (filtre) { filtre.value = bon; filtre.dispatchEvent(new Event('input')); }
          /* ouvrir le bon correspondant */
          var bonEl = document.querySelector('#prets-list .bon[data-bon="' + bon + '"]');
          if (bonEl && !bonEl.classList.contains('ouvert')) bonEl.click();
          if (bonEl) defilerVers(bonEl, { block: 'nearest' });
        }, 150);
      }
    };
  });

  /* bouton Contrôler rapide (tableau lot) et Réaliser le contrôle (liste incidents) */
  document.querySelectorAll('.btn-controler-rapide, .btn-realiser-ctrl').forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      var matId = Number(b.dataset.mat);
      var ongletMat = document.querySelector('.tab[data-t="materiel"]');
      if (ongletMat) ongletMat.click();
      setTimeout(function () {
        ouvrirFicheExemplaire(matId);
        ficheAction(matId, 'controler', pretOuvertDe(matId), TYPE_CONTROLE_DEFAUT[1]);
      }, 50);
    };
  });

  /* bouton Retrouve rapide (2026.5.35) : ouvre la fiche sur le formulaire « Declarer retrouve » */
  document.querySelectorAll('.btn-retrouve-rapide').forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      var matId = Number(b.dataset.mat);
      var ongletMat = document.querySelector('.tab[data-t="materiel"]');
      if (ongletMat) ongletMat.click();
      setTimeout(function () { ouvrirFicheExemplaire(matId); ficheAction(matId, 'retrouve', null); }, 50);
    };
  });

  /* bouton Reparer rapide (tableau lot) : meme principe que Controler rapide,
     mais ouvre le formulaire de cloture de reparation plutot qu'un controle. */
  document.querySelectorAll('.btn-reparation-rapide').forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      var matId = Number(b.dataset.mat);
      var ongletMat = document.querySelector('.tab[data-t="materiel"]');
      if (ongletMat) ongletMat.click();
      setTimeout(function () {
        ouvrirFicheExemplaire(matId);
        ficheAction(matId, 'reparation', pretOuvertDe(matId));
      }, 50);
    };
  });

  verifierReferences();
}

/* ---------------------- editeur generique ---------------------- */

function optionsChoix(choices, selected) {
  return (choices || []).map(function (c) {
    return '<option' + (c === selected ? ' selected' : '') + '>' + esc(c) + '</option>';
  }).join('');
}

/* Le prêt ouvert d'UN exemplaire precis, jamais du bon dans son ensemble :
   un bon peut regrouper plusieurs exemplaires, chacun a sa propre ligne
   EMPRUNTS (son propre date_retour_effective) — c'est ce qui permet deja
   de rendre 2 objets sur 3 sans toucher au 3e. Meme principe ici : reformer
   un exemplaire ne doit jamais affecter le pret d'un autre exemplaire du
   meme bon. */
function blocFermerPret(matId) {
  var p = pretOuvertDe(matId);
  if (!p) return '';
  var nomAdh = mapById(refLists.adherents, 'nom_complet')[p.adherent] || 'un adhérent';
  return '<label class="coche" style="grid-column:1/-1;margin:2px 0">' +
    '<input type="checkbox" data-ff="fermer-pret" checked> ' +
    '<b>Cet exemplaire est actuellement pr\u00eat\u00e9 \u00e0 ' + esc(nomAdh) +
    '</b> (depuis le ' + fmtDate(p.date_emprunt) + ') \u2014 cl\u00f4turer aussi ce pr\u00eat</label>';
}

function pretsOuvertsParmi(matIds) {
  return matIds.map(function (id) { return { matId: id, pret: pretOuvertDe(id) }; })
    .filter(function (x) { return x.pret; });
}

function blocFermerPretsMultiples(matIds) {
  var trouves = pretsOuvertsParmi(matIds);
  if (!trouves.length) return '';
  var matMap = mapById(refLists.materiels, 'numero_marquage');
  var adhMap = mapById(refLists.adherents, 'nom_complet');
  var liste = trouves.map(function (x) {
    return esc(matMap[x.matId] || '#' + x.matId) + ' (' + esc(adhMap[x.pret.adherent] || '?') + ')';
  }).join(', ');
  return '<label class="coche" style="grid-column:1/-1;margin:2px 0">' +
    '<input type="checkbox" data-ff="fermer-prets" checked> ' +
    '<b>' + trouves.length + ' exemplaire(s) parmi les coch\u00e9s sont actuellement en pr\u00eat</b> : ' +
    liste + ' \u2014 cl\u00f4turer aussi ces pr\u00eats</label>';
}

function pretOuvertDe(matId) {
  return (rawRows.emprunts || []).filter(function (e) {
    return e.materiel === matId && !e.date_retour_effective;
  })[0] || null;
}

function esc(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

var EDITABLE = {
  lot: {
    key: 'lots', pane: 'materiel-editor', titre: 'Modifier le lot',
    lier: function (box, rowId) {
      /* avertissement nom = categorie (editeur de lot) */
      var nomEd = box.querySelector('[data-f="designation"]');
      var catEd = box.querySelector('[data-f="categorie"]');
      if (nomEd && catEd) {
        var majNom = brancherAlerteNomLot(nomEd, function () { return catEd.value; }, nomEd.closest('.form-field'));
        if (majNom) catEd.addEventListener('change', majNom);
      }
      if (rowId != null) {
        var actions = box.querySelector('.form-actions');
        if (actions && !box.querySelector('.ed-complete')) {
          var extra = document.createElement('div');
          extra.className = 'ed-complete';
          extra.style.cssText = 'margin:12px 0 4px;padding-top:10px;border-top:1px solid var(--ice-border,#D0D9EC)';
          var ligneLot = (rawRows.lots || []).filter(function (l) { return l.id === rowId; })[0];
          extra.innerHTML =
            '<p class="hint" style="margin:0 0 6px;font-weight:600;color:var(--navy,#1B3668)">Compl\u00e9ter ce lot</p>' +
            '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
              '<button type="button" class="secondary" id="edAddExemplaires">+ Ajouter des exemplaires</button>' +
              (aColonne('lots', 'photo') ? boutonPJ({
                cleTable: 'lots', colonne: 'photo', ligneId: rowId, accept: 'image/*', remplacer: true,
                dejaPresent: idsPiecesJointes(ligneLot && ligneLot.photo).length > 0,
                texteAjout: '+ Photo', texteModifier: 'Modifier la photo',
                titreAjout: 'Ajouter une photo du mod\u00e8le',
                titreModifier: 'Remplacer la photo du mod\u00e8le',
                confirmMsg: 'Une photo est déjà associée à ce lot. Voulez-vous vraiment la remplacer ?'
              }) : '') +
              (aColonne('lots', 'notice') ? boutonPJ({
                cleTable: 'lots', colonne: 'notice', ligneId: rowId, accept: 'image/*,application/pdf', remplacer: true,
                dejaPresent: idsPiecesJointes(ligneLot && ligneLot.notice).length > 0,
                texteAjout: '+ Notice', texteModifier: 'Modifier la notice',
                titreAjout: 'Ajouter la notice du fabricant',
                titreModifier: 'Remplacer la notice du fabricant',
                confirmMsg: 'Une notice est déjà associée à ce lot. Voulez-vous vraiment la remplacer ?'
              }) : '') +
            '</div>' +
            '<p class="hint" style="margin:6px 0 0">Ajoute des exemplaires (marquages \u00e0 la suite) ou une pi\u00e8ce jointe, sans toucher \u00e0 l\'existant.</p>';
          actions.parentNode.insertBefore(extra, actions);
          if (aColonne('materiels', 'numero_serie')) {
            var bSerie = document.createElement('button');
            bSerie.type = 'button'; bSerie.className = 'secondary'; bSerie.id = 'edSaisirSeries';
            bSerie.textContent = 'Saisir les num\u00e9ros de s\u00e9rie';
            var bAdd = extra.querySelector('#edAddExemplaires');
            if (bAdd) bAdd.insertAdjacentElement('afterend', bSerie);
            extra.insertAdjacentHTML('beforeend', '<div id="edSeriesGrille"></div>');
            bSerie.onclick = function () { ouvrirGrilleSeries(ligneLot, extra.querySelector('#edSeriesGrille')); };
          }
          extra.insertAdjacentHTML('beforeend', blocCommandeLot(ligneLot));
          brancherBlocCommandeLot(extra, ligneLot);
          extra.querySelector('#edAddExemplaires').onclick = function () { ouvrirAjoutExemplaires(rowId); };
          extra.querySelectorAll('input[type="file"][data-pj-table]').forEach(function (inp) {
            inp.onchange = function () { surChoixPieceJointe(inp); };
          });
        }
      }
      var cat = box.querySelector('[data-f="categorie"]');
      var duree = box.querySelector('[data-f="duree_vie_mois"]');
      if (!cat || !duree) return;
      function maj() { griserDuree(duree, categorieNonSoumise(cat.value), 'vide = selon controle'); }
      cat.addEventListener('change', maj);
      maj();
    },
    fields: [
      { id: 'designation', label: 'Désignation', type: 'text' },
      { id: 'categorie', label: 'Catégorie', type: 'ref', list: 'categories', labelCol: 'nom' },
      { id: 'fabricant', label: 'Fabricant', type: 'text' },
      { id: 'modele', label: 'Modèle', type: 'text' },
      { id: 'date_fabrication', label: 'Date de fabrication', type: 'date' },
      { id: 'duree_vie_mois', label: 'Durée de vie (mois)', type: 'number' },
      { id: 'prix_unitaire', label: 'Prix unitaire (\u20ac)', type: 'number' },
      { id: 'achat', label: 'Commande d\'origine', type: 'ref', list: 'achats', labelCol: 'ref_commande' },
      { id: 'commentaire', label: 'Commentaire', type: 'text' }
    ]
  },
  materiel: {
    key: 'materiels', pane: 'materiel-editor', titre: 'Modifier l\'exemplaire',
    valideur: function (fields, rowId) {
      /* un marquage en double est une erreur, jamais un choix : on refuse la
         collision avec un AUTRE exemplaire (comparaison normalisee).
         L'edition reste libre pour corriger l'existant. */
      var nm = normMarquage(fields.numero_marquage);
      if (!nm) return null;
      var conflit = refLists.materiels.filter(function (m) {
        return m.id !== rowId && normMarquage(m.numero_marquage) === nm;
      })[0];
      if (conflit) return 'Le marquage "' + fields.numero_marquage + '" est déjà porte par un autre exemplaire.';
      /* une sortie d'inventaire (perte, vol, reforme, cession) est une decision qui doit
         rester comprehensible plus tard : le commentaire n'est pas facultatif dans ce cas.
         Garde sur aColonne : aucun changement de comportement tant que la colonne n'existe pas. */
      if (fields.hors_service_motif && aColonne('materiels', 'commentaire') && !(fields.commentaire || '').trim()) {
        return 'Précisez la cause de la sortie d\'inventaire dans le commentaire (usure, rappel fabricant, décision du bureau...).';
      }
      return null;
    },
    fields: [
      { id: 'numero_marquage', label: 'Numéro de marquage', type: 'text' },
      { id: 'numero_serie', colonne: 'numero_serie', label: 'Numéro de série du fabricant (facultatif)', type: 'text' },
      { id: 'couleur', colonne: 'couleur', label: 'Couleur (facultatif)', type: 'text' },
      { id: 'taille', colonne: 'taille', label: 'Taille (facultatif)', type: 'text' },
      { id: 'lot', label: 'Lot', type: 'ref', list: 'lots', labelCol: 'designation', requis: true },
      { id: 'lieu_stockage', label: 'Lieu de stockage', type: 'ref', list: 'lieux', labelCol: 'nom' },
      { id: 'date_mise_en_service', label: 'Date de mise en service', type: 'date' },
      { id: 'hors_service_motif', colonne: 'hors_service_motif', label: 'Sortie d\'inventaire',
        type: 'choice', options: [''].concat(MOTIFS_HORS_SERVICE) },
      { id: 'hors_service_date', colonne: 'hors_service_date', label: 'Date de sortie', type: 'date' },
      { id: 'commentaire', colonne: 'commentaire', label: 'Commentaire', type: 'text' }
    ],
    lier: function (box, rowId) {
      /* photos individuelles de l'exemplaire (2026.5.27) : meme bloc que les controles et incidents
         (jusqu'a MAX_PHOTOS_PJ, ajout et suppression a l'unite) ; sans effet si la colonne n'existe pas */
      ajouterBlocPhotos(box, 'materiels', rowId);
      var sel = box.querySelector('[data-f="hors_service_motif"]');
      var champComment = box.querySelector('[data-f="commentaire"]');
      if (!sel || !champComment) return;
      var label = champComment.closest('.form-field').querySelector('label');
      var champFermer = document.createElement('div');
      champFermer.className = 'form-field';
      champFermer.style.cssText = 'grid-column:1/-1';
      champFermer.innerHTML = rowId != null ? blocFermerPret(rowId) : '';
      champComment.closest('.form-field').insertAdjacentElement('afterend', champFermer);
      var avant = rowId != null ? (rawRows.materiels.filter(function (x) { return x.id === rowId; })[0] || {}) : {};
      var avisRetour = document.createElement('p');
      avisRetour.className = 'hint'; avisRetour.style.cssText = 'grid-column:1/-1;margin:0';
      avisRetour.textContent = 'Retirer une perte ou un vol enregistre un incident : l\u2019exemplaire passera en \u00ab Examen requis \u00bb ' +
        'jusqu\u2019\u00e0 son prochain contr\u00f4le. Le commentaire de perte est recopi\u00e9 dans l\u2019incident.';
      sel.closest('.form-field').insertAdjacentElement('afterend', avisRetour);
      var maj = function () {
        if (sel.value) { label.textContent = 'Commentaire — précisez la cause (usure, rappel fabricant, décision du bureau...)'; }
        else { label.textContent = 'Commentaire'; }
        champFermer.style.display = sel.value ? '' : 'none';
        avisRetour.style.display = (!sel.value && estPerduOuVole(avant.hors_service_motif)) ? '' : 'none';
      };
      sel.addEventListener('change', maj);
      maj();
    },
    apres: function (rowId, fields, ancien) {
      /* (2026.5.35) sortie Perdu/Vole retiree a la main : meme ecriture que « Declarer retrouve »
         (incident de controle, commentaire recopie), pour qu'aucun chemin ne remette en service
         sans examen. Une erreur de saisie sur Reforme / Cede se corrige toujours librement. */
      if (!fields.hors_service_motif && ancien && estPerduOuVole(ancien.hors_service_motif)) {
        return actionsRetrouve(ancien, Math.round(Date.now() / 1000), 'Sortie d\u2019inventaire retir\u00e9e dans l\u2019\u00e9diteur', fields);
      }
      if (!fields.hors_service_motif) return [];
      var box = document.getElementById('materiel-editor');
      var chk = box && box.querySelector('[data-ff="fermer-pret"]');
      if (!chk || !chk.checked) return [];
      var pr = pretOuvertDe(rowId);
      if (!pr) return [];
      var etatFerm = (fields.hors_service_motif === 'Perdu' || fields.hors_service_motif === 'Vole')
        ? fields.hors_service_motif : 'Degrade';
      return [['UpdateRecord', resolvedNames.emprunts, pr.id, {
        date_retour_effective: Math.round(Date.now() / 1000), etat_retour: etatFerm
      }]];
    },
    avertissement: 'Le statut n\'est plus saisi : il découle des faits (contrôles, prêts, incidents, fin de vie). ' +
      'Seule une sortie d\'inventaire se decide à la main.'
  },
  emprunt: {
    key: 'emprunts', pane: 'prets-editor', titre: 'Modifier le prêt',
    fields: [
      { id: 'materiel', label: 'Matériel', type: 'ref', list: 'materiels', labelCol: 'numero_marquage' },
      { id: 'adherent', label: 'Adhérent', type: 'ref', list: 'adherents', labelCol: 'nom_complet' },
      { id: 'date_emprunt', label: 'Date d\'emprunt', type: 'date' },
      { id: 'date_retour_prevue', label: 'Retour prevu', type: 'date' },
      { id: 'date_retour_effective', label: 'Retour effectif', type: 'date' },
      { id: 'etat_retour', label: 'Etat au retour', type: 'choice', options: ['', 'Bon etat', 'Degrade', 'Perdu', 'Non rendu'] },
      { id: 'sortie_activite', label: 'Sortie / activité', type: 'text' }
    ],
  },
  controle: {
    key: 'controles', pane: 'controles-editor', titre: 'Modifier le contrôle',
    avertissement: 'Modifier un contrôle réécrit la fiche de vie de l\'exemplaire. Grist conserve l\'historique du document, mais la correction n\'apparaîtra pas dans le widget.',
    valideur: function (fields) {
      if (fields.resultat === 'Reforme' && !(fields.commentaire || '').trim()) {
        return 'Précisez la cause de la reforme dans le commentaire.';
      }
      return null;
    },
    fields: [
      { id: 'materiel', label: 'Matériel', type: 'ref', list: 'materiels', labelCol: 'numero_marquage' },
      { id: 'date_controle', label: 'Date du controle', type: 'date' },
      { id: 'controleur', label: 'Contrôleur', type: 'ref', list: 'adherents', labelCol: 'nom_complet' },
      { id: 'resultat', label: 'Résultat du contrôle', type: 'choice', options: RESULTATS_CONTROLE },
      { id: 'commentaire', label: 'Commentaire', type: 'text' },
      { id: 'type_controle', label: 'Type de contrôle', type: 'choice',
        colonne: 'type_controle',
        options: typeControleChoices }
    ],
    lier: function (box, rowId) {
      ajouterBlocPhotos(box, 'controles', rowId);
      var sel = box.querySelector('[data-f="resultat"]');
      var champ = box.querySelector('[data-f="commentaire"]');
      if (!sel || !champ) return;
      var label = champ.closest('.form-field').querySelector('label');
      var champMat = box.querySelector('[data-f="materiel"]');
      var champFermer = document.createElement('div');
      champFermer.className = 'form-field';
      champFermer.style.cssText = 'grid-column:1/-1';
      champ.closest('.form-field').insertAdjacentElement('afterend', champFermer);
      var maj = function () {
        label.textContent = sel.value === 'Reforme'
          ? 'Commentaire \u2014 précisez la cause (usure, rappel fabricant, décision du bureau...)'
          : sel.value === 'A surveiller'
          ? 'Commentaire \u2014 précisez ce qu\'il faut surveiller (facultatif)'
          : 'Commentaire';
        var mId = champMat && champMat.value ? Number(champMat.value) : null;
        champFermer.innerHTML = (sel.value === 'Reforme' && mId) ? blocFermerPret(mId) : '';
      };
      sel.addEventListener('change', maj);
      maj();
    },
    apres: function (rowId, fields) {
      if (fields.resultat !== 'Reforme' || !fields.materiel) return [];
      var box = document.getElementById('controles-editor');
      var chk = box && box.querySelector('[data-ff="fermer-pret"]');
      if (!chk || !chk.checked) return [];
      var pr = pretOuvertDe(fields.materiel);
      if (!pr) return [];
      return [['UpdateRecord', resolvedNames.emprunts, pr.id, {
        date_retour_effective: Math.round(Date.now() / 1000), etat_retour: 'Degrade'
      }]];
    }
  },
  incident: {
    key: 'incidents', pane: 'incidents-editor', titre: 'Modifier l\'incident',
    valideur: function (fields) {
      if (aColonne('incidents', 'suite') && fields.suite === 'Mise au rebut immediate' && !(fields.description || '').trim()) {
        return 'Décrivez les faits qui justifient la mise au rebut, dans la description.';
      }
      return null;
    },
    fields: [
      { id: 'materiel', label: 'Matériel', type: 'ref', list: 'materiels', labelCol: 'numero_marquage' },
      { id: 'date_incident', label: 'Date de l\'incident', type: 'date' },
      { id: 'gravite', label: 'Gravite', type: 'choice', options: ['Mineure', 'Moderee', 'Grave'] },
      { id: 'suite', colonne: 'suite', label: 'Suite a donner', type: 'choice', options: SUITES },
      { id: 'description', label: 'Description', type: 'text' }
    ],
    lier: function (box, rowId) {
      ajouterBlocPhotos(box, 'incidents', rowId);
      var sel = box.querySelector('[data-f="suite"]');
      var champ = box.querySelector('[data-f="description"]');
      if (!sel || !champ) return;
      var label = champ.closest('.form-field').querySelector('label');
      var champMat = box.querySelector('[data-f="materiel"]');
      var champFermer = document.createElement('div');
      champFermer.className = 'form-field';
      champFermer.style.cssText = 'grid-column:1/-1';
      champ.closest('.form-field').insertAdjacentElement('afterend', champFermer);
      var maj = function () {
        label.textContent = sel.value === 'Mise au rebut immediate'
          ? 'Description \u2014 décrivez les faits qui justifient la mise au rebut'
          : 'Description';
        var mId = champMat && champMat.value ? Number(champMat.value) : null;
        champFermer.innerHTML = (sel.value === 'Mise au rebut immediate' && mId) ? blocFermerPret(mId) : '';
      };
      sel.addEventListener('change', maj);
      maj();
    },
    apres: function (rowId, fields) {
      if (fields.suite !== 'Mise au rebut immediate' || !fields.materiel) return [];
      var box = document.getElementById('incidents-editor');
      var chk = box && box.querySelector('[data-ff="fermer-pret"]');
      if (!chk || !chk.checked) return [];
      var pr = pretOuvertDe(fields.materiel);
      if (!pr) return [];
      return [['UpdateRecord', resolvedNames.emprunts, pr.id, {
        date_retour_effective: Math.round(Date.now() / 1000), etat_retour: 'Degrade'
      }]];
    }
  },
  categorie: {
    key: 'categories', pane: 'refs-editor', titre: 'Modifier la catégorie',
    lier: function (box) {
      var type = box.querySelector('[data-f="type_epi"]');
      var duree = box.querySelector('[data-f="duree_vie_defaut_mois"]');
      var note = box.querySelector('[data-f="natureNote"]');
      var maint = box.querySelector('[data-f="maintenance_fabricant"]');
      var maintWrap = maint ? maint.closest('.form-field') : null;
      var reparNote = box.querySelector('[data-f="reparations_acceptees"]');
      var prolong = box.querySelector('[data-f="prolongation_par_reparation"]');
      var prolongWrap = prolong ? prolong.closest('.form-field') : null;
      var reparNoteWrap = reparNote ? reparNote.closest('.form-field') : null;
      var avecMaintenance = aColonne('categories', 'maintenance_fabricant');
      if (!type) return;
      function maj() {
        if (duree) griserDuree(duree, type.value === 'Non soumis a vieillissement');
        var coche = maint ? maint.checked : false;
        if (note) {
          var f = NATURE_EPI_NOTES[type.value];
          note.innerHTML = f ? f(avecMaintenance, coche, reparNote ? reparNote.value : '') : '';
        }
        /* la case "maintenance prevue par le fabricant" n'a de sens que pour
           un EPI : pour un non-EPI la reparation est deja libre sans condition */
        /* (2026.5.14) case visible pour TOUTES les natures, non-EPI compris */
        if (maintWrap) maintWrap.style.display = '';
        /* la liste des reparations acceptees n'a de sens QUE si la reparation
           est reellement ouverte pour cette categorie : EPI + case cochee.
           Sinon rien a preciser, la reponse est deja "reforme systematique". */
        if (reparNoteWrap) reparNoteWrap.style.display = coche ? '' : 'none';
        /* prolongation : n'a de sens que si la reparation est ouverte ; sans
           maintenance cochee, masquee ET decochee (pas de categorie incoherente) */
        if (prolongWrap) {
          /* (2026.5.14) et seulement si le materiel vieillit : sans fin de vie
             calendaire (non soumis, non-EPI), il n'y a rien a prolonger */
          var ouvert = type.value === 'Soumis a vieillissement' && coche;
          prolongWrap.style.display = ouvert ? '' : 'none';
          if (!ouvert) prolong.checked = false;
        }
      }
      type.addEventListener('change', maj);
      /* la note doit aussi refleter le cochage/decochage en direct : sans ce
         second listener, cocher la case laissait affiche "reparation fermee"
         jusqu'au prochain changement de nature. */
      if (maint) maint.addEventListener('change', maj);
      /* et refleter la saisie en direct dans l'encadre au-dessus, comme les
         deux autres : coherence d'ensemble du formulaire. */
      if (reparNote) reparNote.addEventListener('input', maj);
      maj();
    },
    valideur: function (fields, rowId) {
      /* le prefixe doit etre unique entre categories, sinon l'ambiguite
         remonte d'un cran */
      var pr = normMarquage(fields.prefixe);
      if (!pr) return null;
      var conflit = refLists.categories.filter(function (c) {
        return c.id !== rowId && normMarquage(c.prefixe) === pr;
      })[0];
      return conflit
        ? 'Le préfixe "' + fields.prefixe + '" est déjà utilise par la catégorie "' + conflit.nom + '".'
        : null;
    },
    fields: [
      { id: 'nom', label: 'Nom', type: 'text', requis: true },
      /* Le libelle technique historique ("Soumis au vieillissement ?")
         n'annonce qu'une des deux choses que ce champ decide desormais : la
         fin de vie ET l'acces a la reparation (voir reparationOuverte()).
         NATURE_EPI_LABELS l'explicite sans toucher aux 3 valeurs stockees. */
      { id: 'type_epi', label: 'Nature réglementaire', type: 'choice', options: TYPES_EPI, optionLabels: NATURE_EPI_LABELS },
      { id: 'natureNote', type: 'note' },
      { id: 'duree_vie_defaut_mois', label: 'Durée de vie par défaut (mois)', type: 'number' },
      { id: 'prefixe', colonne: 'prefixe', label: 'Préfixe de marquage (ex. BAU-)', type: 'text' },
      /* Colonne facultative : son absence ferme la reparation pour TOUS les
         EPI de la categorie (voir reparationOuverte(), defaut le plus sur). */
      { id: 'maintenance_fabricant', colonne: 'maintenance_fabricant', type: 'checkbox',
        label: 'Maintenance prévue par le fabricant',
        hint: 'À cocher si la notice décrit une réparation ou un remplacement de pièces pour ' +
          'cette catégorie (ex. coiffe de casque, barrettes de crampons, panne de piolet). ' +
          'Ouvre le bouton \u00ab\u00a0D\u00e9clarer une r\u00e9paration\u00a0\u00bb pour ses exemplaires. ' +
          'Pour un mat\u00e9riel non-EPI (raquettes, sacs...)\u00a0: \u00e0 cocher s\u2019il se r\u00e9pare. ' +
          'En cas de doute, la notice du fabricant tranche.' },
      /* 2026.5.6 : juste sous la maintenance, dont elle depend (voir lier :
         masquee et decochee tant que la maintenance n'est pas cochee). */
      { id: 'prolongation_par_reparation', colonne: 'prolongation_par_reparation', type: 'checkbox',
        label: 'Une r\u00e9paration peut prolonger la dur\u00e9e de vie',
        hint: '\u00c0 cocher si la pi\u00e8ce qui vieillit est rempla\u00e7able et que le reste ne se ' +
          'p\u00e9rime pas. Par exemple la sangle d\u2019une d\u00e9gaine\u00a0: ses mousquetons m\u00e9talliques ' +
          'ne vieillissent pas. \u00c0 la cl\u00f4ture de la r\u00e9paration, on indique la date de fabrication ' +
          'de la pi\u00e8ce neuve et sa dur\u00e9e de vie\u00a0: la nouvelle fin de vie de l\u2019exemplaire en ' +
          'd\u00e9coule. Ne pas cocher si l\u2019\u00e9l\u00e9ment qui vieillit ne se remplace pas\u00a0: corde, ' +
          'baudrier, coque d\u2019un casque (changer la coiffe ne rajeunit pas la coque). En cas de doute, la ' +
          'notice du fabricant tranche.' },
      /* Texte libre plutot que liste structuree : une reparabilite depend
         souvent du DOMMAGE precis, pas seulement de la piece ("la sangle
         d'une degaine se change, mais si un mousqueton montre des signes de
         fatigue c'est reforme direct malgre tout") — une checklist ne sait
         pas exprimer cette nuance, une phrase de notice si. Colonne
         facultative, revelee seulement si la reparation est ouverte (case
         cochee ci-dessus) : rien a preciser tant que la reponse generale
         est deja "reforme systematique". Reprise dans l'encadre "ouverte"
         au-dessus ET rappelee aux controleurs au moment de choisir
         "A reparer" (voir panneauNotesReparation, appele depuis les 5
         formulaires de controle/incident). */
      { id: 'reparations_acceptees', colonne: 'reparations_acceptees', type: 'textarea',
        label: 'R\u00e9parations g\u00e9n\u00e9ralement accept\u00e9es',
        hint: 'Ce que dit la notice, en langage courant : \u00ab\u00a0Sangles, coiffe, jugulaire. ' +
          'Le mousqueton reste hors r\u00e9paration : toute fatigue ou d\u00e9formation impose la ' +
          'r\u00e9forme.\u00a0\u00bb Facultatif, affich\u00e9 aux contr\u00f4leurs au moment de choisir ' +
          '\u00ab\u00a0\u00c0 r\u00e9parer\u00a0\u00bb.' },
      /* Question independante de maintenance_fabricant : la decoupe n'est pas
         une affaire de statut EPI mais de nature physique de l'objet (une
         corde ou une sangle se decoupe, un casque ou un mousqueton non).
         Toujours visible quelle que soit la nature reglementaire choisie —
         contrairement a maintenance_fabricant, pas d'exemption automatique
         a exprimer ici. Colonne facultative : son absence ferme la decoupe
         pour tous les exemplaires de la categorie (voir decoupeOuverte()). */
      { id: 'peut_etre_decoupe', colonne: 'peut_etre_decoupe', type: 'checkbox',
        label: 'Peut \u00eatre d\u00e9coup\u00e9 pour cr\u00e9er de nouveaux exemplaires',
        hint: 'Cordes, sangles, cordelettes : \u00e0 cocher si un exemplaire endommag\u00e9 peut ' +
          '\u00eatre recoup\u00e9 plut\u00f4t que r\u00e9form\u00e9 en entier. Ouvre l\u2019option ' +
          '\u00ab\u00a0D\u00e9coup\u00e9e\u00a0\u00bb pour ses exemplaires, dans la sous-rubrique ' +
          'R\u00e9parations.' }
    ]
  },
  lieu: {
    key: 'lieux', pane: 'refs-editor', titre: 'Modifier le lieu de stockage',
    fields: [
      { id: 'nom', label: 'Nom', type: 'text', requis: true },
      { id: 'description', label: 'Description', type: 'text' }
    ]
  },
  fournisseur: {
    key: 'fournisseurs', pane: 'refs-editor', titre: 'Modifier le fournisseur',
    fields: [
      { id: 'nom', label: 'Nom', type: 'text', requis: true },
      { id: 'contact', label: 'Contact', type: 'text' },
      { id: 'telephone', label: 'Téléphone', type: 'text' },
      { id: 'email', label: 'Email', type: 'text' }
    ]
  },
  adherent: {
    key: 'adherents', pane: 'refs-editor', titre: 'Modifier l\'adhérent',
    fields: [
      { id: 'nom_complet', label: 'Nom complet', type: 'text', requis: true },
      { id: 'numero_licence', label: 'Numéro de licence', type: 'text' },
      { id: 'role', colonne: 'role', label: 'Rôle', type: 'choice', options: roleChoices },
      { id: 'email', label: 'Email', type: 'text' },
      { id: 'telephone', label: 'Téléphone', type: 'text' }
    ]
  },
  achat: {
    key: 'achats', pane: 'budget-editor', titre: 'Modifier la commande',
    fields: [
      { id: 'ref_commande', label: 'Référence', type: 'text' },
      { id: 'fournisseur', label: 'Fournisseur', type: 'ref', list: 'fournisseurs', labelCol: 'nom' },
      { id: 'date_commande', label: 'Date de commande', type: 'date' },
      { id: 'date_reception', label: 'Date de réception', type: 'date' },
      { id: 'montant_total', label: 'Montant total (\u20ac)', type: 'number' },
      { id: 'financement', label: 'Financement', type: 'choice', options: financementChoices },
      { id: 'note_financement', colonne: 'note_financement', label: 'Note financement (facultatif)', type: 'text' }
    ]
  }
};

var PANES_EDITION = ['materiel-editor', 'prets-editor', 'controles-editor', 'incidents-editor', 'budget-editor', 'refs-editor'];

function viderFormulaire(formId) {
  var f = document.getElementById(formId);
  if (!f) return;
  f.querySelectorAll('input, select, textarea').forEach(function (el) {
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
    else el.value = '';
  });
  f.querySelectorAll('.form-msg').forEach(function (m) { m.textContent = ''; });
}

function fermerEditeurs() {
  PANES_EDITION.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
}

/* Les champs sont reperes par data-f et non par id : cinq editeurs coexistent
   dans le document, des id globaux se telescopaient d'un onglet a l'autre. */
function editorField(f, val) {
  var attr = 'data-f="' + f.id + '"';
  if (f.type === 'ref') {
    return '<div class="form-field"><label>' + f.label + '</label><select ' + attr + '>' +
      (f.list === 'lots'
        ? optionsLotsGroupes(refLists.lots, val, '<option value="">-</option>')
        : f.list === 'achats'
        ? optionsAchats(val)
        : optionsFor(refLists[f.list] || [], f.labelCol, val)) + '</select></div>';
  }
  if (f.type === 'choice') {
    /* optionLabels : libelle affiche distinct de la valeur stockee (ex. le
       champ nature reglementaire des categories, ou "Soumis a vieillissement"
       reste la valeur technique mais le libelle explicite les 3 options).
       value="" explicite sur chaque <option> pour que ce decouplage marche :
       sans lui, la valeur soumise serait le texte affiche, pas la constante. */
    return field(f.label, '<select ' + attr + '>' + f.options.map(function (o) {
      var texte = (f.optionLabels && f.optionLabels[o]) || o;
      return '<option value="' + esc(o) + '"' + (o === val ? ' selected' : '') + '>' + esc(texte) + '</option>';
    }).join('') + '</select>');
  }
  if (f.type === 'checkbox') {
    return '<div class="form-field" style="grid-column:1/-1">' +
      '<label class="coche"><input type="checkbox" ' + attr + (val ? ' checked' : '') + '> ' + f.label + '</label>' +
      (f.hint ? '<p class="hint" style="margin:2px 0 0 24px">' + f.hint + '</p>' : '') +
      '</div>';
  }
  if (f.type === 'textarea') {
    /* Texte libre multi-ligne : la collecte de valeur (saveCreator/saveEditor)
       traite deja ce cas via la branche generique "else fields[f.id] = v.trim()",
       un textarea exposant .value comme un input — rien a ajouter la-bas. */
    return '<div class="form-field" style="grid-column:1/-1">' +
      '<label>' + f.label + '</label>' +
      '<textarea ' + attr + ' rows="3" style="width:100%;box-sizing:border-box;' +
      'font:inherit;padding:8px 10px;border:1px solid var(--ice-border);' +
      'border-radius:6px;resize:vertical">' + esc(val) + '</textarea>' +
      (f.hint ? '<p class="hint" style="margin:4px 0 0">' + f.hint + '</p>' : '') +
      '</div>';
  }
  if (f.type === 'note') {
    /* champ purement informatif, mis a jour par le lier() de l'editeur (ex.
       la note sous "Nature reglementaire", qui change avec l'option choisie
       et desormais avec la case a cocher). En div + innerHTML, pas en <p> +
       textContent : le contenu est un encadre colore (voir
       blocReparationCategorie), pas une simple ligne de texte gris.
       Jamais envoye a Grist : filtre explicitement dans saveCreator/saveEditor. */
    return '<div class="form-field" style="grid-column:1/-1;margin-top:-6px">' +
      '<div ' + attr + '></div></div>';
  }
  if (f.type === 'date') {
    var d = toDate(val);
    return field(f.label, '<input ' + attr + ' type="date" value="' + (d ? d.toISOString().slice(0, 10) : '') + '">');
  }
  if (f.type === 'number') {
    return field(f.label, '<input ' + attr + ' type="number" step="0.01" value="' +
      (val === null || val === undefined ? '' : esc(val)) + '">');
  }
  return field(f.label, '<input ' + attr + ' type="text" value="' + esc(val) + '">');
}

function champsEditables(cfg) {
  return cfg.fields.filter(function (f) {
    return !f.colonne || aColonne(cfg.key, f.colonne);
  });
}

function openEditor(entity, rowId) {
  var cfg = EDITABLE[entity];
  var row = (rawRows[cfg.key] || []).filter(function (r) { return r.id === rowId; })[0];
  var box = document.getElementById(cfg.pane);
  if (!row || !box) return;
  fermerEditeurs();
  box.innerHTML =
    '<div class="form-panel">' +
      enteteFenetre(cfg.titre, objetEdite(entity, row)) +
      (cfg.avertissement ? '<p class="hint">' + cfg.avertissement + '</p>' : '') +
      /* encart contextuel pour les incidents "Contrôle à réaliser" non encore traités :
         explique que le traitement passe par l'enregistrement d'un contrôle, pas par
         la modification de cet incident. S'efface automatiquement si la suite est changée. */
      (entity === 'incident' && row.suite === 'Controle a realiser' && (function () {
          var d = toDate(row.date_incident);
          var suivi = (rawRows.controles || []).some(function (c) {
            var dc = toDate(c.date_controle);
            return c.materiel === row.materiel && dc && d && dc >= d;
          });
          return !suivi;
        })()
        ? '<div class="encadre" style="margin:0 0 10px;font-size:12px">' +
          '<b>Cet incident attend un contrôle.</b> ' +
          'Pour le clôturer, enregistrez un contrôle sur cet exemplaire — ' +
          'depuis la rubrique Matériel (badge « Examen requis » ou bouton « Contrôler ») ' +
          'ou depuis Suivi des EPI → Contrôles. ' +
          'L’incident restera consultable dans l’historique une fois traité.' +
          '</div>'
        : '') +
      '<div class="form-grid">' +
        champsEditables(cfg).map(function (f) { return editorField(f, row[f.id]); }).join('') +
      '</div>' +
      '<div class="form-actions">' +
        '<button class="ed-save">Enregistrer</button>' +
        '<button class="secondary ed-cancel">Annuler</button>' +
        '<span class="ed-msg form-msg"></span>' +
      '</div>' +
    '</div>';
  defilerVers(box, { block: 'nearest' });
  box.querySelector('.ed-save').onclick = function () { saveEditor(entity, rowId); };
  box.querySelector('.ed-cancel').onclick = function () { box.innerHTML = ''; };
  if (cfg.lier) cfg.lier(box, rowId);
}

/* Creation : memes champs que l'edition, valeurs vides.
   Une seule config pilote les deux — impossible qu'ils divergent. */
function openCreator(entity) {
  var cfg = EDITABLE[entity];
  var box = document.getElementById(cfg.pane);
  if (!box) return;
  fermerEditeurs();
  /* Seul appelant de openCreator (le bouton de Listes du club) : le
     remplacement de texte naif "Modifier" -> "Ajouter" laissait un
     article incorrect ("Ajouter la categorie" au lieu de "Ajouter une
     categorie"). BLOCS_REFS porte deja le bon accord, on le reutilise
     plutot que de fabriquer un deuxieme jeu de libelles. */
  var refBloc = BLOCS_REFS.filter(function (x) { return x.entity === entity; })[0];
  var titreAjout = refBloc ? 'Ajouter ' + refBloc.singulier : cfg.titre.replace('Modifier', 'Ajouter');
  box.innerHTML =
    '<div class="form-panel">' +
      '<h4 style="margin:0 0 10px;font-size:13px;color:var(--navy,#1B3668)">' +
        titreAjout + '</h4>' +
      '<div class="form-grid">' +
        champsEditables(cfg).map(function (f) { return editorField(f, ''); }).join('') +
      '</div>' +
      '<div class="form-actions">' +
        '<button class="ed-save">Ajouter</button>' +
        '<button class="secondary ed-cancel">Annuler</button>' +
        '<span class="ed-msg form-msg"></span>' +
      '</div>' +
    '</div>';
  defilerVers(box, { block: 'nearest' });
  box.querySelector('.ed-cancel').onclick = function () { box.innerHTML = ''; };
  box.querySelector('.ed-save').onclick = function () { saveCreator(entity); };
  if (cfg.lier) cfg.lier(box);
}

/* boxEl (facultatif, 2026.5.9) : formulaire rendu ailleurs que dans le
   panneau de l'entite (ex. commande creee depuis "Modifier le lot").
   apresCreation(newId) : actions a enchainer (ex. rattacher la commande). */
async function saveCreator(entity, boxEl, apresCreation) {
  var cfg = EDITABLE[entity];
  var box = boxEl || document.getElementById(cfg.pane);
  var msg = box.querySelector('.ed-msg');
  var fields = {};
  champsEditables(cfg).forEach(function (f) {
    if (f.type === 'note') return;   /* informatif seul : jamais envoye a Grist */
    var el = box.querySelector('[data-f="' + f.id + '"]');
    if (!el) return;
    if (f.type === 'checkbox') { fields[f.id] = el.checked; return; }
    if (el.disabled) { fields[f.id] = null; return; }
    var v = el.value;
    if (f.type === 'ref') fields[f.id] = v ? Number(v) : null;
    else if (f.type === 'number') fields[f.id] = num(v);
    else if (f.type === 'date') fields[f.id] = dateToTimestamp(v);
    else fields[f.id] = v.trim();
  });
  var manquant = champsEditables(cfg).filter(function (f) { return f.requis && !fields[f.id]; })[0];
  if (manquant) {
    msg.textContent = 'Le champ "' + manquant.label + '" est obligatoire.';
    msg.style.color = '#a3242a';
    return;
  }
  if (cfg.valideur) {
    var errC = cfg.valideur(fields, null);
    if (errC) { msg.textContent = errC; msg.style.color = '#a3242a'; return; }
  }
  msg.textContent = 'Ajout...'; msg.style.color = '#666';
  try {
    var newId = await ajouterEtObtenirId(cfg.key, fields);
    if (apresCreation) await apresCreation(newId);
    var notePhoto = '';
    var fInp = box.querySelector('#edPhotoCreation');
    if (fInp && fInp.files && fInp.files.length && aColonne(cfg.key, 'photo')) {
      var fichiers = Array.prototype.slice.call(fInp.files, 0, MAX_PHOTOS_PJ);
      var idsPhotos = [];
      for (var i = 0; i < fichiers.length; i++) {
        try { idsPhotos.push(await televerserFichierSeul(fichiers[i])); }
        catch (ePhoto) { notePhoto = ' (une photo n\'a pas pu \u00eatre jointe)'; }
      }
      if (idsPhotos.length) {
        try { await appliquer([['UpdateRecord', resolvedNames[cfg.key], newId, { photo: ['L'].concat(idsPhotos) }]]); }
        catch (eAtt) { notePhoto = ' (photo(s) non rattach\u00e9e(s))'; }
      }
    }
    box.innerHTML = '';
    var nomEntite = cfg.label || entity;
    flashToast(nomEntite + ' créé' + (notePhoto ? ' (photo non jointe)' : ''));
    setTimeout(function () { load(); }, 100);
  } catch (e) {
    msg.textContent = 'Erreur : ' + e.message;
    msg.style.color = '#a3242a';
    console.error(e);
  }
}

/* Garde-fous de dates a l'EDITION (comme a la creation) : lit les valeurs
   saisies dans l'editeur et refuse les combinaisons impossibles. */
function erreurDatesEditeur(entity, box, fields) {
  function v(id) { var el = box.querySelector('[data-f="' + id + '"]'); return el ? el.value : ''; }
  var regles = [];
  if (entity === 'emprunt') {
    regles.push({ avant: v('date_emprunt'), apres: v('date_retour_prevue'),
      si: 'La date de retour prévue ne peut pas précéder la date d\'emprunt.' });
    regles.push({ avant: v('date_emprunt'), apres: v('date_retour_effective'),
      si: 'La date de retour effective ne peut pas précéder la date d\'emprunt.' });
  } else if (entity === 'controle') {
    regles.push({ date: v('date_controle'), si: 'La date de contrôle ne peut pas être dans le futur.' });
  } else if (entity === 'incident') {
    regles.push({ date: v('date_incident'), si: 'La date de l\'incident ne peut pas être dans le futur.' });
  } else if (entity === 'achat') {
    regles.push({ avant: v('date_commande'), apres: v('date_reception'),
      si: 'La date de réception ne peut pas précéder la date de commande.' });
  } else if (entity === 'lot') {
    regles.push({ date: v('date_fabrication'), si: 'La date de fabrication ne peut pas être dans le futur.' });
  } else if (entity === 'materiel') {
    var mes = fields.date_mise_en_service;
    var lot = (rawRows.lots || []).filter(function (l) { return l.id === fields.lot; })[0];
    if (mes && lot && lot.date_fabrication && Number(mes) < Number(lot.date_fabrication)) {
      return 'La mise en service ne peut pas précéder la date de fabrication du lot.';
    }
  }
  return erreurDates(regles);
}

async function saveEditor(entity, rowId, boxEl) {
  var cfg = EDITABLE[entity];
  var box = boxEl || document.getElementById(cfg.pane);
  var msg = box.querySelector('.ed-msg');
  var ancien = (rawRows[cfg.key] || []).filter(function (r) { return r.id === rowId; })[0] || {};
  var fields = {};
  champsEditables(cfg).forEach(function (f) {
    if (f.type === 'note') return;   /* informatif seul : jamais envoye a Grist */
    var el = box.querySelector('[data-f="' + f.id + '"]');
    if (!el) return;
    if (f.type === 'checkbox') { fields[f.id] = el.checked; return; }
    if (el.disabled) { fields[f.id] = null; return; }
    var v = el.value;
    if (f.type === 'ref') fields[f.id] = v ? Number(v) : null;
    else if (f.type === 'number') fields[f.id] = num(v);
    else if (f.type === 'date') fields[f.id] = dateToTimestamp(v);
    else fields[f.id] = v.trim();
  });
  /* un exemplaire doit toujours appartenir a un lot, meme d'un seul element :
     c'est le lot qui porte le fabricant, la duree de vie et la fiche de vie */
  var manquant = champsEditables(cfg).filter(function (f) { return f.requis && !fields[f.id]; })[0];
  if (manquant) {
    msg.textContent = 'Le champ "' + manquant.label + '" est obligatoire.';
    msg.style.color = '#a3242a';
    return;
  }
  var errDate = erreurDatesEditeur(entity, box, fields);
  if (errDate) { msg.textContent = errDate; msg.style.color = '#a3242a'; return; }
  if (cfg.valideur) {
    var errV = cfg.valideur(fields, rowId);
    if (errV) { msg.textContent = errV; msg.style.color = '#a3242a'; return; }
  }
  msg.textContent = 'Enregistrement...'; msg.style.color = '#666';
  try {
    var actions = [['UpdateRecord', resolvedNames[cfg.key], rowId, fields]];
    if (cfg.apres) actions = actions.concat(cfg.apres(rowId, fields, ancien));
    await appliquer(actions);
    box.innerHTML = '';
    var nomEntite = cfg.label || entity;
    flashToast(nomEntite + ' modifié');
    setTimeout(function () { load(); }, 100);
  } catch (e) {
    msg.textContent = 'Erreur : ' + e.message;
    msg.style.color = '#a3242a';
    console.error(e);
  }
}

function btnEditer(entity, id, libelle) {
  return '<button class="secondary btn-edit" data-ent="' + entity + '" data-id="' + id + '">' + (libelle || 'Éditer') + '</button>';
}

/* edition et suppression sont cablees ensemble : les separer avait deja
   provoque des boutons morts sur les listes ajoutees apres coup */
function brancherBoutonsEdit(conteneur) {
  document.querySelectorAll('#' + conteneur + ' .btn-edit').forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      openEditor(b.dataset.ent, Number(b.dataset.id));
    };
  });
  document.querySelectorAll('#' + conteneur + ' .btn-del').forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      demanderSuppression(b.dataset.ent, Number(b.dataset.id));
    };
  });
}

/* ---------------------- ecritures Grist ---------------------- */

/* Une valeur undefined est supprimee par JSON.stringify : Grist recoit alors
   {} et n'ecrit rien, sans lever d'erreur. On refuse plutot que d'echouer
   en silence. */
function appliquer(actions) {
  actions.forEach(function (a) {
    var f = a[3];
    if (f && typeof f === 'object' && !Array.isArray(f)) {
      Object.keys(f).forEach(function (k) {
        if (f[k] === undefined) {
          throw new Error('Colonne "' + k + '" de ' + a[1] +
            ' : valeur indéfinie, écriture annulée (action ' + a[0] + ').');
        }
      });
    }
  });
  return grist.docApi.applyUserActions(actions);
}

/* La forme de la reponse d'applyUserActions varie ; en dernier recours on
   relit la table pour retrouver la ligne creee. */
function idDepuisReponse(res) {
  if (!res) return null;
  if (res.retValues && res.retValues.length && res.retValues[0]) return res.retValues[0];
  if (Array.isArray(res) && res.length && typeof res[0] === 'number') return res[0];
  return null;
}

async function ajouterEtObtenirId(key, fields) {
  var res = await appliquer([['AddRecord', resolvedNames[key], null, fields]]);
  var id = idDepuisReponse(res);
  if (id) return id;
  var t = await grist.docApi.fetchTable(resolvedNames[key]);
  if (!t.id || !t.id.length) throw new Error('Ligne créée dans ' + resolvedNames[key] + ' mais introuvable.');
  return Math.max.apply(null, t.id);
}

/* Relit la valeur reellement stockee : seule preuve qu'une ecriture a pris. */
async function lireValeur(key, rowId, col) {
  var t = await grist.docApi.fetchTable(resolvedNames[key]);
  var i = t.id.indexOf(rowId);
  if (i === -1) return undefined;
  return t[col] ? t[col][i] : undefined;
}

/* ---------------------- creation rapide (categorie / lieu / fournisseur) ---------------------- */

var QUICK_ADD = {
  lotCategorie: {
    key: 'categories', label: 'Nouvelle catégorie...',
    fields: [
      { id: 'nom', label: 'Nom', required: true },
      { id: 'type_epi', label: 'Nature réglementaire', type: 'select', options: TYPES_EPI, optionLabels: NATURE_EPI_LABELS },
      { id: 'duree_vie_defaut_mois', label: 'Durée de vie par défaut (mois)', type: 'number' }
    ]
  },
  lotLieu: {
    key: 'lieux', label: 'Nouveau lieu...',
    fields: [
      { id: 'nom', label: 'Nom', required: true },
      { id: 'description', label: 'Description' }
    ]
  },
  acFournisseur: {
    key: 'fournisseurs', label: 'Nouveau fournisseur...',
    fields: [
      { id: 'nom', label: 'Nom', required: true },
      { id: 'contact', label: 'Contact' }
    ]
  },
  prAdherent: {
    key: 'adherents', label: 'Nouvel adhérent...',
    fields: [
      { id: 'nom_complet', label: 'Nom complet', required: true },
      { id: 'numero_licence', label: 'Numéro de licence' },
      { id: 'role', label: 'Rôle', type: 'select', options: roleChoices }
    ]
  }
};

/* Avertissement NON bloquant quand un lot porte le nom de sa categorie
   ("Baudriers" dans Baudriers) : il se confond ensuite avec elle dans les
   menus et les listes (remarque de Pierre, 07/10). Comparaison insensible a
   la casse, aux accents, aux espaces et au pluriel simple (s/x final).
   inputEl : champ du nom ; catIdFn : renvoie l'id de categorie courant ;
   ancre : element apres lequel placer la ligne (le form-field du nom).
   Utilise par la creation de lot, l'editeur de lot et la scission. */
function normaliserNomLot(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim().replace(/[sx]$/, '');
}
function brancherAlerteNomLot(inputEl, catIdFn, ancre) {
  if (!inputEl || !ancre) return;
  var el = document.createElement('p');
  el.className = 'hint alerte-nom-lot';
  el.style.cssText = 'margin:4px 0 0;color:#9a5b00;grid-column:1/-1';
  el.hidden = true;
  ancre.insertAdjacentElement('afterend', el);
  var maj = function () {
    var catId = catIdFn();
    var cat = refLists.categories.filter(function (c) { return String(c.id) === String(catId); })[0];
    var nom = inputEl.value;
    var meme = cat && nom.trim() && normaliserNomLot(nom) === normaliserNomLot(cat.nom);
    el.hidden = !meme;
    el.textContent = meme
      ? 'Ce nom est celui de la cat\u00e9gorie \u00ab\u00a0' + cat.nom + '\u00a0\u00bb. Ajoutez ce qui ' +
        'distingue ce lot (marque, mod\u00e8le, ann\u00e9e...) : sinon il se confondra avec la ' +
        'cat\u00e9gorie dans les menus et les listes.'
      : '';
  };
  inputEl.addEventListener('input', maj);
  maj();
  return maj;
}

/* Menu de lots groupe par categorie (optgroup non cliquable), libelle
   "designation (fabricant)". Un lot nomme comme sa categorie ("Baudriers")
   etait indiscernable d'une categorie dans un menu a plat (remarque de
   Pierre, 07/10). Sert aux six formulaires a filtres, au rattachement des
   orphelins et au champ Lot de l'editeur d'exemplaire.
   premiere : HTML de l'option vide ("Tous" pour un filtre, "-" sinon). */
/* "CMD-2026-01 — Vieux Campeur — 12/03/2026" : une commande sans reference
   n'apparait plus vide, deux references identiques se distinguent. */
function libelleAchat(a) {
  if (!a) return '';
  var four = (refLists.fournisseurs || []).filter(function (f) { return f.id === a.fournisseur; })[0];
  return [a.ref_commande || 'Sans r\u00e9f\u00e9rence (#' + a.id + ')', four ? four.nom : '',
          a.date_commande ? fmtDate(a.date_commande) : ''].filter(Boolean).join(' \u2014 ');
}
function optionsAchats(selectedId) {
  return '<option value="">-</option>' + (refLists.achats || []).slice().sort(function (a, b) {
    return (toDate(b.date_commande) || 0) - (toDate(a.date_commande) || 0);
  }).map(function (a) {
    return '<option value="' + a.id + '"' + (String(a.id) === String(selectedId) ? ' selected' : '') + '>' +
      esc(libelleAchat(a)) + '</option>';
  }).join('');
}

/* ------------- commande depuis "Modifier le lot" (2026.5.9) -------------
   Avant : la commande d'un lot ne se modifiait que dans Achats et budget, et
   rien ne le disait ("on ne peut plus revenir sur la commande", Pierre).
   Encadre : resume, autres lots de la meme commande (la modifier les touche
   aussi), Modifier / facture, ou Creer la commande si le lot n'en a pas.
   Les formulaires reutilisent EDITABLE.achat via saveEditor / saveCreator
   (parametre boxEl) : memes champs, memes controles qu'Achats et budget. */
function blocCommandeLot(lot) {
  if (!lot || !resolvedNames.achats) return '';
  var a = (rawRows.achats || []).filter(function (x) { return x.id === lot.achat; })[0];
  var titre = '<p class="hint" style="margin:14px 0 6px;font-weight:600;color:var(--navy,#1B3668)">Commande</p>';
  if (!a) {
    return '<div class="lot-commande">' + titre +
      '<p class="hint" style="margin:0 0 6px">Aucune commande rattach\u00e9e \u00e0 ce lot.</p>' +
      '<button type="button" class="secondary" id="edCreerCommande">+ Cr\u00e9er la commande de ce lot</button>' +
      '<div id="edCommandeForm"></div></div>';
  }
  var autres = (rawRows.lots || []).filter(function (l) { return l.achat === a.id && l.id !== lot.id; });
  var details = [
    a.date_commande ? 'command\u00e9e le ' + fmtDate(a.date_commande) : '',
    a.date_reception ? 're\u00e7ue le ' + fmtDate(a.date_reception) : '',
    (a.montant_total !== null && a.montant_total !== undefined && a.montant_total !== '') ? money(a.montant_total) : '',
    a.financement || ''
  ].filter(Boolean).join(' \u00b7 ');
  return '<div class="lot-commande">' + titre +
    '<p style="margin:0 0 4px"><b>' + esc(libelleAchat(a)) + '</b></p>' +
    (details ? '<p class="hint" style="margin:0 0 6px">' + esc(details) + '</p>' : '') +
    (autres.length
      ? '<p class="hint" style="margin:0 0 6px;color:#9a5b00">Cette commande concerne aussi\u00a0: ' +
        autres.map(function (l) { return esc(l.designation || '#' + l.id); }).join(', ') +
        '. La modifier ici la modifie pour ces lots aussi.</p>'
      : '') +
    (aColonne('achats', 'facture')
      ? '<p class="hint" style="margin:0 0 6px">Facture\u00a0: ' +
        (idsPiecesJointes(a.facture).length ? 'jointe' : 'aucune \u2014 \u00e0 joindre via \u00ab\u00a0Modifier la commande\u00a0\u00bb') + '</p>'
      : '') +
    '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
      '<button type="button" class="secondary" id="edModifierCommande">Modifier la commande</button>' +
    '</div>' +
    '<div id="edCommandeForm"></div></div>';
}

/* formulaire de commande (champs de EDITABLE.achat) rendu dans l'encadre */
function formCommandeHtml(valeurs, libelleBouton) {
  /* Facture DANS le formulaire (2026.5.10) : avant, un bouton a cote, hors du
     formulaire, qu'on ne trouvait pas (Pierre). Fichier envoye apres
     l'enregistrement reussi de la commande. */
  var dejaFacture = idsPiecesJointes(valeurs.facture).length > 0;
  return '<div class="form-panel" style="margin-top:8px">' +
    '<div class="form-grid">' +
      champsEditables(EDITABLE.achat).map(function (f) { return editorField(f, valeurs[f.id]); }).join('') +
      (aColonne('achats', 'facture')
        ? field('Facture (facultatif)', '<input type="file" class="cmd-facture" accept="image/*,application/pdf">' +
            (dejaFacture ? '<p class="hint" style="margin:4px 0 0">Une facture est d\u00e9j\u00e0 jointe\u00a0: ' +
              'en choisir une autre la remplace.</p>' : ''))
        : '') +
    '</div>' +
    '<div class="form-actions">' +
      '<button type="button" class="cmd-save">' + libelleBouton + '</button>' +
      '<button type="button" class="secondary cmd-cancel">Annuler</button>' +
      '<span class="ed-msg form-msg"></span>' +
    '</div></div>';
}

function brancherBlocCommandeLot(zone, lot) {
  var form = zone.querySelector('#edCommandeForm');
  if (!form || !lot) return;
  var a = (rawRows.achats || []).filter(function (x) { return x.id === lot.achat; })[0];
  zone.querySelectorAll('.lot-commande input[type="file"][data-pj-table]').forEach(function (inp) {
    inp.onchange = function () { surChoixPieceJointe(inp); };
  });
  /* Apres enregistrement reussi (saveEditor / saveCreator videnent le
     formulaire), on ROUVRE l'editeur du lot sur des donnees fraiches : sinon
     son menu "Commande d'origine" reste perime, et cliquer "Enregistrer"
     sur le lot detacherait la commande qu'on vient de creer (vu en test). */
  /* envoie la facture choisie (si une) sur la commande achatId */
  var envoyerFacture = async function (fichier, achatId) {
    if (!fichier) return;
    try {
      /* REMPLACEMENT (une commande = une facture) : televerserPieceJointe
         ajouterait a la suite de l'ancienne. */
      var idPJ = await televerserFichierSeul(fichier);
      await appliquer([['UpdateRecord', resolvedNames.achats, achatId, { facture: ['L', idPJ] }]]);
    } catch (e) {
      afficherErreurGlobale('Commande enregistr\u00e9e, mais la facture n\u2019a pas pu \u00eatre jointe\u00a0: ' + e.message);
    }
  };
  var fichierChoisi = function () {
    var inp = form.querySelector('.cmd-facture');
    return inp && inp.files && inp.files[0] ? inp.files[0] : null;
  };
  var rouvrirLot = async function () {
    if (form.innerHTML !== '') return;          /* echec : message deja affiche */
    await load();
    openEditor('lot', lot.id);
  };
  var ouvrir = function (valeurs, libelle, enregistrer) {
    form.innerHTML = formCommandeHtml(valeurs, libelle);
    form.querySelector('.cmd-cancel').onclick = function () { form.innerHTML = ''; };
    form.querySelector('.cmd-save').onclick = enregistrer;
  };
  var bModif = zone.querySelector('#edModifierCommande');
  if (bModif && a) bModif.onclick = function () {
    ouvrir(a, 'Enregistrer la commande', async function () {
      var fichier = fichierChoisi();               /* lu AVANT : saveEditor vide le formulaire */
      if (fichier && idsPiecesJointes(a.facture).length &&
          !confirm('Une facture est d\u00e9j\u00e0 associ\u00e9e \u00e0 cette commande. La remplacer ?')) return;
      await saveEditor('achat', a.id, form);
      if (form.innerHTML === '') await envoyerFacture(fichier, a.id);
      await rouvrirLot();
    });
  };
  var bCreer = zone.querySelector('#edCreerCommande');
  if (bCreer) bCreer.onclick = function () {
    /* montant propose : prix unitaire x exemplaires du lot (modifiable) */
    var n = (rawRows.materiels || []).filter(function (m) { return m.lot === lot.id; }).length;
    var prix = Number(lot.prix_unitaire);
    ouvrir({ montant_total: prix && n ? prix * n : null }, 'Cr\u00e9er et rattacher au lot', async function () {
      var fichier = fichierChoisi();
      await saveCreator('achat', form, async function (newId) {
        await appliquer([['UpdateRecord', resolvedNames.lots, lot.id, { achat: newId }]]);
        await envoyerFacture(fichier, newId);
      });
      await rouvrirLot();
    });
  };
}

function optionsLotsGroupes(lots, selectedId, premiere) {
  var parCat = {};
  lots.forEach(function (l) {
    var k = l.categorie || 0;
    (parCat[k] = parCat[k] || []).push(l);
  });
  var ordre = refLists.categories.map(function (c) { return c.id; }).filter(function (id) { return parCat[id]; });
  if (parCat[0]) ordre.push(0);
  var catNom = mapById(refLists.categories, 'nom');
  return premiere + ordre.map(function (k) {
    return '<optgroup label="' + esc(k ? catNom[k] : 'Sans cat\u00e9gorie') + '">' +
      parCat[k].map(function (l) {
        var lbl = (l.designation || '#' + l.id) + (l.fabricant ? ' (' + l.fabricant + ')' : '');
        return '<option value="' + l.id + '"' + (String(l.id) === String(selectedId) ? ' selected' : '') + '>' +
          esc(lbl) + '</option>';
      }).join('') + '</optgroup>';
  }).join('');
}

function optionsFor(rowsArr, labelCol, selectedId, newLabel) {
  /* L'option de creation rapide se place juste apres le tiret vide, pas en
     toute derniere position : pour un club avec beaucoup de fournisseurs
     ou d'adherents, "+ Nouveau ..." enfoui apres avoir fait defiler toute
     la liste ne serait jamais decouvert par quelqu'un qui ne sait pas deja
     que cette fonctionnalite existe. */
  var opts = '<option value="">-</option>';
  if (newLabel) opts += '<option value="__new__">+ ' + newLabel + '</option>';
  opts += rowsArr.map(function (r) {
    var lbl = r[labelCol] || ('#' + r.id);
    return '<option value="' + r.id + '"' + (String(r.id) === String(selectedId) ? ' selected' : '') + '>' + lbl + '</option>';
  }).join('');
  return opts;
}

/* Filtre les listes "Controleur" (controle, inspection de securite lors
   d'une reparation, et intervenant "Club" d'une reparation) aux adherents
   dont le role est "Controleur EPI habilite" — un seul flag pour les deux
   usages : dans un club de benevoles, quelqu'un a qui on confie un controle
   est aussi quelqu'un a qui on confierait une reparation, et reciproquement.
   Match sur le TEXTE, pas sur la position dans roleChoices (contrairement a
   typeControleChoices ailleurs) : verifie sur le terrain (capture Grist du
   club) que l'ordre des choix n'est pas garanti — "Controleur EPI habilite"
   peut tres bien etre le premier choix affiche, pas le troisieme comme le
   suggererait ROLES_DEFAUT. Reordonner une liste Grist est un geste courant
   et anodin pour un admin, contrairement a renommer un libelle — le risque
   n'est donc pas symetrique a celui de type_controle, d'ou ce choix
   different ici. Repli sur la liste complete si la colonne "role" n'existe
   pas, ou si le filtre ne renvoie personne (aucun adherent encore marque) —
   jamais de liste vide qui bloquerait la saisie. Ce n'est pas un systeme de
   droits : rien n'empeche de choisir un autre adherent si besoin, c'est
   juste une liste par defaut plus pertinente. */
function adherentsControleurs() {
  if (!aColonne('adherents', 'role')) return refLists.adherents;
  var filtres = refLists.adherents.filter(function (a) { return a.role === 'Controleur EPI habilite'; });
  return filtres.length ? filtres : refLists.adherents;
}

function quickAddField(selectId, f) {  var fid = selectId + '_qa_' + f.id;
  if (f.type === 'select') {
    return '<div class="form-field"><label>' + f.label + '</label><select id="' + fid + '">' +
      f.options.map(function (o) {
        var texte = (f.optionLabels && f.optionLabels[o]) || o;
        return '<option value="' + esc(o) + '">' + esc(texte) + '</option>';
      }).join('') + '</select></div>';
  }
  return '<div class="form-field"><label>' + f.label + '</label><input id="' + fid +
    '" type="' + (f.type === 'number' ? 'number' : 'text') + '"></div>';
}

/* Certains selects partagent la meme config d'ajout rapide (ex. l'emprunteur
   du pret et celui de la fiche pre-remplie pointent tous deux vers ADHERENTS).
   L'alias evite de dupliquer la config ; le resolveur la retrouve. */
var QUICK_ADD_ALIAS = { beAdherent: 'prAdherent' };
function qaConfig(selectId) {
  return QUICK_ADD[selectId] || QUICK_ADD[QUICK_ADD_ALIAS[selectId]] || null;
}

function attachQuickAdd(selectId) {
  var cfg = qaConfig(selectId);
  var sel = document.getElementById(selectId);
  if (!cfg || !sel) return;   /* pas de config = pas d'ajout rapide, mais jamais de plantage */
  sel.onchange = function () {
    var box = document.getElementById(selectId + '_quickadd');
    if (sel.value === '__new__') {
      box.innerHTML = '<div class="form-grid">' +
        cfg.fields.map(function (f) { return quickAddField(selectId, f); }).join('') + '</div>' +
        '<div class="form-actions"><button class="secondary" id="' + selectId + '_qa_go">Créer</button>' +
        '<button type="button" class="secondary" id="' + selectId + '_qa_cancel">Annuler</button>' +
        '<span class="form-msg" id="' + selectId + '_qa_msg"></span></div>';
      box.classList.add('open');
      document.getElementById(selectId + '_qa_go').onclick = function () { createQuickAdd(selectId); };
      document.getElementById(selectId + '_qa_cancel').onclick = function () { box.classList.remove('open'); box.innerHTML = ''; sel.value = ''; };
      /* le type de la nouvelle categorie pilote son champ duree par defaut */
      var qaType = document.getElementById(selectId + '_qa_type_epi');
      var qaDuree = document.getElementById(selectId + '_qa_duree_vie_defaut_mois');
      if (qaType && qaDuree) {
        var majQa = function () { griserDuree(qaDuree, qaType.value === 'Non soumis a vieillissement'); };
        qaType.addEventListener('change', majQa);
        majQa();
      }
    } else {
      box.classList.remove('open');
      box.innerHTML = '';
    }
    if (selectId === 'lotCategorie') { appliquerDureeVieDefaut(); appliquerPrefixeCategorie(); }
  };
}

async function createQuickAdd(selectId) {
  var cfg = qaConfig(selectId);
  if (!cfg) return;
  var msg = document.getElementById(selectId + '_qa_msg');
  var fields = {};
  var ok = true;
  cfg.fields.forEach(function (f) {
    var v = document.getElementById(selectId + '_qa_' + f.id).value.trim();
    if (f.required && !v) ok = false;
    fields[f.id] = (f.type === 'number') ? num(v) : v;
  });
  if (!ok) { msg.textContent = 'Le nom est obligatoire.'; msg.style.color = '#a3242a'; return; }
  msg.textContent = 'Creation...'; msg.style.color = '#666';
  try {
    var newId = await ajouterEtObtenirId(cfg.key, fields);
    var fresh = await grist.docApi.fetchTable(resolvedNames[cfg.key]);
    refLists[cfg.key] = rowsOf(fresh);
    var labelCol = (cfg.key === 'adherents') ? 'nom_complet' : 'nom';
    document.getElementById(selectId).innerHTML = optionsFor(refLists[cfg.key], labelCol, newId, cfg.label);
    var box = document.getElementById(selectId + '_quickadd');
    box.classList.remove('open');
    box.innerHTML = '';
    if (selectId === 'lotCategorie') { appliquerDureeVieDefaut(); appliquerPrefixeCategorie(); }
  } catch (e) {
    msg.textContent = 'Erreur : ' + e.message;
    msg.style.color = '#a3242a';
    console.error(e);
  }
}

/* ---------------------- formulaire : nouveau lot ---------------------- */

function field(label, inner) {
  return '<div class="form-field"><label>' + label + '</label>' + inner + '</div>';
}
/* Bulle d'aide "?" au survol (et au focus clavier), a cote d'un intitule de
   champ. Reservee aux quelques endroits ou le mot seul ne suffit pas a
   deviner la consequence d'un choix — voir le commentaire CSS de
   .aide-bulle pour le principe de parcimonie qui guide son usage. */
function bulle(texte) {
  return '<span class="aide-bulle" tabindex="0" role="button" aria-label="Aide">?' +
    '<span class="aide-bulle-texte">' + texte + '</span></span>';
}
function fieldAide(label, inner, texte) {
  return '<div class="form-field"><label>' + label + bulle(texte) + '</label>' + inner + '</div>';
}
function refField(label, id) {
  return '<div class="form-field"><label>' + label + '</label><select id="' + id +
    '"></select><div id="' + id + '_quickadd" class="quick-add"></div></div>';
}

function renderMaterielActions() {
  document.getElementById('materiel-actions').innerHTML =
    '<div class="barre-actions">' +
      '<button id="btnToggleLot">+ Nouveau lot de matériel</button>' +
      '<button class="secondary" id="btnExportCsv" title="Exporte la liste telle qu\u2019elle est filtr\u00e9e ci-dessous (tout le parc : rubrique Import / export)">Exporter la liste (CSV)</button>' +
      '<button class="secondary" id="btnExportInv" title="Imprime la liste telle qu\u2019elle est filtr\u00e9e ci-dessous (tout le parc : rubrique Import / export)">Imprimer la liste</button>' +
      '<button class="secondary" id="btnImport">Importer un inventaire\u2026</button>' +
      '<span id="lotFlash" class="form-msg"></span>' +
    '</div>' +
    '<div class="filtres">' +
      '<div class="filtre-champ" style="flex:2">' +
        '<label>Rechercher</label>' +
        '<input type="text" id="fmQ" placeholder="Marquage, lot, fabricant, personne...">' +
      '</div>' +
      '<div class="filtre-champ"><label>Catégorie</label><select id="fmCat"></select></div>' +
      '<div class="filtre-champ"><label>Lieu</label><select id="fmLieu"></select></div>' +
      '<div class="filtre-champ"><label>Statut</label><select id="fmStatut">' +
        '<option value="">Tous</option>' +
        STATUTS.map(function (x) { return '<option>' + x + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="filtre-champ" style="flex:0 0 auto">' +
        '<label>&nbsp;</label>' +
        '<label class="filtre-case"><input type="checkbox" id="fmEchu"> Controle echu</label>' +
      '</div>' +
      '<div class="filtre-champ" style="flex:0 0 auto">' +
        '<label>&nbsp;</label>' +
        '<label class="filtre-case"><input type="checkbox" id="fmVetuste"> Vétuste (90j)</label>' +
      '</div>' +
      '<button class="secondary" id="fmReset" style="align-self:flex-end">Reinitialiser</button>' +
    '</div>' +
    '<p class="hint" id="fmResultat"></p>' +
    '<div id="formLot" class="form-panel" style="display:none">' +

      '<h4 style="margin:0 0 10px;font-size:13px;color:#2C4A3E">Le lot</h4>' +
      '<div class="form-grid">' +
        field('Désignation', '<input id="lotDesignation" type="text" placeholder="Baudriers Corax 2024">') +
        refField('Catégorie', 'lotCategorie') +
        field('Fabricant', '<input id="lotFabricant" type="text" placeholder="Petzl">') +
        field('Modèle', '<input id="lotModele" type="text" placeholder="Corax LT taille 1">') +
        field('Date de fabrication', '<input id="lotFabrication" type="date">') +
        field('Durée de vie (mois)', '<input id="lotDureeVie" type="number" placeholder="vide = selon contrôle">') +
        field('Prix unitaire (\u20ac)', '<input id="lotPrix" type="number" step="0.01">') +
      '</div>' +
      '<p class="hint" style="margin:8px 0 0">Laissez la durée de vie <b>vide</b> pour le matériel non soumis ' +
        'au vieillissement (mousquetons, descendeurs) : seul le contrôle le réformera.</p>' +
      ((aColonne('lots', 'photo') || aColonne('lots', 'notice'))
        ? '<div class="form-grid" style="margin-top:6px">' +
            (aColonne('lots', 'photo') ? field('Photo du modèle (facultatif)', '<input id="lotPhotoFile" type="file" accept="image/*">') : '') +
            (aColonne('lots', 'notice') ? field('Notice du fabricant (facultatif)', '<input id="lotNoticeFile" type="file" accept="image/*,application/pdf">') : '') +
          '</div>'
        : '') +
      '<div class="form-grid" style="margin-top:6px">' +
        field('Commentaire', '<input id="lotCommentaire" type="text">') +
      '</div>' +

      '<div class="form-section">' +
        '<h4>Les exemplaires</h4>' +
        '<label class="coche" style="margin:2px 0 10px"><input type="checkbox" id="lotReprise"> ' +
          '<b>Reprise d\'inventaire \u2014 conserver les marquages existants</b></label>' +
        '<div id="blocAuto">' +
          '<p class="hint">Les numéros de marquage sont générés automatiquement.</p>' +
          '<label class="coche" style="margin:2px 0 8px"><input type="checkbox" id="lotUnique"> ' +
            '<b>Exemplaire unique</b> <span class="hint" style="margin:0">(un seul exemplaire pour ce lot)</span></label>' +
          '<div class="form-grid">' +
            field('Quantité', '<input id="lotQuantite" type="number" min="1" value="1">') +
            field('Préfixe de marquage', '<input id="lotPrefixe" type="text" placeholder="BAU-">') +
            field('Premier numéro', '<input id="lotPremier" type="text" value="001">') +
          '</div>' +
          '<p class="hint" id="lotUniqueAide" style="margin:6px 0 0"></p>' +
        '</div>' +
        '<div id="blocReprise" hidden>' +
          '<p class="hint">Saisissez les marquages réels, un par ligne, tels qu\'ils sont inscrits ' +
            'sur le matériel. La quantité se déduit du nombre de lignes ; la date de fabrication peut rester vide.</p>' +
          field('Marquages existants (un par ligne)',
            '<textarea id="lotMarquagesManuels" rows="5" placeholder="TSL-2019-04&#10;RAQ-BEAL-12&#10;..."></textarea>') +
        '</div>' +
        '<div class="form-grid"' + ((aColonne('materiels','couleur') || aColonne('materiels','taille')) ? ' style="margin-top:8px"' : '') + '>' +
          (aColonne('materiels','couleur') ? field('Couleur des exemplaires (facultatif)', '<input id="lotCouleur" type="text" placeholder="bleu, rouge...">') : '') +
          (aColonne('materiels','taille') ? field('Taille des exemplaires (facultatif)', '<input id="lotTaille" type="text" placeholder="M, L, 8.5...">') : '') +
          refField('Lieu de stockage', 'lotLieu') +
          field('Date de mise en service', '<input id="lotMiseEnService" type="date">') +
        '</div>' +
        '<p class="hint" id="apercuMarquage" style="margin-top:8px"></p>' +
        (aColonne('materiels', 'numero_serie')
          ? '<div class="form-field" style="margin-top:8px"><label>Num\u00e9ros de s\u00e9rie du fabricant (facultatif, un par ligne)</label>' +
            '<textarea id="lotSeries" rows="3" placeholder="Dans l\u2019ordre des marquages : la 1re ligne va au 1er exemplaire..."></textarea>' +
            '<div id="lotSeriesApercu" class="hint" style="margin-top:4px"></div>' +
            '<p class="hint" style="margin:2px 0 0">Plus s\u00fbr\u00a0: les saisir apr\u00e8s, objet en main, avec ' +
            '\u00ab\u00a0\u00c9diter le lot \u2192 Saisir les num\u00e9ros de s\u00e9rie\u00a0\u00bb.</p></div>'
          : '') +
      '</div>' +

      '<div class="form-section">' +
        '<label style="font-size:13px;display:flex;align-items:center;gap:8px;cursor:pointer">' +
          '<input type="checkbox" id="lotAvecAchat" style="width:auto" checked> Enregistrer la commande correspondante' +
        '</label>' +
        '<div id="blocAchat" class="quick-add open" style="margin-top:8px">' +
          '<div class="form-grid">' +
            field('Référence de commande', '<input id="acRef" type="text" placeholder="CMD-2026-01">') +
            refField('Fournisseur', 'acFournisseur') +
            field('Date de commande', '<input id="acDateCommande" type="date">') +
            field('Date de réception', '<input id="acDateReception" type="date">') +
            field('Financement', '<select id="acFinancement">' + optionsChoix(financementChoices) + '</select>') +
            (aColonne('achats', 'note_financement') ? field('Note financement (facultatif)', '<input id="acNote" type="text" placeholder="provenance du don / de la subvention">') : '') +
            field('Montant total (\u20ac)', '<input id="acMontant" type="number" step="0.01" placeholder="calculé automatiquement">') +
            (aColonne('achats', 'facture') ? field('Facture (facultatif)', '<input id="acFactureFile" type="file" accept="image/*,application/pdf">') : '') +
          '</div>' +
          '<p class="hint" style="margin:8px 0 0">Laisse le montant vide pour qu\'il soit calculé : prix unitaire x quantité.</p>' +
        '</div>' +
      '</div>' +

      '<div class="form-actions">' +
        '<button id="btnSubmitLot">Enregistrer le lot</button>' +
        '<button type="button" class="secondary" id="btnCancelLot">Annuler</button>' +
        '<span id="lotMsg" class="form-msg"></span>' +
      '</div>' +
    '</div>';

  /* avertissement nom = categorie (formulaire de creation) */
  (function () {
    var nomEl = document.getElementById('lotDesignation');
    var catEl = document.getElementById('lotCategorie');
    if (!nomEl || !catEl) return;
    var maj = brancherAlerteNomLot(nomEl, function () { return catEl.value; }, nomEl.closest('.form-field'));
    if (maj) catEl.addEventListener('change', maj);
  })();
  document.getElementById('btnToggleLot').onclick = function () {
    var f = document.getElementById('formLot');
    f.style.display = (f.style.display === 'none') ? 'block' : 'none';
  };
  document.getElementById('lotAvecAchat').onchange = function () {
    document.getElementById('blocAchat').classList.toggle('open', this.checked);
  };
  document.getElementById('btnSubmitLot').onclick = creerLot;
  document.getElementById('btnCancelLot').onclick = function () { document.getElementById('formLot').style.display = 'none'; viderFormulaire('formLot'); };
  document.getElementById('btnExportCsv').onclick = function () { exporterInventaireCsv(); };
  document.getElementById('btnExportInv').onclick = function () { exporterInventaireImprimable(); };
  document.getElementById('btnImport').onclick = function () { naviguer('donnees'); };

  var minuteur = null;
  document.getElementById('fmQ').oninput = function () {
    var v = this.value;
    clearTimeout(minuteur);
    minuteur = setTimeout(function () { filtresMat.q = v; load(); }, 250);
  };
  ['fmCat', 'fmLieu', 'fmStatut'].forEach(function (id) {
    document.getElementById(id).onchange = function () {
      filtresMat[{ fmCat: 'cat', fmLieu: 'lieu', fmStatut: 'statut' }[id]] = this.value;
      load();
    };
  });
  var fmEchuEl = document.getElementById('fmEchu');
  fmEchuEl.checked = filtresMat.echu;
  fmEchuEl.onchange = function () { filtresMat.echu = this.checked; load(); };
  var fmVet = document.getElementById('fmVetuste');
  if (fmVet) { fmVet.checked = filtresMat.vetuste; fmVet.onchange = function () { filtresMat.vetuste = this.checked; load(); }; }
  document.getElementById('fmReset').onclick = function () {
    filtresMat = { q: '', cat: '', lieu: '', statut: '', echu: false, vetuste: false };
    document.getElementById('fmQ').value = '';
    document.getElementById('fmEchu').checked = false;
    ['fmCat', 'fmLieu', 'fmStatut'].forEach(function (i) { document.getElementById(i).value = ''; });
    load();
  };
  ['lotQuantite', 'lotPrefixe', 'lotPremier', 'lotMarquagesManuels', 'lotSeries'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.oninput = function () { majUnique(); majApercuMarquage(); };
  });
  var uniCase = document.getElementById('lotUnique');
  if (uniCase) uniCase.onchange = function () {
    if (this.checked) document.getElementById('lotQuantite').value = '1';
    majUnique(); majApercuMarquage();
  };
  majUnique();
  var rep = document.getElementById('lotReprise');
  if (rep) rep.onchange = function () {
    var on = this.checked;
    document.getElementById('blocAuto').hidden = on;
    document.getElementById('blocReprise').hidden = !on;
    if (!on) appliquerPrefixeCategorie();
    majApercuMarquage();
  };
  attachQuickAdd('lotCategorie');
  attachQuickAdd('lotLieu');
  attachQuickAdd('acFournisseur');
  populateLotFormOptions();
  appliquerPrefixeCategorie();
  majApercuMarquage();
}

function majFiltresMateriel(nbVisibles, nbTotal, filtreActif) {
  var cat = document.getElementById('fmCat');
  if (!cat) return;
  cat.innerHTML = '<option value="">Toutes</option>' + refLists.categories.map(function (c) {
    return '<option value="' + c.id + '"' + (String(c.id) === filtresMat.cat ? ' selected' : '') + '>' + esc(c.nom) + '</option>';
  }).join('');
  var lieu = document.getElementById('fmLieu');
  lieu.innerHTML = '<option value="">Tous</option>' + refLists.lieux.map(function (l) {
    return '<option value="' + l.id + '"' + (String(l.id) === filtresMat.lieu ? ' selected' : '') + '>' + esc(l.nom) + '</option>';
  }).join('');
  document.getElementById('fmStatut').value = filtresMat.statut;
  document.getElementById('fmResultat').textContent = filtreActif
    ? nbVisibles + ' exemplaire(s) affiché(s) sur ' + nbTotal + '. L\'export ne contiendra que ceux-la.'
    : nbTotal + ' exemplaire(s).';
}

function populateLotFormOptions() {
  var c = document.getElementById('lotCategorie');
  if (!c) return;
  c.innerHTML = optionsFor(refLists.categories, 'nom', c.value, QUICK_ADD.lotCategorie.label);
  var l = document.getElementById('lotLieu');
  l.innerHTML = optionsFor(refLists.lieux, 'nom', l.value, QUICK_ADD.lotLieu.label);
  var f = document.getElementById('acFournisseur');
  f.innerHTML = optionsFor(refLists.fournisseurs, 'nom', f.value, QUICK_ADD.acFournisseur.label);
}

function appliquerDureeVieDefaut() {
  var catId = document.getElementById('lotCategorie').value;
  var champ = document.getElementById('lotDureeVie');
  if (!champ) return;
  if (categorieNonSoumise(catId)) { griserDuree(champ, true); return; }
  griserDuree(champ, false, 'vide = selon controle');
  if (!catId || catId === '__new__' || champ.value) return;
  var cat = refLists.categories.filter(function (c) { return String(c.id) === String(catId); })[0];
  if (cat && cat.duree_vie_defaut_mois) champ.value = cat.duree_vie_defaut_mois;
}

/* Normalisation pour comparer deux marquages : espaces retires, casse ignoree.
   "bau-001", "BAU-001 " et "BAU-001" sont alors consideres identiques. */
function normMarquage(s) {
  return String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();
}

/* Plus grand numero deja porte pour un prefixe donne, en balayant l'existant
   (pas de compteur stocke : resiste aux suppressions et aux imports).
   Les marquages hors-format sont ignores pour ce calcul. */
function maxNumeroPourPrefixe(prefixe) {
  var pref = normMarquage(prefixe);
  if (!pref) return 0;
  var max = 0;
  refLists.materiels.forEach(function (m) {
    var norm = normMarquage(m.numero_marquage);
    if (norm.indexOf(pref) !== 0) return;
    var reste = norm.slice(pref.length);
    if (/^\d+$/.test(reste)) { var n = parseInt(reste, 10); if (n > max) max = n; }
  });
  return max;
}

/* Le prefixe est une propriete de la CATEGORIE (colonne facultative). Quand la
   categorie choisie en a un, on le reporte sur le lot et on fait demarrer la
   numerotation APRES le plus grand numero deja porte. Colonne absente : on
   garde la saisie manuelle du prefixe (repli). */
function appliquerPrefixeCategorie() {
  var rep = document.getElementById('lotReprise');
  if (rep && rep.checked) return;   /* reprise : on ne touche pas aux marquages saisis */
  var champPref = document.getElementById('lotPrefixe');
  var champPrem = document.getElementById('lotPremier');
  if (!champPref || !champPrem) return;
  if (!aColonne('categories', 'prefixe')) return;
  var catId = document.getElementById('lotCategorie').value;
  var cat = refLists.categories.filter(function (c) { return String(c.id) === String(catId); })[0];
  var prefixe = (cat && cat.prefixe) ? String(cat.prefixe).trim() : '';
  if (!prefixe) {
    champPref.readOnly = false;
    champPref.classList.remove('champ-auto');
    majApercuMarquage();
    return;
  }
  champPref.value = prefixe;
  champPref.readOnly = true;                 /* vient du referentiel, non modifiable ici */
  champPref.classList.add('champ-auto');
  champPrem.value = String(maxNumeroPourPrefixe(prefixe) + 1).padStart(3, '0');
  majApercuMarquage();
}

/* ------------------- numeros de serie du fabricant (2026.5.15) -------------------
   Colonne facultative MATERIELS.numero_serie (Texte). Utile aux rappels et
   avis de securite des fabricants, qui designent les produits par numero de
   serie, et a la "reference precise" de l'arrete de 2009. Deux saisies :
   a la creation du lot (une ligne par exemplaire, dans l'ordre des marquages,
   avec apercu de l'appariement) et, plus sur, la grille de "Editer le lot",
   objet en main. Doublon = meme numero (sans casse ni espaces) chez le meme
   fabricant : avertissement, jamais blocage (deux fabricants peuvent avoir
   le meme format). */
function normSerie(v) { return String(v || '').replace(/\s+/g, '').toUpperCase(); }
function fabricantDe(m) {
  var lot = (rawRows.lots || []).filter(function (l) { return l.id === m.lot; })[0];
  return lot ? normSerie(lot.fabricant) : '';
}
/* autres exemplaires du meme fabricant portant ce numero (serie = valeur a
   tester, par defaut celle de m) */
function doublonsSerie(m, serie) {
  var n = normSerie(serie === undefined ? m.numero_serie : serie);
  if (!n) return [];
  var fab = fabricantDe(m);
  return (rawRows.materiels || []).filter(function (x) {
    return x.id !== m.id && normSerie(x.numero_serie) === n && fabricantDe(x) === fab;
  });
}
function lireSeriesCreation() {
  var el = document.getElementById('lotSeries');
  if (!el) return [];
  return (el.value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
}
/* Apercu de l'appariement marquage <- numero, avant d'enregistrer */
function majApercuSeries() {
  var zone = document.getElementById('lotSeriesApercu');
  if (!zone) return;
  var series = lireSeriesCreation();
  if (!series.length) { zone.innerHTML = ''; return; }
  var marq = genererMarquages();
  var lignes = series.slice(0, Math.max(marq.length, series.length)).map(function (sr, i) {
    return (marq[i] ? esc(marq[i]) : '<span class="alerte">(aucun exemplaire)</span>') + ' \u2190 ' + esc(sr);
  });
  var vus = {}, doublons = [];
  series.forEach(function (sr) { var k = normSerie(sr); if (vus[k]) doublons.push(sr); vus[k] = true; });
  var montre = lignes.length <= 8 ? lignes : lignes.slice(0, 4).concat(['...']).concat(lignes.slice(-3));
  zone.innerHTML = '<b>Correspondance\u00a0:</b><br>' + montre.join('<br>') +
    (series.length > marq.length
      ? '<br><span class="alerte">' + series.length + ' num\u00e9ros pour ' + marq.length +
        ' exemplaire(s)\u00a0: retirez les lignes en trop.</span>' : '') +
    (doublons.length ? '<br><span class="alerte">Num\u00e9ro en double dans la liste\u00a0: ' +
      doublons.map(esc).join(', ') + '</span>' : '') +
    (series.length < marq.length ? '<br>Les ' + (marq.length - series.length) +
      ' dernier(s) exemplaire(s) resteront sans num\u00e9ro, \u00e0 compl\u00e9ter plus tard.' : '');
}
/* refus a la creation : trop de numeros, ou doublon dans la liste */
function erreurSeriesCreation(nbMarquages) {
  var series = lireSeriesCreation();
  if (series.length > nbMarquages) {
    return series.length + ' num\u00e9ros de s\u00e9rie pour ' + nbMarquages + ' exemplaire(s) : retirez les lignes en trop.';
  }
  var vus = {};
  for (var i = 0; i < series.length; i++) {
    var k = normSerie(series[i]);
    if (vus[k]) return 'Num\u00e9ro de s\u00e9rie en double dans la liste : ' + series[i] + '.';
    vus[k] = true;
  }
  return null;
}

/* Grille de "Editer le lot" : une ligne par exemplaire, objet en main. */
function ouvrirGrilleSeries(lot, zone) {
  if (!zone || !lot) return;
  var items = (rawRows.materiels || []).filter(function (m) { return m.lot === lot.id; })
    .sort(function (a, b) { return String(a.numero_marquage || '').localeCompare(String(b.numero_marquage || ''), 'fr', { numeric: true }); });
  if (!items.length) { zone.innerHTML = '<p class="hint">Aucun exemplaire dans ce lot.</p>'; return; }
  zone.innerHTML = '<div class="form-panel" style="margin-top:8px">' +
    '<p class="hint" style="margin:0 0 6px">Prenez chaque objet en main, rep\u00e9rez son marquage du club, ' +
      'tapez le num\u00e9ro grav\u00e9 sur la bonne ligne. Vous pouvez enregistrer en cours de route et reprendre plus tard.</p>' +
    '<table class="table-series"><tr><th style="width:130px">Marquage</th><th style="width:120px">Statut</th><th>Num\u00e9ro de s\u00e9rie</th></tr>' +
    items.map(function (m) {
      return '<tr><td><span class="badge-ref">' + esc(m.numero_marquage || '#' + m.id) + '</span></td>' +
        '<td>' + esc(m._statut || '') + '</td>' +
        '<td><input type="text" class="serie-saisie" data-mat="' + m.id + '" value="' + esc(m.numero_serie || '') + '" style="width:100%">' +
        '<div class="hint serie-alerte" style="margin:2px 0 0"></div></td></tr>';
    }).join('') + '</table>' +
    '<div class="form-actions"><button type="button" class="series-save">Enregistrer les num\u00e9ros</button>' +
    '<button type="button" class="secondary series-cancel">Fermer</button><span class="form-msg series-msg"></span></div></div>';
  var verifier = function () {
    var vus = {};
    zone.querySelectorAll('.serie-saisie').forEach(function (inp) {
      var k = normSerie(inp.value); if (k) vus[k] = (vus[k] || 0) + 1;
    });
    zone.querySelectorAll('.serie-saisie').forEach(function (inp) {
      var al = inp.parentNode.querySelector('.serie-alerte');
      var m = items.filter(function (x) { return String(x.id) === inp.dataset.mat; })[0];
      var k = normSerie(inp.value), txt = '';
      if (k && vus[k] > 1) txt = 'Saisi deux fois dans ce lot.';
      else if (k) {
        var d = doublonsSerie(m, inp.value).filter(function (x) { return x.lot !== lot.id; });
        if (d.length) txt = 'D\u00e9j\u00e0 port\u00e9 par ' + d.map(function (x) { return x.numero_marquage || '#' + x.id; }).join(', ') +
          ' (m\u00eame fabricant) : faute de frappe ?';
      }
      al.textContent = txt; al.style.color = txt ? '#a3242a' : '';
    });
  };
  zone.querySelectorAll('.serie-saisie').forEach(function (inp) { inp.addEventListener('input', verifier); });
  verifier();
  zone.querySelector('.series-cancel').onclick = function () { zone.innerHTML = ''; };
  zone.querySelector('.series-save').onclick = async function () {
    var msg = zone.querySelector('.series-msg');
    var vus = {}, actions = [], doublon = null;
    zone.querySelectorAll('.serie-saisie').forEach(function (inp) {
      var v = inp.value.trim(), k = normSerie(v);
      if (k) { if (vus[k]) doublon = v; vus[k] = true; }
      var m = items.filter(function (x) { return String(x.id) === inp.dataset.mat; })[0];
      if (m && v !== String(m.numero_serie || '')) {
        actions.push(['UpdateRecord', resolvedNames.materiels, m.id, { numero_serie: v }]);
      }
    });
    if (doublon) { msg.textContent = 'Num\u00e9ro saisi deux fois dans ce lot : ' + doublon + '.'; msg.style.color = '#a3242a'; return; }
    if (!actions.length) { msg.textContent = 'Aucun changement.'; msg.style.color = '#666'; return; }
    msg.textContent = 'Enregistrement...'; msg.style.color = '#666';
    try {
      await appliquer(actions);
      flashToast(actions.length + ' num\u00e9ro' + (actions.length > 1 ? 's' : '') + ' de s\u00e9rie enregistr\u00e9' + (actions.length > 1 ? 's' : ''));
      await load();
      openEditor('lot', lot.id);
      var g = document.getElementById('edSeriesGrille');
      if (g) ouvrirGrilleSeries((rawRows.lots || []).filter(function (l) { return l.id === lot.id; })[0] || lot, g);
    } catch (e) {
      msg.textContent = 'Erreur : ' + e.message; msg.style.color = '#a3242a';
    }
  };
}

function genererMarquages() {
  /* reprise d'inventaire : les marquages sont saisis a la main, un par ligne,
     tels qu'ils sont sur le materiel. Aucune generation, aucun prefixe impose. */
  var rep = document.getElementById('lotReprise');
  if (rep && rep.checked) {
    var brut = document.getElementById('lotMarquagesManuels').value || '';
    return brut.split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s; });
  }
  var q = Number(document.getElementById('lotQuantite').value) || 0;
  var prefixe = document.getElementById('lotPrefixe').value.trim();
  var premier = document.getElementById('lotPremier').value.trim();
  var start = parseInt(premier, 10);
  var width = premier.length;
  var out = [];
  for (var i = 0; i < q; i++) {
    if (isNaN(start)) {
      out.push(prefixe + (premier ? premier + '-' : '') + (i + 1));
    } else {
      out.push(prefixe + String(start + i).padStart(width, '0'));
    }
  }
  return out;
}

/* Ajouter des exemplaires a un lot EXISTANT, sans le recreer ni toucher a l'historique.
   Repond au cas "on en a achete quelques-uns de plus" / "on en avait oublie". */
function genererMarquagesSuite(prefixe, n) {
  var base = maxNumeroPourPrefixe(prefixe);
  var pref = normMarquage(prefixe), largeur = 3;
  refLists.materiels.forEach(function (m) {
    var norm = normMarquage(m.numero_marquage);
    if (pref && norm.indexOf(pref) !== 0) return;
    var reste = pref ? norm.slice(pref.length) : norm;
    if (/^\d+$/.test(reste)) largeur = Math.max(largeur, reste.length);
  });
  var out = [];
  for (var i = 1; i <= n; i++) out.push(prefixe + String(base + i).padStart(largeur, '0'));
  return out;
}

function suitPrefixeMarquage(marquage, prefixe) {
  if (!prefixe) return false;
  var norm = normMarquage(marquage), pref = normMarquage(prefixe);
  return norm.indexOf(pref) === 0 && /^\d+$/.test(norm.slice(pref.length));
}

function ouvrirAjoutExemplaires(lotId) {
  var lot = (rawRows.lots || []).filter(function (l) { return l.id === lotId; })[0];
  if (!lot) return;
  var box = document.getElementById('materiel-editor');
  if (!box) return;
  fermerEditeurs();
  var cat = refLists.categories.filter(function (c) { return c.id === lot.categorie; })[0];
  var prefixe = cat && cat.prefixe ? String(cat.prefixe).trim() : '';
  var lotMats = refLists.materiels.filter(function (m) { return m.lot === lotId; });
  var suit = prefixe && lotMats.some(function (m) { return suitPrefixeMarquage(m.numero_marquage, prefixe); });
  /* Detection : si le lot n'utilise pas le prefixe (marquages de reprise / personnalises),
     on part en saisie manuelle. L'interrupteur laisse toujours le dernier mot a l'utilisateur. */
  var manuelDefaut = !prefixe || (lotMats.length > 0 && !suit);
  var lieuxOpts = refLists.lieux.map(function (l) { return '<option value="' + l.id + '">' + esc(l.nom) + '</option>'; }).join('');
  box.innerHTML =
    '<div class="form-panel">' +
      enteteFenetre('Ajouter des exemplaires', lot.designation || ('lot #' + lotId)) +
      '<p class="hint" style="margin:0 0 10px">Crée de nouveaux exemplaires rattachés à ce lot. L\'existant n\'est pas touché.</p>' +
      (prefixe
        ? '<label class="coche" style="margin:0 0 8px"><input type="checkbox" id="aeManuel"' + (manuelDefaut ? ' checked' : '') + '> Saisir les marquages à la main (au lieu de la numérotation automatique)</label>'
        : '<input type="hidden" id="aeManuel" value="1">') +
      '<div id="aeBlocAuto"' + (manuelDefaut ? ' hidden' : '') + '>' +
        field('Combien d\'exemplaires ajouter ?', '<input id="aeQuantite" type="number" min="1" value="1" style="max-width:120px">') +
        '<p class="hint" id="aeApercu"></p>' +
      '</div>' +
      '<div id="aeBlocManuel"' + (manuelDefaut ? '' : ' hidden') + '>' +
        field('Marquages a ajouter (un par ligne)', '<textarea id="aeManuels" rows="5" placeholder="tels qu\'ils sont graves sur les objets"></textarea>') +
        (prefixe && manuelDefaut ? '<p class="hint">Ce lot utilise des marquages personnalises (reprise d\'inventaire) : saisissez-les tels qu\'ils sont sur les objets.</p>' : '') +
      '</div>' +
      (lieuxOpts ? field('Lieu de stockage', '<select id="aeLieu">' + lieuxOpts + '</select>') : '') +
      field('Date de mise en service (facultatif)', '<input id="aeDate" type="date">') +
      '<div class="form-actions">' +
        '<button id="aeGo">Ajouter au lot</button>' +
        '<button type="button" class="secondary ae-cancel">Annuler</button>' +
        '<span class="form-msg" id="aeMsg"></span>' +
      '</div>' +
    '</div>';
  defilerVers(box, { block: 'nearest' });
  box.querySelector('.ae-cancel').onclick = function () { box.innerHTML = ''; };
  document.getElementById('aeGo').onclick = function () { ajouterExemplaires(lotId, prefixe); };
  var chk = document.getElementById('aeManuel');
  var blocAuto = document.getElementById('aeBlocAuto');
  var blocManuel = document.getElementById('aeBlocManuel');
  var q = document.getElementById('aeQuantite');
  var apercu = document.getElementById('aeApercu');
  var majApercu = function () {
    if (!apercu || !q) return;
    var m = genererMarquagesSuite(prefixe, Math.max(0, Number(q.value) || 0));
    apercu.textContent = m.length
      ? (m.length <= 3 ? 'Sera créé : ' + m.join(', ') : 'Sera créé : ' + m[0] + ' ... ' + m[m.length - 1] + ' (' + m.length + ')')
      : '';
  };
  var syncMode = function () {
    var man = chk && (chk.type === 'checkbox' ? chk.checked : true);
    if (blocAuto) blocAuto.hidden = man;
    if (blocManuel) blocManuel.hidden = !man;
    if (!man) majApercu();
  };
  if (chk && chk.type === 'checkbox') chk.addEventListener('change', syncMode);
  if (q) q.addEventListener('input', majApercu);
  syncMode();
}

async function ajouterExemplaires(lotId, prefixe) {
  var msg = document.getElementById('aeMsg');
  var chk = document.getElementById('aeManuel');
  var manuel = chk && (chk.type === 'checkbox' ? chk.checked : true);
  var marquages;
  if (manuel) {
    marquages = (document.getElementById('aeManuels').value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  } else {
    var n = Math.max(0, Number(document.getElementById('aeQuantite').value) || 0);
    if (n < 1) { msg.textContent = 'Indiquez un nombre.'; return; }
    marquages = genererMarquagesSuite(prefixe, n);
  }
  if (!marquages.length) { msg.textContent = 'Aucun marquage a créer.'; return; }
  var vus = {};
  for (var i = 0; i < marquages.length; i++) {
    var nm = normMarquage(marquages[i]);
    if (vus[nm]) { msg.textContent = 'Marquage répète dans la saisie : ' + marquages[i]; return; }
    vus[nm] = true;
    if (refLists.materiels.some(function (m) { return normMarquage(m.numero_marquage) === nm; })) {
      msg.textContent = 'Le marquage ' + marquages[i] + ' existe déjà.'; return;
    }
  }
  var lieuSel = document.getElementById('aeLieu');
  var lieuId = lieuSel && lieuSel.value ? Number(lieuSel.value) : null;
  var mes = dateToTimestamp(document.getElementById('aeDate').value);
  var lotPourDate = (rawRows.lots || []).filter(function (l) { return l.id === lotId; })[0];
  if (mes && lotPourDate && lotPourDate.date_fabrication && Number(mes) < Number(lotPourDate.date_fabrication)) {
    msg.textContent = 'La mise en service ne peut pas précéder la date de fabrication du lot.';
    return;
  }
  var actions = marquages.map(function (m) {
    return ['AddRecord', resolvedNames.materiels, null, { lot: lotId, numero_marquage: m, lieu_stockage: lieuId, date_mise_en_service: mes }];
  });
  /* couleur/taille sur la creation depuis ajouterExemplaires : pas de champ global
     (chaque exemplaire peut etre different) -> a renseigner via Editer apres creation */
  var lot = (rawRows.lots || []).filter(function (l) { return l.id === lotId; })[0];
  if (lot && aColonne('lots', 'quantite_achetee')) {
    actions.push(['UpdateRecord', resolvedNames.lots, lotId, { quantite_achetee: (Number(lot.quantite_achetee) || 0) + marquages.length }]);
  }
  msg.textContent = 'Ajout en cours...';
  try {
    await appliquer(actions);
    flashToast(marquages.length + ' exemplaire(s) ajouté(s) au lot');
    var box = document.getElementById('materiel-editor'); if (box) box.innerHTML = '';
    setTimeout(function () { load(); }, 100);
  } catch (e) { msg.textContent = 'Échec : ' + e.message; }
}

function majApercuMarquage() {
  var m = genererMarquages();
  var el = document.getElementById('apercuMarquage');
  majApercuSeries();
  if (!m.length) { el.textContent = ''; return; }
  el.textContent = m.length <= 3
    ? 'Sera créé : ' + m.join(', ')
    : 'Sera créé : ' + m[0] + ', ' + m[1] + ' ... ' + m[m.length - 1] + ' (' + m.length + ' exemplaires)';
}

async function creerLot() {
  var msg = document.getElementById('lotMsg');
  var designation = document.getElementById('lotDesignation').value.trim();
  var marquages = genererMarquages();

  if (!designation) {
    msg.textContent = 'La désignation du lot est obligatoire.';
    msg.style.color = '#a3242a';
    return;
  }
  if (!marquages.length) {
    msg.textContent = 'La quantité doit être d\'au moins 1.';
    msg.style.color = '#a3242a';
    return;
  }
  /* numeros de serie (2026.5.15) : refus AVANT toute ecriture (commande
     comprise) si la liste ne colle pas aux exemplaires */
  var errSeries = erreurSeriesCreation(marquages.length);
  if (errSeries) { msg.textContent = errSeries; msg.style.color = '#a3242a'; return; }
  /* doublons a l'interieur meme de la saisie (surtout en reprise : collage) */
  var vus = {}, internes = [];
  marquages.forEach(function (m) {
    var nm = normMarquage(m);
    if (vus[nm]) { if (internes.indexOf(m) === -1) internes.push(m); } else { vus[nm] = true; }
  });
  if (internes.length) {
    msg.textContent = 'Marquage(s) en double dans la saisie : ' + internes.slice(0, 5).join(', ') +
      (internes.length > 5 ? '...' : '') + '. Chaque exemplaire doit avoir un marquage unique.';
    msg.style.color = '#a3242a';
    return;
  }
  var doublons = marquages.filter(function (m) {
    var nm = normMarquage(m);
    return refLists.materiels.some(function (x) { return normMarquage(x.numero_marquage) === nm; });
  });
  if (doublons.length) {
    msg.textContent = 'Numéro(s) de marquage déjà utilisé(s) : ' + doublons.slice(0, 5).join(', ') +
      (doublons.length > 5 ? '...' : '') + '. Change le premier numéro.';
    msg.style.color = '#a3242a';
    return;
  }
  var errLot = erreurDates([
    { date: document.getElementById('lotFabrication').value,
      si: 'La date de fabrication ne peut pas être dans le futur.' },
    { avant: document.getElementById('lotFabrication').value,
      apres: document.getElementById('lotMiseEnService').value,
      si: 'La mise en service ne peut pas précéder la date de fabrication.' }
  ]);
  if (!errLot && document.getElementById('lotAvecAchat').checked) {
    errLot = erreurDates([{
      avant: document.getElementById('acDateCommande').value,
      apres: document.getElementById('acDateReception').value,
      si: 'La date de réception ne peut pas précéder la date de commande.'
    }]);
  }
  if (errLot) { msg.textContent = errLot; msg.style.color = '#a3242a'; return; }

  var prix = num(document.getElementById('lotPrix').value);
  var catVal = document.getElementById('lotCategorie').value;
  var lieuVal = document.getElementById('lotLieu').value;

  msg.textContent = 'Enregistrement...';
  msg.style.color = '#666';

  try {
    /* 1. la commande */
    var noteAchat = '';
    var achatId = null;
    if (document.getElementById('lotAvecAchat').checked) {
      var fourVal = document.getElementById('acFournisseur').value;
      var montant = num(document.getElementById('acMontant').value);
      if (montant === null && prix !== null) montant = prix * marquages.length;
      var champsAchat = {
        ref_commande: document.getElementById('acRef').value.trim(),
        fournisseur: (fourVal && fourVal !== '__new__') ? Number(fourVal) : null,
        date_commande: dateToTimestamp(document.getElementById('acDateCommande').value),
        date_reception: dateToTimestamp(document.getElementById('acDateReception').value),
        montant_total: montant === null ? null : montant,
        financement: document.getElementById('acFinancement').value
      };
      var acNote = document.getElementById('acNote');
      if (acNote && aColonne('achats', 'note_financement')) champsAchat.note_financement = acNote.value.trim();
      try {
        var fFacture = document.getElementById('acFactureFile');
        if (fFacture && fFacture.files && fFacture.files[0]) champsAchat.facture = ['L', await televerserFichierSeul(fFacture.files[0])];
      } catch (efa) { noteAchat = ' (facture non jointe : ' + efa.message + ')'; }
      achatId = await ajouterEtObtenirId('achats', champsAchat);
    }

    /* 2. le lot */
    var champsLot = {
      designation: designation,
      categorie: (catVal && catVal !== '__new__') ? Number(catVal) : null,
      fabricant: document.getElementById('lotFabricant').value.trim(),
      modele: document.getElementById('lotModele').value.trim(),
      achat: achatId,
      date_fabrication: dateToTimestamp(document.getElementById('lotFabrication').value),
      duree_vie_mois: categorieNonSoumise(catVal) ? null : num(document.getElementById('lotDureeVie').value),
      prix_unitaire: prix,
      quantite_achetee: marquages.length,
      commentaire: document.getElementById('lotCommentaire').value.trim()
    };
    var noteLot = '';
    try {
      var fPhotoLot = document.getElementById('lotPhotoFile');
      if (fPhotoLot && fPhotoLot.files && fPhotoLot.files[0]) champsLot.photo = ['L', await televerserFichierSeul(fPhotoLot.files[0])];
      var fNoticeLot = document.getElementById('lotNoticeFile');
      if (fNoticeLot && fNoticeLot.files && fNoticeLot.files[0]) champsLot.notice = ['L', await televerserFichierSeul(fNoticeLot.files[0])];
    } catch (ef) { noteLot = ' (pièce jointe non ajoutée : ' + ef.message + ')'; }
    var lotId = await ajouterEtObtenirId('lots', champsLot);
    if (!lotId) throw new Error('Le lot n a pas pu être créé.');

    /* 3. les exemplaires */
    var lieuId = (lieuVal && lieuVal !== '__new__') ? Number(lieuVal) : null;
    var mes = dateToTimestamp(document.getElementById('lotMiseEnService').value);

    var couleurEl = document.getElementById('lotCouleur');
    var tailleEl = document.getElementById('lotTaille');
    var couleurStr = couleurEl ? couleurEl.value.trim() : '';
    var tailleStr = tailleEl ? tailleEl.value.trim() : '';
    var series = lireSeriesCreation();
    var actions = marquages.map(function (m, iM) {
      var champs = { lot: lotId, numero_marquage: m, lieu_stockage: lieuId, date_mise_en_service: mes };
      if (series[iM] && aColonne('materiels', 'numero_serie')) champs.numero_serie = series[iM];
      if (couleurStr && aColonne('materiels','couleur')) champs.couleur = couleurStr;
      if (tailleStr && aColonne('materiels','taille')) champs.taille = tailleStr;
      return ['AddRecord', resolvedNames.materiels, null, champs];
    });
    await appliquer(actions);

    msg.textContent = '';
    if (lotId) openLots[lotId] = true;
    ['lotDesignation', 'lotFabricant', 'lotModele', 'lotCommentaire', 'lotFabrication',
     'lotDureeVie', 'lotPrix', 'lotMiseEnService', 'acRef', 'acDateCommande',
     'acDateReception', 'acMontant'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('lotQuantite').value = '1';
    var uniEl = document.getElementById('lotUnique');
    if (uniEl) uniEl.checked = false;
    majUnique();
    document.getElementById('lotPremier').value = '001';
    var repEl = document.getElementById('lotReprise');
    if (repEl && repEl.checked) {
      repEl.checked = false;
      document.getElementById('blocAuto').hidden = false;
      document.getElementById('blocReprise').hidden = true;
      document.getElementById('lotMarquagesManuels').value = '';
    }
    var seriesEl = document.getElementById('lotSeries');
    if (seriesEl) seriesEl.value = '';
    appliquerPrefixeCategorie();
    majApercuMarquage();

    /* on ferme : le formulaire est long, il masquait la liste et donnait
       l'impression que rien ne s'etait passe */
    document.getElementById('formLot').style.display = 'none';
    document.getElementById('lotMsg').textContent = '';
    flashToast('Lot créé : ' + marquages.length + ' exemplaire(s)' + (achatId ? ' + commande enregistrée' : '') + '.' + noteAchat + noteLot);
    setTimeout(function () {
      load().then(function () {
        var nouveau = document.querySelector('#materiel-list .lot[data-lot="' + lotId + '"]');
        if (nouveau) defilerVers(nouveau, { block: 'nearest', behavior: 'smooth' });
      });
    }, 100);
  } catch (e) {
    msg.textContent = 'Erreur : ' + e.message;
    msg.style.color = '#a3242a';
    console.error(e);
  }
}

function flash(id, texte) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = texte;
  el.style.color = '#1a6b34';
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.textContent = ''; }, 8000);
}

/* Toast flottant en bas à droite : message temporaire visible peu importe le scroll */
function flashToast(texte) {
  var toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = '✓ ' + texte;
  document.body.appendChild(toast);
  setTimeout(function () {
    toast.style.animation = 'slideOutToast 0.3s ease-in forwards';
    setTimeout(function () { toast.remove(); }, 300);
  }, 2500);
}

/* ---------------------- statut ---------------------- */

/* ---------------------- prets ---------------------- */

function renderPretsActions() {
  document.getElementById('prets-actions').innerHTML =
    '<button id="btnTogglePret">+ Nouveau prêt</button>' +
    '<button class="secondary" id="btnFicheVierge" style="margin-left:8px">Fiche d\'emprunt vierge</button>' +
    '<span id="prFlash" class="form-msg" style="margin-left:12px"></span>' +
    '<div id="formPret" class="form-panel" style="display:none">' +
      '<p id="prDemandeNote" class="demande-note" hidden></p>' +
      '<div class="form-grid">' +
        filtresMaterielHtml('pr') +
      '</div>' +
      '<div class="form-grid">' +
        refField('Adhérent', 'prAdherent') +
        field('Date d\'emprunt', '<input id="prDateEmprunt" type="date">') +
        field('Date de retour prévue', '<input id="prDateRetourPrevue" type="date">') +
        field('Sortie / activité', '<input id="prSortie" type="text">') +
      '</div>' +
      '<div class="form-field" style="margin-top:12px"><label>Matériel à prêter (cochez)</label>' +
        '<label class="coche" style="margin:4px 0 6px"><input type="checkbox" id="prTous"> <b>Tout cocher / décocher</b></label>' +
        '<div id="prListe" class="grille-coches"></div>' +
        '<div id="prResume" class="selection-resume" hidden></div>' +
      '</div>' +
      '<label class="coche" style="margin:12px 0 4px"><input type="checkbox" id="prImprimer" checked> ' +
        '<b>Imprimer le bon d\'emprunt</b> (à remettre à l\'emprunteur)</label>' +
      '<div class="form-actions">' +
        '<button id="btnSubmitPret">Enregistrer le bon</button>' +
        '<button type="button" class="secondary" id="btnCancelPret">Annuler</button>' +
        '<span id="prMsg" class="form-msg"></span>' +
      '</div>' +
    '</div>' +
    '<div id="bonEditeur" class="form-panel" style="display:none">' +
      '<h4 id="beTitre" style="margin-top:0"></h4>' +
      '<p class="hint">Responsable, dates et sortie s\'appliquent a tout le bon. Vous pouvez aussi ' +
        'ajouter du matériel : il rejoint le bon sous le même numéro. Pour retirer un exemplaire, ' +
        'utilisez « Supprimer » sur sa ligne.</p>' +
      '<div class="form-grid">' +
        refField('Responsable / emprunteur', 'beAdherent') +
        field('Date d\'emprunt', '<input id="beDateEmprunt" type="date">') +
        field('Date de retour prévue', '<input id="beDateRetour" type="date">') +
        field('Sortie / activité', '<input id="beSortie" type="text">') +
      '</div>' +
      '<div class="form-field" style="margin-top:12px"><label>Ajouter du matériel au bon (facultatif)</label>' +
        '<div class="form-grid">' + filtresMaterielHtml('be') + '</div>' +
        '<label class="coche" style="margin:6px 0"><input type="checkbox" id="beTous"> <b>Tout cocher / décocher</b></label>' +
        '<div id="beListe" class="grille-coches"></div>' +
        '<div id="beResume" class="selection-resume" hidden></div>' +
      '</div>' +
      '<div class="form-actions">' +
        '<button id="btnBeSave">Enregistrer les modifications</button>' +
        '<button class="secondary" id="btnBeCancel">Annuler</button>' +
        '<span id="beMsg" class="form-msg"></span>' +
      '</div>' +
    '</div>';
  document.getElementById('btnTogglePret').onclick = function () {
    var f = document.getElementById('formPret');
    f.style.display = (f.style.display === 'none') ? 'block' : 'none';
    if (f.style.display === 'block') {
      document.getElementById('prDateEmprunt').value = new Date().toISOString().slice(0, 10);
      demandeEnCours = null;
      var note = document.getElementById('prDemandeNote');
      if (note) { note.hidden = true; note.innerHTML = ''; }
      viderSelection('pr');
      document.getElementById('prTous').checked = false;
      majListePret();
    }
  };
  document.getElementById('btnSubmitPret').onclick = addPret;
  document.getElementById('btnCancelPret').onclick = function () { document.getElementById('formPret').style.display = 'none'; viderFormulaire('formPret'); viderSelection('pr'); };
  document.getElementById('btnFicheVierge').onclick = ficheEmpruntVierge;
  attachQuickAdd('prAdherent');
  brancherFiltres('pr', majListePret);
  document.getElementById('prTous').onchange = function () {
    var etat = this.checked;
    document.querySelectorAll('#prListe .pr-item').forEach(function (c) {
      if (etat) SELECTION.pr[c.value] = true; else delete SELECTION.pr[c.value];
    });
    majListeSelectionnable('pr');
  };
  attachQuickAdd('beAdherent');
  brancherFiltres('be', function () { majListeSelectionnable('be'); });
  document.getElementById('beTous').onchange = function () {
    var etat = this.checked;
    document.querySelectorAll('#beListe .be-item').forEach(function (c) {
      if (etat) SELECTION.be[c.value] = true; else delete SELECTION.be[c.value];
    });
    majListeSelectionnable('be');
  };
  document.getElementById('btnBeSave').onclick = function () { enregistrerEditeurBon(); };
  document.getElementById('btnBeCancel').onclick = function () {
    document.getElementById('bonEditeur').style.display = 'none';
    bonEnEdition = null;
  };
  populatePretFormOptions();
}

function libelleMateriel(m) {
  var lot = refLists.lots.filter(function (l) { return l.id === m.lot; })[0];
  return (m.numero_marquage || '#' + m.id) + (lot ? ' - ' + lot.designation : '');
}

function populatePretFormOptions() {
  if (!document.getElementById('prListe')) return;
  majListePret();
  var as = document.getElementById('prAdherent');
  as.innerHTML = optionsFor(refLists.adherents, 'nom_complet', as.value, QUICK_ADD.prAdherent.label);
}

/* --- Garde-fous de dates ---
   On bloque les seules combinaisons logiquement impossibles : un fait ne peut
   pas preceder sa cause (retour avant emprunt, reception avant commande, mise
   en service avant fabrication), ni un fait deja survenu se situer dans le
   futur (fabrication, controle, incident). Une date vide est toujours toleree
   -- beaucoup de dates sont facultatives, et on n'invente rien. */
function _jourDate(val) {
  if (!val) return null;
  var d = new Date(val + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}
function _aujourdhui() {
  var n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function erreurDates(regles) {
  for (var i = 0; i < regles.length; i++) {
    var r = regles[i];
    if (r.apres !== undefined) {                 /* ordre : avant <= apres */
      var a = _jourDate(r.avant), b = _jourDate(r.apres);
      if (a && b && a > b) return r.si;
    } else {                                     /* pas dans le futur */
      var d = _jourDate(r.date);
      if (d && d > _aujourdhui()) return r.si;
    }
  }
  return null;
}

/* Numero de bon d'emprunt : millesime + sequence (ex. 2026-014). Toutes les
   lignes d'un meme bon le partagent. Genere en balayant l'existant de l'annee
   (pas de compteur stocke). Colonne facultative : sans elle, pas de numero. */
function maxNumeroEmpruntAnnee(annee) {
  var prefixe = annee + '-';
  var max = 0;
  rawRows.emprunts.forEach(function (e) {
    var v = e.numero_emprunt;
    if (!v || String(v).indexOf(prefixe) !== 0) return;
    var n = parseInt(String(v).slice(prefixe.length), 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max;
}
function genererNumeroEmprunt() {
  var annee = new Date().getFullYear();
  return annee + '-' + String(maxNumeroEmpruntAnnee(annee) + 1).padStart(3, '0');
}

async function addPret() {
  var msg = document.getElementById('prMsg');
  var ids = idsSelectionnes('pr');
  var adhId = document.getElementById('prAdherent').value;
  if (!ids.length || !adhId || adhId === '__new__') {
    msg.textContent = ids.length ? 'L\'adherent est obligatoire.' : 'Cochez au moins un matériel.';
    msg.style.color = '#a3242a';
    return;
  }
  var errPret = erreurDates([{
    avant: document.getElementById('prDateEmprunt').value,
    apres: document.getElementById('prDateRetourPrevue').value,
    si: 'La date de retour prévue ne peut pas précéder la date d\'emprunt.'
  }]);
  if (errPret) { msg.textContent = errPret; msg.style.color = '#a3242a'; return; }

  /* Avertissement multi-sites : si les exemplaires coches viennent de lieux differents,
     l'emprunteur devra se deplacer plusieurs fois. On l'avertit AVANT d'enregistrer.
     Un second clic confirme qu'il en est conscient (le drapeau prMultiSiteOk est passe). */
  var lieuxIds = {};
  ids.forEach(function (id) {
    var m = (rawRows.materiels || []).filter(function (x) { return x.id === id; })[0];
    if (m && m.lieu_stockage) lieuxIds[m.lieu_stockage] = true;
  });
  var nbLieux = Object.keys(lieuxIds).length;
  if (nbLieux > 1 && !addPret._multiOk) {
    var nomsLieux = Object.keys(lieuxIds).map(function (lid) {
      var l = (refLists.lieux || []).filter(function (x) { return String(x.id) === lid; })[0];
      return l ? l.nom : 'Lieu #' + lid;
    });
    addPret._multiOk = true;
    msg.innerHTML = '<b>⚠️ ' + nbLieux + ' lieux de stockage différents :</b> ' +
      nomsLieux.map(esc).join(', ') +
      '. Cliquez à nouveau pour confirmer que vous pouvez récupérer le matériel sur ces deux sites.';
    msg.style.color = '#a3242a';
    return;
  }
  addPret._multiOk = false;

  var numero = aColonne('emprunts', 'numero_emprunt') ? genererNumeroEmprunt() : null;
  var dateStr = document.getElementById('prDateEmprunt').value;
  var sortie = document.getElementById('prSortie').value.trim();
  var selA = document.getElementById('prAdherent');
  var nomEmprunteur = selA.options[selA.selectedIndex] ? selA.options[selA.selectedIndex].text : '';
  var commun = {
    adherent: Number(adhId),
    date_emprunt: dateToTimestamp(dateStr),
    date_retour_prevue: dateToTimestamp(document.getElementById('prDateRetourPrevue').value),
    sortie_activite: sortie
  };
  if (numero) commun.numero_emprunt = numero;
  msg.textContent = 'Enregistrement...'; msg.style.color = '#666';
  try {
    await appliquer(ids.map(function (id) {
      return ['AddRecord', resolvedNames.emprunts, null,
        Object.assign({ materiel: id }, commun)];
    }));
    if (document.getElementById('prImprimer').checked) {
      try { imprimerBon(numero, ids, nomEmprunteur, dateStr, sortie); }
      catch (eImp) { console.error(eImp); }   /* le bon est cree ; l'impression ne bloque pas la suite */
    }
    if (demandeEnCours != null && resolvedNames.demandes) {
      try { await appliquer([['UpdateRecord', resolvedNames.demandes, demandeEnCours, { traitee: true }]]); }
      catch (eDem) { console.error(eDem); }
      demandeEnCours = null;
    }
    document.getElementById('formPret').style.display = 'none';
    document.getElementById('prSortie').value = '';
    var noteP = document.getElementById('prDemandeNote');
    if (noteP) { noteP.hidden = true; noteP.innerHTML = ''; }
    viderSelection('pr');
    msg.textContent = '';
    /* Toast flottant avec marquages + emprunteur */
    var marquagesPret = ids.map(function (id) {
      var mat = rawRows.materiels.find(function (m) { return m.id === id; });
      return mat ? (mat.numero_marquage || '#' + id) : 'id:' + id;
    }).join(', ');
    var msgToastPret = marquagesPret + ' prêtée(s) a ' + nomEmprunteur + 
                       (numero ? ' (Bon N\u00b0 ' + numero + ')' : '');
    flashToast(msgToastPret);
    setTimeout(function () { load(); }, 100);  // Laisser le toast s'afficher avant reload
  } catch (e) {
    msg.textContent = 'Erreur : ' + e.message;
    msg.style.color = '#a3242a';
    console.error(e);
  }
}

/* Les actions d'un retour, partagees entre retour unitaire (fiche),
   retour groupe (liste) : une seule regle. */
/* Meme fonction partagee par les 3 surfaces de retour (bon numerote, chemin
   de secours sans numero, fiche d'un exemplaire) : le raccourci "Degrade" ->
   "Reparation a prevoir" y est centralise une seule fois. suite/motif
   restent facultatifs et defaultent au comportement d'origine (incident
   generique "Controle a realiser") si omis — aucune regression pour un
   appelant qui ne les fournit pas encore. */
function actionsRetour(empId, matId, etat, commentairePerte, suite, motifReparation) {
  var actions = [
    ['UpdateRecord', resolvedNames.emprunts, empId, {
      date_retour_effective: Math.round(Date.now() / 1000), etat_retour: etat
    }]
  ];
  /* Le statut n'est plus ecrit : il se deduit. On enregistre seulement le fait. */
  if (etat === 'Degrade') {
    var suiteFinale = (suite === 'Reparation a prevoir') ? 'Reparation a prevoir' : 'Controle a realiser';
    var dateRetourNow = Math.round(Date.now() / 1000);
    var descrDegrade = (suiteFinale === 'Reparation a prevoir' && (motifReparation || '').trim())
      ? motifReparation.trim()
      : 'Retour de prêt en état degrade - contrôle à réaliser';
    actions.push(['AddRecord', resolvedNames.incidents, null, champsIncident({
      materiel: matId,
      date_incident: dateRetourNow,
      gravite: 'Moderee',
      description: descrDegrade,
      suite: suiteFinale
    })]);
    /* meme geste que les 5 autres points d'entree "A reparer" / "Reparation
       a prevoir" : le fait declencheur cree sa ligne de suivi tout seul. */
    if (suiteFinale === 'Reparation a prevoir' && resolvedNames.reparations) {
      actions.push(['AddRecord', resolvedNames.reparations, null, {
        materiel: matId, date_declaree: dateRetourNow, motif: (motifReparation || '').trim()
      }]);
    }
  }
  if (etat === 'Perdu' || etat === 'Vole') {
    var champsPerdu = {
      hors_service_motif: etat,
      hors_service_date: Math.round(Date.now() / 1000)
    };
    /* la sortie doit s'expliquer, comme partout ailleurs : garde sur aColonne,
       aucun changement de comportement tant que la colonne n'existe pas */
    if (aColonne('materiels', 'commentaire') && (commentairePerte || '').trim()) {
      champsPerdu.commentaire = commentairePerte.trim();
    }
    actions.push(['UpdateRecord', resolvedNames.materiels, matId, champsPerdu]);
  }
  return actions;
}


/* Retour groupe par BON : les prets en cours sont regroupes par numero de bon.
   Chaque bon se solde d'un clic (tout en bon etat) ou au cas par cas (etat par
   exemplaire). Les prets sans numero (anciens ou rapides) forment un groupe a part. */
/* ---------- Onboarding : etats vides qui guident (n5, phase multi-club) ---------- */
/* Liste "Premiers pas" de la Vue d'ensemble : se coche seule, disparait des qu'un
   exemplaire existe (le socle est en place). */
function checklistPremiersPas() {
  if (rawRows.materiels.length > 0) return '';
  var etapes = [
    { ok: rawRows.categories.length > 0, txt: 'Créer une catégorie (rubrique « Listes du club »)' },
    { ok: rawRows.lieux.length > 0, txt: 'Ajouter un lieu de stockage' },
    { ok: rawRows.lots.length > 0, txt: 'Créer un premier lot (un modèle acheté)' },
    { ok: rawRows.materiels.length > 0, txt: 'Ajouter des exemplaires numérotés' }
  ];
  return '<div class="onboarding">' +
    '<div class="onboarding-titre">Premiers pas — mise en route</div>' +
    '<p class="onboarding-sous">Cette liste disparaît des que votre premier exemplaire est enregistré.</p>' +
    '<ul class="checklist">' + etapes.map(function (e) {
      return '<li class="' + (e.ok ? 'fait' : '') + '"><span class="check">' + (e.ok ? '\u2713' : '') + '</span>' +
        esc(e.txt) + '</li>';
    }).join('') + '</ul>' +
    '<p class="onboarding-sous">Vous avez d\u00e9j\u00e0 un inventaire (tableur) ? <a href="#" class="lien-import">Importez-le plut\u00f4t que de tout ressaisir \u2192</a></p></div>';
}

/* Onglet Materiel : message contextuel selon l'avancement (categorie -> lot -> exemplaire). */
function onboardingMateriel() {
  if (rawRows.materiels.length > 0) return '';
  var msg;
  if (rawRows.categories.length === 0) {
    msg = 'Votre parc est encore vide. Trois étapés, dans l\'ordre : <b>1.</b> créez vos catégories ' +
      '(baudrier, corde\u2026) dans la rubrique <b>Listes du club</b>, <b>2.</b> créez un lot (un modèle acheté), ' +
      '<b>3.</b> ajoutez-y ses exemplaires numérotés.';
  } else if (rawRows.lots.length === 0) {
    msg = 'Vos catégories sont créées. Créez maintenant votre <b>premier lot</b> \u2014 un modèle acheté ' +
      '(fabricant, modèle, durée de vie) \u2014 avec « + Nouveau lot ».';
  } else {
    msg = 'Vos lots sont la. Ajoutez leurs <b>exemplaires numérotés</b> (un par pièce physique) pour ' +
      'commencer à prêter et contrôler.';
  }
  return '<div class="onboarding"><div class="onboarding-titre">Premiers pas</div><p>' + msg + '</p>' +
    '<p class="onboarding-sous">Vous avez d\u00e9j\u00e0 un inventaire (tableur) ? <a href="#" class="lien-import">Importez-le \u2192</a></p></div>';
}

/* Encart "ajoutez du materiel d'abord" (Prets, Controles, incidents et reparations) quand le parc est vide. */
function onboardingSansMateriel(texte) {
  if (rawRows.materiels.length > 0) return '';
  return '<div class="onboarding"><div class="onboarding-titre">Premiers pas</div><p>' + texte + '</p></div>';
}

/* Nombre d'actes d'emprunt (bons) parmi une liste de prets : numeros distincts,
   plus un groupe pour les prets sans numero (legacy). Colle a la vue groupee. */
function compterBons(prets) {
  var vus = {}, sans = false;
  prets.forEach(function (e) { if (e.numero) vus[e.numero] = true; else sans = true; });
  return Object.keys(vus).length + (sans ? 1 : 0);
}

/* Quels bons sont deplies (l'utilisateur les a ouverts). Persiste entre deux
   rendus pour ne pas se refermer apres un retour. */
var bonsDeplies = {};
/* items par bon ferme, repeuple a chaque rendu -- permet aux boutons d'export
   (ajoutes hors de la boucle de rendu) de retrouver les lignes du bon clique. */
var bonsTerminesItems = {};

/* Demandes d'emprunt (table facultative DEMANDES, remplie par un formulaire
   Grist distribue aux adherents). Le formulaire ne cree jamais de pret : il
   depose une demande que le responsable transforme en bon, en choisissant les
   exemplaires reels. */
function blocDemandes(demandes) {
  return '<div class="demandes-bloc">' +
    '<h2 class="section-titre" style="margin-top:0">Demandes en attente ' +
      '<span class="titre-compte">' + demandes.length + '</span></h2>' +
    demandes.map(blocDemande).join('') + '</div>';
}

function blocDemande(dm) {
  return '<div class="demande" data-dem="' + dm.id + '">' +
    '<div class="demande-tete"><b>' + esc(dm.demandeur || '(sans nom)') + '</b>' +
      (dm.sortie_activite ? ' <span class="demande-meta">&middot; ' + esc(dm.sortie_activite) + '</span>' : '') +
      ' <span class="demande-meta">&middot; ' + fmtDate(dm.date_emprunt) + ' &rarr; ' + fmtDate(dm.date_retour_prevue) + '</span></div>' +
    '<div class="demande-besoin">' + esc(dm.besoin || '\u2014') + '</div>' +
    '<div class="demande-actions">' +
      '<button class="btn-dem-creer">Créer le bon</button>' +
      '<button class="secondary btn-dem-ignorer">Ignorer</button>' +
    '</div>' +
  '</div>';
}

function demarrerBonDepuisDemande(demId) {
  var dm = (rawRows.demandes || []).filter(function (d) { return d.id === demId; })[0];
  if (!dm) return;
  demandeEnCours = demId;
  var f = document.getElementById('formPret');
  f.style.display = 'block';
  var auj = new Date().toISOString().slice(0, 10);
  document.getElementById('prDateEmprunt').value = tsInput(dm.date_emprunt) || auj;
  document.getElementById('prDateRetourPrevue').value = tsInput(dm.date_retour_prevue) || '';
  document.getElementById('prSortie').value = dm.sortie_activite || '';
  var nom = (dm.demandeur || '').trim().toLowerCase();
  var adh = (refLists.adherents || []).filter(function (a) {
    return (a.nom_complet || '').trim().toLowerCase() === nom;
  })[0];
  document.getElementById('prAdherent').value = adh ? String(adh.id) : '';
  viderSelection('pr');
  document.getElementById('prTous').checked = false;
  majListePret();
  var note = document.getElementById('prDemandeNote');
  if (note) {
    note.innerHTML = 'Demande de <b>' + esc(dm.demandeur || '?') + '</b> : ' + esc(dm.besoin || '\u2014') +
      (adh ? '' : ' <span class="demande-note-alerte">(emprunteur a choisir : nom non reconnu)</span>');
    note.hidden = false;
  }
  defilerVers(f, { block: 'nearest' });
}

async function ignorerDemande(demId) {
  if (!resolvedNames.demandes) return;
  try {
    await appliquer([['UpdateRecord', resolvedNames.demandes, demId, { traitee: true }]]);
    flash('prFlash', 'Demande ignorée (marquée traitée).');
    await load();
  } catch (e) { afficherErreurGlobale('Demande : ' + e.message); console.error(e); }
}

/* Recherche tolerante (2026.5.28) : sans accents ni majuscules ; plusieurs mots = tous doivent se
   retrouver (« guillaume falaise »). Sert a la recherche des prets et a celle de l'onglet Materiel. */
function normRecherche(t) {
  return String(t === null || t === undefined ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}
function correspondRecherche(q, cible) {
  var mots = normRecherche(q).split(' ').filter(Boolean);
  if (!mots.length) return true;
  var c = normRecherche(cible);
  return mots.every(function (m) { return c.indexOf(m) !== -1; });
}
/* ce qu'on peut chercher dans un bon : numero, personne, sortie, marquages */
function rechercheDeBon(cle, items) {
  return [String(cle).replace(/^term:/, ''), items[0].adherent, items[0].sortie,
    items.map(function (e) { return e.materiel; }).join(' ')].join(' ');
}
var rechercheBons = '';   /* saisie conservee d'un rafraichissement a l'autre */
function appliquerRechercheBons() {
  var champ = document.getElementById('filtreBon');
  var q = champ ? champ.value : '';
  rechercheBons = q;
  var nEn = 0, nTe = 0;
  var bons = document.querySelectorAll('#prets-list .bon');
  if (bons.length) {
    bons.forEach(function (bl) {
      var ok = correspondRecherche(q, bl.dataset.recherche || bl.dataset.bon || '');
      bl.style.display = ok ? '' : 'none';
      if (ok) { if (bl.classList.contains('bon-termine')) nTe++; else nEn++; }
    });
  } else {
    /* documents sans numero de bon : listes en tableaux, on filtre les lignes */
    document.querySelectorAll('#prets-list tr').forEach(function (tr) {
      if (!tr.querySelector('td')) return;
      var ok = correspondRecherche(q, tr.textContent);
      tr.style.display = ok ? '' : 'none';
      if (ok) nEn++;
    });
  }
  var c = document.getElementById('filtreBonCompte');
  if (c) {
    c.textContent = !q.trim() ? '' : (bons.length
      ? nEn + ' bon' + (nEn > 1 ? 's' : '') + ' en cours \u00b7 ' + nTe + ' bon' + (nTe > 1 ? 's' : '') + ' termin\u00e9' + (nTe > 1 ? 's' : '') + ' correspondent'
      : nEn + ' ligne' + (nEn > 1 ? 's' : '') + ' correspondent');
  }
}

function renderBonsEnCours(prets, totalParBon) {
  var groupes = {}, ordre = [];
  prets.forEach(function (e) {
    var k = e.numero || '__sans__';
    if (!groupes[k]) { groupes[k] = []; ordre.push(k); }
    groupes[k].push(e);
  });
  ordre.sort(function (a, b) {
    var ra = groupes[a].some(function (e) { return e.retard; }) ? 0 : 1;
    var rb = groupes[b].some(function (e) { return e.retard; }) ? 0 : 1;
    if (ra !== rb) return ra - rb;                 /* retards en tete */
    if (a === '__sans__') return 1;
    if (b === '__sans__') return -1;
    return a < b ? 1 : -1;                         /* numero decroissant */
  });
  return ordre.map(function (k) { return blocBon(k, groupes[k], (totalParBon || {})[k] || groupes[k].length); }).join('');
}

function blocBon(cle, items, totalOrigine) {
  var retard = items.some(function (e) { return e.retard; });
  var partiel = totalOrigine > items.length;
  var numero = (cle === '__sans__') ? '' : cle;
  var ouvert = retard || partiel || bonsDeplies[cle];   /* en retard ou partiel = ouvert par defaut */
  var avecCommentaire = aColonne('materiels', 'commentaire');
  /* Sans la colonne "suite" sur INCIDENTS, le concept de "Reparation a
     prevoir" vs "Controle a realiser" n'a pas de sens a proposer : Degrade
     garde alors son comportement d'origine (incident generique silencieux),
     comme avant cette evolution. */
  var avecSuite = aColonne('incidents', 'suite');
  var rows = items.map(function (e) {
    /* Plus de case a cocher : choisir un etat EST l'acte de rendre l'exemplaire.
       Le menu demarre sur "Non rendu" (valeur vide) — les lignes laissees ainsi
       restent en cours, ce qui preserve le retour partiel. */
    return '<tr><td><select class="ret-etat" style="width:auto" data-emp="' + e.id + '" data-mat="' + e.matId + '">' +
        '<option value="">Non rendu</option>' +
        '<option>Bon etat</option><option>Degrade</option><option>Perdu</option><option>Vole</option></select></td>' +
      '<td><span class="badge-ref badge-clic" data-mat="' + e.matId + '" title="Ouvrir la fiche">' + esc(e.materiel) + '</span></td>' +
      '<td' + (e.retard ? ' style="color:var(--red);font-weight:600"' : '') + '>' + e.prevu +
        (e.retard ? ' <span class="badge danger">Retard</span>' : '') + '</td>' +
      '<td class="td-actions"><div>' + btnSupprimer('emprunt', e.id) + '</div></td></tr>' +
      ((avecCommentaire || avecSuite)
        ? '<tr class="ret-detail" data-detail-mat="' + e.matId + '" hidden><td></td>' +
          '<td colspan="3" style="padding:2px 8px 10px 4px">' +
            (avecCommentaire
              ? '<div class="ret-detail-perte">' +
                '<input type="text" class="ret-commentaire-item" placeholder="Circonstances (obligatoire)..." style="width:100%;max-width:420px">' +
                '</div>'
              : '') +
            /* Le raccourci demande : au retour d'un objet degrade, choisir tout
               de suite si un simple controle suffira ou si une reparation est
               deja envisagee — evite de repasser par "Declarer un incident"
               juste apres coup pour le meme exemplaire. */
            (avecSuite
              ? '<div class="ret-detail-degrade" hidden>' +
                '<select class="ret-suite" style="width:auto;margin-bottom:6px">' +
                  '<option value="Controle a realiser">Contr\u00f4le \u00e0 pr\u00e9voir</option>' +
                  '<option value="Reparation a prevoir">R\u00e9paration \u00e0 pr\u00e9voir</option>' +
                '</select>' +
                '<input type="text" class="ret-motif-item" placeholder="Motif de la r\u00e9paration (obligatoire)..." ' +
                  'style="width:100%;max-width:420px;display:block;margin-top:4px" hidden>' +
                '<div class="ret-reparation-bloc" style="margin-top:4px"></div>' +
                '</div>'
              : '') +
          '</td></tr>'
        : '');
  }).join('');
  return '<div class="bon' + (retard ? ' bon-retard' : '') + (ouvert ? ' ouvert' : '') + '" data-bon="' + esc(cle) + '" data-recherche="' + esc(normRecherche(rechercheDeBon(cle, items))) + '">' +
      '<div class="bon-tete">' +
        '<span class="bon-chevron">&#9656;</span>' +
        '<div class="bon-tete-txt">' +
          '<span class="bon-titre">' + (numero ? 'Bon N&deg; ' + esc(numero) : 'Sans numéro') + '</span> ' +
          '<span class="bon-meta">' + esc(items[0].adherent) +
            (items[0].sortie ? ' &middot; ' + esc(items[0].sortie) : '') +
            ' &middot; emprunte le ' + esc(items[0].emprunte) +
            ' &middot; ' + items.length + (partiel ? '/' + totalOrigine : '') +
            ' exemplaire' + (items.length > 1 ? 's' : '') + (partiel ? ' encore en cours' : '') + '</span>' +
        '</div>' +
        '<div class="bon-tete-actions">' +
          (retard ? '<span class="badge danger">Retard</span>' : '') +
          (partiel ? '<span class="badge info">Partiel</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="bon-corps">' +
        '<div class="scroll-y"><table class="bon-tbl">' +
          '<tr><th>Etat au retour</th><th>Matériel</th><th>Retour prevu</th><th></th></tr>' +
          rows + '</table></div>' +
        '<div class="bon-actions">' +
          '<button class="btn-bon-coches">Tout rendre en bon état</button>' +
          (numero ? '<button class="secondary btn-bon-modifier">Modifier le bon (responsable, dates, ajout)</button>' : '') +
          '<span class="form-msg bon-msg"></span>' +
        '</div>' +
      '</div>' +
    '</div>';
}

/* Prets termines : memes accordeons, replies par defaut, groupes par bon.
   Cle de depliage prefixee 'term:' pour ne pas se confondre avec les bons en cours
   (un meme numero peut avoir des lignes rendues et d'autres encore ouvertes). */
function renderBonsTermines(prets) {
  var groupes = {}, ordre = [];
  prets.forEach(function (e) {
    var k = e.numero || '__sans__';
    if (!groupes[k]) { groupes[k] = []; ordre.push(k); }
    groupes[k].push(e);
  });
  ordre.sort(function (a, b) {
    if (a === '__sans__') return 1;
    if (b === '__sans__') return -1;
    return a < b ? 1 : -1;                          /* numero decroissant */
  });
  return ordre.map(function (k) { return blocBonTermine(k, groupes[k]); }).join('');
}

function blocBonTermine(cle, items) {
  var numero = (cle === '__sans__') ? '' : cle;
  var key = 'term:' + cle;
  bonsTerminesItems[key] = items;
  var ouvert = bonsDeplies[key];                    /* replie par defaut */
  var nonBon = items.filter(function (e) { return e.etat && e.etat !== 'Bon etat'; }).length;
  var rendus = items.map(function (e) { return e.rendu; }).filter(Boolean).sort();
  var renduLabel = rendus.length ? rendus[rendus.length - 1] : '';
  var rows = items.map(function (e) {
    var etatCell = e.etat
      ? '<span class="badge ' + (e.etat === 'Bon etat' ? 'ok' : (e.etat === 'Degrade' ? 'warn' : 'danger')) +
          '">' + esc(e.etat) + '</span>'
      : '<span style="color:#999">-</span>';
    return '<tr><td><span class="badge-ref badge-clic" data-mat="' + e.matId + '" title="Ouvrir la fiche">' + esc(e.materiel) + '</span></td>' +
      '<td>' + e.emprunte + '</td><td>' + e.rendu + '</td><td>' + etatCell + '</td>' +
      '<td class="td-actions"><div>' + btnSupprimer('emprunt', e.id) + '</div></td></tr>';
  }).join('');
  return '<div class="bon bon-termine' + (ouvert ? ' ouvert' : '') + '" data-bon="' + esc(key) + '" data-recherche="' + esc(normRecherche(rechercheDeBon(key, items))) + '">' +
      '<div class="bon-tete">' +
        '<span class="bon-chevron">&#9656;</span>' +
        '<div class="bon-tete-txt">' +
          '<span class="bon-titre">' + (numero ? 'Bon N&deg; ' + esc(numero) : 'Sans numéro') + '</span> ' +
          '<span class="bon-meta">' + esc(items[0].adherent) +
            (items[0].sortie ? ' &middot; ' + esc(items[0].sortie) : '') +
            ' &middot; ' + items.length + ' exemplaire' + (items.length > 1 ? 's' : '') +
            (renduLabel ? ' &middot; rendu le ' + esc(renduLabel) : '') + '</span>' +
        '</div>' +
        '<div class="bon-tete-actions">' +
          (nonBon ? '<span class="badge warn">' + nonBon + ' a signaler</span>' : '<span class="badge ok">Rendu</span>') +
          '<button class="secondary btn-recap-pdf" data-bon="' + esc(key) + '">Export (PDF)</button>' +
          '<button class="secondary btn-recap-csv" data-bon="' + esc(key) + '">Export (CSV)</button>' +
        '</div>' +
      '</div>' +
      '<div class="bon-corps"><div class="scroll-y"><table class="bon-tbl">' +
        '<tr><th>Matériel</th><th>Emprunte le</th><th>Rendu le</th><th>État</th><th></th></tr>' +
        rows + '</table></div></div>' +
    '</div>';
}

async function validerRetours(actions, n, note) {
  if (!actions.length) { flashToast('Cochez au moins un exemplaire a rendre.'); return; }
  try {
    await appliquer(actions);
    flashToast(n + ' retour(s) valide(s)' + (note ? ' ' + note : '') + '.');
    setTimeout(function () { load(); }, 100);
  } catch (e) {
    afficherErreurGlobale('Retour : ' + e.message);
    console.error(e);
  }
}

function tsInput(v) { var d = toDate(v); return d ? d.toISOString().slice(0, 10) : ''; }

/* Ouvre l'editeur d'un bon : responsable, dates et sortie communs a toutes ses
   lignes, plus l'ajout de materiel (nouvelles lignes au meme numero). */
function ouvrirEditeurBon(numero) {
  var lignes = rawRows.emprunts.filter(function (e) {
    return String(e.numero_emprunt || '') === String(numero) && !e.date_retour_effective;
  });
  if (!lignes.length) return;
  bonEnEdition = { numero: numero, matIds: lignes.map(function (e) { return e.materiel; }) };
  var ref = lignes[0];
  document.getElementById('beTitre').textContent = 'Modifier le bon N\u00b0 ' + numero;
  var as = document.getElementById('beAdherent');
  as.innerHTML = optionsFor(refLists.adherents, 'nom_complet', ref.adherent, QUICK_ADD.prAdherent.label);
  as.value = ref.adherent;
  document.getElementById('beDateEmprunt').value = tsInput(ref.date_emprunt);
  document.getElementById('beDateRetour').value = tsInput(ref.date_retour_prevue);
  document.getElementById('beSortie').value = ref.sortie_activite || '';
  viderSelection('be');
  document.getElementById('beTous').checked = false;
  majListeSelectionnable('be');
  document.getElementById('beMsg').textContent = '';
  document.getElementById('formPret').style.display = 'none';
  var panneau = document.getElementById('bonEditeur');
  panneau.style.display = 'block';
  defilerVers(panneau, { block: 'nearest' });
}

async function enregistrerEditeurBon() {
  var msg = document.getElementById('beMsg');
  if (!bonEnEdition) return;
  var adhId = document.getElementById('beAdherent').value;
  if (!adhId || adhId === '__new__') {
    msg.textContent = 'Le responsable est obligatoire.'; msg.style.color = '#a3242a'; return;
  }
  var errD = erreurDates([{
    avant: document.getElementById('beDateEmprunt').value,
    apres: document.getElementById('beDateRetour').value,
    si: 'La date de retour prévue ne peut pas précéder la date d\'emprunt.'
  }]);
  if (errD) { msg.textContent = errD; msg.style.color = '#a3242a'; return; }
  var commun = {
    adherent: Number(adhId),
    date_emprunt: dateToTimestamp(document.getElementById('beDateEmprunt').value),
    date_retour_prevue: dateToTimestamp(document.getElementById('beDateRetour').value),
    sortie_activite: document.getElementById('beSortie').value.trim()
  };
  var lignes = rawRows.emprunts.filter(function (e) {
    return String(e.numero_emprunt || '') === String(bonEnEdition.numero) && !e.date_retour_effective;
  });
  var ajouts = idsSelectionnes('be');
  var actions = lignes.map(function (e) {
    return ['UpdateRecord', resolvedNames.emprunts, e.id, commun];
  });
  ajouts.forEach(function (matId) {
    actions.push(['AddRecord', resolvedNames.emprunts, null,
      Object.assign({ materiel: matId, numero_emprunt: bonEnEdition.numero }, commun)]);
  });
  msg.textContent = 'Enregistrement...'; msg.style.color = '#666';
  try {
    await appliquer(actions);
    document.getElementById('bonEditeur').style.display = 'none';
    var num = bonEnEdition.numero;
    bonEnEdition = null;
    flashToast('Bon N\u00b0 ' + num + ' modifié' +
      (ajouts.length ? ' (+' + ajouts.length + ' exemplaire' + (ajouts.length > 1 ? 's' : '') + ')' : '') + '.');
    setTimeout(function () { load(); }, 100);
  } catch (e) {
    msg.textContent = 'Erreur : ' + e.message; msg.style.color = '#a3242a'; console.error(e);
  }
}

async function retourGroupe() {
  var msgLocal = document.getElementById('retMsg');
  function erreurLocaleRet(texte) {
    if (msgLocal) { msgLocal.textContent = texte; msgLocal.style.color = '#a3242a'; defilerVers(msgLocal, { block: 'nearest' }); }
  }
  var coches = Array.prototype.slice.call(document.querySelectorAll('#prets-list .ret-cb:checked'));
  if (!coches.length) { erreurLocaleRet('Cochez au moins un prêt a rendre.'); return; }
  var etat = document.getElementById('retEtat').value;
  var champComment = document.getElementById('retCommentaire');
  var commentaire = champComment ? champComment.value.trim() : '';
  if ((etat === 'Perdu' || etat === 'Vole') && champComment && !commentaire) {
    erreurLocaleRet('Précisez les circonstances de la perte dans le commentaire.');
    if (champComment) champComment.focus();
    return;
  }
  var retSuiteSel = document.getElementById('retSuite');
  var suite = retSuiteSel ? retSuiteSel.value : '';
  var champMotif = document.getElementById('retMotifReparation');
  var motifReparation = champMotif ? champMotif.value.trim() : '';
  var estReparGroupe = etat === 'Degrade' && suite === 'Reparation a prevoir';
  if (estReparGroupe) {
    var idsCoches = coches.map(function (c) { return Number(c.dataset.mat); });
    var fermeesGroupe = categoriesFermeesReparation(idsCoches);
    if (fermeesGroupe.length) {
      var blocRepGroupe = document.getElementById('retReparationBloc');
      if (blocRepGroupe) blocRepGroupe.innerHTML = panneauReparationFermee(fermeesGroupe);
      if (msgLocal) msgLocal.textContent = '';
      return;
    }
    if (!motifReparation) {
      erreurLocaleRet('Précisez le motif de la réparation.');
      if (champMotif) champMotif.focus();
      return;
    }
  }
  if (msgLocal) msgLocal.textContent = '';
  var actions = [];
  coches.forEach(function (c) {
    actions = actions.concat(actionsRetour(Number(c.dataset.emp), Number(c.dataset.mat), etat, commentaire, suite, motifReparation));
  });
  try {
    await appliquer(actions);
    flashToast(coches.length + ' retour(s) valide(s) en "' + etat + '".' +
      (etat === 'Degrade' ? (estReparGroupe ? ' Reparation a prevoir pour chacun.' : ' Un incident a été cree pour chacun.') : ''));
    setTimeout(function () { load(); }, 100);
  } catch (e) {
    afficherErreurGlobale('Retour groupe : ' + e.message);
    console.error(e);
  }
}

/* n'ecrit "suite" que si la colonne existe */
function champsIncident(base) {
  if (aColonne('incidents', 'suite') && base.suite === undefined) base.suite = 'Controle a realiser';
  if (!aColonne('incidents', 'suite')) delete base.suite;
  return base;
}


/* ---------------------- controles EPI ---------------------- */

/* Volets repliants par annee (historique des controles et des incidents).
   L'annee est l'unite qui a du sens ici (un EPI se controle une fois par an).
   Annee en cours ouverte par defaut ; etat memorise entre deux rendus. */
var voletsAnnee = {};   /* 'ctrl:2025' -> true/false (deplie) */

/* Regroupe les controles identiques (meme jour, controleur, resultat, commentaire,
   type, LOT) en une seule ligne d'affichage — c'est la signature d'un controle groupe
   fait en un seul geste depuis le formulaire "Suivi EPI". Un controle avec une photo
   n'est jamais regroupe : la photo doit rester visible individuellement, pas cachee
   dans un repli. Un controle isole (pas de doublon) ressort inchange. */
function regrouperControlesLot(controles) {
  var groupes = {}, ordre = [];
  controles.forEach(function (c) {
    var jour = c.dateObj ? Date.UTC(c.dateObj.getUTCFullYear(), c.dateObj.getUTCMonth(), c.dateObj.getUTCDate()) : ('nulldate-' + c.id);
    var aPhoto = idsPiecesJointes(c.photo).length > 0;
    var cle = aPhoto ? ('seul:' + c.id) : [jour, c.controleur, c.resultat, c.commentaire, c.typeControle, c.lot || ''].join('|');
    if (!groupes[cle]) { groupes[cle] = []; ordre.push(cle); }
    groupes[cle].push(c);
  });
  var out = [];
  ordre.forEach(function (cle) {
    var membres = groupes[cle];
    if (membres.length === 1) { out.push(membres[0]); return; }
    var ref = membres[0];
    out.push({
      _groupe: true, _membres: membres, id: 'grp:' + cle,
      dateObj: ref.dateObj, date: ref.date, controleur: ref.controleur,
      resultat: ref.resultat, commentaire: ref.commentaire, typeControle: ref.typeControle,
      prochain: ref.prochain, retard: ref.retard, lotNom: ref.lotNom
    });
  });
  return out;
}

function rendreVoletsAnnee(cle, items, entetesHtml, ligneFn, mot, anneeFn) {
  var anneeActuelle = new Date().getFullYear();
  var groupes = {}, ordre = [];
  items.forEach(function (it) {
    var an = anneeFn(it) || '?';
    if (!groupes[an]) { groupes[an] = []; ordre.push(an); }
    groupes[an].push(it);
  });
  ordre.sort(function (a, b) {
    if (a === '?') return 1;
    if (b === '?') return -1;
    return b - a;                                   /* annee decroissante */
  });
  return ordre.map(function (an) {
    var liste = groupes[an];
    var key = cle + ':' + an;
    var deplie = (voletsAnnee[key] !== undefined) ? voletsAnnee[key] : (an === anneeActuelle);
    var titre = (an === '?' ? 'Date inconnue' : an) + ' \u2014 ' + liste.length + ' ' + mot + (liste.length > 1 ? 's' : '');
    return '<div class="volet-annee' + (deplie ? ' ouvert' : '') + '" data-vkey="' + key + '">' +
        '<div class="volet-tete"><span class="volet-chevron">&#9656;</span>' +
          '<span class="volet-titre">' + titre + '</span></div>' +
        '<div class="volet-corps"><div class="scroll-y"><table>' + entetesHtml +
          liste.map(ligneFn).join('') + '</table></div></div>' +
      '</div>';
  }).join('');
}

function brancherVoletsAnnee(conteneurId) {
  document.querySelectorAll('#' + conteneurId + ' .volet-tete').forEach(function (t) {
    t.onclick = function () {
      var v = t.closest('.volet-annee');
      voletsAnnee[v.dataset.vkey] = v.classList.toggle('ouvert');
    };
  });
}

function majSousOngletEPI() {
  document.querySelectorAll('#epi-so .sous-onglet').forEach(function (b) {
    b.classList.toggle('actif', b.dataset.se === sousOngletEPI);
  });
  var c = document.getElementById('epi-controles');
  var i = document.getElementById('epi-incidents');
  var r = document.getElementById('epi-reparations');
  var e = document.getElementById('epi-entretiens');
  /* Sous-onglet Entretien : visible seulement si la table facultative
     ENTRETIENS existe. Si elle a disparu alors qu'on y etait, retour sur
     Controles plutot qu'un ecran vide. */
  var btnEnt = document.querySelector('#epi-so [data-se="entretiens"]');
  if (btnEnt) btnEnt.hidden = !resolvedNames.entretiens;
  if (sousOngletEPI === 'entretiens' && !resolvedNames.entretiens) {
    sousOngletEPI = 'controles';
    document.querySelectorAll('#epi-so .sous-onglet').forEach(function (b) {
      b.classList.toggle('actif', b.dataset.se === 'controles');
    });
  }
  if (c) c.hidden = (sousOngletEPI !== 'controles');
  if (i) i.hidden = (sousOngletEPI !== 'incidents');
  if (r) r.hidden = (sousOngletEPI !== 'reparations');
  if (e) e.hidden = (sousOngletEPI !== 'entretiens');
}

/* ---------------------- entretien ---------------------- */

/* Bulle d'aide unique du module : dit ce que recouvre le mot, invite a
   preciser sans obliger, et ecarte la confusion la plus probable
   (un materiel nettoye n'est pas un materiel verifie). */
var AIDE_ENTRETIEN = 'Nettoyage, lavage ou d\u00e9sinfection du mat\u00e9riel, r\u00e9alis\u00e9 selon la notice ' +
  'du fabricant. Pr\u00e9cisez au besoin dans le commentaire ce qui a \u00e9t\u00e9 fait. Un entretien ne ' +
  'remplace pas un contr\u00f4le et ne modifie pas le statut du mat\u00e9riel.';

function renderEntretiens() {
  var zone = document.getElementById('entretiens-list');
  if (!zone) return;
  if (!resolvedNames.entretiens) { zone.innerHTML = ''; majSousOngletEPI(); return; }
  var adhMap = mapById(refLists.adherents, 'nom_complet');
  var matById = {};
  rawRows.materiels.forEach(function (m) { matById[m.id] = m; });
  var lignes = (rawRows.entretiens || []).map(function (r) {
    var d = toDate(r.date_entretien);
    return { row: r, dateObj: d, ts: d ? d.getTime() : 0, mat: matById[r.materiel] };
  }).sort(function (a, b) { return b.ts - a.ts; });
  var anneeEnCours = new Date().getFullYear();
  var cetteAnnee = lignes.filter(function (l) { return l.dateObj && l.dateObj.getFullYear() === anneeEnCours; }).length;
  var enTete = '<tr><th style="width:100px">Date</th><th style="width:110px">Exemplaire</th><th>Cat\u00e9gorie</th>' +
    '<th style="width:150px">Par</th><th>Commentaire</th><th></th></tr>';
  var ligneHtml = function (l) {
    var m = l.mat;
    var cat = m ? categorieDeMateriel(m) : null;
    return '<tr><td style="white-space:nowrap">' + fmtDate(l.row.date_entretien) + '</td>' +
      '<td>' + (m ? '<span class="badge-ref badge-clic" data-mat="' + m.id + '" title="Ouvrir la fiche">' +
        esc(m.numero_marquage || '#' + m.id) + '</span>' : '<span class="hint">supprim\u00e9</span>') + '</td>' +
      '<td>' + esc(cat ? cat.nom : '') + '</td>' +
      '<td>' + esc(adhMap[l.row.auteur] || '-') + '</td>' +
      '<td>' + esc(l.row.commentaire || '') + '</td>' +
      '<td class="td-actions">' + btnSupprimer('entretien', l.row.id) + '</td></tr>';
  };
  zone.innerHTML =
    '<div class="cards">' +
      '<div class="card"><p class="label">Entretiens enregistr\u00e9s</p><p class="value">' + lignes.length + '</p></div>' +
      '<div class="card"><p class="label">Cette ann\u00e9e</p><p class="value">' + cetteAnnee + '</p></div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
      '<button id="btnToggleEnt">+ D\u00e9clarer un entretien</button>' +
    '</div>' +
    '<span id="entFlash" class="form-msg" style="margin-left:12px"></span>' +
    '<div id="entretiens-editor"></div>' +
    '<div id="formEnt" class="form-panel" style="display:none">' +
      '<div class="form-grid">' + filtresMaterielHtml('ent') + '</div>' +
      '<div class="form-grid">' +
        fieldAide('Date de l\u2019entretien', '<input id="entDate" type="date">', AIDE_ENTRETIEN) +
        field('R\u00e9alis\u00e9 par', '<select id="entAuteur">' + optionsFor(refLists.adherents, 'nom_complet') + '</select>') +
        field('Commentaire (facultatif)', '<input id="entCommentaire" type="text" placeholder="Lavage \u00e0 l\u2019eau ti\u00e8de, d\u00e9sinfection apr\u00e8s le stage...">') +
      '</div>' +
      '<div class="form-field" style="margin-top:12px"><label>Mat\u00e9riel entretenu (cochez)</label>' +
        '<label class="coche" style="margin:4px 0 6px"><input type="checkbox" id="entFormTous"> <b>Tout cocher / décocher</b></label>' +
        '<div id="entListe" class="grille-coches"></div>' +
        '<div id="entResume" class="selection-resume" hidden></div>' +
      '</div>' +
      '<div class="form-actions">' +
        '<button id="btnSubmitEnt">Enregistrer</button>' +
        '<button type="button" class="secondary" id="btnCancelEnt">Annuler</button>' +
        '<span id="entMsg" class="form-msg"></span>' +
      '</div>' +
    '</div>' +
    '<h2 class="section-titre" style="margin-top:14px">Historique des entretiens</h2>' +
    (lignes.length
      ? rendreVoletsAnnee('ent', lignes, enTete, ligneHtml, 'entretien',
          function (l) { return l.dateObj ? l.dateObj.getFullYear() : null; })
      : '<p class="hint">Aucun entretien enregistr\u00e9. Le bouton ci-dessus d\u00e9clare un nettoyage, ' +
        'un lavage ou une d\u00e9sinfection, pour un ou plusieurs exemplaires d\u2019un coup.</p>');

  document.getElementById('btnToggleEnt').onclick = function () {
    var f = document.getElementById('formEnt');
    f.style.display = (f.style.display === 'none') ? 'block' : 'none';
    if (f.style.display === 'block') {
      document.getElementById('entDate').value = new Date().toISOString().slice(0, 10);
      document.getElementById('entMsg').textContent = '';
      viderSelection('ent');
      document.getElementById('entFormTous').checked = false;
      majListeSelectionnable('ent');
    }
  };
  document.getElementById('entFormTous').onchange = function () {
    var etat = this.checked;
    document.querySelectorAll('#entListe .ent-item').forEach(function (c) {
      if (etat) SELECTION.ent[c.value] = true; else delete SELECTION.ent[c.value];
    });
    majListeSelectionnable('ent');
  };
  document.getElementById('btnSubmitEnt').onclick = declarerEntretien;
  document.getElementById('btnCancelEnt').onclick = function () {
    document.getElementById('formEnt').style.display = 'none';
    viderSelection('ent');
  };
  brancherFiltres('ent', function () { majListeSelectionnable('ent'); });
  brancherBoutonsEdit('entretiens-list');
  brancherVoletsAnnee('entretiens-list');
  majSousOngletEPI();
}

async function declarerEntretien() {
  var msg = document.getElementById('entMsg');
  var ids = idsSelectionnes('ent');
  if (!ids.length) {
    msg.textContent = 'Cochez au moins un mat\u00e9riel.';
    msg.style.color = '#a3242a';
    return;
  }
  var dateStr = document.getElementById('entDate').value;
  if (!dateStr) { msg.textContent = 'La date est obligatoire.'; msg.style.color = '#a3242a'; return; }
  var err = erreurDates([{ date: dateStr, si: 'La date de l\u2019entretien ne peut pas \u00eatre dans le futur.' }]);
  if (err) { msg.textContent = err; msg.style.color = '#a3242a'; return; }
  var auteur = document.getElementById('entAuteur').value;
  var commentaire = document.getElementById('entCommentaire').value.trim();
  var date = dateToTimestamp(dateStr);
  msg.textContent = 'Enregistrement...'; msg.style.color = '#666';
  try {
    /* Une ligne par exemplaire, comme les controles : la fiche de vie de
       chacun garde sa propre trace. Aucune autre ecriture : ni statut, ni
       echeance de controle ne dependent d'un entretien. */
    await appliquer(ids.map(function (id) {
      return ['AddRecord', resolvedNames.entretiens, null, {
        materiel: id, date_entretien: date, auteur: auteur ? Number(auteur) : null, commentaire: commentaire
      }];
    }));
    msg.textContent = '';
    var marquages = ids.map(function (id) {
      var mat = rawRows.materiels.find(function (m) { return m.id === id; });
      return mat ? (mat.numero_marquage || '#' + id) : 'id:' + id;
    }).join(', ');
    flashToast('Entretien enregistr\u00e9 (' + ids.length + ') : ' + marquages);
    document.getElementById('entCommentaire').value = '';
    viderSelection('ent');
    setTimeout(function () { load(); }, 100);
  } catch (e) {
    msg.textContent = 'Erreur : ' + e.message;
    msg.style.color = '#a3242a';
    console.error(e);
  }
}

function renderControlesActions() {
  document.getElementById('controles-actions').innerHTML =
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button id="btnToggleCtrl">+ Nouveau contrôle</button>' +
      '<button class="secondary" id="btnFeuille" style="padding:8px 14px">Feuille de contrôle à imprimer</button>' +
      '<button class="secondary" id="btnRegistre" style="padding:8px 14px">Exporter le registre (CSV)</button>' +
    '</div>' +
    '<span id="ctFlash" class="form-msg" style="display:inline-block;margin-top:8px"></span>' +
    '<div id="formCtrl" class="form-panel" style="display:none">' +
      '<div class="form-grid">' +
        filtresMaterielHtml('ct') +
      '</div>' +
      '<div class="form-grid">' +
        field('Date du controle', '<input id="ctDate" type="date">') +
        fieldAide('Contrôleur', '<select id="ctControleur"></select>', 'Seuls les adhérents marqués « Contrôleur EPI habilité » (Listes du club → Adhérents) apparaissent ici. Si personne n’est encore marqué, tous les adhérents sont proposés.') +
        fieldAide('Résultat du contrôle', '<select id="ctResultat">' + optionsResultatsControle() + '</select>', 'Conforme : reste en service. À surveiller : reste en service, à re-vérifier de près la prochaine fois. À réparer : mis de côté, en attente de réparation. Réforme : retiré définitivement du parc.') +
        field('Commentaire', '<input id="ctCommentaire" type="text">') +
        (aColonne('controles','type_controle') ? fieldAide('Type',"<select id=\"ctType\">" + typeControleChoices.map(function(v){return '<option>'+v+'</option>';}).join('') + "</select>", 'Un contrôle périodique ou avant mise en service décale toujours la prochaine échéance. Un contrôle suite à incident ne la décale que si le réglage du club (Réglages → Fonctionnement) est en mode « systématique ».') : '') +
        '<p class="hint" id="ctMotifHint" style="grid-column:1/-1;margin:-6px 0 2px"></p>' +
        '<div id="ctReparationBloc" style="grid-column:1/-1"></div>' +
        '<div id="ctPretsBloc" style="grid-column:1/-1"></div>' +
      '</div>' +
      /* meme ergonomie que le pret : on coche, on valide une fois */
      '<div class="form-field" style="margin-top:12px"><label>Matériel à contrôler (cochez)</label>' +
        '<label class="coche" style="margin:4px 0 6px"><input type="checkbox" id="ctFormTous"> <b>Tout cocher / décocher</b></label>' +
        '<div id="ctListe" class="grille-coches"></div>' +
        '<div id="ctResume" class="selection-resume" hidden></div>' +
      '</div>' +
      '<p class="hint" style="margin-top:10px">Statut mis à jour automatiquement : Conforme &rarr; En service, A surveiller &rarr; Examen requis, A reparer &rarr; En reparation (formulaire dédié), Reforme &rarr; Reforme.</p>' +
      '<div class="form-actions">' +
        '<button id="btnSubmitCtrl">Enregistrer</button>' +
        '<button type="button" class="secondary" id="btnCancelCtrl">Annuler</button>' +
        '<span id="ctMsg" class="form-msg"></span>' +
      '</div>' +
    '</div>';
  document.getElementById('btnToggleCtrl').onclick = function () {
    var f = document.getElementById('formCtrl');
    f.style.display = (f.style.display === 'none') ? 'block' : 'none';
    if (f.style.display === 'block') {
      document.getElementById('ctDate').value = new Date().toISOString().slice(0, 10);
      viderSelection('ct');
      document.getElementById('ctFormTous').checked = false;
      majListeSelectionnable('ct');
    }
  };
  document.getElementById('ctFormTous').onchange = function () {
    var etat = this.checked;
    document.querySelectorAll('#ctListe .ct-item').forEach(function (c) {
      if (etat) SELECTION.ct[c.value] = true; else delete SELECTION.ct[c.value];
    });
    majListeSelectionnable('ct');
  };
  document.getElementById('btnSubmitCtrl').onclick = addControle;
  document.getElementById('btnCancelCtrl').onclick = function () { document.getElementById('formCtrl').style.display = 'none'; viderFormulaire('formCtrl'); viderSelection('ct'); };
  document.getElementById('btnFeuille').onclick = exporterFeuilleControle;
  document.getElementById('btnRegistre').onclick = exporterRegistreControles;
  (function () {
    var sel = document.getElementById('ctResultat'), hint = document.getElementById('ctMotifHint');
    var blocPrets = document.getElementById('ctPretsBloc');
    var blocRep = document.getElementById('ctReparationBloc');
    if (!sel || !hint) return;
    var maj = function () {
      hint.textContent = sel.value === 'Reforme'
        ? 'Précisez la cause dans le commentaire ci-dessus : usure constatée, rappel fabricant (référence), décision du bureau...'
        : sel.value === 'A surveiller'
        ? 'Précisez ce qu\'il faut surveiller dans le commentaire ci-dessus (facultatif) : usure localisée, corrosion naissante...'
        : sel.value === 'A reparer'
        ? 'Précisez le motif de la réparation dans le commentaire ci-dessus : c\'est ce qui figurera sur la fiche de vie.'
        : '';
      if (blocPrets) blocPrets.innerHTML = sel.value === 'Reforme' ? blocFermerPretsMultiples(idsSelectionnes('ct')) : '';
      /* Avertissement informatif au vol : le blocage reel se joue a la
         validation (addControle), ceci n'est qu'un signal precoce pour
         eviter de remplir tout le formulaire avant de decouvrir le refus. */
      if (blocRep) {
        blocRep.innerHTML = (sel.value === 'A reparer')
          ? (function () {
              var ids = idsSelectionnes('ct');
              var fermees = categoriesFermeesReparation(ids);
              if (fermees.length) return panneauReparationFermee(fermees);
              var avecNote = categoriesAvecNoteReparation(ids);
              return avecNote.length ? panneauNotesReparation(avecNote) : '';
            })()
          : '';
      }
    };
    sel.onchange = maj; maj();
  })();
  brancherFiltres('ct', majListeControle);
  populateControleFormOptions();
  document.querySelectorAll('#epi-so .sous-onglet').forEach(function (b) {
    b.onclick = function () { sousOngletEPI = b.dataset.se; majSousOngletEPI(); };
  });
  majSousOngletEPI();
}

function populateControleFormOptions() {
  if (!document.getElementById('ctListe')) return;
  majListeControle();
  document.getElementById('ctControleur').innerHTML = optionsFor(adherentsControleurs(), 'nom_complet');
}

function majListeControle() { majListeSelectionnable('ct'); }

async function addControle() {
  var msg = document.getElementById('ctMsg');
  var ids = idsSelectionnes('ct');
  if (!ids.length) {
    msg.textContent = 'Cochez au moins un matériel.';
    msg.style.color = '#a3242a';
    return;
  }
  var errCtrl = erreurDates([{
    date: document.getElementById('ctDate').value,
    si: 'La date de contrôle ne peut pas être dans le futur.'
  }]);
  if (errCtrl) { msg.textContent = errCtrl; msg.style.color = '#a3242a'; return; }
  var resultat = document.getElementById('ctResultat').value;
  var date = dateToTimestamp(document.getElementById('ctDate').value);
  var ctrlVal = document.getElementById('ctControleur').value;
  var commentaire = document.getElementById('ctCommentaire').value.trim();
  if (resultat === 'Reforme' && !commentaire) {
    msg.textContent = 'Précisez la cause de la reforme dans le commentaire.';
    msg.style.color = '#a3242a';
    return;
  }
  if (resultat === 'A reparer') {
    var blocRepCt = document.getElementById('ctReparationBloc');
    var fermeesCt = categoriesFermeesReparation(ids);
    if (fermeesCt.length) {
      if (blocRepCt) blocRepCt.innerHTML = panneauReparationFermee(fermeesCt);
      msg.textContent = ''; msg.style.color = '#666';
      return;
    }
    if (!commentaire) {
      msg.textContent = 'Précisez le motif de la réparation dans le commentaire.';
      msg.style.color = '#a3242a';
      return;
    }
  }

  msg.textContent = 'Enregistrement...'; msg.style.color = '#666';
  try {
    /* on n'enregistre que le fait : le statut du materiel en decoule */
    var _typeCt = aColonne('controles','type_controle') ? (document.getElementById('ctType')||{}).value||'' : '';
    var actions = ids.map(function (id) {
      var _ch = { materiel: id, date_controle: date, controleur: ctrlVal ? Number(ctrlVal) : null,
        resultat: resultat, commentaire: commentaire };
      if (_typeCt) _ch.type_controle = _typeCt;
      return ['AddRecord', resolvedNames.controles, null, _ch];
    });
    /* "A reparer" ouvre une ligne REPARATIONS par exemplaire, exactement comme
       un retour "Degrade" ouvre un incident automatiquement (meme principe :
       le fait declencheur cree sa trace de suivi, l'utilisateur n'a rien de
       plus a saisir). Rien n'est ecrit si le club n'a pas cree la table. */
    if (resultat === 'A reparer' && resolvedNames.reparations) {
      ids.forEach(function (id) {
        actions.push(['AddRecord', resolvedNames.reparations, null, {
          materiel: id, date_declaree: date, motif: commentaire
        }]);
      });
    }
    if (resultat === 'Reforme') {
      var chkCt = document.querySelector('[data-ff="fermer-prets"]');
      if (!chkCt || chkCt.checked) {
        pretsOuvertsParmi(ids).forEach(function (x) {
          actions.push(['UpdateRecord', resolvedNames.emprunts, x.pret.id, {
            date_retour_effective: Math.round(Date.now() / 1000), etat_retour: 'Degrade'
          }]);
        });
      }
    }
    await appliquer(actions);
    msg.textContent = '';
    /* Toast flottant avec marquages + resultat */
    var marquagesCtrl = ids.map(function (id) {
      var mat = rawRows.materiels.find(function (m) { return m.id === id; });
      return mat ? (mat.numero_marquage || '#' + id) : 'id:' + id;
    }).join(', ');
    var msgToastCtrl = ids.length + ' contrôle(s) : ' + marquagesCtrl + ' — Contrôle realise (' + resultat + ')';
    flashToast(msgToastCtrl);
    document.getElementById('ctCommentaire').value = '';
    viderSelection('ct');
    setTimeout(function () { load(); }, 100);  // Laisser le toast s'afficher avant reload
  } catch (e) {
    msg.textContent = 'Erreur : ' + e.message;
    msg.style.color = '#a3242a';
    console.error(e);
  }
}

/* ---------------------- incidents ---------------------- */

function renderIncidentsActions() {
  var aSuite = aColonne('incidents', 'suite');
  document.getElementById('incidents-actions').innerHTML =
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button id="btnToggleInc">+ Déclarer un incident</button>' +
      '<button class="secondary" id="btnFeuilleInc" style="padding:8px 14px" ' +
        'title="À remettre à l\'emprunteur en cas d\'incident : il decrit ce qui s\'est passe sans avoir besoin d\'acceder au logiciel, et la fiche fiabilise le suivi EPI jusqu\'a la saisie dans le registre.">' +
        'Déclaration d\'incident à imprimer</button>' +
    '</div>' +
    '<span id="incFlash" class="form-msg" style="margin-left:12px"></span>' +
    '<div id="formInc" class="form-panel" style="display:none">' +
      '<div class="form-grid">' +
        filtresMaterielHtml('in') +
      '</div>' +
      '<div class="form-grid">' +
        field('Date de l\'incident', '<input id="inDate" type="date">') +
        field('Gravite', '<select id="inGravite"><option>Mineure</option><option>Moderee</option><option>Grave</option></select>') +
        fieldAide('Suite a donner', '<select id="inSuite">' +
          SUITES.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select>', 'Contrôle à réaliser : passe en attente de contrôle. Sans suite : reste en service tel quel, l’incident reste tracé pour mémoire. Réparation à prévoir : passe en réparation. Mise au rebut immédiate : réformé directement.') +
        field('Description', '<input id="inDescription" type="text" placeholder="Chute facteur 2, choc sur arete...">') +
        '<p class="hint" id="inSuiteHint" style="grid-column:1/-1;margin:-6px 0 2px"></p>' +
        '<div id="inReparationBloc" style="grid-column:1/-1"></div>' +
        '<div id="inPretsBloc" style="grid-column:1/-1"></div>' +
        (aColonne('incidents', 'photo') ? field('Photo du dommage (facultatif)', '<input id="inPhoto" type="file" accept="image/*">') : '') +
      '</div>' +
      /* meme ergonomie que le pret et le controle : on coche, on valide une fois.
         Un incident touche souvent plusieurs exemplaires (chute d'un sac, choc). */
      '<div class="form-field" style="margin-top:12px"><label>Matériel concerne (cochez)</label>' +
        '<label class="coche" style="margin:4px 0 6px"><input type="checkbox" id="inFormTous"> <b>Tout cocher / décocher</b></label>' +
        '<div id="inListe" class="grille-coches"></div>' +
        '<div id="inResume" class="selection-resume" hidden></div>' +
      '</div>' +
      '<p class="hint" style="margin-top:10px">Le statut du matériel découle de la suite choisie, sans saisie.' +
        (aSuite ? '' : ' <b>La colonne "suite" n\'existe pas dans la table INCIDENTS : la décision ne sera pas enregistrée.</b>') +
      '</p>' +
      '<div class="form-actions">' +
        '<button id="btnSubmitInc">Enregistrer</button>' +
        '<button type="button" class="secondary" id="btnCancelInc">Annuler</button>' +
        '<span id="inMsg" class="form-msg"></span>' +
      '</div>' +
    '</div>';
  document.getElementById('btnToggleInc').onclick = function () {
    var f = document.getElementById('formInc');
    f.style.display = (f.style.display === 'none') ? 'block' : 'none';
    if (f.style.display === 'block') {
      document.getElementById('inDate').value = new Date().toISOString().slice(0, 10);
      viderSelection('in');
      document.getElementById('inFormTous').checked = false;
      majListeSelectionnable('in');
      /* etat propre a chaque ouverture : evite qu'un "Annuler" (qui decoche
         les deux radios sans les remettre a l'etat par defaut) ne laisse le
         panneau reparation dans un etat incoherent a la reouverture. */
      var inSuiteReset = document.getElementById('inSuite');
      var inBlocReset = document.getElementById('inReparationBloc');
      var inHintReset = document.getElementById('inSuiteHint');
      if (inSuiteReset) inSuiteReset.selectedIndex = 0;
      if (inBlocReset) inBlocReset.innerHTML = '';
      if (inHintReset) inHintReset.textContent = '';
    }
  };
  document.getElementById('inFormTous').onchange = function () {
    var etat = this.checked;
    document.querySelectorAll('#inListe .in-item').forEach(function (c) {
      if (etat) SELECTION.in[c.value] = true; else delete SELECTION.in[c.value];
    });
    majListeSelectionnable('in');
  };
  document.getElementById('btnSubmitInc').onclick = addIncident;
  document.getElementById('btnCancelInc').onclick = function () { document.getElementById('formInc').style.display = 'none'; viderFormulaire('formInc'); viderSelection('in'); };
  document.getElementById('btnFeuilleInc').onclick = exporterFeuilleIncident;
  brancherFiltres('in', majListeIncident);
  populateIncidentFormOptions();
  (function () {
    var sel = document.getElementById('inSuite'), hint = document.getElementById('inSuiteHint');
    var blocPrets = document.getElementById('inPretsBloc');
    var blocRepIn = document.getElementById('inReparationBloc');
    if (!sel || !hint) return;
    var maj = function () {
      hint.textContent = sel.value === 'Mise au rebut immediate'
        ? 'Décrivez dans la description les faits qui justifient la mise au rebut (utile pour la traçabilité et un éventuel signalement au fabricant).'
        : sel.value === 'Reparation a prevoir'
        ? 'Précisez le motif de la réparation dans la description : c\'est ce qui figurera sur la fiche de vie.'
        : '';
      if (blocPrets) blocPrets.innerHTML = sel.value === 'Mise au rebut immediate' ? blocFermerPretsMultiples(idsSelectionnes('in')) : '';
      if (blocRepIn) {
        blocRepIn.innerHTML = (sel.value !== 'Reparation a prevoir') ? '' :
          (function () {
            var idsIn = idsSelectionnes('in');
            var fermees = categoriesFermeesReparation(idsIn);
            var panneauCategorieIn = fermees.length ? panneauReparationFermee(fermees)
              : (function () { var avecNote = categoriesAvecNoteReparation(idsIn); return avecNote.length ? panneauNotesReparation(avecNote) : ''; })();
            return panneauCategorieIn + blocEtatReparation('in');
          })();
        if (sel.value === 'Reparation a prevoir') brancherEtatReparation('in');
      }
    };
    sel.onchange = maj; maj();
  })();
}


function populateIncidentFormOptions() {
  if (!document.getElementById('inListe')) return;
  majListeIncident();
}

function majListeIncident() { majListeSelectionnable('in'); }

async function addIncident() {
  var msg = document.getElementById('inMsg');
  var ids = idsSelectionnes('in');
  if (!ids.length) {
    msg.textContent = 'Cochez au moins un matériel.';
    msg.style.color = '#a3242a';
    return;
  }
  var errInc = erreurDates([{
    date: document.getElementById('inDate').value,
    si: 'La date de l\'incident ne peut pas être dans le futur.'
  }]);
  if (errInc) { msg.textContent = errInc; msg.style.color = '#a3242a'; return; }
  if (aColonne('incidents', 'suite') && document.getElementById('inSuite').value === 'Mise au rebut immediate'
      && !document.getElementById('inDescription').value.trim()) {
    msg.textContent = 'Décrivez les faits qui justifient la mise au rebut, dans la description.';
    msg.style.color = '#a3242a';
    return;
  }
  var inSuiteVal = aColonne('incidents', 'suite') ? document.getElementById('inSuite').value : '';
  if (inSuiteVal === 'Reparation a prevoir') {
    var blocRepInSub = document.getElementById('inReparationBloc');
    var fermeesIn = categoriesFermeesReparation(ids);
    if (fermeesIn.length) {
      if (blocRepInSub) blocRepInSub.innerHTML = panneauReparationFermee(fermeesIn);
      msg.textContent = ''; msg.style.color = '#666';
      return;
    }
    if (!document.getElementById('inDescription').value.trim()) {
      msg.textContent = 'Précisez le motif de la réparation dans la description.';
      msg.style.color = '#a3242a';
      return;
    }
  }
  msg.textContent = 'Enregistrement...'; msg.style.color = '#666';
  try {
    var base = {
      date_incident: dateToTimestamp(document.getElementById('inDate').value),
      gravite: document.getElementById('inGravite').value,
      description: document.getElementById('inDescription').value.trim()
    };
    /* on n'ecrit dans "suite" que si la colonne existe, sinon Grist rejette l'action */
    if (aColonne('incidents', 'suite')) base.suite = document.getElementById('inSuite').value;

    var noteInc = '';
    var inPhoto = document.getElementById('inPhoto');
    if (inPhoto && inPhoto.files && inPhoto.files[0]) {
      try { base.photo = ['L', await televerserFichierSeul(inPhoto.files[0])]; }
      catch (ep) { noteInc = ' (photo non jointe : ' + ep.message + ')'; }
    }

    var actionsInc = ids.map(function (id) {
      var champs = { materiel: id };
      Object.keys(base).forEach(function (k) { champs[k] = base[k]; });
      return ['AddRecord', resolvedNames.incidents, null, champs];
    });
    if (base.suite === 'Reparation a prevoir' && resolvedNames.reparations) {
      var dejaFaiteIn = etatReparationEstDejaFaite('in');
      var extraIn = dejaFaiteIn ? champsExtraReparationDejaFaite('in') : null;
      ids.forEach(function (id) {
        var champsRepIn = { materiel: id, date_declaree: base.date_incident, motif: base.description };
        if (dejaFaiteIn) {
          champsRepIn.date_effectuee = base.date_incident;
          champsRepIn.intervenant = extraIn.intervenant;
          champsRepIn.pieces_remplacees = extraIn.pieces_remplacees;
          appliquerProlongation(champsRepIn, extraIn, id);
          champsRepIn.description = base.description;
        }
        actionsInc.push(['AddRecord', resolvedNames.reparations, null, champsRepIn]);
        var actionCtrlIn = actionControleApresReparation('in', id, base.date_incident);
        if (actionCtrlIn) actionsInc.push(actionCtrlIn);
      });
    }
    if (base.suite === 'Mise au rebut immediate') {
      var chkIn = document.querySelector('[data-ff="fermer-prets"]');
      if (!chkIn || chkIn.checked) {
        pretsOuvertsParmi(ids).forEach(function (x) {
          actionsInc.push(['UpdateRecord', resolvedNames.emprunts, x.pret.id, {
            date_retour_effective: Math.round(Date.now() / 1000), etat_retour: 'Degrade'
          }]);
        });
      }
    }
    await appliquer(actionsInc);
    document.getElementById('formInc').style.display = 'none';
    document.getElementById('inDescription').value = '';
    viderSelection('in');
    msg.textContent = '';
    /* Toast flottant avec marquages + statut */
    var marquagesInc = ids.map(function (id) {
      var mat = rawRows.materiels.find(function (m) { return m.id === id; });
      return mat ? (mat.numero_marquage || '#' + id) : 'id:' + id;
    }).join(', ');
    var msgToastInc;
    if (base.suite === 'Reparation a prevoir') {
      msgToastInc = etatReparationEstInspectee('in')
        ? ids.length + ' r\u00e9paration(s) enregistr\u00e9e(s) : ' + marquagesInc + ' repassent en service imm\u00e9diatement' + noteInc
        : etatReparationEstDejaFaite('in')
        ? ids.length + ' r\u00e9paration(s) enregistr\u00e9e(s) : ' + marquagesInc + ' repartent en attente de contr\u00f4le' + noteInc
        : ids.length + ' r\u00e9paration(s) d\u00e9clar\u00e9e(s) : ' + marquagesInc + ' retir\u00e9(s) du parc en attendant' + noteInc;
    } else {
      msgToastInc = ids.length + ' incident(s) : ' + marquagesInc + ' en attente de contrôle' + noteInc;
    }
    flashToast(msgToastInc);
    setTimeout(function () { load(); }, 100);  // Laisser le toast s'afficher avant reload
  } catch (e) {
    msg.textContent = 'Erreur : ' + e.message;
    msg.style.color = '#a3242a';
    console.error(e);
  }
}

/* Meme principe qu'addIncident(), mais pour le formulaire dedie "Declarer
   une reparation" : toujours suite = "Reparation a prevoir", gravite fixee
   (le champ n'existe plus dans ce formulaire, aucune raison de le demander),
   et les champs de "deja effectuee" lus sur le prefixe 'rep'. Un incident
   est quand meme cree en arriere-plan (meme table, meme traçabilite) —
   seule l'apparence change, comme convenu. */
async function declarerReparationGroupe() {
  var msg = document.getElementById('repMsg');
  var rDecRep = document.getElementById('repEtatDecoupee');
  if (rDecRep && rDecRep.checked) {
    /* "Decoupee" ne se soumet jamais par ce bouton — la fenetre dediee
       s'en charge entierement (elle s'ouvre d'ailleurs automatiquement
       des la selection de l'exemplaire). Sans ce garde-fou, une categorie
       a la fois reparable et decoupable (rA/rD toujours presents) aurait
       pu soumettre silencieusement comme "A prevoir" — etatReparationEstDejaFaite
       lit rD.checked, jamais rDec, donc rien ne l'aurait signale autrement. */
    msg.textContent = 'Utilisez la fen\u00eatre de d\u00e9coupe pour valider (elle s\u2019ouvre d\u00e8s que vous cochez l\u2019exemplaire).';
    msg.style.color = '#666';
    return;
  }
  var ids = idsSelectionnes('rep');
  if (!ids.length) {
    msg.textContent = 'Cochez au moins un matériel.';
    msg.style.color = '#a3242a';
    return;
  }
  var repDateEl = document.getElementById('repRepDate');
  var repDescEl = document.getElementById('repRepDescription');
  var repDate = repDateEl ? repDateEl.value : '';
  var repDesc = repDescEl ? repDescEl.value.trim() : '';
  var errRep = erreurDates([{
    date: repDate, si: 'La date ne peut pas être dans le futur.'
  }]);
  if (errRep) { msg.textContent = errRep; msg.style.color = '#a3242a'; return; }
  var fermeesRep = categoriesFermeesReparation(ids);
  if (fermeesRep.length) {
    /* deja visible : le panneau se rafraichit en direct des que la
       selection change (voir majListeSelectionnable), rien a reecrire ici */
    msg.textContent = ''; msg.style.color = '#666';
    return;
  }
  if (!repDesc) {
    msg.textContent = 'Précisez le motif : c\'est ce qui figurera sur la fiche de vie.';
    msg.style.color = '#a3242a';
    return;
  }
  msg.textContent = 'Enregistrement...'; msg.style.color = '#666';
  try {
    var repDateTs = dateToTimestamp(repDate);
    var actionsRep = ids.map(function (id) {
      return ['AddRecord', resolvedNames.incidents, null, champsIncident({
        materiel: id, date_incident: repDateTs,
        gravite: 'Moderee', suite: 'Reparation a prevoir',
        description: repDesc
      })];
    });
    if (resolvedNames.reparations) {
      var dejaFaiteRep = etatReparationEstDejaFaite('rep');
      var extraRep = dejaFaiteRep ? champsExtraReparationDejaFaite('rep') : null;
      ids.forEach(function (id) {
        var champsRepGr = { materiel: id, date_declaree: repDateTs, motif: repDesc };
        if (dejaFaiteRep) {
          champsRepGr.date_effectuee = repDateTs;
          champsRepGr.intervenant = extraRep.intervenant;
          champsRepGr.pieces_remplacees = extraRep.pieces_remplacees;
          appliquerProlongation(champsRepGr, extraRep, id);
          champsRepGr.description = repDesc;
          if (extraRep.intervenant_qui) champsRepGr.intervenant_qui = extraRep.intervenant_qui;
        }
        actionsRep.push(['AddRecord', resolvedNames.reparations, null, champsRepGr]);
        var actionCtrlRep = actionControleApresReparation('rep', id, repDateTs);
        if (actionCtrlRep) actionsRep.push(actionCtrlRep);
      });
    }
    await appliquer(actionsRep);
    document.getElementById('formDeclarerRep').style.display = 'none';
    viderSelection('rep');
    msg.textContent = '';
    var marquagesRep = ids.map(function (id) {
      var mat = rawRows.materiels.find(function (m) { return m.id === id; });
      return mat ? mat.numero_marquage : 'id:' + id;
    }).join(', ');
    var toastRep = etatReparationEstInspectee('rep')
      ? ids.length + ' r\u00e9paration(s) enregistr\u00e9e(s) : ' + marquagesRep + ' repassent en service imm\u00e9diatement'
      : etatReparationEstDejaFaite('rep')
      ? ids.length + ' r\u00e9paration(s) enregistr\u00e9e(s) : ' + marquagesRep + ' repartent en attente de contr\u00f4le'
      : ids.length + ' r\u00e9paration(s) d\u00e9clar\u00e9e(s) : ' + marquagesRep + ' retir\u00e9(s) du parc en attendant';
    flashToast(toastRep);
    setTimeout(function () { load(); }, 100);
  } catch (e) {
    msg.textContent = 'Erreur : ' + e.message;
    msg.style.color = '#a3242a';
    console.error(e);
  }
}

/* Enregistre un controle identique pour tous les exemplaires coches.
   Un seul appel a Grist, comme le pret et le retour groupes. */
async function controleGroupe() {
  var msg = document.getElementById('cgMsg');
  var coches = Array.prototype.slice.call(document.querySelectorAll('#controles-list .ct-cb:checked'));
  if (!coches.length) {
    msg.textContent = 'Cochez au moins un exemplaire.'; msg.style.color = '#a3242a'; return;
  }
  var errCg = erreurDates([{
    date: document.getElementById('cgDate').value,
    si: 'La date de contrôle ne peut pas être dans le futur.'
  }]);
  if (errCg) { msg.textContent = errCg; msg.style.color = '#a3242a'; return; }
  var date = dateToTimestamp(document.getElementById('cgDate').value);
  var ctrlVal = document.getElementById('cgControleur').value;
  var resultat = document.getElementById('cgResultat').value;
  var commentaire = document.getElementById('cgCommentaire').value.trim();
  if (resultat === 'Reforme' && !commentaire) {
    msg.textContent = 'Précisez la cause de la reforme dans le commentaire.';
    msg.style.color = '#a3242a';
    return;
  }
  var matIdsCgTot = coches.map(function (c) { return Number(c.dataset.mat); });
  if (resultat === 'A reparer') {
    var blocRepCg = document.getElementById('cgReparationBloc');
    var fermeesCg = categoriesFermeesReparation(matIdsCgTot);
    if (fermeesCg.length) {
      if (blocRepCg) blocRepCg.innerHTML = panneauReparationFermee(fermeesCg);
      msg.textContent = ''; msg.style.color = '#666';
      return;
    }
    if (!commentaire) {
      msg.textContent = 'Précisez le motif de la réparation dans le commentaire.';
      msg.style.color = '#a3242a';
      return;
    }
  }
  var _typeCg = aColonne('controles','type_controle') ? (document.getElementById('cgType')||{}).value||'' : '';
  var actions = coches.map(function (c) {
    var _ch = { materiel: Number(c.dataset.mat), date_controle: date,
      controleur: ctrlVal ? Number(ctrlVal) : null, resultat: resultat, commentaire: commentaire };
    if (_typeCg) _ch.type_controle = _typeCg;
    return ['AddRecord', resolvedNames.controles, null, _ch];
  });
  if (resultat === 'A reparer' && resolvedNames.reparations) {
    matIdsCgTot.forEach(function (id) {
      actions.push(['AddRecord', resolvedNames.reparations, null, {
        materiel: id, date_declaree: date, motif: commentaire
      }]);
    });
  }
  if (resultat === 'Reforme') {
    var chkCg = document.querySelector('[data-ff="fermer-prets"]');
    if (!chkCg || chkCg.checked) {
      var matIdsCg = coches.map(function (c) { return Number(c.dataset.mat); });
      pretsOuvertsParmi(matIdsCg).forEach(function (x) {
        actions.push(['UpdateRecord', resolvedNames.emprunts, x.pret.id, {
          date_retour_effective: Math.round(Date.now() / 1000), etat_retour: 'Degrade'
        }]);
      });
    }
  }
  msg.textContent = 'Enregistrement...'; msg.style.color = '#666';
  try {
    await appliquer(actions);
    flashToast(coches.length + ' contrôle(s) valide(s) en "' + resultat + '".');
    setTimeout(function () { load(); }, 100);
  } catch (e) {
    afficherErreurGlobale('Contrôle groupe : ' + e.message);
    console.error(e);
  }
}

/* Export des commandes, tel que filtre a l'ecran : ce qu'on joint a un
   dossier de subvention ou au rapport financier de l'AG. */
function exporterAchats(liste, portee) {
  var lignes = [['COMMANDES — ' + portee.toUpperCase()],
                ['Genere le', new Date().toLocaleDateString('fr-FR')], [],
                ['Commande', 'Fournisseur', 'Date', 'Lots', 'Montant', 'Financement']];
  liste.forEach(function (a) {
    lignes.push([a.ref, a.fournisseur, a.date, a.lots, a.montant, a.financement]);
  });
  lignes.push([], ['Total', '', '', '', liste.reduce(function (s, a) { return s + a.montant; }, 0), '']);
  telechargerCsv(lignes, 'commandes-' + portee.replace(/[^a-zA-Z0-9]+/g, '-') + '.csv', 'budget-list');
}

/* ---------------------- suivi du remplissage (plan gratuit) ---------------------- */

/* Grist gratuit plafonne chaque table a 5000 lignes. On previent bien
   avant, et on offre d'archiver les prets clos anciens sans rien perdre. */
var PLAFOND_LIGNES = 5000;
var SEUIL_ALERTE = 0.8;

function remplissageTables() {
  return [
    { nom: 'Prêts (EMPRUNTS)', key: 'emprunts', n: rawRows.emprunts.length },
    { nom: 'Contrôles', key: 'controles', n: rawRows.controles.length },
    { nom: 'Incidents', key: 'incidents', n: rawRows.incidents.length },
    { nom: 'Matériels', key: 'materiels', n: rawRows.materiels.length }
  ].map(function (t) {
    t.part = Math.round(100 * t.n / PLAFOND_LIGNES);
    t.alerte = t.n >= PLAFOND_LIGNES * SEUIL_ALERTE;
    return t;
  });
}

/* prets clos dont le retour date de plus de deux ans : candidats a l'archivage */
function pretsArchivables() {
  var limite = new Date();
  limite.setFullYear(limite.getFullYear() - 2);
  return rawRows.emprunts.filter(function (e) {
    var d = toDate(e.date_retour_effective);
    return d && d < limite;
  });
}

function renderRemplissage() {
  var zone = document.getElementById('apercu-remplissage');
  if (!zone) return;
  var tables = remplissageTables();
  var archivables = pretsArchivables();

  var barres = tables.map(function (t) {
    return '<div class="rempl-ligne">' +
      '<span class="rempl-nom">' + t.nom + '</span>' +
      '<span class="rempl-jauge"><span class="rempl-fill' + (t.alerte ? ' chaud' : '') +
        '" style="width:' + Math.min(t.part, 100) + '%"></span></span>' +
      '<span class="rempl-chiffre">' + t.n + ' / ' + PLAFOND_LIGNES + '</span>' +
    '</div>';
  }).join('');

  var alerte = tables.some(function (t) { return t.alerte; });
  var archiveBloc = archivables.length
    ? '<p class="hint" style="margin:10px 0 6px">' + archivables.length +
        ' prêt(s) clos depuis plus de deux ans peuvent être archivés : ' +
        'exportez-les, puis supprimez-les pour libérer des lignes. La traçabilite reste dans le fichier exporté.</p>' +
      '<button class="secondary" id="btnExportArchive">Exporter les prets archivables (CSV)</button>'
    : '<p class="hint" style="margin:10px 0 0">Aucun prêt assez ancien pour être archive (seuil : retour il y a plus de 2 ans).</p>';

  zone.innerHTML =
    (alerte
      ? '<p class="hint" style="color:var(--red);font-weight:600">Une table approche du plafond de ' +
          PLAFOND_LIGNES + ' lignes du plan gratuit. Pensez a archiver.</p>'
      : '<p class="hint">Chaque table du plan gratuit est limitée a ' + PLAFOND_LIGNES +
          ' lignes. Vous êtes très loin du plafond.</p>') +
    '<div class="rempl-tableau">' + barres + '</div>' +
    archiveBloc;

  var btn = document.getElementById('btnExportArchive');
  if (btn) btn.onclick = function () { exporterArchivePrets(archivables); };
}

function exporterArchivePrets(prets) {
  var matMap = mapById(rawRows.materiels, 'numero_marquage');
  var adhMap = mapById(rawRows.adherents, 'nom_complet');
  var lignes = [['Materiel', 'Adherent', 'Emprunte le', 'Retour prevu', 'Rendu le', 'Etat', 'Sortie']];
  prets.forEach(function (e) {
    lignes.push([
      matMap[e.materiel] || e.materiel, adhMap[e.adherent] || e.adherent,
      fmtDate(e.date_emprunt), fmtDate(e.date_retour_prevue), fmtDate(e.date_retour_effective),
      e.etat_retour || '', e.sortie_activite || ''
    ]);
  });
  telechargerCsv(lignes, 'archive-prets-' + new Date().toISOString().slice(0, 10) + '.csv', 'apercu-remplissage');
}

/* ---------------------- statistiques (bilan annuel / AG) ---------------------- */

/* Chiffres pensees pour un compte-rendu d'assemblee generale :
   ce qui tourne, ce qui dort, ce qui est a jour, ce qui a coute. */
function calculerStatistiques() {
  var now = new Date();
  var depuis12 = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  /* rotation : nombre de prets par exemplaire sur les 12 derniers mois */
  var pretsParMat = {};
  rawRows.emprunts.forEach(function (e) {
    var d = toDate(e.date_emprunt);
    if (d && d >= depuis12 && e.materiel) pretsParMat[e.materiel] = (pretsParMat[e.materiel] || 0) + 1;
  });

  var enParc = rawRows.materiels.filter(function (m) { return HORS_STOCK.indexOf(m._statut) === -1; });

  /* taux de controle : part du parc controle dans les 12 derniers mois */
  var controlesRecents = {};
  rawRows.controles.forEach(function (c) {
    var d = toDate(c.date_controle);
    if (d && d >= depuis12 && c.materiel) controlesRecents[c.materiel] = true;
  });
  var nbControles = enParc.filter(function (m) { return controlesRecents[m.id]; }).length;
  var tauxControle = enParc.length ? Math.round(100 * nbControles / enParc.length) : 0;

  /* rotation par categorie : total de prets 12 mois, agrege par categorie du lot */
  var lotById = {}; rawRows.lots.forEach(function (l) { lotById[l.id] = l; });
  var catById = {}; rawRows.categories.forEach(function (c) { catById[c.id] = c; });
  var parCategorie = {};
  enParc.forEach(function (m) {
    var l = lotById[m.lot]; if (!l) return;
    var cat = catById[l.categorie]; var nom = cat ? cat.nom : 'Sans catégorie';
    if (!parCategorie[nom]) parCategorie[nom] = { exemplaires: 0, prets: 0 };
    parCategorie[nom].exemplaires++;
    parCategorie[nom].prets += (pretsParMat[m.id] || 0);
  });

  /* depenses par financement : sur toutes les commandes enregistrees */
  var parFinancement = {};
  var totalDepense = 0;
  rawRows.achats.forEach(function (a) {
    var f = a.financement || 'Non précise';
    var montant = Number(a.montant_total) || 0;
    parFinancement[f] = (parFinancement[f] || 0) + montant;
    totalDepense += montant;
  });

  /* Le plus emprunte / dormant : agrege par LOT (modele), pas par exemplaire.
     Un emprunteur choisit un TYPE de materiel, pas un exemplaire precis ; c'est le lot
     qui revele les investissements rentables (tres empruntes) et dormants (jamais). */
  var pretsTotalParMat = {};
  rawRows.emprunts.forEach(function (e) {
    if (e.materiel) pretsTotalParMat[e.materiel] = (pretsTotalParMat[e.materiel] || 0) + 1;
  });
  var statLot = {};
  enParc.forEach(function (m) {
    var l = lotById[m.lot]; if (!l) return;
    if (!statLot[l.id]) statLot[l.id] = { lotId: l.id,
      label: l.designation || [l.fabricant, l.modele].filter(Boolean).join(' ') || ('Lot #' + l.id),
      exemplaires: 0, prets12: 0, pretsTotal: 0 };
    statLot[l.id].exemplaires++;
    statLot[l.id].prets12 += (pretsParMat[m.id] || 0);
    statLot[l.id].pretsTotal += (pretsTotalParMat[m.id] || 0);
  });
  var lotsVals = Object.keys(statLot).map(function (k) { return statLot[k]; });
  var podiumLots = lotsVals.filter(function (x) { return x.prets12 > 0; })
    .sort(function (a, b) { return b.prets12 - a.prets12; }).slice(0, 5);
  var lotsDormants = lotsVals.filter(function (x) { return x.pretsTotal === 0; })
    .sort(function (a, b) { return b.exemplaires - a.exemplaires; });

  /* pertes et vols de l'annee civile en cours : un chiffre de bilan, pas de pilotage
     quotidien -- c'est pour ca qu'il vit ici plutot que sur la Vue d'ensemble. */
  var anneeStats = new Date().getUTCFullYear();
  var perdusAnneeStat = rawRows.materiels.filter(function (m) {
    if (m._statut !== 'Perdu') return false;
    var d = toDate(m.hors_service_date);
    return d && d.getUTCFullYear() === anneeStats;
  }).length;
  var volesAnneeStat = rawRows.materiels.filter(function (m) {
    if (m._statut !== 'Vole') return false;
    var d = toDate(m.hors_service_date);
    return d && d.getUTCFullYear() === anneeStats;
  }).length;
  var valeurPerdueStat = rawRows.materiels.reduce(function (som, m) {
    if (m._statut !== 'Perdu' && m._statut !== 'Vole') return som;
    var d = toDate(m.hors_service_date);
    if (!d || d.getUTCFullYear() !== anneeStats) return som;
    var l = lotById[m.lot];
    return som + (l ? Number(l.prix_unitaire) || 0 : 0);
  }, 0);

  return {
    parcActif: enParc.length,
    lotsDormants: lotsDormants,
    tauxControle: tauxControle, nbControles: nbControles,
    parCategorie: parCategorie, parFinancement: parFinancement,
    totalDepense: totalDepense, podiumLots: podiumLots,
    anneeStats: anneeStats, perdusAnnee: perdusAnneeStat, volesAnnee: volesAnneeStat,
    valeurPerdue: valeurPerdueStat
  };
}

function renderStatistiques() {
  var zone = document.getElementById('apercu-stats');
  if (!zone) return;
  var s = calculerStatistiques();

  function bloc(titre, contenu) {
    return '<div class="stat-bloc"><h4>' + titre + '</h4>' + contenu + '</div>';
  }

  var cats = Object.keys(s.parCategorie).sort(function (a, b) {
    return s.parCategorie[b].prets - s.parCategorie[a].prets;
  });
  var rotationHtml = cats.length
    ? '<table><tr><th>Catégorie</th><th class="num">Exempl.</th><th class="num">Prêts 12 m.</th>' +
        '<th class="num">Par exempl.</th></tr>' +
      cats.map(function (n) {
        var c = s.parCategorie[n];
        var ratio = c.exemplaires ? (c.prets / c.exemplaires).toFixed(1) : '0';
        return '<tr><td>' + esc(n) + '</td><td class="num">' + c.exemplaires + '</td>' +
          '<td class="num">' + c.prets + '</td><td class="num">' + ratio + '</td></tr>';
      }).join('') + '</table>'
    : '<p class="hint">Aucun prêt sur la période.</p>';

  var podiumHtml = s.podiumLots.length
    ? '<table><tr><th>Lot / modèle</th><th class="num">Exempl.</th><th class="num">Prêts (12 mois)</th></tr>' +
      s.podiumLots.map(function (p) {
        return '<tr><td>' + esc(p.label) + '</td><td class="num">' + p.exemplaires + '</td><td class="num">' + p.prets12 + '</td></tr>';
      }).join('') + '</table>'
    : '<p class="hint">Aucun prêt sur la période.</p>';

  var jamaisHtml = s.lotsDormants.length
    ? '<p class="hint" style="margin:0 0 6px">' + s.lotsDormants.length +
        ' lot(s) jamais empruntes (candidats à la revente, au don, ou signe d\'un mauvais choix) :</p>' +
      '<table><tr><th>Lot / modèle</th><th class="num">Exempl.</th></tr>' +
      s.lotsDormants.map(function (l) {
        return '<tr><td>' + esc(l.label) + '</td><td class="num">' + l.exemplaires + '</td></tr>';
      }).join('') + '</table>'
    : '<p class="hint">Tous les lots ont été empruntes au moins une fois.</p>';

  var fins = Object.keys(s.parFinancement).sort(function (a, b) { return s.parFinancement[b] - s.parFinancement[a]; });
  var finHtml = fins.length
    ? '<table><tr><th>Financement</th><th>Montant</th><th>Part</th></tr>' +
      fins.map(function (f) {
        var m = s.parFinancement[f];
        var part = s.totalDepense ? Math.round(100 * m / s.totalDepense) : 0;
        return '<tr><td>' + esc(f) + '</td><td>' + money(m) + '</td><td>' + part + ' %</td></tr>';
      }).join('') +
      '<tr style="font-weight:700"><td>Total</td><td>' + money(s.totalDepense) + '</td><td>100 %</td></tr>' +
      '</table>'
    : '<p class="hint">Aucune commande enregistrée.</p>';

  zone.innerHTML =
    '<div class="stat-entete">' +
      '<span class="stat-chiffre">' + s.tauxControle + ' %</span>' +
      '<span>du parc contrôle sur 12 mois (' + s.nbControles + '/' + s.parcActif + ')</span>' +
      '<button class="secondary" id="btnExportStats" style="margin-left:auto">Exporter (CSV)</button>' +
    '</div>' +
    '<div class="stat-grille">' +
      bloc('Rotation par catégorie', rotationHtml) +
      bloc('Les plus empruntes (par lot)', podiumHtml) +
      bloc('Lots dormants', jamaisHtml) +
      bloc('Dépenses par financement', finHtml) +
      bloc('Pertes et vols (' + s.anneeStats + ')',
        '<table class="tbl-sans-entete"><tr><td>Perdus</td><td style="text-align:right;font-weight:700">' + s.perdusAnnee + '</td></tr>' +
        '<tr><td>Voles</td><td style="text-align:right;font-weight:700">' + s.volesAnnee + '</td></tr>' +
        ((s.perdusAnnee + s.volesAnnee) > 0
          ? '<tr><td>Valeur estimée</td><td style="text-align:right;font-weight:700">' + money(s.valeurPerdue) + '</td></tr>'
          : '') + '</table>') +
    '</div>';

  var btn = document.getElementById('btnExportStats');
  if (btn) btn.onclick = function () { exporterStatistiques(s); };
}

function exporterStatistiques(s) {
  var lignes = [['BILAN — genere le', new Date().toLocaleDateString('fr-FR')], [],
    ['Taux de controle 12 mois', s.tauxControle + ' %', s.nbControles + '/' + s.parcActif], [],
    ['ROTATION PAR CATEGORIE'], ['Categorie', 'Exemplaires', 'Prets 12 mois', 'Prets/exemplaire']];
  Object.keys(s.parCategorie).forEach(function (n) {
    var c = s.parCategorie[n];
    lignes.push([n, c.exemplaires, c.prets, c.exemplaires ? (c.prets / c.exemplaires).toFixed(1) : '0']);
  });
  lignes.push([], ['MATERIEL JAMAIS EMPRUNTE'], ['Marquage']);
  s.jamaisEmprunte.forEach(function (m) { lignes.push([m.numero_marquage || '#' + m.id]); });
  lignes.push([], ['DEPENSES PAR FINANCEMENT'], ['Financement', 'Montant']);
  Object.keys(s.parFinancement).forEach(function (f) { lignes.push([f, s.parFinancement[f]]); });
  lignes.push(['Total', s.totalDepense]);
  telechargerCsv(lignes, 'bilan-' + new Date().toISOString().slice(0, 10) + '.csv', 'apercu-stats');
}

/* ---------------------- photos de modele (pieces jointes) ---------------------- */

/* La photo est une caracteristique du MODELE, donc portee par le LOT :
   les 12 exemplaires d'un meme lot partagent la meme image. Colonne
   facultative "photo" de type Attachments dans LOTS. Si elle est absente,
   tout fonctionne comme avant : aucune erreur, aucune trace. */
var jetonPJ = null;  /* jeton court : {token, baseUrl, expire} */

/* Une cellule Attachments arrive sous plusieurs formes selon le contexte
   (['L', 3, 4], [3, 4] ou 3). On accepte les trois. */
function idsPiecesJointes(val) {
  if (val === null || val === undefined) return [];
  if (typeof val === 'number') return val > 0 ? [val] : [];
  if (Array.isArray(val)) {
    var a = (val.length && val[0] === 'L') ? val.slice(1) : val;
    return a.filter(function (v) { return typeof v === 'number' && v > 0; });
  }
  return [];
}

/* Bouton d'ajout/remplacement d'une piece jointe (photo, notice, facture...).
   Le libelle et le titre changent des qu'une piece est deja presente, et un
   avertissement (confirm()) est demande avant de remplacer : l'upload est en
   realite un AJOUT (l'ancien id reste dans la cellule Grist, cf.
   televerserPieceJointe), mais seule la PLUS RECENTE piece est affichee
   (cf. urlPieceJointe) — sans ce garde-fou, remplacer par erreur ecrase
   silencieusement ce que l'utilisateur voyait a l'ecran. */
function boutonPJ(opts) {
  var dejaPresent = !!opts.dejaPresent;
  var texte = dejaPresent ? opts.texteModifier : opts.texteAjout;
  var titre = dejaPresent ? (opts.titreModifier || opts.texteModifier) : (opts.titreAjout || opts.texteAjout);
  return '<label class="btn-pj' + (dejaPresent ? ' btn-pj-existe' : '') + '" title="' + esc(titre) + '">' +
    '<input type="file" accept="' + opts.accept + '" hidden' +
    ' data-pj-table="' + opts.cleTable + '" data-pj-col="' + opts.colonne + '" data-pj-id="' + opts.ligneId + '"' +
    (dejaPresent ? ' data-pj-confirm="' + esc(opts.confirmMsg) + '"' : '') +
    /* remplacer : la cellule ne garde que le nouveau fichier (photo du modele,
       notice, facture). Sans : ajout a la suite (galeries de photos). */
    (opts.remplacer ? ' data-pj-remplacer="1"' : '') + '>' +
    esc(texte) + '</label>';
}

var LEGENDE_PHOTO_PJ = { controles: 'Photo du contrôle', incidents: 'Photo de l\'incident', materiels: 'Photo de l\u2019exemplaire' };

/* Bloc "Photo(s)" insere dans un editeur (Ajouter/Modifier un controle ou un incident) :
   - en EDITION (rowId connu) : galerie des photos existantes (suppression individuelle)
     + bouton d'ajout tant que MAX_PHOTOS_PJ n'est pas atteint.
   - en CREATION (rowId absent) : la ligne n'existe pas encore, donc rien a rattacher
     dans Grist tout de suite. On propose juste un selecteur de fichier(s) (id fixe
     #edPhotoCreation, lu par saveCreator()) ; le televersement + rattachement reel se
     fait juste apres la creation de la ligne. Evite l'aller-retour "valider d'abord,
     rouvrir en modification ensuite" pour la toute premiere photo.
   Deplace hors de la barre d'actions de la liste, qui devenait surchargee. Idempotent :
   reconstruit le bloc s'il existe deja, pour pouvoir etre rappele apres un ajout/
   suppression sans fermer l'editeur. */
function ajouterBlocPhotos(box, cleTable, rowId) {
  if (!box || !aColonne(cleTable, 'photo')) return;
  var actions = box.querySelector('.form-actions');
  if (!actions) return;
  var ancien = box.querySelector('.ed-photos');
  if (ancien) ancien.remove();
  var bloc = document.createElement('div');
  bloc.className = 'ed-photos';
  bloc.style.cssText = 'margin:12px 0 4px;padding-top:10px;border-top:1px solid var(--ice-border,#D0D9EC)';

  if (rowId == null) {
    bloc.innerHTML =
      '<p class="hint" style="margin:0 0 6px;font-weight:600;color:var(--navy,#1B3668)">Photo(s) (facultatif)</p>' +
      '<label class="btn-pj" title="Choisir jusqu\'a ' + MAX_PHOTOS_PJ + ' photos (jointes a la creation)">' +
        '<input type="file" accept="image/*" id="edPhotoCreation" multiple>Photo +</label>' +
      '<span id="edPhotoCreationNb" class="hint" style="margin-left:8px;font-size:11px"></span>';
    actions.parentNode.insertBefore(bloc, actions);
    var fInp = bloc.querySelector('#edPhotoCreation');
    fInp.onchange = function () {
      var n = fInp.files.length;
      document.getElementById('edPhotoCreationNb').textContent = !n ? '' :
        (n + ' photo(s) s\u00e9lectionn\u00e9e(s)' + (n > MAX_PHOTOS_PJ ? ' (seules les ' + MAX_PHOTOS_PJ + ' premi\u00e8res seront gard\u00e9es)' : ''));
    };
    return;
  }

  var ligne = (rawRows[cleTable] || []).filter(function (r) { return r.id === rowId; })[0];
  var n = ligne ? idsPiecesJointes(ligne.photo).length : 0;
  bloc.dataset.pjTable = cleTable;
  bloc.dataset.pjRowid = rowId;
  bloc.innerHTML =
    '<p class="hint" style="margin:0 0 6px;font-weight:600;color:var(--navy,#1B3668)">Photo(s)</p>' +
    '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<span class="galerie-pj" id="edGalerie-' + cleTable + '-' + rowId + '" hidden></span>' +
      (n < MAX_PHOTOS_PJ
        ? boutonPJ({
            cleTable: cleTable, colonne: 'photo', ligneId: rowId, accept: 'image/*', dejaPresent: false,
            texteAjout: n ? '+ Ajouter' : 'Photo +',
            titreAjout: 'Ajouter une photo (max ' + MAX_PHOTOS_PJ + ')'
          })
        : '<span class="hint" style="font-size:11px">' + MAX_PHOTOS_PJ + ' photos max.</span>') +
    '</div>';
  actions.parentNode.insertBefore(bloc, actions);
  bloc.querySelectorAll('input[type="file"][data-pj-table]').forEach(function (inp) {
    inp.onchange = function () { surChoixPieceJointe(inp); };
  });
  if (ligne && n) remplirGaleriePhotos(cleTable, [ligne], 'edGalerie-' + cleTable + '-', LEGENDE_PHOTO_PJ[cleTable], true);
}

/* Si l'editeur (Modifier le controle / l'incident) est ouvert sur cette ligne au moment
   ou une photo est ajoutee ou supprimee depuis ailleurs (galerie de la liste), on
   reconstruit son bloc Photo(s) pour qu'il ne reste pas perime. */
function rafraichirBlocPhotosOuvert(cleTable, ligneId) {
  var bloc = document.querySelector('.ed-photos[data-pj-table="' + cleTable + '"][data-pj-rowid="' + ligneId + '"]');
  if (!bloc) return;
  var box = bloc.closest('.form-panel') || bloc.parentNode;
  ajouterBlocPhotos(box, cleTable, ligneId);
}

/* Televerse un fichier dans la cellule pièce jointe d'une ligne (photo, notice, facture...).
   Méthode supportée par Grist (jeton en écriture -> POST vers baseUrl/attachments, hors CORS),
   puis rattachement de l'id à la cellule en conservant les pièces déjà présentes.
   Réutilisable : cleTable = 'incidents'|'lots'|'achats', colonne = 'photo'|'notice'|'facture'. */
async function televerserFichierSeul(file) {
  var jeton = await grist.docApi.getAccessToken({ readOnly: false });
  if (!jeton || !jeton.baseUrl || !jeton.token) throw new Error('jeton d\'écriture indisponible');
  var fd = new FormData();
  fd.append('upload', file, file.name);
  var rep = await fetch(jeton.baseUrl + '/attachments?auth=' + encodeURIComponent(jeton.token), {
    method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest' }
  });
  if (!rep.ok) throw new Error('téléversement refusé (' + rep.status + ' ' + rep.statusText + ')');
  var res = await rep.json();
  var nouvelId = Array.isArray(res) ? res[0] : res;
  if (nouvelId == null) throw new Error('aucun identifiant renvoyé par Grist');
  return nouvelId;
}

/* remplacer (2026.5.11) : "Modifier la photo / la notice", "Remplacer la
   facture" REMPLACENT ; avant, le nouveau fichier s'ajoutait a cote de
   l'ancien. Les galeries (photos des controles et incidents) ajoutent. */
/* Reduit une photo de telephone (3 a 6 Mo) avant l'envoi : cote maxi COTE_MAX_PHOTO px, JPEG.
   Un inventaire imprime de 80 exemplaires avec photo chargerait sinon des centaines de Mo. Les
   photos deja petites, les formats que le navigateur ne sait pas decoder et toute erreur laissent
   le fichier tel quel : on ne perd jamais l'envoi. L'orientation EXIF est appliquee a la lecture. */
var COTE_MAX_PHOTO = 1600;
async function reduirePhoto(file) {
  try {
    if (!file || !/^image\//.test(file.type) || typeof createImageBitmap !== 'function') return file;
    var bmp = await createImageBitmap(file);
    var ratio = Math.min(1, COTE_MAX_PHOTO / Math.max(bmp.width, bmp.height));
    if (ratio === 1 && file.size < 1200000) { if (bmp.close) bmp.close(); return file; }
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * ratio)); c.height = Math.max(1, Math.round(bmp.height * ratio));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    var blob = await new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', 0.85); });
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], String(file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (e) { return file; }
}

async function televerserPieceJointe(cleTable, colonne, ligneId, file, remplacer) {
  if (cleTable === 'materiels' && colonne === 'photo') file = await reduirePhoto(file);
  var nouvelId = await televerserFichierSeul(file);
  var ligne = (rawRows[cleTable] || []).filter(function (r) { return r.id === ligneId; })[0];
  var existants = (ligne && !remplacer) ? idsPiecesJointes(ligne[colonne]) : [];
  var champ = {}; champ[colonne] = ['L'].concat(existants).concat([nouvelId]);
  await appliquer([['UpdateRecord', resolvedNames[cleTable], ligneId, champ]]);
  await load();
  if (colonne === 'photo') rafraichirBlocPhotosOuvert(cleTable, ligneId);
  return nouvelId;
}

/* Retire UNE piece jointe precise d'une cellule qui peut en contenir plusieurs
   (galerie photos controles/incidents). Reecrit la cellule sans cet id ; les
   autres sont conserves tels quels. */
async function retirerPieceJointe(cleTable, colonne, ligneId, idASupprimer) {
  var ligne = (rawRows[cleTable] || []).filter(function (r) { return r.id === ligneId; })[0];
  var existants = ligne ? idsPiecesJointes(ligne[colonne]) : [];
  var reste = existants.filter(function (id) { return id !== idASupprimer; });
  var champ = {}; champ[colonne] = ['L'].concat(reste);
  await appliquer([['UpdateRecord', resolvedNames[cleTable], ligneId, champ]]);
  await load();
  if (colonne === 'photo') rafraichirBlocPhotosOuvert(cleTable, ligneId);
}

/* Gestionnaire commun pour un input file marqué data-pj-table / data-pj-col / data-pj-id. */
async function surChoixPieceJointe(inp) {
  var file = inp.files && inp.files[0];
  if (!file) return;
  var msgConfirm = inp.dataset.pjConfirm;
  if (msgConfirm && !confirm(msgConfirm)) { inp.value = ''; return; }
  var lab = inp.closest('label');
  var avant = lab ? lab.getAttribute('data-txt') : null;
  if (lab) lab.classList.add('pj-encours');
  try {
    await televerserPieceJointe(inp.dataset.pjTable, inp.dataset.pjCol, Number(inp.dataset.pjId), file,
      inp.dataset.pjRemplacer === '1');
  } catch (e) {
    afficherErreurGlobale('Ajout de la pièce jointe impossible : ' + e.message +
      '. Astuce : cette fonction requiert un accès en écriture ; si vous n\'êtes pas propriétaire du document et que des règles d\'accès s\'appliquent, le dépôt direct dans la cellule Grist reste la solution.');
    if (lab) lab.classList.remove('pj-encours');
    inp.value = '';
  }
}

/* Gestionnaire du bouton "supprimer" d'une vignette de galerie. */
async function surSuppressionPieceJointe(btn) {
  if (!confirm('Supprimer cette photo ?')) return;
  btn.disabled = true;
  try {
    await retirerPieceJointe(btn.dataset.pjTable, btn.dataset.pjCol, Number(btn.dataset.pjId), Number(btn.dataset.pjAttid));
  } catch (e) {
    afficherErreurGlobale('Suppression de la photo impossible : ' + e.message);
    btn.disabled = false;
  }
}

/* Lit les choix reels d'une colonne 'Choix' depuis les tables systeme de Grist.
   Repli sur 'defauts' si indisponible (ancienne version de Grist, colonne absente, etc.). */
async function chargerChoixColonne(tableKey, colId, defauts) {
  try {
    var tblName = resolvedNames[tableKey];
    if (!tblName) return defauts;
    var tables = await grist.docApi.fetchTable('_grist_Tables');
    var ti = (tables.tableId || []).indexOf(tblName);
    if (ti < 0) return defauts;
    var tblRowId = tables.id[ti];
    var cols = await grist.docApi.fetchTable('_grist_Tables_column');
    for (var i = 0; i < cols.id.length; i++) {
      if (cols.parentId[i] === tblRowId && cols.colId[i] === colId && cols.widgetOptions[i]) {
        var parsed = JSON.parse(cols.widgetOptions[i]);
        if (parsed && Array.isArray(parsed.choices) && parsed.choices.length) return parsed.choices;
      }
    }
  } catch (e) { /* silencieux : on garde les defauts */ }
  return defauts;
}

async function jetonPieceJointe() {
  var now = Date.now();
  if (jetonPJ && jetonPJ.expire > now + 5000) return jetonPJ;
  if (!grist.docApi || typeof grist.docApi.getAccessToken !== 'function') return null;
  var t = await grist.docApi.getAccessToken({ readOnly: true });
  if (!t || !t.token || !t.baseUrl) return null;
  jetonPJ = { token: t.token, baseUrl: t.baseUrl, expire: now + (Number(t.ttlMsecs) || 60000) };
  return jetonPJ;
}

/* URL de la premiere piece jointe d'une COLONNE donnee (photo, notice, facture...),
   ou null. Generique : jeton court reutilise. */
async function urlPieceJointe(cleTable, ligne, colonne) {
  if (!ligne || !aColonne(cleTable, colonne)) return null;
  var ids = idsPiecesJointes(ligne[colonne]);
  if (!ids.length) return null;
  try {
    var j = await jetonPieceJointe();
    if (!j) return null;
    return j.baseUrl + '/attachments/' + ids[ids.length - 1] + '/download?auth=' + encodeURIComponent(j.token);
  } catch (e) {
    return null;  /* pas de piece : ce n'est pas une anomalie */
  }
}

async function urlPhoto(cleTable, ligne) { return urlPieceJointe(cleTable, ligne, 'photo'); }

/* Toutes les URLs d'une colonne piece-jointe (pas seulement la derniere) — utilisee
   pour les galeries d'impression (controles/incidents, jusqu'a MAX_PHOTOS_PJ photos). */
async function urlsPieceJointe(cleTable, ligne, colonne) {
  if (!ligne || !aColonne(cleTable, colonne)) return [];
  var ids = idsPiecesJointes(ligne[colonne]);
  if (!ids.length) return [];
  try {
    var j = await jetonPieceJointe();
    if (!j) return [];
    return ids.map(function (id) {
      return j.baseUrl + '/attachments/' + id + '/download?auth=' + encodeURIComponent(j.token);
    });
  } catch (e) {
    return [];
  }
}

function lienDoc(url, libelle) {
  return '<a class="lien-doc" href="' + esc(url) + '" target="_blank" rel="noopener">' +
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>' +
    esc(libelle) + '</a>';
}

/* Remplit une zone avec les liens "Ouvrir la notice / la facture" d'un lot.
   Notice sur le lot ; facture sur l'achat lie. Silencieux s'il n'y a rien. */
async function afficherDocsLot(idZone, lot, achat) {
  var el = document.getElementById(idZone);
  if (!el) return;
  var liens = [];
  var uN = await urlPieceJointe('lots', lot, 'notice');
  if (uN) liens.push(lienDoc(uN, 'Notice'));
  var uF = achat ? await urlPieceJointe('achats', achat, 'facture') : null;
  if (uF) liens.push(lienDoc(uF, 'Facture'));
  if (!liens.length) { el.hidden = true; el.innerHTML = ''; return; }
  el.innerHTML = liens.join('');
  el.hidden = false;
}

/* Remplit les liens documents de chaque lot affiche dans la liste Materiel. */
async function remplirDocsLots() {
  if (!aColonne('lots', 'notice') && !aColonne('achats', 'facture')) return;
  var achatById = {};
  (rawRows.achats || []).forEach(function (a) { achatById[a.id] = a; });
  for (var i = 0; i < rawRows.lots.length; i++) {
    var lot = rawRows.lots[i];
    await afficherDocsLot('lotDocs-' + lot.id, lot, achatById[lot.achat]);
  }
}

/* Lien "Ouvrir" vers la facture, dans le tableau des commandes (onglet Achats). */
async function remplirDocsAchats() {
  if (!aColonne('achats', 'facture')) return;
  for (var i = 0; i < rawRows.achats.length; i++) {
    var a = rawRows.achats[i];
    var el = document.getElementById('achatFacture-' + a.id);
    if (!el) continue;
    var u = await urlPieceJointe('achats', a, 'facture');
    el.innerHTML = u ? lienDoc(u, 'Ouvrir') : '<span style="color:var(--text-light)">\u2014</span>';
  }
}

/* Remplit une zone avec la photo d'une ligne. Silencieux s'il n'y a rien a montrer. */
/* legende: texte alt de l'image. illustratif: si vrai, ajoute une mention precisant
   que la photo represente le modele et pas forcement cet exemplaire precis (couleur,
   finition...) — reserve au contexte d'une fiche exemplaire, jamais a la fiche du lot
   lui-meme ou la photo est legitimement representative. */
async function afficherPhoto(cleTable, ligne, idZone, classeImg, legende, illustratif) {
  var el = document.getElementById(idZone);
  if (!el) return;
  var url = await urlPhoto(cleTable, ligne);
  if (!url) return;
  el.innerHTML = '<a href="' + esc(url) + '" target="_blank" rel="noopener" title="Agrandir">' +
    '<img class="' + (classeImg || 'fiche-photo-img') + '" alt="' + esc(legende || 'Photo') + '" src="' + esc(url) + '"></a>' +
    (illustratif ? '<p class="hint" style="margin:4px 0 0;font-style:italic;max-width:220px">Photo illustrative du mod\u00e8le \u2014 la couleur ou la finition peut diff\u00e9rer de cet exemplaire.</p>' : '');
  el.hidden = false;
  var img = el.querySelector('img');
  img.onerror = function () { el.hidden = true; el.innerHTML = ''; };
}

/* Vignettes : un seul jeton sert toute la page. */
async function remplirVignettes(cleTable, lignes, prefixeId, classeImg, legende) {
  if (!aColonne(cleTable, 'photo')) return;
  var avecPhoto = lignes.filter(function (l) { return idsPiecesJointes(l.photo).length; });
  for (var i = 0; i < avecPhoto.length; i++) {
    await afficherPhoto(cleTable, avecPhoto[i], prefixeId + avecPhoto[i].id, classeImg, legende);
  }
}

/* Galerie de plusieurs photos (jusqu'a MAX_PHOTOS_PJ), avec suppression individuelle
   optionnelle. Reservee aux controles et incidents : plusieurs angles/preuves ont un
   usage reel la ou lots/achats n'ont structurellement qu'un seul document valide
   (notice, facture) — ceux-la restent en mode "une seule piece, remplacee avec
   avertissement" (boutonPJ + confirm, cf. plus bas). */
async function remplirGaleriePhotos(cleTable, lignes, prefixeId, legende, permettreSuppr) {
  if (!aColonne(cleTable, 'photo')) return;
  var j = await jetonPieceJointe();
  for (var i = 0; i < lignes.length; i++) {
    var ligne = lignes[i];
    var ids = idsPiecesJointes(ligne.photo);
    var el = document.getElementById(prefixeId + ligne.id);
    if (!el || !ids.length) continue;
    var html = '';
    for (var k = 0; k < ids.length; k++) {
      var url = j ? (j.baseUrl + '/attachments/' + ids[k] + '/download?auth=' + encodeURIComponent(j.token)) : '';
      html += '<span class="galerie-item">' +
        '<a href="' + esc(url) + '" target="_blank" rel="noopener" title="Agrandir"><img class="mini-photo-img" alt="' + esc(legende || 'Photo') + '" src="' + esc(url) + '"></a>' +
        (permettreSuppr ? '<button type="button" class="galerie-suppr" data-pj-table="' + cleTable + '" data-pj-col="photo" data-pj-id="' + ligne.id + '" data-pj-attid="' + ids[k] + '" title="Supprimer cette photo">&times;</button>' : '') +
        '</span>';
    }
    el.innerHTML = html;
    el.hidden = false;
    if (permettreSuppr) {
      el.querySelectorAll('.galerie-suppr').forEach(function (btn) {
        btn.onclick = function () { surSuppressionPieceJointe(btn); };
      });
    }
  }
}

/* Table des URLs (toutes) de photos d'incidents, pour les documents imprimables. */
async function urlsPhotosIncidents(incidents) {
  var m = {};
  if (!aColonne('incidents', 'photo')) return m;
  for (var i = 0; i < incidents.length; i++) {
    var us = await urlsPieceJointe('incidents', incidents[i], 'photo');
    if (us.length) m[incidents[i].id] = us;
  }
  return m;
}

/* Meme motif pour les photos de controle. */
async function urlsPhotosControles(controles) {
  var m = {};
  if (!aColonne('controles', 'photo')) return m;
  for (var i = 0; i < controles.length; i++) {
    var us = await urlsPieceJointe('controles', controles[i], 'photo');
    if (us.length) m[controles[i].id] = us;
  }
  return m;
}

/* ---------------------- fiche exemplaire ---------------------- */

/* Branche le clic du badge "Examen requis" (liste Materiel ET fiche exemplaire) :
   navigue vers Controles, incidents et reparations > Incidents pour voir le contexte avant de
   realiser le controle. Fonction nommee (plutot qu'inline dans load()) car la fiche
   exemplaire construit son DOM a la demande, hors du cycle de rendu de load() — sans
   rebranchement explicite ici, son badge restait visuellement cliquable mais inerte. */
function brancherBadgesAction(racine) {
  (racine || document).querySelectorAll('.badge-action').forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      var matId = Number(b.dataset.mat);

      var ongletCtrl = document.querySelector('.tab[data-t="controles"]');
      if (ongletCtrl) ongletCtrl.click();

      /* data-action distingue desormais deux destinations : jusqu'ici seul
         "controler" existait et l'attribut n'etait meme pas lu (la branche
         incidents/controles se decidait uniquement via le texte de _raison).
         "reparation" est le premier a vraiment s'en servir. */
      if (b.dataset.action === 'reparation') {
        sousOngletEPI = 'reparations';
      } else {
        var mat = rawRows.materiels.find(function (m) { return m.id === matId; });
        var allerIncidents = mat && mat._raison && mat._raison.indexOf('Incident du') !== -1;
        /* Au lieu de cliquer sur le sous-onglet (timing fragile), modifier directement
           la variable globale et appeler la fonction de mise à jour. */
        sousOngletEPI = allerIncidents ? 'incidents' : 'controles';
      }
      if (typeof majSousOngletEPI === 'function') majSousOngletEPI();
    };
  });
}

/* Toute la vie d'un exemplaire et ses actions au meme endroit :
   fini la navigation entre quatre onglets pour suivre un baudrier. */
function ouvrirFicheExemplaire(matId) {
  var x = contexteMateriel(matId);
  var box = document.getElementById('materiel-editor');
  if (!x || !box) return;
  fermerEditeurs();
  var m = x.m;
  var horsService = HORS_STOCK.indexOf(m._statut) !== -1;
  var cls = classeStatut(m._statut);
  var pretOuvert = x.emprunts.filter(function (e) { return !e.date_retour_effective; })[0];
  var dc = x.controles[0];

  function li(k, v, alerte) {
    return '<div class="li"><span class="k">' + k + '</span><span class="v"' +
      (alerte ? ' style="color:var(--red)"' : '') + '>' + (v || '-') + '</span></div>';
  }
  function tableHist(titre, lignes, entetes, vide) {
    return '<h4>' + titre + (lignes.length > 5 ? ' <span style="color:var(--text-light);font-weight:400">(' +
        lignes.length + ' au total, 5 affiches)</span>' : '') + '</h4>' +
      (lignes.length
        ? '<table><tr>' + entetes.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>' +
          lignes.slice(0, 5).map(function (l) {
            return '<tr>' + l.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
          }).join('') + '</table>'
        : '<p class="hint">' + vide + '</p>');
  }

  var boutons = [];
  if (!horsService) {
    if (m._statut === 'En service') boutons.push('<button class="secondary" data-act="preter">Prêter</button>');
    if (pretOuvert) boutons.push('<button class="secondary" data-act="retour">Valider le retour</button>');
    /* Rien a controler tant que la reparation n'est pas terminee : le
       controle redevient pertinent une fois "Declarer la reparation
       effectuee" fait, qui renvoie l'exemplaire en "Examen requis" — ou le
       bouton Controler reapparait normalement (condition inchangee). */
    if (m._statut === 'En reparation') {
      boutons.push('<button class="secondary" data-act="reparation">Déclarer la réparation effectuée</button>');
    } else if (m._statut !== 'Examen requis') {
      boutons.push('<button class="secondary" data-act="controler">Contrôler</button>');
    }
    /* Porte d'entree directe vers la reparation, distincte de "Declarer un
       incident" (mais qui ouvre EXACTEMENT le meme formulaire, suite
       preselectionnee sur "Reparation a prevoir") : le mot "incident" ne
       venait naturellement a l'esprit de personne pour signaler une sangle
       usee remarquee hors contrôle. Absente seulement quand l'exemplaire est
       DEJA en reparation — le bouton juste au-dessus fait alors le travail. */
    /* (2026.5.14) bouton masque quand il ne mene nulle part : categorie fermee
       a la reparation ET a la decoupe (avant : visible, puis avertissement) */
    if (m._statut !== 'En reparation' && (reparationOuverte(x.cat) || decoupeOuverte(x.cat))) {
      boutons.push('<button class="secondary" data-act="signaler-reparation">Déclarer une réparation</button>');
    }
    boutons.push('<button class="secondary" data-act="incident">Déclarer un incident</button>');
  } else if (m._reformeCalendaire && prolongationOuverte(x.cat)) {
    /* Reforme seulement par le CALENDRIER, dans une categorie ou remplacer la
       piece qui vieillit prolonge la duree de vie (degaine) : la reparation
       est justement le moyen de la remettre en service. Une reforme decidee
       (controle, perte, vol, cession) reste definitive. Apres la reparation,
       l'exemplaire passe par "Examen requis" comme toute reparation. */
    boutons.push('<button class="secondary" data-act="signaler-reparation" title="Fin de vie atteinte\u00a0: ' +
      'remplacer la pi\u00e8ce qui vieillit (ex. sangle) peut la prolonger">Déclarer une réparation (prolonger)</button>');
  }
  if (horsService && estPerduOuVole(m.hors_service_motif)) {
    boutons.push('<button class="secondary" data-act="retrouve">D\u00e9clarer retrouv\u00e9</button>');
  }
  boutons.push('<button class="secondary" data-act="imprimer">Fiche de vie à imprimer</button>');
  boutons.push('<button class="secondary" data-act="editer">Éditer l\'exemplaire</button>');
  boutons.push(btnSupprimer('materiel', matId));

  box.innerHTML =
    '<div class="form-panel">' +
      '<div class="fiche-entete">' +
        '<span class="badge-ref" style="font-size:14px;padding:5px 12px">' + esc(m.numero_marquage || '#' + matId) + '</span>' +
        '<div><div class="fiche-titre">' + esc(x.lot.designation || 'Sans lot') + '</div>' +
          '<div class="fiche-sous">' + [x.lot.fabricant, x.cat.nom, x.lieu.nom].filter(Boolean).map(esc).join(' \u00b7 ') + '</div></div>' +
        /* badges cliquables : memes classes que le tableau du lot, le cablage existant les prend en charge */
        (m._statut === 'Examen requis'
          ? '<span class="badge warn badge-action" data-mat="' + matId + '" style="margin-left:auto;cursor:pointer" title="Cliquer pour ouvrir le formulaire de contrôle">Examen requis</span>'
          : '<span class="badge ' + cls + '" style="margin-left:auto">' + m._statut + '</span>') +
        (m._controleEchu && !horsService
          ? '<span class="badge warn badge-goto-ctrl" data-mat="' + matId + '" style="cursor:pointer" title="Cliquer pour aller dans Suivi des EPI">' +
            (m._jamaisControle ? 'Jamais controle' : 'Controle echu') + '</span>' : '') +
        '<button class="secondary" id="ficheFermer" style="margin-left:6px">Fermer</button>' +
      '</div>' +
      (m._raison && m._raison !== m._statut ? '<p class="raison" style="margin:6px 0 0">' + esc(m._raison) + '</p>' : '') +
      '<div id="fichePhoto" class="fiche-photo" hidden></div>' +
      '<div id="ficheDocs" class="fiche-docs" hidden></div>' +

      '<div class="fiche-infos">' +
        (m.numero_serie ? li('N\u00b0 de s\u00e9rie', esc(m.numero_serie) +
          (doublonsSerie(m).length ? ' <span class="alerte">(aussi sur ' + doublonsSerie(m).map(function (d) {
            return esc(d.numero_marquage || '#' + d.id); }).join(', ') + ')</span>' : '')) : '') +
        li('Mise en service', fmtDate(m.date_mise_en_service)) +
        /* Absente jusqu'ici de la fiche interactive (presente seulement sur
           le tableau du lot et la fiche imprimable) — signale par Pierre le
           22/08 a propos des longueurs de corde issues d'une decoupe.
           Meme relabellisation Longueur/Taille que les deux autres endroits. */
        (aColonne('materiels', 'taille') && m.taille
          ? li(decoupeOuverte(x.cat) ? 'Longueur' : 'Taille', esc(m.taille))
          : '') +
        li('Fin de vie' + (x.prolongation
             ? bulle('Fin de vie ' + texteProlongation(x.prolongation) + '.')
             : (x.fin ? '' : bulle('Cette cat\u00e9gorie n\u2019a pas de dur\u00e9e de vie fixe\u00a0: ' +
             'c\u2019est le r\u00e9sultat de chaque contr\u00f4le qui d\u00e9termine si l\u2019exemplaire reste en ' +
             'service, pas une date calendaire.'))),
           (x.fin ? '31/12/' + x.fin.getUTCFullYear() : 'Selon controle') +
             (x.prolongation ? ' (prolong\u00e9e)' : ''),
           x.fin && x.fin <= new Date()) +
        li('Dernier controle', dc ? fmtDate(dc.date_controle) + ' (' + esc(dc.resultat || '-') + ')' : 'jamais') +
        li('Prochain controle' + bulle('Un an apr\u00e8s le dernier contr\u00f4le retenu (ou la mise en ' +
             'service si jamais contr\u00f4l\u00e9). Passe \u00ab\u00a0en retard\u00a0\u00bb 60 jours avant l\u2019\u00e9ch\u00e9ance, pour ' +
             'anticiper la campagne annuelle.'),
           m._limiteControle ? fmtDate(m._limiteControle) : '-', m._controleEchu) +
        li('Prix unitaire', x.lot.prix_unitaire ? money(x.lot.prix_unitaire) : null) +
        li('Commande', esc(x.achat.ref_commande || '')) +
        /* Colonne facultative : n'apparait que si le club l'a activee ET que
           CET exemplaire precis est issu d'une decoupe — la tres grande
           majorite des exemplaires n'ont jamais rien a montrer ici. */
        (aColonne('materiels', 'origine_decoupe') && m.origine_decoupe
          ? li('Origine', '<span class="badge-ref badge-clic" data-mat="' + m.origine_decoupe +
              '" title="Ouvrir la fiche">D\u00e9coupe de ' +
              esc((rawRows.materiels.filter(function (o) { return o.id === m.origine_decoupe; })[0] || {}).numero_marquage || '?') +
              '</span>' +
              (m.date_mise_en_service ? ' <span class="hint">le ' + fmtDate(m.date_mise_en_service) + '</span>' : ''))
          : '') +
      '</div>' +

      (aColonne('materiels', 'photo') ? '<div class="galerie-pj" id="galerieMat-' + m.id + '" hidden style="margin:8px 0"></div>' : '') +
      '<div class="form-actions" id="ficheBoutons">' + boutons.join('') + '</div>' +
      '<div id="ficheAction"></div>' +

      '<div class="fiche-hist">' +
        tableHist('Contrôles', x.controles.map(function (c) {
          return [fmtDate(c.date_controle), esc(x.adhMap[c.controleur] || '-'),
            '<span class="badge ' + (c.resultat === 'Conforme' ? 'ok' : (c.resultat === 'Reforme' ? 'danger' : 'warn')) + '">' +
              esc(c.resultat || '-') + '</span>', esc(c.commentaire || '')];
        }), ['Date', 'Controleur', 'Resultat', 'Commentaire'], 'Aucun contrôle enregistré.') +
        tableHist('Incidents', x.incidents.map(function (i) {
          var l = [fmtDate(i.date_incident), esc(i.gravite || '-'), esc(i.suite || '-'), esc(i.description || '')];
          if (aColonne('incidents', 'photo')) {
            l.push('<span class="galerie-pj" id="ficheInc-' + i.id + '" hidden></span>');
          }
          return l;
        }), aColonne('incidents', 'photo')
              ? ['Date', 'Gravite', 'Suite', 'Description', 'Photo']
              : ['Date', 'Gravite', 'Suite', 'Description'], 'Aucun incident enregistré.') +
        tableHist('Prêts', x.emprunts.map(function (e) {
          return [fmtDate(e.date_emprunt), fmtDate(e.date_retour_effective) || '<span class="badge info">en cours</span>',
            esc(x.adhMap[e.adherent] || '-'), esc(e.etat_retour || '-'), esc(e.sortie_activite || '')];
        }), ['Emprunt', 'Retour', 'Adherent', 'Etat', 'Sortie'], 'Aucun prêt enregistré.') +
        /* Table facultative (voir resolvedNames.reparations) : n'affiche cette
           section que si le club l'a activee, pour ne pas laisser croire a
           un club qui n'utilise pas ce module qu'il "n'a jamais rien
           repare" — l'absence de la table et l'absence de reparations sont
           deux choses differentes, ne pas les confondre a l'affichage. */
        (resolvedNames.reparations ? tableHist('Réparations', x.reparations.map(function (r) {
          var interv = r.intervenant ? esc(r.intervenant) : '-';
          if (r.intervenant === 'Club' && r.intervenant_qui && x.adhMap[r.intervenant_qui]) {
            interv += ' (' + esc(x.adhMap[r.intervenant_qui]) + ')';
          }
          return [fmtDate(r.date_declaree), esc(r.motif || '-'),
            r.date_effectuee ? fmtDate(r.date_effectuee) : '<span class="badge repair">en cours</span>',
            interv, esc(r.description || '-')];
        }), ['Declaree', 'Motif', 'Effectuee', 'Intervenant', 'Description'], 'Aucune réparation enregistrée.') : '') +
        /* Meme regle que les reparations : section absente si le club n'a
           pas cree la table ENTRETIENS. */
        (resolvedNames.entretiens ? tableHist('Entretiens', x.entretiens.map(function (e) {
          return [fmtDate(e.date_entretien), esc(x.adhMap[e.auteur] || '-'), esc(e.commentaire || '')];
        }), ['Date', 'Par', 'Commentaire'], 'Aucun entretien enregistr\u00e9.') : '') +
      '</div>' +
    '</div>';
  defilerVers(box, { block: 'nearest' });
  afficherPhoto('lots', x.lot, 'fichePhoto', 'fiche-photo-img', 'Photo du modele', true);
  afficherDocsLot('ficheDocs', x.lot, x.achat);
  remplirGaleriePhotos('incidents', x.incidents.slice(0, 5), 'ficheInc-', 'Photo de l\'incident', false);
  remplirGaleriePhotos('materiels', [x.m], 'galerieMat-', 'Photo de l\u2019exemplaire', false);

  document.getElementById('ficheFermer').onclick = function () { box.innerHTML = ''; };
  brancherBadgesAction(box);
  /* Le cablage global de .badge-clic (voir load()) ne couvre que ce qui
     existe DEJA au moment du chargement — la fiche s'injecte plus tard,
     donc un badge de filiation ("Origine") pose ici son propre cablage,
     plutot que de dependre d'un passage global qui ne le verra jamais. */
  box.querySelectorAll('.badge-ref.badge-clic').forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      ouvrirFicheExemplaire(Number(b.dataset.mat));
    };
  });
  box.querySelectorAll('#ficheBoutons [data-act]').forEach(function (b) {
    b.onclick = function () {
      /* meme critere que brancherBadgesAction() pour la preselection du type
         de controle : "Contrôle suite à incident" si la raison actuelle du
         statut vient d'un incident, ou si l'exemplaire vient de sortir d'une
         reparation (le champ ne s'appelle plus "incident" dans ce cas, mais
         la logique est la meme — un controle qui n'est pas de routine). */
      var typePre;
      if (b.dataset.act === 'controler') {
        var raison = m._raison || '';
        if (raison.indexOf('Incident du') !== -1) typePre = TYPE_CONTROLE_DEFAUT[1];
        else if (raison.indexOf('Reparation du') !== -1) typePre = TYPE_CONTROLE_DEFAUT[1];
      }
      ficheAction(matId, b.dataset.act, pretOuvert, typePre);
    };
  });
  brancherBoutonsEdit('materiel-editor');
}

/* mini-formulaires d'action, dans la fiche */
function ficheAction(matId, act, pretOuvert, typePreselect) {
  var zone = document.getElementById('ficheAction');
  if (act === 'editer') { openEditor('materiel', matId); return; }
  if (act === 'imprimer') { ficheDeVieMateriel(matId); return; }

  var auj = new Date().toISOString().slice(0, 10);
  var html = '';
  if (act === 'preter') {
    html = '<div class="form-grid">' +
      field('Adhérent', '<select data-ff="adherent">' + optionsFor(refLists.adherents, 'nom_complet') + '</select>') +
      field('Date d\'emprunt', '<input data-ff="emprunt" type="date" value="' + auj + '">') +
      field('Retour prevu', '<input data-ff="prevu" type="date">') +
      field('Sortie / activité', '<input data-ff="sortie" type="text">') +
      '</div>';
  } else if (act === 'retour') {
    html = '<div class="form-grid">' +
      field('Etat au retour', '<select data-ff="etat"><option>Bon etat</option><option>Degrade</option><option>Perdu</option><option>Vole</option></select>') +
      (aColonne('materiels', 'commentaire')
        ? field('Commentaire', '<input data-ff="commentaire" type="text">') +
          '<p class="hint" id="ffEtatHint" style="grid-column:1/-1;margin:-6px 0 2px"></p>'
        : '') +
      (aColonne('incidents', 'suite')
        ? '<div id="ffRetourDegradeBloc" style="grid-column:1/-1;display:none">' +
            field('Suite \u00e0 donner', '<select data-ff="retour-suite">' +
              '<option value="Controle a realiser">Contr\u00f4le \u00e0 pr\u00e9voir</option>' +
              '<option value="Reparation a prevoir">R\u00e9paration \u00e0 pr\u00e9voir</option>' +
              '</select>') +
            '<div id="ffRetourMotifWrap" style="grid-column:1/-1;display:none">' +
              field('Motif de la r\u00e9paration', '<input data-ff="retour-motif" type="text">') +
            '</div>' +
            '<div id="ffRetourReparationBloc" style="grid-column:1/-1"></div>' +
          '</div>'
        : '') +
      '</div>';
  } else if (act === 'controler') {
    var mPourCtrl = (rawRows.materiels || []).filter(function (x) { return x.id === matId; })[0];
    var incidentEnAttente = mPourCtrl && mPourCtrl._statut === 'Examen requis';
    html = '<div class="form-grid">' +
      (incidentEnAttente
        ? '<div class="encadre" style="grid-column:1/-1;margin:0 0 6px;font-size:12px">' +
          '<b>Cet exemplaire a un incident en attente.</b> ' +
          'Enregistrer ce contrôle suffit à le clôturer — ' +
          'l’incident restera consultable dans l’historique (rubrique Suivi des EPI, Incidents, section « Incidents clôturés »).' +
          '</div>'
        : '') +
      field('Date', '<input data-ff="date" type="date" value="' + auj + '">') +
      fieldAide('Contrôleur', '<select data-ff="controleur">' + optionsFor(adherentsControleurs(), 'nom_complet') + '</select>', 'Seuls les adhérents marqués « Contrôleur EPI habilité » (Listes du club → Adhérents) apparaissent ici. Si personne n’est encore marqué, tous les adhérents sont proposés.') +
      fieldAide('Résultat du contrôle', '<select data-ff="resultat">' + optionsResultatsControle() + '</select>', 'Conforme : reste en service. À surveiller : reste en service, à re-vérifier de près la prochaine fois. À réparer : mis de côté, en attente de réparation. Réforme : retiré définitivement du parc.') +
      field('Commentaire', '<input data-ff="commentaire" type="text">') +
      (aColonne('controles','type_controle') ? fieldAide('Type',"<select data-ff=\"type_controle\">" + typeControleChoices.map(function(v){return '<option>'+v+'</option>';}).join('') + "</select>", 'Un contrôle périodique ou avant mise en service décale toujours la prochaine échéance. Un contrôle suite à incident ne la décale que si le réglage du club (Réglages → Fonctionnement) est en mode « systématique ».') : '') +
      (aColonne('controles','photo') ? field('Photo (facultatif)', '<input data-ff="photo" type="file" accept="image/*">') : '') +
      '<p class="hint" id="ffResultatHint" style="grid-column:1/-1;margin:-6px 0 2px"></p>' +
      '<div id="ffReparationBloc" style="grid-column:1/-1"></div>' +
      blocFermerPret(matId) +
      '</div>';
  } else if (act === 'signaler-reparation') {
    /* Formulaire dedie, distinct de "Declarer un incident" — voir
       formulaireDeclarerReparation(). L'ecriture reste la meme (via
       ficheEnvoyer), seule l'apparence change. */
    html = formulaireDeclarerReparation('ff', [matId]);
  } else if (act === 'incident') {
    html = '<div class="form-grid">' +
      field('Date', '<input data-ff="date" type="date" value="' + auj + '">') +
      field('Gravite', '<select data-ff="gravite"><option>Mineure</option><option>Moderee</option><option>Grave</option></select>') +
      fieldAide('Suite a donner', '<select data-ff="suite">' +
        SUITES.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select>', 'Contrôle à réaliser : passe en attente de contrôle. Sans suite : reste en service tel quel, l’incident reste tracé pour mémoire. Réparation à prévoir : passe en réparation. Mise au rebut immédiate : réformé directement.') +
      field('Description', '<input data-ff="description" type="text">') +
      '<div id="ffReparationBlocInc" style="grid-column:1/-1"></div>' +
      blocFermerPret(matId) +
      '</div>';
  } else if (act === 'retrouve') {
    var mR = rawRows.materiels.filter(function (x) { return x.id === matId; })[0] || {};
    var comR = aColonne('materiels', 'commentaire') ? String(mR.commentaire || '').trim() : '';
    html = '<div class="form-grid">' +
      '<div class="encadre" style="grid-column:1/-1;margin:0 0 6px;font-size:12px">' +
        '<b>D\u00e9clar\u00e9 ' + (mR.hors_service_motif === 'Vole' ? 'vol\u00e9' : 'perdu') + '</b>' +
        (mR.hors_service_date ? ' le ' + fmtDate(mR.hors_service_date) : '') + (comR ? ' : ' + esc(comR) : '') +
        '<br>Une fois retrouv\u00e9, l\u2019exemplaire passe en <b>Examen requis</b> : un contr\u00f4le est obligatoire avant de le pr\u00eater \u00e0 nouveau. ' +
        'L\u2019\u00e9pisode reste dans sa fiche de vie.' +
      '</div>' +
      field('Retrouv\u00e9 le', '<input data-ff="date" type="date" value="' + auj + '">') +
      field('Observation (facultatif)', '<input data-ff="observation" type="text" placeholder="O\u00f9, dans quel \u00e9tat\u2026">') +
      (mR.hors_service_motif === 'Vole'
        ? '<p class="hint" style="grid-column:1/-1;margin:-4px 0 2px">S\u2019il avait \u00e9t\u00e9 d\u00e9clar\u00e9 vol\u00e9 \u00e0 l\u2019assurance ou \u00e0 la police, pensez \u00e0 les pr\u00e9venir.</p>'
        : '') +
      '</div>';
  } else if (act === 'reparation') {
    /* Cloture d'une reparation deja en cours. Reutilise les memes briques
       que le formulaire de declaration (blocEtatChamps, blocInspection, en
       mode "toujours visible" puisqu'il n'y a pas d'etat a choisir ici —
       cloturer EST deja "c'est fait") : meme filtre par role sur
       Intervenant/Controleur, meme champ Qui, meme case d'inspection qui
       envoie l'exemplaire direct en service au lieu d'Examen requis. */
    var repEnCours = reparationOuverteDe(matId);
    html = '<div class="form-grid">' +
      (repEnCours && repEnCours.motif
        ? '<div class="encadre" style="grid-column:1/-1;margin:0 0 6px;font-size:12px">' +
          '<b>Motif de la mise en réparation</b> (' + fmtDate(repEnCours.date_declaree) + ') : ' +
          esc(repEnCours.motif) +
          '</div>'
        : '') +
      field('Date', '<input data-ff="date" type="date" value="' + auj + '">') +
      field('Description', '<input data-ff="description" type="text" placeholder="Ce qui a été fait">') +
      blocEtatChamps('ff', true) +
      blocInspection('ff', true) +
      '<p class="hint" style="grid-column:1/-1;margin:-6px 0 2px">' +
      'La description est obligatoire : c\'est elle qui figurera sur la fiche de vie et dans le registre.' +
      '</p>' +
      '</div>';
  }
  zone.innerHTML = '<div class="quick-add open">' + html +
    '<div class="form-actions"><button class="secondary" id="ffGo">Valider</button>' +
    '<button class="secondary" id="ffNon">Annuler</button>' +
    '<span class="form-msg" id="ffMsg"></span></div></div>';
  defilerVers(zone, { block: 'nearest' });
  document.getElementById('ffNon').onclick = function () { zone.innerHTML = ''; };
  /* (2026.5.14) controle / incident depuis la fiche : pas de "A reparer" ni
     de "Reparation a prevoir" si la categorie est fermee a la reparation ET
     a la decoupe ; une ligne dit pourquoi. */
  (function () {
    var mF = rawRows.materiels.filter(function (x) { return x.id === matId; })[0];
    var catF = mF ? categorieDeMateriel(mF) : null;
    if (!catF || reparationOuverte(catF) || decoupeOuverte(catF)) return;
    var retire = false;
    /* filtre sur la VALEUR (o.value) : ces <option> n'ont pas d'attribut
       value, un selecteur [value=...] ne les trouverait pas */
    zone.querySelectorAll('[data-ff="resultat"] option, [data-ff="suite"] option').forEach(function (o) {
      if (o.value === 'A reparer' || o.value === 'Reparation a prevoir') { o.remove(); retire = true; }
    });
    if (retire) {
      var act = zone.querySelector('.form-actions');
      if (act) act.insertAdjacentHTML('beforebegin', '<p class="hint" style="margin:6px 0">R\u00e9paration non pr\u00e9vue ' +
        'pour la cat\u00e9gorie \u00ab\u00a0' + esc(catF.nom) + '\u00a0\u00bb\u00a0: voir Listes du club \u2192 Cat\u00e9gories.</p>');
    }
  })();
  /* prolongation : la fiche vise CET exemplaire */
  var ffProlong = document.getElementById('ffProlongBloc');
  if (ffProlong) { ffProlong.dataset.mats = String(matId); majProlongation('ff'); }
  document.getElementById('ffGo').onclick = function () { ficheEnvoyer(matId, act, pretOuvert); };
  if (act === 'retour') {
    var ffEtatSel = zone.querySelector('[data-ff="etat"]'), ffHint = document.getElementById('ffEtatHint');
    if (ffEtatSel && ffHint) {
      var majFfHint = function () {
        ffHint.textContent = (ffEtatSel.value === 'Perdu' || ffEtatSel.value === 'Vole')
          ? 'Précisez les circonstances (perte ou vol) dans le commentaire.'
          : '';
      };
      ffEtatSel.onchange = majFfHint; majFfHint();
    }
    var ffDegradeBloc = document.getElementById('ffRetourDegradeBloc');
    var ffRetSuiteSel = zone.querySelector('[data-ff="retour-suite"]');
    if (ffEtatSel && ffDegradeBloc && ffRetSuiteSel) {
      var ffMotifWrap = document.getElementById('ffRetourMotifWrap');
      var ffRetBlocRep = document.getElementById('ffRetourReparationBloc');
      var majFfDegrade = function () {
        var estDegrade = ffEtatSel.value === 'Degrade';
        ffDegradeBloc.style.display = estDegrade ? '' : 'none';
        if (!estDegrade) return;
        var estRepar = ffRetSuiteSel.value === 'Reparation a prevoir';
        if (ffMotifWrap) ffMotifWrap.style.display = estRepar ? '' : 'none';
        if (ffRetBlocRep) {
          if (!estRepar) { ffRetBlocRep.innerHTML = ''; return; }
          var fermees = categoriesFermeesReparation([matId]);
          if (fermees.length) { ffRetBlocRep.innerHTML = panneauReparationFermee(fermees); return; }
          var avecNote = categoriesAvecNoteReparation([matId]);
          ffRetBlocRep.innerHTML = avecNote.length ? panneauNotesReparation(avecNote) : '';
        }
      };
      ffEtatSel.addEventListener('change', majFfDegrade);
      ffRetSuiteSel.onchange = majFfDegrade;
      majFfDegrade();
    }
  }
  if (act === 'controler') {
    var ffResultatSel = zone.querySelector('[data-ff="resultat"]'), ffResHint = document.getElementById('ffResultatHint');
    var ffBlocRep = document.getElementById('ffReparationBloc');
    if (ffResultatSel && ffResHint) {
      var majFfResHint = function () {
        ffResHint.textContent = ffResultatSel.value === 'Reforme'
          ? 'Précisez la cause dans le commentaire : usure constatée, rappel fabricant (référence), décision du bureau...'
          : ffResultatSel.value === 'A surveiller'
          ? 'Précisez ce qu\'il faut surveiller dans le commentaire (facultatif) : usure localisée, corrosion naissante...'
          : ffResultatSel.value === 'A reparer'
          ? 'Précisez le motif de la réparation dans le commentaire : c\'est ce qui figurera sur la fiche de vie.'
          : '';
        if (ffBlocRep) {
          ffBlocRep.innerHTML = (ffResultatSel.value === 'A reparer')
            ? (function () {
                var fermees = categoriesFermeesReparation([matId]);
                if (fermees.length) return panneauReparationFermee(fermees);
                var avecNote = categoriesAvecNoteReparation([matId]);
                return avecNote.length ? panneauNotesReparation(avecNote) : '';
              })()
            : '';
        }
      };
      ffResultatSel.onchange = majFfResHint; majFfResHint();
    }
  }
  if (act === 'signaler-reparation') {
    /* Plus de suite a donner a surveiller ici : l'etat est toujours visible
       en tete de ce formulaire dedie, le cablage est donc direct. */
    brancherEtatReparation('ff', matId);
  }
  if (act === 'incident') {
    var ffSuiteSel = zone.querySelector('[data-ff="suite"]');
    var ffBlocRepInc = document.getElementById('ffReparationBlocInc');
    if (ffSuiteSel && ffBlocRepInc) {
      var majFfSuite = function () {
        if (ffSuiteSel.value !== 'Reparation a prevoir') { ffBlocRepInc.innerHTML = ''; return; }
        var panneauCategorie = (function () {
          var fermees = categoriesFermeesReparation([matId]);
          if (fermees.length) return panneauReparationFermee(fermees);
          var avecNote = categoriesAvecNoteReparation([matId]);
          return avecNote.length ? panneauNotesReparation(avecNote) : '';
        })();
        ffBlocRepInc.innerHTML = panneauCategorie + blocEtatReparation('ff');
        brancherEtatReparation('ff', matId);
      };
      ffSuiteSel.onchange = majFfSuite; majFfSuite();
    }
  }
  if (act === 'reparation') {
    brancherChampsReparationToujoursVisible('ff');
  }
  /* pré-sélection du type selon le contexte d'entrée (incident vs routine) */
  if (act === 'controler' && typePreselect && aColonne('controles','type_controle')) {
    var _ffType = document.querySelector('#ficheAction [data-ff="type_controle"]');
    if (_ffType) Array.prototype.forEach.call(_ffType.options, function(o,i){
      if (o.text === typePreselect) { _ffType.selectedIndex = i; }
    });
  }
}

async function ficheEnvoyer(matId, act, pretOuvert) {
  var zone = document.getElementById('ficheAction');
  var msg = document.getElementById('ffMsg');
  function v(ff) { var el = zone.querySelector('[data-ff="' + ff + '"]'); return el ? el.value : ''; }
  function vChecked(ff) { var el = zone.querySelector('[data-ff="' + ff + '"]'); return !!(el && el.checked); }
  var actions = [];
  if (act === 'preter') {
    if (!v('adherent')) { msg.textContent = 'L\'adhérent est obligatoire.'; msg.style.color = '#a3242a'; return; }
    var errFfPret = erreurDates([{
      avant: v('emprunt'), apres: v('prevu'),
      si: 'La date de retour prévue ne peut pas précéder la date d\'emprunt.'
    }]);
    if (errFfPret) { msg.textContent = errFfPret; msg.style.color = '#a3242a'; return; }
    actions = [['AddRecord', resolvedNames.emprunts, null, {
      materiel: matId, adherent: Number(v('adherent')),
      date_emprunt: dateToTimestamp(v('emprunt')),
      date_retour_prevue: dateToTimestamp(v('prevu')),
      sortie_activite: v('sortie').trim()
    }]];
  } else if (act === 'retour') {
    if ((v('etat') === 'Perdu' || v('etat') === 'Vole') && aColonne('materiels', 'commentaire') && !v('commentaire').trim()) {
      msg.textContent = 'Précisez les circonstances de la perte dans le commentaire.';
      msg.style.color = '#a3242a';
      return;
    }
    var ffEstRepar = v('etat') === 'Degrade' && v('retour-suite') === 'Reparation a prevoir';
    if (ffEstRepar) {
      var ffFermeesRet = categoriesFermeesReparation([matId]);
      if (ffFermeesRet.length) {
        var ffBlocRepRet = document.getElementById('ffRetourReparationBloc');
        if (ffBlocRepRet) ffBlocRepRet.innerHTML = panneauReparationFermee(ffFermeesRet);
        msg.textContent = ''; msg.style.color = '#666';
        return;
      }
      if (!v('retour-motif').trim()) {
        msg.textContent = 'Précisez le motif de la réparation.';
        msg.style.color = '#a3242a';
        return;
      }
    }
    actions = actionsRetour(pretOuvert.id, matId, v('etat'), v('commentaire'),
      v('retour-suite'), v('retour-motif'));
  } else if (act === 'controler') {
    var errFfCtrl = erreurDates([{
      date: v('date'), si: 'La date de contrôle ne peut pas être dans le futur.'
    }]);
    if (errFfCtrl) { msg.textContent = errFfCtrl; msg.style.color = '#a3242a'; return; }
    if (v('resultat') === 'Reforme' && !v('commentaire').trim()) {
      msg.textContent = 'Précisez la cause de la reforme dans le commentaire.';
      msg.style.color = '#a3242a';
      return;
    }
    if (v('resultat') === 'A reparer') {
      var ffBlocRepSub = document.getElementById('ffReparationBloc');
      var ffFermees = categoriesFermeesReparation([matId]);
      if (ffFermees.length) {
        if (ffBlocRepSub) ffBlocRepSub.innerHTML = panneauReparationFermee(ffFermees);
        msg.textContent = ''; msg.style.color = '#666';
        return;
      }
      if (!v('commentaire').trim()) {
        msg.textContent = 'Précisez le motif de la réparation dans le commentaire.';
        msg.style.color = '#a3242a';
        return;
      }
    }
    var _chCtrl = { materiel: matId, date_controle: dateToTimestamp(v('date')),
      controleur: v('controleur') ? Number(v('controleur')) : null,
      resultat: v('resultat'), commentaire: v('commentaire').trim() };
    if (aColonne('controles','type_controle') && v('type_controle')) _chCtrl.type_controle = v('type_controle');
    var noteCtrlPhoto = '';
    var ffPhotoInp = zone.querySelector('[data-ff="photo"]');
    if (ffPhotoInp && ffPhotoInp.files && ffPhotoInp.files[0]) {
      try { _chCtrl.photo = ['L', await televerserFichierSeul(ffPhotoInp.files[0])]; }
      catch (epc) { noteCtrlPhoto = ' (photo non jointe : ' + epc.message + ')'; }
    }
    actions = [['AddRecord', resolvedNames.controles, null, _chCtrl]];
    if (v('resultat') === 'A reparer' && resolvedNames.reparations) {
      actions.push(['AddRecord', resolvedNames.reparations, null, {
        materiel: matId, date_declaree: dateToTimestamp(v('date')), motif: v('commentaire').trim()
      }]);
    }
    if (v('resultat') === 'Reforme' && vChecked('fermer-pret')) {
      var prC = pretOuvertDe(matId);
      if (prC) actions.push(['UpdateRecord', resolvedNames.emprunts, prC.id, {
        date_retour_effective: Math.round(Date.now() / 1000), etat_retour: 'Degrade'
      }]);
    }
  } else if (act === 'signaler-reparation') {
    /* Champs en id simples (pas data-ff) : ce formulaire ne partage plus sa
       structure avec "Declarer un incident", voir formulaireDeclarerReparation(). */
    var ffRDec = document.getElementById('ffEtatDecoupee');
    if (ffRDec && ffRDec.checked) {
      /* Meme garde-fou que le formulaire groupe : "Decoupee" se valide par
         sa propre fenetre, jamais par ce bouton. Sur la fiche individuelle,
         la fenetre s'ouvre deja automatiquement des l'affichage du
         formulaire (categorie decoupable-seule) — ce cas ne devrait donc
         se presenter qu'apres une fermeture manuelle de la fenetre. */
      msg.textContent = 'Utilisez la fen\u00eatre de d\u00e9coupe pour valider.';
      msg.style.color = '#666';
      return;
    }
    var ffRepDateEl = document.getElementById('ffRepDate');
    var ffRepDescEl = document.getElementById('ffRepDescription');
    var ffRepDate = ffRepDateEl ? ffRepDateEl.value : '';
    var ffRepDesc = ffRepDescEl ? ffRepDescEl.value.trim() : '';
    var errFfRepDecl = erreurDates([{
      date: ffRepDate, si: 'La date ne peut pas être dans le futur.'
    }]);
    if (errFfRepDecl) { msg.textContent = errFfRepDecl; msg.style.color = '#a3242a'; return; }
    var ffFermeesDecl = categoriesFermeesReparation([matId]);
    if (ffFermeesDecl.length) {
      /* deja visible : formulaireDeclarerReparation() l'affiche des l'ouverture,
         independamment de l'etat choisi (la categorie ne depend pas de ce choix) */
      msg.textContent = ''; msg.style.color = '#666';
      return;
    }
    if (!ffRepDesc) {
      msg.textContent = 'Précisez le motif : c\'est ce qui figurera sur la fiche de vie.';
      msg.style.color = '#a3242a';
      return;
    }
    var ffRepDateTs = dateToTimestamp(ffRepDate);
    actions = [['AddRecord', resolvedNames.incidents, null, champsIncident({
      materiel: matId, date_incident: ffRepDateTs,
      gravite: 'Moderee', suite: 'Reparation a prevoir',
      description: ffRepDesc
    })]];
    if (resolvedNames.reparations) {
      var champsRepDecl = { materiel: matId, date_declaree: ffRepDateTs, motif: ffRepDesc };
      if (etatReparationEstDejaFaite('ff')) {
        var extraDecl = champsExtraReparationDejaFaite('ff');
        champsRepDecl.date_effectuee = ffRepDateTs;
        champsRepDecl.intervenant = extraDecl.intervenant;
        champsRepDecl.pieces_remplacees = extraDecl.pieces_remplacees;
        appliquerProlongation(champsRepDecl, extraDecl, matId);
        champsRepDecl.description = ffRepDesc;
        if (extraDecl.intervenant_qui) champsRepDecl.intervenant_qui = extraDecl.intervenant_qui;
      }
      actions.push(['AddRecord', resolvedNames.reparations, null, champsRepDecl]);
      var actionCtrlDecl = actionControleApresReparation('ff', matId, ffRepDateTs);
      if (actionCtrlDecl) actions.push(actionCtrlDecl);
    }
  } else if (act === 'incident') {
    var errFfInc = erreurDates([{
      date: v('date'), si: 'La date de l\'incident ne peut pas être dans le futur.'
    }]);
    if (errFfInc) { msg.textContent = errFfInc; msg.style.color = '#a3242a'; return; }
    if (aColonne('incidents', 'suite') && v('suite') === 'Mise au rebut immediate' && !v('description').trim()) {
      msg.textContent = 'Décrivez les faits qui justifient la mise au rebut, dans la description.';
      msg.style.color = '#a3242a';
      return;
    }
    if (v('suite') === 'Reparation a prevoir') {
      var ffBlocRepIncSub = document.getElementById('ffReparationBlocInc');
      var ffFermeesInc = categoriesFermeesReparation([matId]);
      if (ffFermeesInc.length) {
        if (ffBlocRepIncSub) ffBlocRepIncSub.innerHTML = panneauReparationFermee(ffFermeesInc);
        msg.textContent = ''; msg.style.color = '#666';
        return;
      }
      if (!v('description').trim()) {
        msg.textContent = 'Précisez le motif de la réparation dans la description.';
        msg.style.color = '#a3242a';
        return;
      }
    }
    actions = [['AddRecord', resolvedNames.incidents, null, champsIncident({
      materiel: matId, date_incident: dateToTimestamp(v('date')),
      gravite: v('gravite'), suite: v('suite'),
      description: v('description').trim()
    })]];
    if (v('suite') === 'Reparation a prevoir' && resolvedNames.reparations) {
      var ffDateTs = dateToTimestamp(v('date'));
      var champsRepFf = { materiel: matId, date_declaree: ffDateTs, motif: v('description').trim() };
      if (etatReparationEstDejaFaite('ff')) {
        var extraFf = champsExtraReparationDejaFaite('ff');
        champsRepFf.date_effectuee = ffDateTs;
        champsRepFf.intervenant = extraFf.intervenant;
        champsRepFf.pieces_remplacees = extraFf.pieces_remplacees;
        appliquerProlongation(champsRepFf, extraFf, matId);
        champsRepFf.description = v('description').trim();
        if (extraFf.intervenant_qui) champsRepFf.intervenant_qui = extraFf.intervenant_qui;
      }
      actions.push(['AddRecord', resolvedNames.reparations, null, champsRepFf]);
      var actionCtrlFf = actionControleApresReparation('ff', matId, ffDateTs);
      if (actionCtrlFf) actions.push(actionCtrlFf);
    }
    if (v('suite') === 'Mise au rebut immediate' && vChecked('fermer-pret')) {
      var prI = pretOuvertDe(matId);
      if (prI) actions.push(['UpdateRecord', resolvedNames.emprunts, prI.id, {
        date_retour_effective: Math.round(Date.now() / 1000), etat_retour: 'Degrade'
      }]);
    }
  } else if (act === 'retrouve') {
    var mRet = rawRows.materiels.filter(function (x) { return x.id === matId; })[0];
    if (!mRet || !estPerduOuVole(mRet.hors_service_motif)) {
      msg.textContent = 'Cet exemplaire n\u2019est plus d\u00e9clar\u00e9 perdu ou vol\u00e9 (page peut-\u00eatre obsol\u00e8te : fermez la fiche et rouvrez-la).';
      msg.style.color = '#a3242a'; return;
    }
    if (!v('date')) { msg.textContent = 'Indiquez la date \u00e0 laquelle il a \u00e9t\u00e9 retrouv\u00e9.'; msg.style.color = '#a3242a'; return; }
    var errRet = erreurDates([{ date: v('date'), si: 'La date ne peut pas \u00eatre dans le futur.' }]);
    var dPerte = toDate(mRet.hors_service_date);
    if (!errRet && dPerte && v('date') < dPerte.toISOString().slice(0, 10)) {
      errRet = 'Il ne peut pas avoir \u00e9t\u00e9 retrouv\u00e9 avant d\u2019avoir \u00e9t\u00e9 d\u00e9clar\u00e9 ' + (mRet.hors_service_motif === 'Vole' ? 'vol\u00e9' : 'perdu') + ' (' + fmtDate(mRet.hors_service_date) + ').';
    }
    if (errRet) { msg.textContent = errRet; msg.style.color = '#a3242a'; return; }
    actions = actionsRetrouve(mRet, dateToTimestamp(v('date')), v('observation'), null);
  } else if (act === 'reparation') {
    var errFfRep = erreurDates([{
      date: v('date'), si: 'La date de réparation ne peut pas être dans le futur.'
    }]);
    if (errFfRep) { msg.textContent = errFfRep; msg.style.color = '#a3242a'; return; }
    if (!v('description').trim()) {
      msg.textContent = 'La description est obligatoire : c\'est elle qui figurera sur la fiche de vie et dans le registre.';
      msg.style.color = '#a3242a';
      return;
    }
    var repACloturer = reparationOuverteDe(matId);
    if (!repACloturer) {
      msg.textContent = 'Aucune réparation en cours n\'a été trouvée pour cet exemplaire (page peut-être obsolète : fermez la fiche et rouvrez-la).';
      msg.style.color = '#a3242a';
      return;
    }
    var ffCloture = champsExtraReparationDejaFaite('ff');
    var ffClotureDateTs = dateToTimestamp(v('date'));
    var champsCloture = {
      date_effectuee: ffClotureDateTs,
      intervenant: ffCloture.intervenant,
      description: v('description').trim(),
      pieces_remplacees: ffCloture.pieces_remplacees
    };
    if (ffCloture.intervenant_qui) champsCloture.intervenant_qui = ffCloture.intervenant_qui;
    appliquerProlongation(champsCloture, ffCloture, matId);
    actions = [['UpdateRecord', resolvedNames.reparations, repACloturer.id, champsCloture]];
    var actionCtrlCloture = actionControleApresReparation('ff', matId, ffClotureDateTs);
    if (actionCtrlCloture) actions.push(actionCtrlCloture);
  }
  msg.textContent = 'Enregistrement...'; msg.style.color = '#666';
  try {
    await appliquer(actions);
    /* Toast flottant : message different selon l'action */
    var toastMsg = '';
    if (act === 'controler') {
      toastMsg = 'Contrôle enregistré (' + v('resultat') + ')';
    } else if (act === 'signaler-reparation') {
      var marquageDecl = esc(refLists.materiels.find(function (m) { return m.id === matId; }).numero_marquage);
      toastMsg = etatReparationEstInspectee('ff')
        ? 'R\u00e9paration enregistr\u00e9e : ' + marquageDecl + ' repasse en service imm\u00e9diatement'
        : etatReparationEstDejaFaite('ff')
        ? 'R\u00e9paration enregistr\u00e9e : ' + marquageDecl + ' repart en attente de contr\u00f4le'
        : 'R\u00e9paration d\u00e9clar\u00e9e : ' + marquageDecl + ' retir\u00e9 du parc en attendant';
    } else if (act === 'incident') {
      var suiteFinale = v('suite');
      var marquageInc = esc(refLists.materiels.find(function (m) { return m.id === matId; }).numero_marquage);
      if (suiteFinale === 'Reparation a prevoir') {
        toastMsg = etatReparationEstInspectee('ff')
          ? 'R\u00e9paration enregistr\u00e9e : ' + marquageInc + ' repasse en service imm\u00e9diatement'
          : etatReparationEstDejaFaite('ff')
          ? 'R\u00e9paration enregistr\u00e9e : ' + marquageInc + ' repart en attente de contr\u00f4le'
          : 'R\u00e9paration d\u00e9clar\u00e9e : ' + marquageInc + ' retir\u00e9 du parc en attendant';
      } else if (suiteFinale === 'Mise au rebut immediate') {
        toastMsg = 'Incident créé : ' + marquageInc + ' mis au rebut';
      } else if (suiteFinale === 'Sans suite') {
        toastMsg = 'Incident créé : ' + marquageInc + ' (classé sans suite)';
      } else {
        toastMsg = 'Incident créé : ' + marquageInc + ' en attente de contrôle';
      }
    } else if (act === 'preter' || act === 'retour') {
      /* 'preter' : valeur reelle de data-act (bouton de la fiche). L'ancien
         test sur 'pret' n'etait jamais vrai : pas de toast apres un pret. */
      toastMsg = act === 'preter' ? 'Prêt créé' : 'Retour enregistré';
    } else if (act === 'retrouve') {
      toastMsg = 'Retrouv\u00e9 : ' + esc(refLists.materiels.find(function (m) { return m.id === matId; }).numero_marquage) +
        ' en attente de contr\u00f4le avant remise en service';
    } else if (act === 'reparation') {
      toastMsg = etatReparationEstInspectee('ff')
        ? 'R\u00e9paration cl\u00f4tur\u00e9e : l\u2019exemplaire repasse en service imm\u00e9diatement'
        : 'R\u00e9paration d\u00e9clar\u00e9e effectu\u00e9e \u2014 contr\u00f4le \u00e0 r\u00e9aliser avant remise en service';
    }
    if (toastMsg) {
      flashToast(toastMsg);
      setTimeout(function () {
        load().then(function () {
          ouvrirFicheExemplaire(matId);
          if (typeof noteCtrlPhoto !== 'undefined' && noteCtrlPhoto) {
            afficherErreurGlobale('Contrôle enregistré, mais la photo n\'a pas pu être jointe' + noteCtrlPhoto + '.');
          }
        });
      }, 100);
    } else {
      await load();
      ouvrirFicheExemplaire(matId);
      if (typeof noteCtrlPhoto !== 'undefined' && noteCtrlPhoto) {
        afficherErreurGlobale('Contrôle enregistré, mais la photo n\'a pas pu être jointe' + noteCtrlPhoto + '.');
      }
    }
  } catch (e) {
    msg.textContent = 'Erreur : ' + e.message;
    msg.style.color = '#a3242a';
    console.error(e);
  }
}

/* ---------------------- exports ---------------------- */

/* L'iframe d'un widget Grist est sandboxee : window.open et le
   telechargement peuvent etre bloques. On tente les deux, puis on
   se rabat sur un affichage dans le widget. */
/* Fiche d'emprunt papier : construite sur la meme machinerie que les autres
   documents imprimables. "case" = case a cocher au stylo. */
function corpsFicheEmprunt(o) {
  var etat = '<span class="emp-etat">&#9744; Bon &nbsp;&nbsp; &#9744; Degrade &nbsp;&nbsp; &#9744; Perdu</span>';
  var n = 0, rows = '';
  (o.lignes || []).forEach(function (l) {
    n++;
    rows += '<tr><td>' + n + '</td><td>' + esc(l.designation || '') + '</td>' +
      '<td><b>' + esc(l.marquage || '') + '</b></td><td></td><td></td>' +
      '<td>' + etat + '</td><td style="text-align:center">&#9744;</td></tr>';
  });
  for (var i = 0; i < (o.nbVierges || 0); i++) {
    n++;
    rows += '<tr><td>' + n + '</td><td></td><td></td><td></td><td></td>' +
      '<td>' + etat + '</td><td style="text-align:center">&#9744;</td></tr>';
  }
  var estBon = !!o.numero;
  return '<div class="entete"><span class="club">' + esc(clubImprimable()) + '</span>' +
      '<span>' + (estBon ? 'Bon d\'emprunt' : 'Fiche d\'emprunt de materiel') + '</span></div>' +
    '<h1>' + (estBon ? 'Bon d\'emprunt N&deg; ' + esc(o.numero) : 'Fiche d\'emprunt de materiel') + '</h1>' +
    '<p class="sous">A remplir au retour, puis a rapporter au responsable materiel pour archivage dans le logiciel.' +
      (estBon ? ' Conservez ce numero : il suffit a retrouver le bon au retour.' : '') + '</p>' +
    '<div class="grid" style="margin-bottom:12px">' +
      ligneInfo('Sortie / activite', o.sortie || '') +
      ligneInfo('Date', o.date || '') +
      ligneInfo('Emprunteur', o.emprunteur || '') +
      ligneInfo('Contact (tel / mail)', o.contact || '') +
    '</div>' +
    '<table class="emp-tbl"><tr><th style="width:24px">N&deg;</th><th>Designation</th>' +
      '<th style="width:115px">Marquage</th><th style="width:62px">Sortie le</th>' +
      '<th style="width:62px">Retour prevu</th><th style="width:150px">Etat au retour</th>' +
      '<th style="width:50px">Incident</th></tr>' + rows + '</table>' +
    '<h2>Incident a signaler</h2>' +
    '<div class="grid" style="margin-bottom:4px">' +
      ligneInfo('Marquage concerne', '') + ligneInfo('Date', '') +
    '</div>' +
    '<p class="emp-cases">Gravite : &#9744; Mineure &nbsp;&nbsp; &#9744; Moderee &nbsp;&nbsp; &#9744; Grave</p>' +
    '<div class="emp-box">Description :</div>' +
    '<div class="pied"><span>Rapportez cette fiche au responsable materiel.</span>' +
      '<span>Degrade &rarr; incident cree &middot; Perdu &rarr; sortie d\'inventaire</span></div>';
}

function ficheEmpruntVierge() {
  sortirDocument(enveloppeFiche('Fiche d\'emprunt', corpsFicheEmprunt({ nbVierges: 12 })),
    'fiche-emprunt-vierge.html', 'prets-actions');
}

/* Le bon imprime : liste exactement le materiel prete, avec le numero du bon.
   Remis a l'emprunteur, il suffit a retrouver le pret au retour. */
/* Recapitulatif d'un bon deja rendu : ce qui s'est REELLEMENT passe (pas un formulaire
   vierge a remplir comme corpsFicheEmprunt). Reserve aux bons entierement fermes :
   un bon encore ouvert n'a pas de "resultat" a recapituler. */
function corpsRecapBon(numero, items) {
  var rows = items.map(function (e) {
    return '<tr><td>' + esc(e.materiel) + '</td><td>' + e.emprunte + '</td>' +
      '<td>' + e.rendu + '</td><td>' + esc(e.etat || '-') + '</td></tr>';
  }).join('');
  return '<div class="entete"><span class="club">' + esc(clubImprimable()) + '</span>' +
      '<span>Recapitulatif de pret</span></div>' +
    '<h1>Bon N&deg; ' + esc(numero || 'sans numero') + '</h1>' +
    '<div class="grid" style="margin-bottom:12px">' +
      ligneInfo('Emprunteur', items[0].adherent) +
      ligneInfo('Sortie / activite', items[0].sortie) +
    '</div>' +
    '<table><tr><th>Materiel</th><th style="width:90px">Emprunte le</th>' +
      '<th style="width:90px">Rendu le</th><th style="width:120px">Etat au retour</th></tr>' +
      rows + '</table>' +
    '<div class="pied"><span>Document genere depuis le registre &mdash; ne remplace pas le bon papier d\'origine.</span></div>';
}

function exporterRecapBonPdf(numero, items) {
  sortirDocument(enveloppeFiche('Recapitulatif bon ' + (numero || ''), corpsRecapBon(numero, items)),
    'recap-bon-' + (numero || 'sans-numero') + '.html', 'prets-actions');
}

function exporterRecapBonCsv(numero, items) {
  var lignes = [['Materiel', 'Emprunte le', 'Rendu le', 'Etat au retour', 'Emprunteur', 'Sortie']];
  items.forEach(function (e) {
    lignes.push([e.materiel, e.emprunte, e.rendu, e.etat || '', e.adherent, e.sortie || '']);
  });
  telechargerCsv(lignes, 'recap-bon-' + (numero || 'sans-numero') + '.csv', 'prets-actions');
}

function imprimerBon(numero, ids, emprunteur, dateStr, sortie) {
  var lignes = ids.map(function (id) {
    var m = refLists.materiels.filter(function (x) { return x.id === id; })[0];
    var lot = m ? refLists.lots.filter(function (l) { return l.id === m.lot; })[0] : null;
    return { designation: lot ? lot.designation : '', marquage: m ? (m.numero_marquage || '#' + m.id) : '' };
  });
  var corps = corpsFicheEmprunt({
    numero: numero || '',
    sortie: sortie || '',
    date: dateStr ? new Date(dateStr).toLocaleDateString('fr-FR') : '',
    emprunteur: emprunteur || '',
    lignes: lignes,
    nbVierges: 3        /* quelques lignes libres pour un ajout de derniere minute au stylo */
  });
  sortirDocument(enveloppeFiche(numero ? 'Bon d\'emprunt ' + numero : 'Fiche d\'emprunt', corps),
    numero ? ('bon-emprunt-' + numero + '.html') : 'fiche-emprunt.html', 'prets-actions');
}

function sortirDocument(html, nomFichier, paneFallback) {
  /* meme regle que pour les CSV : le nom du fichier porte l'outil */
  var nom = /^epilog-/i.test(nomFichier) ? nomFichier : 'epilog-' + nomFichier;
  try {
    var w = window.open('', '_blank');
    if (w && w.document) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      return;
    }
  } catch (e) { console.warn('window.open bloque', e); }

  try {
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    return;
  } catch (e) { console.warn('telechargement bloque', e); }

  /* dernier recours : rendu dans le widget */
  var box = document.getElementById(paneFallback);
  if (box) {
    box.innerHTML =
      '<div class="form-panel">' +
        enteteFenetre('Document \u00e0 imprimer', String(nom || '').replace(/\.[a-z]+$/i, '')) +
        '<p class="hint">L\'ouverture d\'une fenetre et le telechargement sont bloques par Grist. ' +
        'Selectionnez le contenu ci-dessous et copiez-le, ou imprimez la page.</p>' +
        '<div style="background:#fff;padding:12px;border-radius:6px;max-height:420px;overflow:auto">' +
          html.replace(/^[\s\S]*<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '') +
        '</div>' +
        '<div class="form-actions"><button class="secondary" onclick="document.getElementById(\'' +
          paneFallback + '\').innerHTML=\'\'">Fermer</button></div>' +
      '</div>';
    defilerVers(box, { block: 'nearest' });
  }
}

function telechargerCsv(lignes, nomFichier, paneFallback) {
  /* Tracabilite de l'outil : elle passe par le NOM DU FICHIER, jamais par une
     ligne de metadonnees en tete. La premiere ligne d'un CSV porte les noms de
     colonnes : y glisser « genere par EPILOG » decalerait tout le tableau et
     casserait l'ouverture dans Excel ou LibreOffice. Le prefixe est pose ici,
     dans la fonction commune, pour qu'aucun export present ou futur ne l'oublie. */
  var nom = /^epilog-/i.test(nomFichier) ? nomFichier : 'epilog-' + nomFichier;
  /* separateur ; et BOM : Excel francais ouvre le fichier directement */
  var csv = lignes.map(function (l) {
    return l.map(function (c) {
      var v = String(c === null || c === undefined ? '' : c);
      return /[";\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(';');
  }).join('\r\n');
  try {
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  } catch (e) {
    var box = document.getElementById(paneFallback);
    if (box) {
      box.innerHTML = '<div class="form-panel"><p class="hint">Telechargement bloque. Copiez le contenu ci-dessous dans un fichier .csv :</p>' +
        '<textarea style="width:100%;height:220px;font-family:monospace;font-size:12px">' + esc(csv) + '</textarea>' +
        '<div class="form-actions"><button class="secondary" onclick="document.getElementById(\'' +
        paneFallback + '\').innerHTML=\'\'">Fermer</button></div></div>';
    }
  }
}

var CSS_FICHE =
  '.photo-doc { margin: 10px 0 14px; } .photo-mat { max-width: 230px; max-height: 190px; object-fit: contain; border: 1px solid #ccd6e8; border-radius: 4px; background: #fff; margin: 0 8px 8px 0; } .photo-vign { max-width: 56px; max-height: 56px; object-fit: cover; border: 1px solid #ccd6e8; border-radius: 3px; margin: 0 2px 2px 0; } .photo-inc { max-width: 150px; max-height: 130px; object-fit: contain; border: 1px solid #ccd6e8; border-radius: 4px; background: #fff; } .photo-doc img { max-width: 170px; max-height: 120px; object-fit: contain; border: 1px solid #ccd6e8; border-radius: 6px; padding: 4px; background: #fff; } .legende-illustrative { margin: 4px 0 0; font-style: italic; font-size: 10px; color: #777; max-width: 260px } .ligne-photos td { border-top: none; padding-top: 0 } .photos-ligne { display: flex; flex-wrap: wrap; gap: 8px; padding: 2px 0 6px } @page{size:A4;margin:14mm}' +
  'body{font-family:Arial,sans-serif;color:#222;font-size:12px;margin:0}' +
  'h1{font-size:17px;margin:0 0 2px}' +
  'h2{font-size:13px;margin:16px 0 6px;padding-bottom:3px;border-bottom:1px solid #2C4A3E;color:#2C4A3E}' +
  '.entete{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #2C4A3E;padding-bottom:6px;margin-bottom:12px}' +
  '.club{font-weight:bold;color:#2C4A3E}' +
  '.sous{color:#666;margin:0 0 10px}' +
  '.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin-bottom:4px}' +
  '.ligne{display:flex;justify-content:space-between;border-bottom:1px dotted #ccc;padding:3px 0}' +
  '.ligne .k{color:#666}' +
  '.ligne .v{font-weight:bold;text-align:right}' +
  'table{width:100%;border-collapse:collapse;margin-bottom:4px}' +
  'th{background:#f0f0ee;text-align:left;padding:5px 6px;border:1px solid #ddd;font-size:11px}' +
  'td{padding:5px 6px;border:1px solid #ddd;vertical-align:top}' +
  '.vide{color:#999;font-style:italic}' +
  '.alerte{color:#a3242a;font-weight:bold}' +
  '.pied{margin-top:22px;display:flex;justify-content:space-between;font-size:11px;color:#666}' +
  '.signature{margin-top:26px;border-top:1px solid #999;width:220px;padding-top:4px}' +
  '.emp-tbl td{height:30px}' +
  '.emp-etat{white-space:nowrap;font-size:10px;color:#444}' +
  '.emp-box{border:1px solid #999;border-radius:4px;padding:8px 10px;margin-top:4px;min-height:64px}' +
  '.emp-cases{font-size:11px;margin:6px 0}' +
  /* Signature EPILOG en pied de page. print-color-adjust force le rendu des
     aplats sombres du logo, que les navigateurs suppriment sinon a l'impression. */
  '.epilog-pied{margin-top:26px;padding-top:8px;border-top:1px solid #ddd;' +
    'display:flex;align-items:center;gap:9px;font-size:10px;color:#888}' +
  '.epilog-pied svg{flex:0 0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
  '.epilog-pied b{color:#555;letter-spacing:0.08em;font-size:11px}' +
  '@media print{.noprint{display:none}}';

/* Pictogramme du logo (mousqueton + epicea), sans le fond ni le texte :
   a 22 px seuls les volumes se lisent. Couleurs en dur car le document
   imprimable est autonome — il ne recoit pas les variables du widget. */
var LOGO_EPILOG_DOC =
  '<svg viewBox="140 100 300 390" width="22" height="22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M 235 115 C 345 95, 410 142, 410 225 L 410 355 C 410 438, 325 475, 245 465 C 180 456, 160 410, 160 355 L 160 225 C 160 160, 180 125, 235 115 Z" ' +
      'fill="none" stroke="#0EA5E9" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<rect x="397" y="225" width="26" height="130" rx="7" fill="#94A3B8"/>' +
    '<rect x="390" y="270" width="40" height="44" rx="8" fill="#F97316"/>' +
    '<rect x="289" y="380" width="22" height="40" rx="3" fill="#78350F"/>' +
    '<polygon points="300,390 210,390 257,335 233,335 300,270 367,335 343,335 390,390" fill="#047857"/>' +
    '<polygon points="300,335 230,335 267,288 248,288 300,223 352,288 333,288 370,335" fill="#10B981"/>' +
    '<polygon points="300,280 248,280 277,242 263,242 300,185 337,242 323,242 352,280" fill="#34D399"/>' +
    '<polygon points="300,215 267,215 300,140 333,215" fill="#6EE7B7"/>' +
  '</svg>';

/* Pied commun a tous les documents imprimables : identifie l'outil qui a
   produit la piece, ce qui compte pour un registre EPI conserve des annees. */
function piedEpilog() {
  return '<div class="epilog-pied">' + LOGO_EPILOG_DOC +
    '<span><b>EPILOG</b> &mdash; Logiciel de gestion des EPI pour clubs alpins et de montagne ' +
    '&middot; \u00a9 Pierre Travers &middot; Licence EUPL 1.2</span></div>';
}

function ligneInfo(k, v, cls) {
  return '<div class="ligne"><span class="k">' + k + '</span><span class="v ' + (cls || '') + '">' +
    (v === null || v === undefined || v === '' ? '-' : esc(v)) + '</span></div>';
}

function enveloppeFiche(titre, corps) {
  return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>' + esc(titre) + '</title>' +
    '<style>' + CSS_FICHE + '</style></head><body>' +
    '<div class="noprint" style="margin-bottom:10px"><button onclick="window.print()" ' +
      'style="background:#2C4A3E;color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer">Imprimer</button></div>' +
    corps +
    piedEpilog() +
    '</body></html>';
}

/* assemble tout le contexte d'un exemplaire */
function contexteMateriel(matId) {
  var m = rawRows.materiels.filter(function (x) { return x.id === matId; })[0];
  if (!m) return null;
  var lot = rawRows.lots.filter(function (l) { return l.id === m.lot; })[0] || {};
  var achat = rawRows.achats.filter(function (a) { return a.id === lot.achat; })[0] || {};
  var cat = refLists.categories.filter(function (c) { return c.id === lot.categorie; })[0] || {};
  var lieu = refLists.lieux.filter(function (l) { return l.id === m.lieu_stockage; })[0] || {};
  var four = refLists.fournisseurs.filter(function (f) { return f.id === achat.fournisseur; })[0] || {};
  var adhMap = mapById(refLists.adherents, 'nom_complet');
  /* fin de vie PROPRE a l'exemplaire (prolongation par reparation comprise) */
  var fin = m._finDeVie !== undefined ? m._finDeVie : finDeVieLot(lot);
  return {
    m: m, lot: lot, achat: achat, cat: cat, lieu: lieu, four: four, fin: fin,
    prolongation: m._prolongation || null,
    controles: rawRows.controles.filter(function (c) { return c.materiel === matId; })
      .sort(function (a, b) { return (toDate(b.date_controle) || 0) - (toDate(a.date_controle) || 0); }),
    incidents: rawRows.incidents.filter(function (i) { return i.materiel === matId; })
      .sort(function (a, b) { return (toDate(b.date_incident) || 0) - (toDate(a.date_incident) || 0); }),
    emprunts: rawRows.emprunts.filter(function (e) { return e.materiel === matId; })
      .sort(function (a, b) { return (toDate(b.date_emprunt) || 0) - (toDate(a.date_emprunt) || 0); }),
    reparations: (rawRows.reparations || []).filter(function (r) { return r.materiel === matId; })
      .sort(function (a, b) { return (toDate(b.date_declaree) || 0) - (toDate(a.date_declaree) || 0); }),
    entretiens: (rawRows.entretiens || []).filter(function (e) { return e.materiel === matId; })
      .sort(function (a, b) { return (toDate(b.date_entretien) || 0) - (toDate(a.date_entretien) || 0); }),
    adhMap: adhMap
  };
}

function tableauControles(controles, adhMap, avecMateriel, photosCtrl) {
  if (!controles.length) return '<p class="vide">Aucun controle enregistre.</p>';
  var avecType = aColonne('controles','type_controle');
  var nCols = (avecMateriel ? 1 : 0) + 4 + (avecType ? 1 : 0);
  return '<table><tr>' + (avecMateriel ? '<th>Exemplaire</th>' : '') +
    '<th style="width:80px">Date</th><th style="width:130px">Controleur</th>' +
    '<th style="width:90px">Resultat</th><th>Observations</th>' +
    (avecType ? '<th>Type</th>' : '') + '</tr>' +
    controles.map(function (c) {
      var photos = (photosCtrl && photosCtrl[c.id]) || [];
      return '<tr>' + (avecMateriel ? '<td>' + esc(c._marquage || '') + '</td>' : '') +
        '<td>' + fmtDate(c.date_controle) + '</td>' +
        '<td>' + esc(adhMap[c.controleur] || '-') + '</td>' +
        '<td' + (c.resultat === 'Reforme' ? ' class="alerte"' : '') + '>' + esc(c.resultat || '-') + '</td>' +
        '<td>' + esc(c.commentaire || '') + '</td>' +
        (avecType ? '<td>' + esc(c.type_controle || '') + '</td>' : '') + '</tr>' +
        (photos.length ? ligneImpressionPhotos(nCols, photos) : '');
    }).join('') + '</table>';
}

/* Ligne pleine largeur (colspan) inseree juste sous une ligne de controle/incident,
   avec toutes ses photos alignees cote a cote. Remplace l'ancienne mini-colonne
   "Photo" (une seule image, minuscule) qui obligeait a telecharger pour la voir. */
function ligneImpressionPhotos(nCols, urls) {
  return '<tr class="ligne-photos"><td colspan="' + nCols + '"><div class="photos-ligne">' +
    urls.map(function (u) { return '<img class="photo-inc" src="' + esc(u) + '" alt="">'; }).join('') +
    '</div></td></tr>';
}

/* Tableau incidents, factorise (utilise pour la fiche exemplaire ET le registre par lot,
   avant duplique deux fois — risque que les deux divergent). */
function tableauIncidents(incidents, avecMateriel, marquageMap, photosInc) {
  if (!incidents.length) return '<p class="vide">Aucun incident enregistre.</p>';
  var nCols = (avecMateriel ? 1 : 0) + 3;
  return '<table><tr>' + (avecMateriel ? '<th style="width:90px">Exemplaire</th>' : '') +
    '<th style="width:80px">Date</th><th style="width:80px">Gravite</th><th>Description</th></tr>' +
    incidents.map(function (i) {
      var photos = (photosInc && photosInc[i.id]) || [];
      return '<tr>' + (avecMateriel ? '<td>' + esc(marquageMap[i.materiel] || '-') + '</td>' : '') +
        '<td>' + fmtDate(i.date_incident) + '</td>' +
        '<td' + (i.gravite === 'Grave' ? ' class="alerte"' : '') + '>' + esc(i.gravite || '-') + '</td>' +
        '<td>' + esc(i.description || '') + '</td></tr>' +
        (photos.length ? ligneImpressionPhotos(nCols, photos) : '');
    }).join('') + '</table>';
}

/* Meme famille que tableauControles/tableauIncidents : une ligne par
   reparation, du plus recent au plus ancien (l'appelant trie deja).
   "En cours" tant que date_effectuee est vide — c'est un fait normal, pas
   une anomalie, donc pas de classe "alerte" dessus : contrairement a une
   Reforme ou un incident Grave, une reparation en cours ne signale aucun
   probleme, juste une action pas encore terminee. */
function tableauReparations(reparations, avecMateriel, marquageMap) {
  if (!reparations.length) return '<p class="vide">Aucune reparation enregistree.</p>';
  return '<table><tr>' + (avecMateriel ? '<th style="width:90px">Exemplaire</th>' : '') +
    '<th style="width:80px">Declaree le</th><th>Motif</th>' +
    '<th style="width:170px">Etat</th><th>Reparation effectuee</th></tr>' +
    reparations.map(function (r) {
      var enCours = !r.date_effectuee;
      var etat = enCours
        ? 'En cours'
        : 'Termin\u00e9e le ' + fmtDate(r.date_effectuee) + (r.intervenant ? ' (' + esc(r.intervenant) + ')' : '');
      var fait = enCours ? '' : [
        esc(r.description || ''),
        r.pieces_remplacees ? '<i>Pi\u00e8ces\u00a0: ' + esc(r.pieces_remplacees) + '</i>' : ''
      ].filter(Boolean).join('<br>');
      return '<tr>' + (avecMateriel ? '<td>' + esc(marquageMap[r.materiel] || '-') + '</td>' : '') +
        '<td>' + fmtDate(r.date_declaree) + '</td>' +
        '<td>' + esc(r.motif || '') + '</td>' +
        '<td>' + etat + '</td>' +
        '<td>' + fait + '</td></tr>';
    }).join('') + '</table>';
}

/* Tableau imprimable des entretiens, meme famille que tableauReparations.
   La phrase d'en-tete porte la "nature" des mesures exigee par l'arrete du
   22/10/2009 (art. 2) : une seule nature declaree, precisee au besoin par le
   commentaire. */
function tableauEntretiens(entretiens, avecMateriel, marquageMap, adhMap) {
  var intro = '<p class="vide" style="font-style:normal">Nettoyage, lavage ou d\u00e9sinfection, ' +
    'r\u00e9alis\u00e9s selon la notice du fabricant.</p>';
  if (!entretiens.length) return intro + '<p class="vide">Aucun entretien enregistre.</p>';
  return intro + '<table><tr>' + (avecMateriel ? '<th style="width:90px">Exemplaire</th>' : '') +
    '<th style="width:80px">Date</th><th style="width:150px">Par</th><th>Commentaire</th></tr>' +
    entretiens.map(function (e) {
      return '<tr>' + (avecMateriel ? '<td>' + esc(marquageMap[e.materiel] || '-') + '</td>' : '') +
        '<td>' + fmtDate(e.date_entretien) + '</td>' +
        '<td>' + esc(adhMap[e.auteur] || '-') + '</td>' +
        '<td>' + esc(e.commentaire || '') + '</td></tr>';
    }).join('') + '</table>';
}

async function corpsFicheMateriel(matId) {
  var x = contexteMateriel(matId);
  if (!x) return null;
  /* le jeton d'image est court : on le demande juste avant d'ecrire le document */
  var photo = await urlPhoto('lots', x.lot);
  var photosInc = await urlsPhotosIncidents(x.incidents);
  var photosCtrl = await urlsPhotosControles(x.controles);
  var photosMat = await urlsPieceJointe('materiels', x.m, 'photo');   /* 2026.5.27 : photos de CET exemplaire */

  var corps =
    '<div class="entete"><span class="club">' + esc(clubImprimable()) + '</span>' +
      '<span>Fiche de vie EPI</span></div>' +
    '<h1>' + esc(x.m.numero_marquage || '#' + matId) + '</h1>' +
    '<p class="sous">' + esc(x.lot.designation || 'Sans lot') +
      (x.cat.type_epi ? ' &middot; ' + esc(x.cat.type_epi) : '') + '</p>' +

    (photo ? '<div class="photo-doc"><img src="' + esc(photo) + '" alt="Photo du modele">' +
      '<p class="legende-illustrative">Photo illustrative du mod\u00e8le \u2014 la couleur ou la finition peut diff\u00e9rer de cet exemplaire.</p></div>' : '') +
    '<h2>Identification</h2><div class="grid">' +
      ligneInfo('Numero de marquage', x.m.numero_marquage) +
      (aColonne('materiels', 'numero_serie') ? ligneInfo('Numero de serie (fabricant)', x.m.numero_serie) : '') +
      ligneInfo('Categorie', x.cat.nom) +
      ligneInfo('Fabricant', x.lot.fabricant) +
      ligneInfo('Modele', x.lot.modele) +
      ligneInfo('Lot', x.lot.designation) +
      (aColonne('materiels','couleur') && x.m.couleur ? ligneInfo('Couleur', x.m.couleur) : '') +
      /* Meme relabellisation que le tableau du lot (Matériel) : ce champ
         porte une longueur en metres pour les categories decoupables
         (cordes, sangles), une taille S/M/L pour le reste — champ unique
         reutilise, juste presente differemment selon ce qu'il represente ici. */
      (aColonne('materiels','taille') && x.m.taille ? ligneInfo(decoupeOuverte(x.cat) ? 'Longueur' : 'Taille', x.m.taille) : '') +
      ligneInfo('Lieu de stockage', x.lieu.nom) +
      /* commentaire de l'exemplaire (2026.5.25) : couleur et taille y figuraient deja ;
         il porte aussi la trace des scissions et decoupes. */
      (aColonne('materiels', 'commentaire') && x.m.commentaire ? ligneInfo('Commentaire', x.m.commentaire) : '') +
      /* Arrete du 22/10/2009, art. 2 : la notice du fabricant fait partie de
         l'identification de l'equipement. Meme libelle que la fiche du lot ;
         ligne absente si le club n'a pas cree la colonne notice. */
      (aColonne('lots', 'notice')
        ? ligneInfo('Notice fabricant', idsPiecesJointes(x.lot.notice).length ? 'Jointe au registre' : 'Non jointe')
        : '') +
    '</div>' +

    (photosMat.length
      ? '<h2>Photos de l\u2019exemplaire</h2><div class="photo-doc">' + photosMat.map(function (u) {
          return '<img class="photo-mat" src="' + esc(u) + '" alt="Photo de l\u2019exemplaire">';
        }).join('') + '</div>'
      : '') +
    '<h2>Cycle de vie</h2><div class="grid">' +
      ligneInfo('Date de fabrication', fmtDate(x.lot.date_fabrication)) +
      ligneInfo('Date de mise en service', fmtDate(x.m.date_mise_en_service)) +
      ligneInfo('Duree de vie annoncee', x.lot.duree_vie_mois ? x.lot.duree_vie_mois + ' mois' : null) +
      ligneInfo('Fin de vie theorique', (x.fin ? '31/12/' + x.fin.getUTCFullYear() : 'Illimitee') +
          (x.prolongation ? ' \u2014 ' + texteProlongation(x.prolongation) : ''),
        (x.fin && x.fin <= new Date()) ? 'alerte' : '') +
      /* Arrete du 22/10/2009, art. 2 : periodicite des inspections et date de
         la prochaine verification. Simple inscription : la date est celle
         deja calculee par load() (controleEchu -> _limiteControle), aucune
         regle nouvelle. Sans objet pour un exemplaire sorti du parc. */
      ligneInfo('Periodicite des controles', '12 mois au plus (contr\u00f4le complet annuel)') +
      (HORS_STOCK.indexOf(x.m._statut) !== -1
        ? ligneInfo('Prochain controle', 'Sans objet (hors du parc)')
        : ligneInfo('Prochain controle',
            x.m._limiteControle
              ? fmtDate(x.m._limiteControle) +
                (x.m._jamaisControle ? ' (premier controle, 12 mois apr\u00e8s la mise en service)' : '') +
                (x.m._controleEchu ? ' \u2014 en retard' : '')
              : 'Date inconnue (aucune date de mise en service)',
            x.m._controleEchu ? 'alerte' : '')) +
      ligneInfo('Statut actuel', x.m._statut, (HORS_STOCK.indexOf(x.m._statut) !== -1) ? 'alerte' : '') +
      (dateSortieParc(x.m) ? ligneInfo('Sortie du parc', fmtDate(dateSortieParc(x.m)) +
        (conservationEchue(x.m) ? ' (conservation de 3 ans echue)' : '')) : '') +
      ligneInfo('Motif', (x.m._raison && x.m._raison !== x.m._statut) ? x.m._raison :
        (x.m._raison ? 'Aucune precision enregistree' : 'Aucun fait ne le sort du circuit')) +
      /* Colonne facultative : absente si le club ne la suit pas, ou si cet
         exemplaire n'est simplement pas issu d'une decoupe (l'immense
         majorite du parc). La date vient de hors_service_date de l'ORIGINE
         (c'est elle qui porte la date de decoupe, puisque c'est elle qui a
         ete reformee ce jour-la), pas d'un champ duplique sur ce nouvel
         exemplaire. */
      (aColonne('materiels', 'origine_decoupe') && x.m.origine_decoupe
        ? (function () {
            var origine = rawRows.materiels.filter(function (o) { return o.id === x.m.origine_decoupe; })[0];
            if (!origine) return '';
            return ligneInfo('Origine', 'Provient de la d\u00e9coupe de l\u2019exemplaire ' +
              (origine.numero_marquage || '?') +
              (origine.hors_service_date ? ', d\u00e9coup\u00e9 le ' + fmtDate(origine.hors_service_date) : ''));
          })()
        : '') +
    '</div>' +

    '<h2>Acquisition</h2><div class="grid">' +
      ligneInfo('Commande', x.achat.ref_commande) +
      ligneInfo('Fournisseur', x.four.nom) +
      ligneInfo('Date de reception', fmtDate(x.achat.date_reception)) +
      ligneInfo('Prix unitaire', x.lot.prix_unitaire ? money(x.lot.prix_unitaire) : null) +
      ligneInfo('Financement', x.achat.financement) +
      (aColonne('achats', 'note_financement') && x.achat.note_financement ? ligneInfo('Note financement', x.achat.note_financement) : '') +
    '</div>' +

    '<h2>Controles periodiques</h2>' + tableauControles(x.controles, x.adhMap, false, photosCtrl) +

    /* Section absente entierement (pas meme "Aucune reparation enregistree")
       si le club n'a pas cree la table facultative : cf. le reste du fichier,
       aucune fonctionnalite optionnelle n'affiche son etat vide quand elle
       n'est pas activee (meme logique que DEMANDES_EMPRUNT). */
    (resolvedNames.reparations
      ? '<h2>Reparations</h2>' + tableauReparations(x.reparations, false, null)
      : '') +

    '<h2>Incidents</h2>' + tableauIncidents(x.incidents, false, null, photosInc) +

    (resolvedNames.entretiens
      ? '<h2>Entretien</h2>' + tableauEntretiens(x.entretiens, false, null, x.adhMap)
      : '') +

    '<h2>Historique des prets</h2>' +
    (x.emprunts.length
      ? '<table><tr><th style="width:80px">Emprunt</th><th style="width:80px">Retour</th>' +
        '<th style="width:130px">Adherent</th><th>Sortie</th><th style="width:80px">Etat</th></tr>' +
        x.emprunts.slice(0, 25).map(function (e) {
          return '<tr><td>' + fmtDate(e.date_emprunt) + '</td><td>' + fmtDate(e.date_retour_effective) + '</td>' +
            '<td>' + esc(x.adhMap[e.adherent] || '-') + '</td>' +
            '<td>' + esc(e.sortie_activite || '') + '</td>' +
            '<td>' + esc(e.etat_retour || '-') + '</td></tr>';
        }).join('') + '</table>' +
        (x.emprunts.length > 25 ? '<p class="vide">' + (x.emprunts.length - 25) + ' pret(s) plus ancien(s) non affiche(s).</p>' : '')
      : '<p class="vide">Aucun pret enregistre.</p>') +

    '<div class="pied"><span>Edite le ' + new Date().toLocaleDateString('fr-FR') +
      '</span><span>Document genere depuis Grist</span></div>' +
    '<div class="signature">Visa du responsable materiel</div>';

  return corps;
}

async function ficheDeVieMateriel(matId) {
  var m = (refLists.materiels || []).filter(function (mm) { return mm.id === matId; })[0];
  var corps = await corpsFicheMateriel(matId);
  if (corps == null) return;
  var mq = m ? (m.numero_marquage || '#' + matId) : matId;
  sortirDocument(enveloppeFiche('Fiche de vie ' + mq, corps),
    'fiche-de-vie-' + mq + '.html', 'materiel-editor');
}

/* Registre d'un lot : toutes les fiches de vie de ses exemplaires, un seul document,
   une fiche par page. Reutilise le meme mecanisme d'impression (repli telechargement si besoin). */
/* ------------- fiches de vie en PDF, avec fenetre de configuration (2026.5.23) -------------
   Demande de Pierre : un document avec les fiches individuelles, choisies dans
   une fenetre de configuration (categories, lieu, statut), dont \"sortis du parc
   depuis plus de 3 ans\" = conservation reglementaire echue (arrete du
   22/10/2009, art. 3). Export seul : aucune suppression. */

/* Date de sortie du parc, deduite selon la nature de la sortie :
   - perte, vol, cession, reforme declaree : hors_service_date ;
   - reforme decidee par un controle : date de ce controle (le plus recent) ;
   - reforme au calendrier : 31/12 de l'annee de fin de vie.
   null si l'exemplaire est dans le parc ou si aucune date n'est connue. */
function dateSortieParc(m) {
  if (!m || HORS_STOCK.indexOf(m._statut) === -1) return null;
  var d = toDate(m.hors_service_date);
  if (d) return d;
  var ctrl = (rawRows.controles || []).filter(function (c) { return c.materiel === m.id && c.resultat === 'Reforme'; })
    .map(function (c) { return toDate(c.date_controle); }).filter(Boolean)
    .sort(function (a, b) { return b - a; })[0];
  if (ctrl) return ctrl;
  if (m._reformeCalendaire && m._finDeVie) return m._finDeVie;
  return null;
}
function conservationEchue(m) {
  var d = dateSortieParc(m);
  if (!d) return false;
  var limite = new Date(d.getTime()); limite.setUTCFullYear(limite.getUTCFullYear() + 3);
  return limite <= new Date();
}

/* Fiches de vie de plusieurs exemplaires en un document (une par page).
   Partage avec le registre d'un lot. progression(i, n) facultatif. */
async function exporterFichesDeVie(matIds, titre, nomFichier, progression) {
  var parties = [];
  for (var i = 0; i < matIds.length; i++) {
    if (progression) progression(i + 1, matIds.length);
    var c = await corpsFicheMateriel(matIds[i]);
    if (c) parties.push(c);
  }
  if (!parties.length) return 0;
  var corps = parties.map(function (part, idx) {
    return (idx > 0 ? '<div style="page-break-before:always"></div>' : '') + part;
  }).join('');
  sortirDocument(enveloppeFiche(titre, corps), nomFichier, null);
  return parties.length;
}

var SEUIL_CONFIRMATION_FICHES = 50;
function selectionFichesPdf(panneau) {
  var cats = Array.prototype.map.call(panneau.querySelectorAll('.fp-cat:checked'), function (c) { return Number(c.value); });
  var lieu = panneau.querySelector('#fpLieu').value;
  var statut = (panneau.querySelector('input[name="fpStatut"]:checked') || {}).value || 'circulation';
  var sansDate = 0;
  var mats = (rawRows.materiels || []).filter(function (m) {
    var cat = categorieDeMateriel(m);
    if (!cat || cats.indexOf(cat.id) === -1) return false;
    if (lieu && String(m.lieu_stockage || '') !== lieu) return false;
    var hors = HORS_STOCK.indexOf(m._statut) !== -1;
    if (statut === 'circulation') return !hors;
    if (statut === 'sortis') return hors;
    if (statut === 'sortis3') {
      if (hors && !dateSortieParc(m)) { sansDate++; return false; }
      return hors && conservationEchue(m);
    }
    return true;
  }).sort(function (a, b) {
    return String(a.numero_marquage || '').localeCompare(String(b.numero_marquage || ''), 'fr', { numeric: true });
  });
  return { mats: mats, statut: statut, sansDate: sansDate, lieu: lieu, nbCats: cats.length };
}
function ouvrirConfigFichesPdf() {
  var p = document.getElementById('exportFichesPanel');
  if (!p) return;
  if (p.innerHTML) { p.innerHTML = ''; return; }   /* second clic : referme */
  var cats = (refLists.categories || []).slice().sort(function (a, b) { return String(a.nom).localeCompare(String(b.nom), 'fr'); });
  p.innerHTML = '<div class="form-panel" style="margin-top:10px">' +
    '<p style="margin:0 0 8px"><b>Fiches de vie (PDF)</b> \u2014 une fiche par exemplaire, une par page. Choisissez ce qu\u2019il faut inclure.</p>' +
    '<div class="form-field"><label>Cat\u00e9gories</label>' +
      '<label class="coche" style="display:block;margin:2px 0 6px"><input type="checkbox" id="fpToutes" checked> <b>Toutes</b></label>' +
      '<div class="grille-coches">' + cats.map(function (c) {
        return '<label class="coche"><input type="checkbox" class="fp-cat" value="' + c.id + '" checked> ' + esc(c.nom) + '</label>';
      }).join('') + '</div></div>' +
    '<div class="form-grid" style="margin-top:8px">' +
      field('Lieu de stockage', '<select id="fpLieu"><option value="">Tous les lieux</option>' +
        (refLists.lieux || []).map(function (l) { return '<option value="' + l.id + '">' + esc(l.nom) + '</option>'; }).join('') + '</select>') +
    '</div>' +
    '<div class="form-field" style="margin-top:8px"><label>Exemplaires</label>' +
      '<label class="coche" style="display:block;margin:3px 0"><input type="radio" name="fpStatut" value="circulation" checked> En circulation (dans le parc)</label>' +
      '<label class="coche" style="display:block;margin:3px 0"><input type="radio" name="fpStatut" value="sortis"> Sortis du parc (r\u00e9form\u00e9s, perdus, vol\u00e9s, c\u00e9d\u00e9s)</label>' +
      '<label class="coche" style="display:block;margin:3px 0"><input type="radio" name="fpStatut" value="sortis3"> Sortis du parc <b>depuis plus de 3 ans</b> ' +
        '<span class="hint" style="text-transform:none;letter-spacing:0;font-weight:400;font-size:12px">(conservation r\u00e9glementaire \u00e9chue : fiches \u00e0 archiver)</span></label>' +
      '<label class="coche" style="display:block;margin:3px 0"><input type="radio" name="fpStatut" value="tous"> Tous</label>' +
    '</div>' +
    '<p class="hint" id="fpCompte" style="margin:8px 0"></p>' +
    '<div class="form-actions"><button type="button" id="fpGenerer">G\u00e9n\u00e9rer les fiches</button>' +
      '<button type="button" class="secondary" id="fpAnnuler">Annuler</button>' +
      '<span class="form-msg" id="fpMsg"></span></div></div>';
  var maj = function () {
    var s = selectionFichesPdf(p);
    var n = s.mats.length;
    p.querySelector('#fpCompte').textContent = (n ? n + ' fiche' + (n > 1 ? 's' : '') + ' (environ ' + n + ' page' + (n > 1 ? 's' : '') + ').'
      : 'Aucun exemplaire ne correspond.') +
      (s.sansDate ? ' ' + s.sansDate + ' exemplaire(s) sorti(s) du parc sans date connue ne sont pas inclus.' : '');
    p.querySelector('#fpGenerer').disabled = !n;
    var toutes = p.querySelector('#fpToutes'), nb = p.querySelectorAll('.fp-cat').length;
    toutes.checked = s.nbCats === nb; toutes.indeterminate = s.nbCats > 0 && s.nbCats < nb;
  };
  p.querySelector('#fpToutes').onchange = function () {
    var v = this.checked;
    p.querySelectorAll('.fp-cat').forEach(function (c) { c.checked = v; });
    maj();
  };
  p.querySelectorAll('.fp-cat, #fpLieu, input[name="fpStatut"]').forEach(function (el) { el.onchange = maj; });
  p.querySelector('#fpAnnuler').onclick = function () { p.innerHTML = ''; };
  p.querySelector('#fpGenerer').onclick = async function () {
    var s = selectionFichesPdf(p), n = s.mats.length, msg = p.querySelector('#fpMsg');
    if (!n) return;
    if (n > SEUIL_CONFIRMATION_FICHES &&
        !confirm(n + ' fiches de vie (environ ' + n + ' pages) : la pr\u00e9paration peut prendre un moment. Continuer ?')) return;
    var titre = 'Fiches de vie \u2014 ' + (CONFIG.nom_club || '') + ' \u2014 ' +
      ({ circulation: 'en circulation', sortis: 'sortis du parc', sortis3: 'sortis du parc depuis plus de 3 ans', tous: 'tous les exemplaires' })[s.statut];
    msg.style.color = '';
    try {
      var faites = await exporterFichesDeVie(s.mats.map(function (m) { return m.id; }), titre,
        nomFichierDuJour('fiches-de-vie', 'html'), function (i, t) { msg.textContent = 'Pr\u00e9paration ' + i + ' / ' + t + '...'; });
      msg.textContent = faites + ' fiche' + (faites > 1 ? 's' : '') + ' pr\u00eate' + (faites > 1 ? 's' : '') +
        ' : imprimez ou \u00ab Enregistrez en PDF \u00bb depuis la fen\u00eatre ouverte.';
    } catch (e) {
      msg.textContent = 'Erreur : ' + e.message; msg.style.color = '#a3242a';
    }
  };
  maj();
}

async function exporterRegistreLot(lotId) {
  var lot = (rawRows.lots || []).filter(function (l) { return l.id === lotId; })[0];
  if (!lot) return;
  var mats = (refLists.materiels || []).filter(function (m) { return m.lot === lotId; });
  if (!mats.length) return;
  await exporterFichesDeVie(mats.map(function (m) { return m.id; }), 'Registre — ' + (lot.designation || 'lot ' + lotId),
    'registre-' + (lot.designation || lotId) + '.html');
}

async function ficheDeVieLot(lotId) {
  var lot = rawRows.lots.filter(function (l) { return l.id === lotId; })[0];
  if (!lot) return;
  var photo = await urlPhoto('lots', lot);
  var achat = rawRows.achats.filter(function (a) { return a.id === lot.achat; })[0] || {};
  var cat = refLists.categories.filter(function (c) { return c.id === lot.categorie; })[0] || {};
  var four = refLists.fournisseurs.filter(function (f) { return f.id === achat.fournisseur; })[0] || {};
  var adhMap = mapById(refLists.adherents, 'nom_complet');
  var lieuMap = mapById(refLists.lieux, 'nom');
  var items = rawRows.materiels.filter(function (m) { return m.lot === lotId; });
  var ids = items.map(function (m) { return m.id; });
  var marquageMap = mapById(items, 'numero_marquage');
  var fin = finDeVieLot(lot);
  /* photos individuelles des exemplaires (2026.5.27) : colonne de vignettes si au moins un exemplaire en a */
  var photosMat = {};
  if (aColonne('materiels', 'photo')) {
    for (var ip = 0; ip < items.length; ip++) {
      if (!idsPiecesJointes(items[ip].photo).length) continue;
      var us = await urlsPieceJointe('materiels', items[ip], 'photo');
      if (us.length) photosMat[items[ip].id] = us;
    }
  }

  var controles = rawRows.controles.filter(function (c) { return ids.indexOf(c.materiel) !== -1; })
    .map(function (c) { var o = Object.assign({}, c); o._marquage = marquageMap[c.materiel]; return o; })
    .sort(function (a, b) { return (toDate(b.date_controle) || 0) - (toDate(a.date_controle) || 0); });
  var incidents = rawRows.incidents.filter(function (i) { return ids.indexOf(i.materiel) !== -1; })
    .sort(function (a, b) { return (toDate(b.date_incident) || 0) - (toDate(a.date_incident) || 0); });
  var reparationsLot = (rawRows.reparations || []).filter(function (r) { return ids.indexOf(r.materiel) !== -1; })
    .sort(function (a, b) { return (toDate(b.date_declaree) || 0) - (toDate(a.date_declaree) || 0); });

  var photosInc = await urlsPhotosIncidents(incidents);
  var photosCtrlLot = await urlsPhotosControles(controles);

  var titre = 'Fiche de vie lot ' + lot.designation;
  var corps =
    '<div class="entete"><span class="club">' + esc(clubImprimable()) + '</span>' +
      '<span>Fiche de vie EPI &middot; lot</span></div>' +
    '<h1>' + esc(lot.designation) + '</h1>' +
    '<p class="sous">' + [lot.fabricant, lot.modele, cat.type_epi].filter(Boolean).map(esc).join(' &middot; ') + '</p>' +
    (photo ? '<div class="photo-doc"><img src="' + esc(photo) + '" alt="Photo du modele">' +
      '<p class="legende-illustrative">Photo illustrative du mod\u00e8le \u2014 la couleur ou la finition peut diff\u00e9rer des exemplaires list\u00e9s ci-dessous.</p></div>' : '') +

    '<h2>Identification du lot</h2><div class="grid">' +
      ligneInfo('Categorie', cat.nom) +
      ligneInfo('Fabricant', lot.fabricant) +
      ligneInfo('Modele', lot.modele) +
      ligneInfo('Date de fabrication', fmtDate(lot.date_fabrication)) +
      ligneInfo('Duree de vie annoncee', lot.duree_vie_mois ? lot.duree_vie_mois + ' mois' : null) +
      ligneInfo('Fin de vie theorique', fin ? '31/12/' + fin.getUTCFullYear() : 'Illimitee',
        (fin && fin <= new Date()) ? 'alerte' : '') +
      ligneInfo('Commande', achat.ref_commande) +
      ligneInfo('Fournisseur', four.nom) +
      ligneInfo('Notice fabricant', aColonne('lots', 'notice')
        ? (idsPiecesJointes(lot.notice).length ? 'Jointe au registre' : 'Non jointe') : null) +
      ligneInfo('Facture', aColonne('achats', 'facture')
        ? (idsPiecesJointes(achat.facture).length ? 'Jointe au registre' : 'Non jointe') : null) +
      ligneInfo('Prix unitaire', lot.prix_unitaire ? money(lot.prix_unitaire) : null) +
      ligneInfo('Quantite', items.length === 1 ? '1 (exemplaire unique)' : items.length) +
      ligneInfo('Periodicite des controles', '12 mois au plus (contr\u00f4le complet annuel)') +
    '</div>' +

    '<h2>Exemplaires du lot</h2>' +
    (function () {
      /* Colonne compteur facultative : visible seulement si le club tient la
         table REPARATIONS, pour reperer d'un coup d'oeil un lot qui use
         anormalement, sans alourdir le tableau des clubs qui ne l'utilisent
         pas. Compte TOUTES les reparations (en cours ou terminees) : c'est
         la frequence qui interesse ici, pas leur etat. */
      var avecRep = !!resolvedNames.reparations;
      var repParMat = {};
      if (avecRep) reparationsLot.forEach(function (r) {
        repParMat[r.materiel] = (repParMat[r.materiel] || 0) + 1;
      });
      var det = colonnesDetail(items, function (m, c) { return c === 'serie' ? m.numero_serie : m[c]; }, decoupeOuverte(cat),
        photosMat, function (m) { return m.id; });
      var nCols = 5 + (avecRep ? 1 : 0) + det.n;
      /* Prochain controle par exemplaire (arrete du 22/10/2009) : meme date
         que la fiche de l'exemplaire, relue sur _limiteControle. */
      var prochainCtrl = function (m) {
        if (HORS_STOCK.indexOf(m._statut) !== -1) return '<td>Sans objet</td>';
        if (!m._limiteControle) return '<td>-</td>';
        return '<td' + (m._controleEchu ? ' class="alerte"' : '') + '>' +
          fmtDate(m._limiteControle) + '</td>';
      };
      return '<table><tr><th style="width:90px">Marquage</th>' + det.th(det.avant) + '<th>Lieu</th>' +
        '<th style="width:90px">Mise en service</th><th style="width:90px">Statut</th>' +
        '<th style="width:90px">Prochain controle</th>' +
        (avecRep ? '<th style="width:80px">R\u00e9parations</th>' : '') + det.th(det.apres) + '</tr>' +
      (items.map(function (m) {
        return '<tr><td>' + esc(m.numero_marquage || '#' + m.id) + '</td>' + det.td(det.avant, m) +
          '<td>' + esc(lieuMap[m.lieu_stockage] || '-') + '</td>' +
          '<td>' + fmtDate(m.date_mise_en_service) + '</td>' +
          '<td' + (HORS_STOCK.indexOf(m._statut) !== -1 ? ' class="alerte"' : '') + '>' + esc(m._statut || '-') + '</td>' +
          prochainCtrl(m) +
          (avecRep ? '<td>' + (repParMat[m.id] || 0) + '</td>' : '') + det.td(det.apres, m) + '</tr>';
      }).join('') || '<tr><td colspan="' + nCols + '" class="vide">Aucun exemplaire.</td></tr>') +
      '</table>';
    })() +

    '<h2>Controles periodiques</h2>' + tableauControles(controles, adhMap, true, photosCtrlLot) +

    (resolvedNames.reparations
      ? '<h2>Reparations</h2>' + tableauReparations(reparationsLot, true, marquageMap)
      : '') +

    '<h2>Incidents</h2>' + tableauIncidents(incidents, true, marquageMap, photosInc) +

    (resolvedNames.entretiens
      ? '<h2>Entretien</h2>' + tableauEntretiens(
          (rawRows.entretiens || []).filter(function (e) { return ids.indexOf(e.materiel) !== -1; })
            .sort(function (a, b) { return (toDate(b.date_entretien) || 0) - (toDate(a.date_entretien) || 0); }),
          true, marquageMap, adhMap)
      : '') +

    '<div class="pied"><span>Edite le ' + new Date().toLocaleDateString('fr-FR') +
      '</span><span>Document genere depuis Grist</span></div>' +
    '<div class="signature">Visa du responsable materiel</div>';

  sortirDocument(enveloppeFiche(titre, corps),
    'fiche-de-vie-lot-' + String(lot.designation).replace(/[^a-zA-Z0-9]+/g, '-') + '.html', 'materiel-editor');
}

/* Inventaire : suit strictement le filtre affiche. */
/* UNE SEULE liste de colonnes pour l'export CSV ET le modele CSV (2026.5.31) : `calc` = colonne que EPILOG
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
function exporterInventaireCsv(tout) {
  var liste = tout === true ? inventaireTout : inventaireVisible;
  if (!liste.length) { flash(tout === true ? 'exportParcMsg' : 'lotFlash', 'Aucun exemplaire a exporter.'); return; }
  var lignes = [INV_CSV.map(function (c) { return c.t; })].concat(liste.map(function (r) {
    return INV_CSV.map(function (c) { return c.get(r); });
  }));
  telechargerCsv(lignes, 'inventaire-' + new Date().toISOString().slice(0, 10) + '.csv', tout === true ? 'donneesRepli' : 'materiel-editor');
}

/* Colonnes de detail des exemplaires dans les documents imprimes (2026.5.25,
   demande de Pierre : couleur, taille, commentaires...). Une colonne n'est
   ajoutee QUE si au moins un exemplaire du tableau la renseigne : un lot sans
   couleur ni taille garde son tableau habituel, sans colonne vide qui
   l'elargirait. `acces(item, cle)` lit la valeur ('serie' | 'couleur' |
   'taille' | 'commentaire') : l'inventaire manipule des lignes deja
   calculees, la fiche du lot des lignes brutes de MATERIELS. Le champ unique
   `taille` porte une LONGUEUR pour les categories decoupables (cordes,
   sangles), une taille sinon : meme libelle que les fiches. */
function colonnesDetail(items, acces, decoupable, photos, idDe) {
  var defs = [
    { cle: 'serie', label: 'N\u00b0 de s\u00e9rie', fin: false },
    { cle: 'couleur', label: 'Couleur', fin: false },
    { cle: 'taille', label: decoupable ? 'Longueur' : 'Taille', fin: false },
    { cle: 'commentaire', label: 'Commentaire', fin: true }
  ];
  /* vignettes des photos individuelles (2026.5.27) : `photos` = { idExemplaire: [urls] }, colonne
     ajoutee, en premier, seulement si au moins un exemplaire du tableau a une photo */
  var avecPhotos = !!photos && items.some(function (it) { return (photos[idDe(it)] || []).length; });
  if (avecPhotos) defs.unshift({ cle: 'photo', label: 'Photo', fin: false });
  var det = defs.filter(function (d) {
    if (d.cle === 'photo') return true;
    return items.some(function (it) { return String(acces(it, d.cle) || '').trim() !== ''; });
  });
  return {
    avant: det.filter(function (d) { return !d.fin; }),
    apres: det.filter(function (d) { return d.fin; }),
    /* le commentaire est un texte libre : largeur minimale, sinon il s'ecrase en colonne etroite */
    th: function (liste) {
      return liste.map(function (d) { return '<th' + (d.fin ? ' style="min-width:130px"' : '') + '>' + esc(d.label) + '</th>'; }).join('');
    },
    td: function (liste, it) {
      return liste.map(function (d) {
        if (d.cle === 'photo') {
          return '<td>' + (photos[idDe(it)] || []).map(function (u) {
            return '<img class="photo-vign" src="' + esc(u) + '" alt="">';
          }).join('') + '</td>';
        }
        return '<td>' + esc(String(acces(it, d.cle) || '')) + '</td>';
      }).join('');
    },
    n: det.length
  };
}

async function exporterInventaireImprimable(tout) {
  var inventaire = tout === true ? inventaireTout : inventaireVisible;
  if (!inventaire.length) { flash(tout === true ? 'exportParcMsg' : 'lotFlash', 'Aucun exemplaire a exporter.'); return; }
  /* photos individuelles (2026.5.27) : URLs des exemplaires visibles qui en ont */
  var photosMat = {};
  if (aColonne('materiels', 'photo')) {
    var brutes = {};
    rawRows.materiels.forEach(function (m) { brutes[m.id] = m; });
    for (var ip = 0; ip < inventaire.length; ip++) {
      var rr = inventaire[ip], mm = brutes[rr.id];
      if (!mm || !idsPiecesJointes(mm.photo).length) continue;
      var us = await urlsPieceJointe('materiels', mm, 'photo');
      if (us.length) photosMat[rr.id] = us;
    }
  }
  /* photos de modele des lots (2026.5.32) : vignette a cote du titre de chaque lot */
  var photosLot = {};
  if (aColonne('lots', 'photo')) {
    for (var il = 0; il < rawRows.lots.length; il++) {
      var lt = rawRows.lots[il];
      if (!idsPiecesJointes(lt.photo).length) continue;
      var ul = await urlsPieceJointe('lots', lt, 'photo');
      if (ul.length) photosLot[lt.id] = ul[ul.length - 1];
    }
  }
  var now = new Date();
  var parLot = {};
  inventaire.forEach(function (r) {
    var k = r.lot || 'Sans lot';
    (parLot[k] = parLot[k] || []).push(r);
  });
  var valeur = inventaire.reduce(function (s, r) { return s + (Number(r.prix) || 0); }, 0);

  var corps =
    '<div class="entete"><span class="club">' + esc(clubImprimable()) + '</span>' +
      '<span>Inventaire du materiel</span></div>' +
    '<h1>Inventaire</h1>' +
    '<p class="sous">' + inventaire.length + ' exemplaire(s) &middot; ' +
      Object.keys(parLot).length + ' lot(s) &middot; valeur ' + money(valeur) +
      ' &middot; edite le ' + now.toLocaleDateString('fr-FR') + '</p>' +
    Object.keys(parLot).sort().map(function (k) {
      var items = parLot[k];
      var p = items[0];
      /* le motif du statut (colonne Observations) reprend deja le commentaire d'un exemplaire
         sorti du parc ("Perdu le ... \u2014 Perdu dans le ravin.") : on ne le repete pas */
      var det = colonnesDetail(items, function (r, c) {
        if (c === 'commentaire' && r.commentaire && String(r.raison || '').indexOf(r.commentaire) !== -1) return '';
        return r[c];
      }, p.decoupable, photosMat, function (r) { return r.id; });
      var vignLot = photosLot[p.lotId]
        ? '<img class="photo-vign photo-lot" src="' + esc(photosLot[p.lotId]) + '" alt="Photo du modele" style="float:left;margin:0 8px 4px 0;max-width:64px;max-height:64px">' : '';
      return '<div style="overflow:auto">' + vignLot + '<h2>' + esc(k) + '</h2>' +
        '<p class="sous" style="margin:-2px 0 6px">' +
          [p.fabricant, p.categorie, p.modele].filter(Boolean).map(esc).join(' &middot; ') +
          (p.finDeVie ? ' &middot; fin de vie ' + esc(p.finDeVie) : '') + '</p></div>' +
        '<table><tr><th style="width:85px">Marquage</th>' + det.th(det.avant) + '<th>Lieu</th>' +
          '<th style="width:80px">Statut</th><th style="width:80px">Dernier controle</th><th>Observations</th>' +
          det.th(det.apres) + '</tr>' +
        items.map(function (r) {
          return '<tr><td>' + esc(r.marquage) + '</td>' + det.td(det.avant, r) + '<td>' + esc(r.lieu) + '</td>' +
            '<td' + (r.statut === 'Reforme' || r.statut === 'Perdu' ? ' class="alerte"' : '') + '>' + esc(r.statut) + '</td>' +
            '<td' + (r.echu === 'oui' ? ' class="alerte"' : '') + '>' + esc(r.dernierControle || 'jamais') + '</td>' +
            '<td>' + esc(r.raison) + '</td>' + det.td(det.apres, r) + '</tr>';
        }).join('') + '</table>';
    }).join('') +
    '<div class="pied"><span>Edite le ' + now.toLocaleDateString('fr-FR') +
      '</span><span>Document genere depuis Grist</span></div>' +
    '<div class="signature">Visa du responsable materiel</div>';

  sortirDocument(enveloppeFiche('Inventaire du materiel', corps),
    'inventaire-' + now.toISOString().slice(0, 10) + '.html', tout === true ? 'donneesRepli' : 'materiel-editor');
}

/* registre complet des controles, pour l'AG ou l'archivage */
function exporterRegistreControles() {
  var adhMap = mapById(refLists.adherents, 'nom_complet');
  var matMap = mapById(rawRows.materiels, 'numero_marquage');
  var lotMap = mapById(rawRows.lots, 'designation');
  var lignes = [['Marquage', 'Lot', 'Date du controle', 'Controleur', 'Resultat', 'Observations', 'Prochain controle']];
  rawRows.controles
    .slice()
    .sort(function (a, b) { return (toDate(b.date_controle) || 0) - (toDate(a.date_controle) || 0); })
    .forEach(function (c) {
      var m = rawRows.materiels.filter(function (x) { return x.id === c.materiel; })[0] || {};
      var d = toDate(c.date_controle);
      var prochain = d ? new Date(Date.UTC(d.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate())) : null;
      lignes.push([
        matMap[c.materiel] || '', lotMap[m.lot] || '', fmtDate(c.date_controle),
        adhMap[c.controleur] || '', c.resultat || '', c.commentaire || '',
        prochain ? fmtDate(prochain) : ''
      ]);
    });
  telechargerCsv(lignes, 'registre-controles-' + new Date().toISOString().slice(0, 10) + '.csv', 'controles-editor');
}

/* feuille de saisie papier pour la campagne de controle annuelle */
/* Formulaire de declaration d'incident, vierge, a imprimer : un adherent qui rend un
   materiel deteriore n'a pas acces au logiciel et ne saisit pas lui-meme le registre.
   Cette feuille reprend exactement les champs du formulaire "Declarer un incident"
   (materiel, date, gravite, suite, description), pour une transcription directe. */
function exporterFeuilleIncident() {
  var now = new Date();
  var lignesVierges = new Array(4).fill(
    '<tr><td style="height:26px"></td><td></td></tr>'
  ).join('');
  var corps =
    '<div class="entete"><span class="club">' + esc(clubImprimable()) + '</span>' +
      '<span>Declaration d\'incident EPI</span></div>' +
    '<h1>Declaration d\'incident</h1>' +
    '<p class="sous">A remplir par la personne concernee, sur le terrain ou au retour, ' +
      'puis a rapporter au responsable materiel pour saisie dans le registre. Remise a ' +
      'l\'emprunteur en cas d\'incident, cette fiche fiabilise le suivi des EPI et la ' +
      'securite de tous : aucun detail ne se perd entre le terrain et le registre. ' +
      'Edite le ' + now.toLocaleDateString('fr-FR') + '.</p>' +
    '<div class="grid" style="margin-bottom:12px">' +
      ligneInfo('Nom de la personne', '') +
      ligneInfo('Contact (tel / mail)', '') +
      ligneInfo('Date de l\'incident', '') +
      ligneInfo('Sortie / activite', '') +
    '</div>' +
    '<h2>Materiel concerne</h2>' +
    '<table><tr><th style="width:140px">Marquage (si connu)</th><th>Designation (baudrier, corde...)</th></tr>' +
      lignesVierges +
    '</table>' +
    '<p class="emp-cases" style="margin-top:12px">Gravite : &#9744; Mineure &nbsp;&nbsp; ' +
      '&#9744; Moderee &nbsp;&nbsp; &#9744; Grave</p>' +
    '<div class="emp-box" style="min-height:110px">Description des faits ' +
      '(comment, ou, quand, consequence constatee) :</div>' +
    '<p class="emp-cases" style="margin-top:10px">Suite a donner ' +
      '(reserve au responsable materiel, lors de la saisie) : &#9744; Controle a realiser ' +
      '&nbsp;&nbsp; &#9744; Sans suite &nbsp;&nbsp; &#9744; Mise au rebut immediate</p>' +
    '<div class="grid" style="margin-top:14px">' +
      ligneInfo('Recu par (responsable materiel)', '') +
      ligneInfo('Date de reception', '') +
    '</div>' +
    '<div class="signature">Signature de la personne qui declare l\'incident</div>';

  sortirDocument(enveloppeFiche('Declaration d\'incident EPI', corps),
    'declaration-incident-vierge.html', 'incidents-actions');
}

function exporterFeuilleControle() {
  var now = new Date();
  var lieuMap = mapById(refLists.lieux, 'nom');
  var dernier = {};
  rawRows.controles.forEach(function (c) {
    var d = toDate(c.date_controle);
    if (!d) return;
    if (!dernier[c.materiel] || d > dernier[c.materiel]) dernier[c.materiel] = d;
  });
  var horizon = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
  var aControler = rawRows.materiels.filter(function (m) {
    if (HORS_STOCK.indexOf(m._statut) !== -1) return false;
    /* meme regle que le badge : la limite memorisee integre le delai de
       12 mois apres mise en service pour le jamais-controle */
    if (!m._limiteControle) return true;
    return m._limiteControle <= horizon;
  });
  var lotMap = mapById(rawRows.lots, 'designation');

  var corps =
    '<div class="entete"><span class="club">' + esc(clubImprimable()) + '</span>' +
      '<span>Feuille de controle EPI</span></div>' +
    '<h1>Campagne de controle</h1>' +
    '<p class="sous">Exemplaires dont le controle est du ou echoit dans les 3 mois &middot; edite le ' +
      now.toLocaleDateString('fr-FR') + '</p>' +
    '<div class="grid" style="margin-bottom:14px">' +
      ligneInfo('Controleur (nom)', '') +
      ligneInfo('Date du controle', '') +
    '</div>' +
    '<table><tr><th style="width:85px">Marquage</th><th>Lot</th><th>Lieu</th>' +
      '<th style="width:75px">Dernier</th><th style="width:95px">Resultat</th><th style="width:150px">Observations</th></tr>' +
    (aControler.map(function (m) {
      return '<tr><td>' + esc(m.numero_marquage || '#' + m.id) + '</td>' +
        '<td>' + esc(lotMap[m.lot] || '-') + '</td>' +
        '<td>' + esc(lieuMap[m.lieu_stockage] || '-') + '</td>' +
        '<td>' + (dernier[m.id] ? fmtDate(dernier[m.id]) : '<span class="alerte">jamais</span>') + '</td>' +
        '<td style="height:26px"></td><td></td></tr>';
    }).join('') || '<tr><td colspan="6" class="vide">Aucun controle a realiser dans les 3 mois.</td></tr>') +
    '</table>' +
    '<p class="sous" style="margin-top:10px">Resultat : C = conforme, S = a surveiller, R = reforme</p>' +
    '<div class="signature">Signature du controleur habilite</div>';

  sortirDocument(enveloppeFiche('Feuille de controle EPI', corps),
    'feuille-controle-' + now.toISOString().slice(0, 10) + '.html', 'controles-editor');
}

/* ---------------------- selecteur de materiel filtre ---------------------- */

/* Chaque formulaire a son prefixe et sa regle d'eligibilite propre :
   on ne prete que ce qui est en service, on ne controle pas un reforme. */
var BASE_PREDICAT = {
  /* le controle echu n'interdit pas le pret : decision du club, un parc
     de benevoles ne peut pas s'arreter parce qu'un registre a du retard */
  pr: function (m) { return m._statut === 'En service'; },
  ct: function (m) { return HORS_STOCK.indexOf(m._statut) === -1; },
  in: function (m) { return m._statut !== 'Reforme'; },
  /* declaration de reparation (groupee) : ni reforme (rien a reparer), ni
     deja en reparation (deja suivi, double declaration sans objet) —
     meme regle que le bouton "Declarer une reparation" de la fiche. */
  rep: function (m) {
    /* (2026.5.14) categorie fermee a la reparation ET a la decoupe : absent de
       la liste (avant : present mais grise) */
    var catR = categorieDeMateriel(m);
    if (catR && !reparationOuverte(catR) && !decoupeOuverte(catR)) return false;
    /* + reforme CALENDAIRE d'une categorie prolongeable (sangle de degaine
       changee en fin de vie) : seule reforme qu'une reparation peut lever */
    if (m._reformeCalendaire && prolongationOuverte(categorieDeMateriel(m))) return true;
    return HORS_STOCK.indexOf(m._statut) === -1 && m._statut !== 'En reparation';
  },
  /* entretien : tout ce qui est encore dans le parc (meme regle que le
     controle) ; un exemplaire reforme, perdu ou cede n'a plus rien a nettoyer */
  ent: function (m) { return HORS_STOCK.indexOf(m._statut) === -1; },
  /* edition d'un bon : ajouter du materiel disponible, sauf celui deja dans le bon */
  be: function (m) {
    if (m._statut !== 'En service') return false;
    return !bonEnEdition || bonEnEdition.matIds.indexOf(m.id) === -1;
  }
};

/* bon en cours d'edition (null si l'editeur est ferme) : {numero, matIds} */
var bonEnEdition = null;

/* Formulaires ou le geste se fait sur place (on prete, on controle, on
   nettoie au local ou au gymnase) : filtre de lieu. Incident et reparation
   se declarent apres coup, de n'importe ou : pas de filtre de lieu. */
var PREFIXES_AVEC_LIEU = ['pr', 'be', 'ct', 'ent'];

function filtresMaterielHtml(prefix) {
  var lieuHtml = PREFIXES_AVEC_LIEU.indexOf(prefix) !== -1
    ? '<div class="form-field"><label>Lieu de stockage</label>' +
      '<select id="' + prefix + 'FiltreLieu"><option value="">Tous les lieux</option></select></div>'
    : '';
  return lieuHtml +
    '<div class="form-field"><label>Filtrer par catégorie</label>' +
    '<select id="' + prefix + 'FiltreCat"></select></div>' +
    '<div class="form-field"><label>Filtrer par lot</label>' +
    '<select id="' + prefix + 'FiltreLot"></select></div>' +
    '<div class="form-field"><label>Rechercher</label>' +
    '<input id="' + prefix + 'Recherche" type="text" placeholder="marquage, lot, mod\u00e8le, fabricant"></div>';
}

/* Remplit les deux filtres en cascade et retourne la liste filtree.
   Sert au menu (controles, incidents) comme a la liste a cocher (prets). */
function materielsFiltresCascade(prefix) {
  var catSel = document.getElementById(prefix + 'FiltreCat');
  var lotSel = document.getElementById(prefix + 'FiltreLot');
  if (!catSel || !lotSel) return null;

  var base = refLists.materiels.filter(BASE_PREDICAT[prefix]);
  var lotById = {};
  refLists.lots.forEach(function (l) { lotById[l.id] = l; });

  /* filtre lieu (prets uniquement), calcule EN PREMIER : il restreint les
     menus Categorie et Lot. Avant, ces menus l'ignoraient et proposaient un
     lot entierement range ailleurs -> liste vide sans explication (bug
     signale le 07/10 : baudriers au gymnase, filtre sur le local). Le menu
     des lieux, lui, reste construit sur tout le materiel eligible : on doit
     toujours pouvoir changer de lieu. */
  var lieuSel = document.getElementById(prefix + 'FiltreLieu');
  var lieuVal = '';
  if (lieuSel) {
    var lieuxPresents = {};
    base.forEach(function (m) {
      if (m.lieu_stockage) lieuxPresents[m.lieu_stockage] = true;
    });
    var prevLieu = lieuSel.value;
    lieuSel.innerHTML = '<option value="">Tous les lieux</option>' +
      refLists.lieux.filter(function (l) { return lieuxPresents[l.id]; }).map(function (l) {
        return '<option value="' + l.id + '"' + (String(l.id) === prevLieu ? ' selected' : '') + '>' + esc(l.nom) + '</option>';
      }).join('');
    lieuVal = lieuSel.value;
  }
  var baseLieu = lieuVal
    ? base.filter(function (m) { return String(m.lieu_stockage || '') === lieuVal; })
    : base;

  /* on ne propose que les categories qui ont effectivement du materiel eligible
     (dans le lieu choisi, s'il y en a un) */
  var catsPresentes = {};
  baseLieu.forEach(function (m) {
    var l = lotById[m.lot];
    if (l && l.categorie) catsPresentes[l.categorie] = true;
  });
  var catVal = catSel.value;
  catSel.innerHTML = '<option value="">Toutes</option>' +
    refLists.categories.filter(function (c) { return catsPresentes[c.id]; }).map(function (c) {
      return '<option value="' + c.id + '"' + (String(c.id) === catVal ? ' selected' : '') + '>' + esc(c.nom) + '</option>';
    }).join('');
  catVal = catSel.value;

  var lotsPresents = {};
  baseLieu.forEach(function (m) {
    var l = lotById[m.lot];
    if (!l) return;
    if (catVal && String(l.categorie) !== catVal) return;
    lotsPresents[l.id] = true;
  });
  var lotVal = lotSel.value;
  lotSel.innerHTML = optionsLotsGroupes(
    refLists.lots.filter(function (l) { return lotsPresents[l.id]; }), lotVal,
    '<option value="">Tous</option>');
  lotVal = lotSel.value;

  var rechEl = document.getElementById(prefix + 'Recherche');
  var terme = rechEl ? rechEl.value.trim().toLowerCase() : '';
  function correspond(m) {
    var l = lotById[m.lot];
    if (catVal && (!l || String(l.categorie) !== catVal)) return false;
    if (lotVal && String(m.lot) !== lotVal) return false;
    if (terme) {
      /* meme cible que la recherche de l'onglet Materiel : marquage, nom du
         lot, fabricant, modele. Avant 2026.5.3 : marquage et lot seulement,
         alors que l'invite annoncait "marquage ou modele". */
      var cible = ((m.numero_marquage || '') + ' ' + (m.numero_serie || '') + ' ' +
        (l ? (l.designation || '') + ' ' + (l.fabricant || '') + ' ' + (l.modele || '') : '')).toLowerCase();
      if (cible.indexOf(terme) === -1) return false;
    }
    return true;
  }
  /* Ce qui correspondrait aux autres filtres mais est range dans un AUTRE
     lieu : compte par lieu, affiche sous la liste par majAilleurs(). */
  var ailleurs = {};
  /* seulement quand on cherche quelque chose de precis : sans autre filtre,
     annoncer "tout le reste est ailleurs" serait du bruit */
  if (lieuVal && (catVal || lotVal || terme)) {
    base.forEach(function (m) {
      if (String(m.lieu_stockage || '') === lieuVal || !correspond(m)) return;
      var cle = m.lieu_stockage || 0;
      ailleurs[cle] = (ailleurs[cle] || 0) + 1;
    });
  }
  materielAilleurs[prefix] = ailleurs;
  return baseLieu.filter(correspond);
}

/* Materiel eligible range hors du lieu filtre, par prefixe : { idLieu: nombre } */
var materielAilleurs = {};

/* Ligne d'information sous la liste a cocher : dit ou se trouve le materiel
   que le filtre de lieu masque. Vide (et masquee) sinon. Appelee aux DEUX
   sorties de majListeSelectionnable (lecon du 22/08 : la sortie anticipee
   doit aussi remettre a zero ce qu'elle n'affiche pas). */
function majAilleurs(prefix, zone) {
  if (!document.getElementById(prefix + 'FiltreLieu') || !zone) return;
  var el = document.getElementById(prefix + '-ailleurs');
  if (!el) {
    el = document.createElement('p');
    el.id = prefix + '-ailleurs';
    el.className = 'hint';
    el.style.margin = '6px 4px 0';
    zone.insertAdjacentElement('afterend', el);
  }
  var a = materielAilleurs[prefix] || {};
  var cles = Object.keys(a);
  if (!cles.length) { el.hidden = true; el.textContent = ''; return; }
  var lieuMap = mapById(refLists.lieux, 'nom');
  var total = cles.reduce(function (t, k) { return t + a[k]; }, 0);
  el.hidden = false;
  el.textContent = total + ' autre' + (total > 1 ? 's' : '') + ' exemplaire' + (total > 1 ? 's' : '') +
    ' disponible' + (total > 1 ? 's' : '') + ' ailleurs : ' +
    cles.map(function (k) { return (k === '0' ? 'sans lieu' : (lieuMap[k] || 'lieu ' + k)) + ' (' + a[k] + ')'; }).join(', ') +
    '. Choisissez \u00ab\u00a0Tous les lieux\u00a0\u00bb ou le bon lieu pour les voir.';
}


/* Liste a cocher du formulaire de pret : une sortie club, c'est dix
   baudriers d'un coup, pas dix formulaires. */
/* --- Selection persistante partagee (pret + fiche d'emprunt) ---
   La selection ne vit PAS dans les cases a cocher (detruites a chaque filtre)
   mais dans cet etat, indexe par prefixe de formulaire. On peut donc filtrer
   par categorie, cocher, refiltrer, cocher encore : rien n'est perdu. Une zone
   recapitule en permanence ce qui est choisi, meme filtre hors de la vue. */
var SELECTION = { pr: {}, be: {}, ct: {}, in: {}, rep: {}, ent: {} };
var SELECTION_BTN = {
  pr: { id: 'btnSubmitPret', sans: 'Enregistrer le bon', avec: 'Enregistrer le bon' },
  be: { id: 'beVoidBtn', sans: '', avec: '' },
  ct: { id: 'btnSubmitCtrl', sans: 'Enregistrer', avec: 'Enregistrer le contrôle' },
  in: { id: 'btnSubmitInc', sans: 'Enregistrer', avec: 'Enregistrer l\'incident' },
  rep: { id: 'btnSubmitRep', sans: 'Enregistrer', avec: 'Enregistrer la r\u00e9paration' },
  ent: { id: 'btnSubmitEnt', sans: 'Enregistrer', avec: 'Enregistrer l\u2019entretien' }
};

function idsSelectionnes(prefix) {
  return Object.keys(SELECTION[prefix]).map(Number);
}
function viderSelection(prefix) { SELECTION[prefix] = {}; }

var SEUIL_LISTE = 12;   /* au-dela, on n'affiche pas le mur : on demande de filtrer/chercher */

function majListeSelectionnable(prefix) {
  var zone = document.getElementById(prefix + 'Liste');
  var filtres = materielsFiltresCascade(prefix);   /* reconstruit aussi les menus cat/lot */
  if (!zone || !filtres) return;
  var catEl = document.getElementById(prefix + 'FiltreCat');
  var lotEl = document.getElementById(prefix + 'FiltreLot');
  var rechEl = document.getElementById(prefix + 'Recherche');
  var lieuEl = document.getElementById(prefix + 'FiltreLieu');
  var actif = (catEl && catEl.value) || (lotEl && lotEl.value) || (rechEl && rechEl.value.trim()) || (lieuEl && lieuEl.value);
  if (!actif && filtres.length > SEUIL_LISTE) {
    zone.innerHTML = '<p class="hint" style="margin:6px 4px">' + filtres.length +
      ' matériels disponibles. Choisissez une catégorie ou un lot, ou tapez une recherche, pour les afficher.</p>';
    majResumeSelection(prefix);
    majAilleurs(prefix, zone);
    if (prefix === 'rep') {
      var panneauVide = document.getElementById('repPanneauCategorie');
      if (panneauVide) panneauVide.innerHTML = '';
      /* Meme piege que plus bas : sans filtre actif, aucune categorie n'est
         determinable, donc "Decoupee" ne doit jamais rester affiche ici —
         mais cette branche sort AVANT le code qui recalcule et reconstruit
         la zone d'etat. Sans ce repli explicite, revenir sur "Toutes" apres
         avoir filtre sur une categorie decoupable laissait "Decoupee"
         visible a tort (verifie et corrige le 22/08). */
      var zoneEtatVide = document.getElementById(prefix + 'ZoneEtat');
      if (zoneEtatVide && zoneEtatVide.dataset.decoupeSignature !== 'normal') {
        zoneEtatVide.outerHTML = blocEtatRadios(prefix, null);
        var zoneReset = document.getElementById(prefix + 'ZoneEtat');
        if (zoneReset) zoneReset.dataset.decoupeSignature = 'normal';
        brancherEtatReparation(prefix);
      }
    }
    return;
  }
  /* "Declarer une reparation" : l'eligibilite depend de ce qui est VISIBLE
     (le filtre), pas de ce qui est COCHE — l'avertissement apparait des
     qu'une categorie fermee entre dans la liste affichee, avant meme
     d'avoir touche une case, et ses exemplaires sont grises/decoches
     d'office plutot que cochables puis a decocher apres avertissement. */
  var estFermeRep = {};
  var decoupeActif = false;
  if (prefix === 'rep') {
    filtres.forEach(function (m) {
      var cat = categorieDeMateriel(m);
      estFermeRep[m.id] = !!(cat && !reparationOuverte(cat));
    });
    var idsVisibles = filtres.map(function (m) { return m.id; });
    var decoupeInfo = eligibiliteDecoupeVisible(idsVisibles);
    var toutFerme = toutFermeVisible(idsVisibles);
    /* Meme suppression qu'a la construction initiale (formulaireDeclarerReparation) :
       le message neutre de blocEtatRadios remplace l'avertissement "fermee"
       dans le cas decoupable-seul, ne pas les cumuler. Le panneau reste
       affiche quand toutFerme : c'est la seule explication dans ce cas. */
    var panneau = document.getElementById('repPanneauCategorie');
    if (panneau) panneau.innerHTML = (decoupeInfo && !decoupeInfo.reparable) ? '' : panneauCategoriePourReparation(idsVisibles);
    /* La zone d'etat ne se reconstruit QUE si l'eligibilite a reellement
       change (signature comparee) — jamais a chaque frappe dans la
       recherche : reconstruire a chaque filtre effacerait un choix deja
       fait (ex. "Deja effectuee" coche, puis on tape dans Rechercher —
       la case ne doit pas revenir sur "A prevoir" sans raison). */
    var signature = toutFerme ? 'ferme' : (decoupeInfo ? (decoupeInfo.reparable ? 'les-deux' : 'decoupee-seule') : 'normal');
    var zoneEtat = document.getElementById(prefix + 'ZoneEtat');
    if (zoneEtat && zoneEtat.dataset.decoupeSignature !== signature) {
      zoneEtat.outerHTML = blocEtatRadios(prefix, decoupeInfo, toutFerme);
      var nouvelleZone = document.getElementById(prefix + 'ZoneEtat');
      if (nouvelleZone) nouvelleZone.dataset.decoupeSignature = signature;
      brancherEtatReparation(prefix);
    }
    var rDecCourant = document.getElementById(prefix + 'EtatDecoupee');
    decoupeActif = !!(rDecCourant && rDecCourant.checked);
  }
  /* Mode "Decoupee" : selection unique (radio), pas multiple (checkbox) —
     et cocher l'exemplaire ouvre directement la fenetre de decoupe, sans
     bouton "Enregistrer" intermediaire qui n'aurait pas de sens ici. */
  zone.innerHTML = filtres.length
    ? filtres.map(function (m) {
        var ferme = prefix === 'rep' && estFermeRep[m.id] && !decoupeActif;
        if (ferme) delete SELECTION[prefix][m.id];   /* jamais coche si ferme, meme apres un changement de filtre */
        if (decoupeActif) {
          return '<label class="coche">' +
            '<input type="radio" name="' + prefix + 'DecoupeChoix" class="' + prefix + '-item" value="' + m.id + '"' +
            (SELECTION[prefix][m.id] ? ' checked' : '') + '> ' + esc(libelleMateriel(m)) + '</label>';
        }
        return '<label class="coche' + (ferme ? ' coche-desactivee' : '') + '"' +
          (ferme ? ' title="R\u00e9paration non autoris\u00e9e pour cette cat\u00e9gorie \u2014 voir Listes du club"' : '') + '>' +
          '<input type="checkbox" class="' + prefix + '-item" value="' + m.id + '"' +
          (ferme ? ' disabled' : '') +
          (SELECTION[prefix][m.id] ? ' checked' : '') + '> ' + esc(libelleMateriel(m)) + '</label>';
      }).join('')
    : '<p class="hint" style="margin:4px">Aucun matériel disponible avec ces filtres.</p>';
  majAilleurs(prefix, zone);
  zone.querySelectorAll('.' + prefix + '-item').forEach(function (c) {
    c.onchange = function () {
      if (decoupeActif) {
        /* Le radio natif garantit deja qu'un seul input est coche dans le
           DOM, mais SELECTION[prefix] doit refleter EXACTEMENT ce choix
           unique — pas accumuler d'anciennes entrees d'une selection
           multiple precedente (avant le passage en mode Decoupee). */
        SELECTION[prefix] = {};
        SELECTION[prefix][c.value] = true;
        majResumeSelection(prefix);
        ouvrirFenetreDecoupe(Number(c.value));
        return;
      }
      if (c.checked) SELECTION[prefix][c.value] = true; else delete SELECTION[prefix][c.value];
      majResumeSelection(prefix);
    };
  });
  majResumeSelection(prefix);
}

function majResumeSelection(prefix) {
  /* Le bloc de prolongation depend de CE QUI EST COCHE : a recalculer a chaque
     changement de selection (coche, x sur une etiquette, Vider, Tout cocher),
     pas seulement au rendu de la liste. Bug du 07/10 : les coches a la main ne
     passaient que par ici, le bloc restait masque. */
  majProlongation(prefix);
  var ids = idsSelectionnes(prefix);
  var cfg = SELECTION_BTN[prefix];
  var b = document.getElementById(cfg.id);
  if (b) b.textContent = ids.length
    ? cfg.avec + ' (' + ids.length + ' matériel' + (ids.length > 1 ? 's' : '') + ')'
    : cfg.sans;
  var zone = document.getElementById(prefix + 'Resume');
  if (!zone) return;
  if (!ids.length) { zone.hidden = true; zone.innerHTML = ''; return; }
  var matById = {};
  refLists.materiels.forEach(function (m) { matById[m.id] = m; });
  zone.hidden = false;
  zone.innerHTML = '<span class="sel-titre">Sélection (' + ids.length + ')&nbsp;:</span> ' +
    ids.map(function (id) {
      var m = matById[id];
      return '<span class="sel-chip" data-id="' + id + '">' +
        esc(m ? (m.numero_marquage || '#' + id) : '#' + id) + ' <b>&times;</b></span>';
    }).join(' ') +
    ' <a class="sel-vider">Vider</a>';
  zone.querySelectorAll('.sel-chip').forEach(function (ch) {
    ch.onclick = function () { delete SELECTION[prefix][ch.dataset.id]; majListeSelectionnable(prefix); };
  });
  var v = zone.querySelector('.sel-vider');
  if (v) v.onclick = function () { viderSelection(prefix); majListeSelectionnable(prefix); };
}

/* wrappers historiques (memes noms, meme role) */
function majListePret() { majListeSelectionnable('pr'); }

function brancherFiltres(prefix, majListe) {
  var catEl = document.getElementById(prefix + 'FiltreCat');
  var lotEl = document.getElementById(prefix + 'FiltreLot');
  var lieuEl = document.getElementById(prefix + 'FiltreLieu');
  if (lieuEl) lieuEl.onchange = majListe;
  /* Categorie et lot restent coherents (07/10) :
     - choisir un lot directement regle la categorie sur la sienne (l'option
       existe : un lot n'est propose que si sa categorie l'est aussi) ;
     - revenir a "Toutes" efface le lot, sinon le lot encore choisi
       ramenerait aussitot sa categorie et "Toutes" serait inatteignable ;
     - choisir une autre categorie retire le lot (deja le cas via la cascade). */
  if (catEl) catEl.onchange = function () {
    if (!catEl.value && lotEl) lotEl.value = '';
    majListe();
  };
  if (lotEl) lotEl.onchange = function () {
    if (lotEl.value && catEl) {
      var lot = refLists.lots.filter(function (l) { return String(l.id) === lotEl.value; })[0];
      if (lot && lot.categorie) catEl.value = String(lot.categorie);
    }
    majListe();
  };
  var rech = document.getElementById(prefix + 'Recherche');
  if (rech) rech.oninput = majListe;
}

/* ---------------------- suppression ---------------------- */

/* Toujours visible : le garde-fou est le panneau de confirmation
   (impacts detailles + mot SUPPRIMER a taper), pas le masquage. */
function btnSupprimer(entity, id) {
  return '<button class="danger btn-del" data-ent="' + entity + '" data-id="' + id + '">Supprimer</button>';
}

/* ---------------------- suppression ---------------------- */

function libMateriel(refId) {
  return mapById(rawRows.materiels, 'numero_marquage')[refId] || ('#' + refId);
}
function libAdherent(refId) {
  return mapById(refLists.adherents, 'nom_complet')[refId] || '';
}
function p13(txt) { return '<p style="font-size:13px;margin:0 0 8px">' + txt + '</p>'; }

/* recense ce qui disparaitra en cascade */
function impactSuppression(entity, id) {
  var imp = { matIds: [], lots: [], controles: [], emprunts: [], incidents: [], entretiens: [], reparations: [] };
  if (entity === 'achat') {
    imp.lots = rawRows.lots.filter(function (l) { return l.achat === id; });
    return imp;
  }
  /* un controle, un incident ou un pret ne porte aucune dependance */
  if (entity !== 'lot' && entity !== 'materiel') return imp;

  imp.matIds = (entity === 'materiel')
    ? [id]
    : rawRows.materiels.filter(function (m) { return m.lot === id; }).map(function (m) { return m.id; });
  imp.controles = rawRows.controles.filter(function (c) { return imp.matIds.indexOf(c.materiel) !== -1; });
  imp.emprunts = rawRows.emprunts.filter(function (e) { return imp.matIds.indexOf(e.materiel) !== -1; });
  imp.incidents = rawRows.incidents.filter(function (i) { return imp.matIds.indexOf(i.materiel) !== -1; });
  imp.reparations = resolvedNames.reparations
    ? (rawRows.reparations || []).filter(function (r) { return imp.matIds.indexOf(r.materiel) !== -1; })
    : [];
  imp.entretiens = resolvedNames.entretiens
    ? (rawRows.entretiens || []).filter(function (e) { return imp.matIds.indexOf(e.materiel) !== -1; })
    : [];
  return imp;
}

function avertissementCascade(imp) {
  var pertes = [];
  if (imp.controles.length) pertes.push(imp.controles.length + ' contrôle(s) EPI');
  if (imp.incidents.length) pertes.push(imp.incidents.length + ' incident(s)');
  if (imp.emprunts.length) pertes.push(imp.emprunts.length + ' prêt(s)');
  if (imp.reparations && imp.reparations.length) pertes.push(imp.reparations.length + ' réparation(s)');
  if (imp.entretiens && imp.entretiens.length) pertes.push(imp.entretiens.length + ' entretien(s)');
  if (!pertes.length) {
    return '<p class="hint">Aucun contrôle, incident ni prêt n\'est rattaché : la suppression est ' +
      'sans consequence sur la traçabilité.</p>';
  }
  return p13('Seront également effacés : <b>' + pertes.join(', ') + '</b>.') +
    '<p class="hint">Ces contrôles font partie de la fiche de vie. En cas d\'accident ou de contrôle FFCAM, ' +
    'cette traçabilité ne pourra pas être reconstituee. Pour un matériel sorti de l\'inventaire, ' +
    'le statut "Reforme" ou "Perdu" conserve l\'historique.</p>';
}

var SUPPRIMABLE = {
  lot: {
    key: 'lots', pane: 'materiel-editor', flash: 'lotFlash', succes: 'Lot supprimé.',
    intro: function (r, imp) {
      return 'Le lot <b>' + esc(r.designation) + '</b> et ses ' + imp.matIds.length +
        ' exemplaire(s) seront supprimés.';
    },
    avertissement: avertissementCascade,
    actions: function (id, r, imp) { return actionsCascade(imp).concat([['RemoveRecord', resolvedNames.lots, id]]); }
  },

  materiel: {
    key: 'materiels', pane: 'materiel-editor', flash: 'lotFlash', succes: 'Exemplaire supprimé.',
    intro: function (r, id) { return 'L\'exemplaire <b>' + esc(r.numero_marquage || '#' + r.id) + '</b> sera supprimé.'; },
    avertissement: avertissementCascade,
    actions: function (id, r, imp) { return actionsCascade(imp); }
  },

  achat: {
    key: 'achats', pane: 'budget-editor', flash: 'budgetFlash', succes: 'Commande supprimée.',
    intro: function (r) { return 'La commande <b>' + esc(r.ref_commande || '#' + r.id) + '</b> sera supprimée.'; },
    avertissement: function (imp) {
      /* on ne detruit pas les lots : le materiel existe physiquement */
      if (!imp.lots.length) {
        return '<p class="hint">Aucun lot n\'est rattache à cette commande : la suppression est sans consequence.</p>';
      }
      return p13('<b>' + imp.lots.length + ' lot(s)</b> rattaché(s) (' +
        imp.lots.map(function (l) { return esc(l.designation); }).join(', ') +
        ') ne seront <b>pas</b> supprimés, mais perdront leur lien vers l\'achat.') +
        '<p class="hint">Le montant disparaîtra du suivi budgétaire. Le matériel, lui, reste en inventaire.</p>';
    },
    actions: function (id, r, imp) {
      var a = [];
      if (imp.lots.length) {
        var lotIds = imp.lots.map(function (l) { return l.id; });
        a.push(['BulkUpdateRecord', resolvedNames.lots, lotIds, { achat: lotIds.map(function () { return null; }) }]);
      }
      a.push(['RemoveRecord', resolvedNames.achats, id]);
      return a;
    }
  },

  controle: {
    key: 'controles', pane: 'controles-editor', flash: 'ctFlash', succes: 'Contrôle supprimé.',
    intro: function (r) {
      return 'Le contrôle de <b>' + esc(libMateriel(r.materiel)) + '</b> du ' +
        fmtDate(r.date_controle) + ' (' + esc(r.resultat || '-') + ') sera supprimé.';
    },
    avertissement: function (imp, r) {
      var txt = '<p class="hint">Ce contrôle disparaîtra de la fiche de vie de l\'exemplaire. En cas d\'accident ' +
        'ou de contrôle FFCAM, cette trace ne pourra pas être reconstituee.</p>';
      var autres = rawRows.controles.filter(function (c) {
        return c.materiel === r.materiel && c.id !== r.id;
      }).length;
      if (!autres) {
        txt += p13('C\'est le <b>seul contrôle</b> de cet exemplaire : il repassera en "jamais contrôle" ' +
          'et remontera dans les alertes.');
      }
      txt += '<p class="hint">Le statut du matériel n\'est <b>pas</b> rétabli : si ce contrôle l\'avait ' +
        'reforme ou mis en contrôle, il le restera. Corrigez-le à la main si besoin.</p>';
      return txt;
    },
    actions: function (id) { return [['RemoveRecord', resolvedNames.controles, id]]; }
  },

  incident: {
    key: 'incidents', pane: 'incidents-editor', flash: 'incFlash', succes: 'Incident supprimé.',
    intro: function (r) {
      return 'L\'incident du ' + fmtDate(r.date_incident) + ' sur <b>' +
        esc(libMateriel(r.materiel)) + '</b> (' + esc(r.gravite || '-') + ') sera supprimé.';
    },
    avertissement: function () {
      return '<p class="hint">L\'incident disparaîtra de la fiche de vie. Le statut du matériel n\'est ' +
        '<b>pas</b> rétabli : s\'il avait été retire du circuit, il reste "Examen requis".</p>';
    },
    actions: function (id) { return [['RemoveRecord', resolvedNames.incidents, id]]; }
  },

  emprunt: {
    key: 'emprunts', pane: 'prets-editor', flash: 'prFlash', succes: 'Prêt supprimé.',
    intro: function (r) {
      var adh = libAdherent(r.adherent);
      return 'Le prêt de <b>' + esc(libMateriel(r.materiel)) + '</b>' +
        (adh ? ' a ' + esc(adh) : '') + ' du ' + fmtDate(r.date_emprunt) + ' sera supprimé.';
    },
    avertissement: function (imp, r) {
      /* le piege : sans cela l'exemplaire resterait "Prete" sans pret pour le justifier */
      if (!r.date_retour_effective && r.materiel) {
        return p13('<b>Ce prêt est en cours.</b> L\'exemplaire redeviendra disponible : son statut ' +
          'découle des prêts ouverts, il n\'y a rien a corriger à la main.');
      }
      return '<p class="hint">Ce prêt est clos : sa suppression efface une ligne d\'historique, ' +
        'sans effet sur le statut du matériel.</p>';
    },
    actions: function (id) { return [['RemoveRecord', resolvedNames.emprunts, id]]; }
  },

  entretien: {
    key: 'entretiens', pane: 'entretiens-editor', flash: 'entFlash', succes: 'Entretien supprim\u00e9.',
    intro: function (r) {
      return 'L\u2019entretien du ' + fmtDate(r.date_entretien) + ' sur <b>' +
        esc(libMateriel(r.materiel)) + '</b> sera supprim\u00e9.';
    },
    avertissement: function () {
      return '<p class="hint">Il dispara\u00eetra de la fiche de vie de l\u2019exemplaire. Rien d\u2019autre ' +
        'ne change : un entretien n\u2019a d\u00e9cid\u00e9 ni du statut ni de la date du prochain contr\u00f4le.</p>';
    },
    actions: function (id) { return [['RemoveRecord', resolvedNames.entretiens, id]]; }
  }
};

/* Une reference encore utilisee ne se supprime pas : on refuserait de
   recreer les references orphelines qu'on vient de payer si cher. */
function usagesReference(entity, id) {
  var u = [];
  function compte(rows, col, libelle) {
    var c = (rows || []).filter(function (r) { return r[col] === id; }).length;
    if (c) u.push(c + ' ' + libelle);
  }
  if (entity === 'categorie') compte(rawRows.lots, 'categorie', 'lot(s)');
  if (entity === 'lieu') compte(rawRows.materiels, 'lieu_stockage', 'exemplaire(s)');
  if (entity === 'fournisseur') compte(rawRows.achats, 'fournisseur', 'commande(s)');
  if (entity === 'adherent') {
    compte(rawRows.emprunts, 'adherent', 'pret(s)');
    compte(rawRows.controles, 'controleur', 'controle(s)');
  }
  return u;
}

function configSuppressionReference(entity, key, libelle, colNom) {
  return {
    key: key, pane: 'refs-editor', flash: 'refsFlash', succes: libelle + ' supprime(e).',
    intro: function (r) { return libelle + ' <b>' + esc(r[colNom] || '#' + r.id) + '</b> sera supprime(e).'; },
    bloquant: function (id) {
      var u = usagesReference(entity, id);
      if (!u.length) return null;
      return 'Impossible de supprimer : encore utilise(e) par <b>' + u.join(', ') + '</b>. ' +
        'Reaffectez ou supprimez d\'abord ces éléments, ou renommez plutôt que de supprimer.';
    },
    avertissement: function () {
      return '<p class="hint">Aucun élément ne s\'y réfère : la suppression est sans consequence.</p>';
    },
    actions: function (id) { return [['RemoveRecord', resolvedNames[key], id]]; }
  };
}

SUPPRIMABLE.categorie = configSuppressionReference('categorie', 'categories', 'La categorie', 'nom');
SUPPRIMABLE.lieu = configSuppressionReference('lieu', 'lieux', 'Le lieu', 'nom');
SUPPRIMABLE.fournisseur = configSuppressionReference('fournisseur', 'fournisseurs', 'Le fournisseur', 'nom');
SUPPRIMABLE.adherent = configSuppressionReference('adherent', 'adherents', 'L\'adherent', 'nom_complet');

/* dependances d'abord, sinon on laisse des references orphelines */
function actionsCascade(imp) {
  var a = [];
  if (imp.controles.length) a.push(['BulkRemoveRecord', resolvedNames.controles,
    imp.controles.map(function (c) { return c.id; })]);
  if (imp.incidents.length) a.push(['BulkRemoveRecord', resolvedNames.incidents,
    imp.incidents.map(function (i) { return i.id; })]);
  if (imp.emprunts.length) a.push(['BulkRemoveRecord', resolvedNames.emprunts,
    imp.emprunts.map(function (e) { return e.id; })]);
  if (imp.reparations && imp.reparations.length) a.push(['BulkRemoveRecord', resolvedNames.reparations,
    imp.reparations.map(function (r) { return r.id; })]);
  if (imp.entretiens && imp.entretiens.length) a.push(['BulkRemoveRecord', resolvedNames.entretiens,
    imp.entretiens.map(function (e) { return e.id; })]);
  if (imp.matIds.length) a.push(['BulkRemoveRecord', resolvedNames.materiels, imp.matIds]);
  return a;
}

function demanderSuppression(entity, id) {
  var cfg = SUPPRIMABLE[entity];
  if (!cfg) return;
  var box = document.getElementById(cfg.pane);
  var row = (rawRows[cfg.key] || []).filter(function (r) { return r.id === id; })[0];
  if (!box || !row) return;

  /* certaines suppressions sont interdites tant que des elements s'y referent */
  if (cfg.bloquant) {
    var motifBlocage = cfg.bloquant(id);
    if (motifBlocage) {
      fermerEditeurs();
      box.innerHTML =
        '<div class="form-panel" style="border-top-color:var(--red);background:#FDF6F6">' +
          '<h4 style="margin:0 0 8px;font-size:13px;color:var(--red)">Suppression impossible</h4>' +
          p13(motifBlocage) +
          '<div class="form-actions"><button class="secondary del-cancel">Fermer</button></div>' +
        '</div>';
      defilerVers(box, { block: 'nearest' });
      box.querySelector('.del-cancel').onclick = function () { box.innerHTML = ''; };
      return;
    }
  }

  var imp = impactSuppression(entity, id);
  fermerEditeurs();
  box.innerHTML =
    '<div class="form-panel" style="border-top-color:var(--red);background:#FDF6F6">' +
      '<h4 style="margin:0 0 8px;font-size:13px;color:var(--red)">Suppression définitive</h4>' +
      p13(cfg.intro(row, imp)) +
      cfg.avertissement(imp, row) +
      p13('Tapez <b>SUPPRIMER</b> pour confirmer :') +
      '<input class="del-confirm" type="text" style="max-width:200px" autocomplete="off">' +
      '<div class="form-actions">' +
        '<button class="danger-plein del-go">Supprimer définitivement</button>' +
        '<button class="secondary del-cancel">Annuler</button>' +
        '<span class="del-msg form-msg"></span>' +
      '</div>' +
    '</div>';
  defilerVers(box, { block: 'nearest' });
  box.querySelector('.del-cancel').onclick = function () { box.innerHTML = ''; };
  box.querySelector('.del-go').onclick = function () { executerSuppression(entity, id); };
}

async function executerSuppression(entity, id) {
  var cfg = SUPPRIMABLE[entity];
  var box = document.getElementById(cfg.pane);
  var msg = box.querySelector('.del-msg');
  if (box.querySelector('.del-confirm').value.trim().toUpperCase() !== 'SUPPRIMER') {
    msg.textContent = 'Tapez SUPPRIMER pour confirmer.';
    msg.style.color = '#a3242a';
    return;
  }
  var row = (rawRows[cfg.key] || []).filter(function (r) { return r.id === id; })[0] || {};
  var imp = impactSuppression(entity, id);
  msg.textContent = 'Suppression...';
  msg.style.color = '#666';
  try {
    await appliquer(cfg.actions(id, row, imp));
    box.innerHTML = '';
    flashToast(cfg.succes);
    setTimeout(function () { load(); }, 100);
  } catch (e) {
    msg.textContent = 'Erreur : ' + e.message;
    msg.style.color = '#a3242a';
    console.error(e);
  }
}


/* ---------------------- rattachement des orphelins ---------------------- */

function ouvrirRattachement() {
  var box = document.getElementById('materiel-editor');
  if (!box) {
    afficherErreurGlobale('Conteneur "matériel-editor" absent : le panneau HTML du widget n\'est pas à jour.');
    return;
  }
  var orphelins = rawRows.materiels.filter(function (m) { return !m.lot; });
  /* ces deux cas rendaient le bouton inerte sans rien dire */
  if (!orphelins.length) {
    flash('lotFlash', 'Aucun exemplaire orphelin à rattacher.');
    return;
  }
  if (!refLists.lots.length) {
    flash('lotFlash', 'Aucun lot n\'existe encore : créez-en un avant de rattacher.');
    return;
  }
  fermerEditeurs();

  box.innerHTML =
    '<div class="form-panel">' +
      enteteFenetre('Rattacher \u00e0 un lot', orphelins.length + ' exemplaire' + (orphelins.length > 1 ? 's' : '') + ' sans lot') +
      '<p class="hint">Cochez les exemplaires à rattacher, puis choisissez le lot de destination. ' +
        'Ils hériteront aussitôt de son fabricant, de sa date de fabrication et de sa fin de vie.</p>' +
      '<div class="form-grid" style="grid-template-columns:1fr">' +
        '<div class="form-field"><label>Lot de destination</label>' +
          '<select id="ratLot">' + optionsLotsGroupes(refLists.lots, null, '<option value="">-</option>') + '</select></div>' +
      '</div>' +
      '<div style="margin-top:12px">' +
        '<label style="font-size:12px;display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:8px">' +
          '<input type="checkbox" id="ratTous" checked> <b>Tout cocher / décocher</b>' +
        '</label>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;' +
          'max-height:220px;overflow:auto;padding:10px;background:var(--ice,#f4f4f2);border-radius:6px">' +
          orphelins.map(function (m) {
            return '<label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer">' +
              '<input type="checkbox" class="rat-item" value="' + m.id + '" checked> ' +
              esc(m.numero_marquage || '#' + m.id) + '</label>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="form-actions">' +
        '<button id="ratGo">Rattacher</button>' +
        '<button class="secondary" id="ratCancel">Annuler</button>' +
        '<span id="ratMsg" class="form-msg"></span>' +
      '</div>' +
    '</div>';
  defilerVers(box, { block: 'nearest' });

  document.getElementById('ratCancel').onclick = function () { box.innerHTML = ''; };
  document.getElementById('ratTous').onchange = function () {
    var etat = this.checked;
    box.querySelectorAll('.rat-item').forEach(function (c) { c.checked = etat; });
  };
  document.getElementById('ratGo').onclick = function () { executerRattachement(); };
}

async function executerRattachement() {
  var box = document.getElementById('materiel-editor');
  var msg = document.getElementById('ratMsg');
  var lotVal = document.getElementById('ratLot').value;
  if (!lotVal) {
    msg.textContent = 'Choisissez un lot de destination.';
    msg.style.color = '#a3242a';
    return;
  }
  var ids = Array.prototype.slice.call(box.querySelectorAll('.rat-item:checked'))
    .map(function (c) { return Number(c.value); });
  if (!ids.length) {
    msg.textContent = 'Cochez au moins un exemplaire.';
    msg.style.color = '#a3242a';
    return;
  }
  var lotId = Number(lotVal);
  msg.textContent = 'Rattachement...'; msg.style.color = '#666';
  try {
    await appliquer([['BulkUpdateRecord', resolvedNames.materiels, ids,
      { lot: ids.map(function () { return lotId; }) }]]);
    /* on relit : c'est precisement cette ecriture qui avait echoue en silence */
    var relu = await lireValeur('materiels', ids[0], 'lot');
    if (relu !== lotId) {
      msg.innerHTML = 'Le rattachement n\'a pas pris. Attendu : <b>' + lotId +
        '</b> — relu : <b>' + esc(String(relu)) + '</b>. Vérifiez que la colonne "lot" de ' +
        esc(resolvedNames.materiels) + ' est bien de type Référence vers ' + esc(resolvedNames.lots) + '.';
      msg.style.color = '#a3242a';
      return;
    }
    box.innerHTML = '';
    openLots[lotId] = true;
    flash('lotFlash', ids.length + ' exemplaire(s) rattaché(s).');
    await load();
  } catch (e) {
    msg.textContent = 'Erreur : ' + e.message;
    msg.style.color = '#a3242a';
    console.error(e);
  }
}

/* Applique CONFIG a l'interface : titres, credits, couleurs. Idempotent. */
/* un texte de titre ne doit jamais etre un nombre seul : ce serait le signe
   d'une colonne mal lue. On refuse, pour ne pas defigurer l'en-tete. */
function texteValide(v) {
  var s = String(v == null ? '' : v).trim();
  return s !== '' && !/^\d+$/.test(s);
}
function couleurValide(v) {
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(v == null ? '' : v).trim());
}

function appliquerConfig() {
  function pose(sel, texte) {
    var el = document.querySelector(sel);
    if (el && texteValide(texte)) el.textContent = texte;
  }
  pose('.header-titles h1', CONFIG.titre_appli);
  pose('.header-titles .subtitle', CONFIG.sous_titre);
  pose('.apropos-nom', CONFIG.auteur);
  if (texteValide(CONFIG.nom_club)) {
    var desc = document.querySelector('.apropos-desc');
    if (desc) desc.textContent = CONFIG.description + ' — ' + CONFIG.nom_club + ' — ' + CONFIG.annee;
    var credit = document.querySelector('.credits-inner b');
    if (credit) credit.textContent = CONFIG.nom_club;
    /* bandeau d'accueil de l'aide : seule la ligne du club est paramétrable,
       le nom et la baseline du logiciel ne le sont pas */
    var heroClub = document.getElementById('heroClub');
    if (heroClub) heroClub.textContent = CONFIG.nom_club;
  }
  var mail = document.querySelector('.apropos-pied span');
  if (mail && CONFIG.email_contact && texteValide(CONFIG.email_contact)) mail.innerHTML = '✉ <a href="mailto:' + esc(CONFIG.email_contact) + '">' + esc(CONFIG.email_contact) + '</a>';
  var annee = document.querySelectorAll('.apropos-pied span')[1];
  if (annee && String(CONFIG.annee).trim()) annee.textContent = CONFIG.annee;

  /* mention "duree de vie <FEDE>" du bandeau : branchee sur le sous-titre (partie apres le dernier « · »),
     pour eviter un champ de plus. Pas de « · » -> version neutre, jamais fausse. */
  /* La mention de vetuste a ete retiree du bandeau (lecture allegee) :
     l'information reste dans l'aide. Le bloc est conserve, sans effet si
     l'element est absent, au cas ou un habillage le reintroduirait. */
  var cv = document.getElementById('creditsVetuste');
  if (cv) {
    var st = String(CONFIG.sous_titre || '').trim();
    var parts = st.split(/[\u00b7\u2022]/);   /* · ou • */
    var fede = parts.length > 1 ? parts[parts.length - 1].trim() : '';
    cv.textContent = fede
      ? 'Vétusté selon les durées de vie ' + fede
      : 'Vétusté selon les durées de vie des EPI';
  }

  /* couleurs : uniquement un vrai code hexadecimal, sinon on garde la charte */
  var root = document.documentElement;
  if (couleurValide(CONFIG.couleur_principale)) root.style.setProperty('--navy', CONFIG.couleur_principale);
  else root.style.removeProperty('--navy');   /* vide/invalide -> retour a la charte */
  if (couleurValide(CONFIG.couleur_accent)) root.style.setProperty('--red', CONFIG.couleur_accent);
  else root.style.removeProperty('--red');

  remplirLiensApropos();
  remplirLiensCredits();
}

/* Liens utiles (regles fede, norme...) dans l'A propos. Rien si aucun lien configure.
   Toute adresse sans schema http(s) recoit un https:// -> tolere « ffme.fr/epi » ET
   neutralise un eventuel « javascript: » (qui deviendrait une URL inerte). */
function liensConfigures() {
  var paires = [['lien1_libelle', 'lien1_url'], ['lien2_libelle', 'lien2_url']];
  var res = [];
  paires.forEach(function (pr) {
    var url = String(CONFIG[pr[1]] || '').trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '');  /* tolere « ffme.fr/epi », neutralise « javascript: » */
    var lib = String(CONFIG[pr[0]] || '').trim() || url;
    res.push({ url: url, libelle: lib });
  });
  return res;
}

function remplirLiensApropos() {
  var zone = document.getElementById('aproposLiens');
  var bloc = document.getElementById('aproposReferences');
  if (!zone || !bloc) return;
  var liens = liensConfigures();
  if (!liens.length) { bloc.hidden = true; zone.innerHTML = ''; return; }
  zone.innerHTML = liens.map(function (l) {
    return '<a class="apropos-lien" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.libelle) + '</a>';
  }).join('');
  bloc.hidden = false;
}

/* Memes liens, en version affirmee dans le bandeau du bas (a cote de « A propos »). */
function remplirLiensCredits() {
  var zone = document.getElementById('creditsLiens');
  if (!zone) return;
  zone.innerHTML = liensConfigures().map(function (l) {
    return '<span class="sep">·</span> <a class="credits-lien" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.libelle) + '</a> ';
  }).join('');
}

/* Depuis une carte-chiffre : basculer sur l'onglet Materiel avec un filtre
   deja arme. Un chiffre passif ("3 alertes") devient un point d'entree. */
function ouvrirMaterielFiltre(patch) {
  filtresMat = { q: '', cat: '', lieu: '', statut: '', echu: false, vetuste: false };
  Object.keys(patch).forEach(function (k) { filtresMat[k] = patch[k]; });
  var ong = document.querySelector('.tab[data-t="materiel"]');
  if (ong) ong.click();
  load();
}

/* ---------------------- referentiels ---------------------- */

var BLOCS_REFS = [
  { entity: 'categorie', key: 'categories', titre: 'Catégories', singulier: 'une cat\u00e9gorie',
    colonnes: [
      { label: 'Nom', rendu: function (r) { return esc(r.nom || '-'); } },
      { label: 'Vieillissement', rendu: function (r) { return esc(r.type_epi || '-'); } },
      { label: 'Durée (mois)', rendu: function (r) { return r.duree_vie_defaut_mois || '<span style="color:var(--text-light)">selon contrôle</span>'; } }
    ] },
  { entity: 'lieu', key: 'lieux', titre: 'Lieux de stockage', singulier: 'un lieu de stockage',
    colonnes: [
      { label: 'Nom', rendu: function (r) { return esc(r.nom || '-'); } },
      { label: 'Description', rendu: function (r) { return esc(r.description || ''); } }
    ] },
  { entity: 'fournisseur', key: 'fournisseurs', titre: 'Fournisseurs', singulier: 'un fournisseur',
    colonnes: [
      { label: 'Nom', rendu: function (r) { return esc(r.nom || '-'); } },
      { label: 'Contact', rendu: function (r) { return esc([r.contact, r.telephone].filter(Boolean).join(' - ')); } }
    ] },
  { entity: 'adherent', key: 'adherents', titre: 'Adhérents', singulier: 'un adh\u00e9rent',
    colonnes: [
      { label: 'Nom', rendu: function (r) { return esc(r.nom_complet || '-'); } },
      { label: 'Licence', rendu: function (r) { return esc(r.numero_licence || ''); } },
      { label: 'Rôle', rendu: function (r) {
          return r.role === 'Controleur EPI habilite'
            ? '<span class="badge info">' + esc(r.role) + '</span>'
            : esc(r.role || 'Adherent');
        } }
    ] }
];

/* Meme principe que majSousOngletEPI()/renderControlesActions() : un seul
   bloc affiche a la fois, choisi par sousOngletRefs, avec les 4 compteurs
   toujours visibles sur les boutons de sous-onglet (pas seulement celui de
   l'onglet actif — c'est deja comme ca pour Controles/Incidents). Les cles
   de BLOCS_REFS (categories, lieux, fournisseurs, adherents) sont deliberement
   les memes chaines que data-se des boutons : pas de table de correspondance
   a maintenir en plus. */
function renderRefs() {
  var zone = document.getElementById('refs-list');
  if (!zone) return;
  var b = BLOCS_REFS.filter(function (x) { return x.key === sousOngletRefs; })[0] || BLOCS_REFS[0];
  var rows = rawRows[b.key] || [];
  zone.innerHTML = '<div class="refs-bloc">' +
    '<div style="margin-bottom:10px">' +
      '<button class="btn-ref-add" data-ent="' + b.entity + '">+ Ajouter ' + b.singulier + '</button></div>' +
    '<div class="refs-scroll">' +
    '<table><tr>' + b.colonnes.map(function (c) { return '<th>' + c.label + '</th>'; }).join('') + '<th></th></tr>' +
    (rows.map(function (r) {
      return '<tr>' + b.colonnes.map(function (c) { return '<td>' + c.rendu(r) + '</td>'; }).join('') +
        '<td class="td-actions"><div>' + btnEditer(b.entity, r.id) + btnSupprimer(b.entity, r.id) + '</div></td></tr>';
    }).join('') || '<tr><td colspan="' + (b.colonnes.length + 1) + '" class="hint">Aucune entrée.</td></tr>') +
    '</table></div></div>';
  brancherBoutonsEdit('refs-list');
  document.querySelectorAll('#refs-list .btn-ref-add').forEach(function (btn) {
    btn.onclick = function () { openCreator(btn.dataset.ent); };
  });

  var comptes = {
    categories: 'refsCompteCategories', lieux: 'refsCompteLieux',
    fournisseurs: 'refsCompteFournisseurs', adherents: 'refsCompteAdherents'
  };
  Object.keys(comptes).forEach(function (k) {
    var el = document.getElementById(comptes[k]);
    if (el) el.textContent = (rawRows[k] || []).length || '';
  });

  document.querySelectorAll('#refs-so .sous-onglet').forEach(function (btn) {
    btn.classList.toggle('actif', btn.dataset.se === sousOngletRefs);
    /* reassignation simple (pas addEventListener) : idempotent a chaque
       rendu, meme discipline que majSousOngletEPI et son wiring. */
    btn.onclick = function () {
      sousOngletRefs = btn.dataset.se;
      /* editeur partage entre les 4 entites (voir EDITABLE.*.pane) : le vider
         evite qu'un formulaire ouvert sur une autre liste reste affiche hors
         contexte apres le changement de sous-onglet. */
      var ed = document.getElementById('refs-editor');
      if (ed) ed.innerHTML = '';
      renderRefs();
    };
  });
}

/* ---------------------- commande isolee ---------------------- */

async function creerAchat() {
  var msg = document.getElementById('naMsg');
  var ref = document.getElementById('naRef').value.trim();
  if (!ref) {
    msg.textContent = 'La référence est obligatoire.';
    msg.style.color = '#a3242a';
    return;
  }
  var four = document.getElementById('naFournisseur').value;
  var errNa = erreurDates([{
    avant: document.getElementById('naDateCommande').value,
    apres: document.getElementById('naDateReception').value,
    si: 'La date de réception ne peut pas précéder la date de commande.'
  }]);
  if (errNa) { msg.textContent = errNa; msg.style.color = '#a3242a'; return; }
  msg.textContent = 'Enregistrement...'; msg.style.color = '#666';
  try {
    var champsNa = {
      ref_commande: ref,
      fournisseur: four ? Number(four) : null,
      date_commande: dateToTimestamp(document.getElementById('naDateCommande').value),
      date_reception: dateToTimestamp(document.getElementById('naDateReception').value),
      montant_total: num(document.getElementById('naMontant').value),
      financement: document.getElementById('naFinancement').value
    };
    var naNote = document.getElementById('naNote');
    if (naNote && aColonne('achats', 'note_financement')) champsNa.note_financement = naNote.value.trim();
    await ajouterEtObtenirId('achats', champsNa);
    document.getElementById('formAchat').style.display = 'none';
    ['naRef', 'naDateCommande', 'naDateReception', 'naMontant', 'naNote'].forEach(function (i) {
      var el = document.getElementById(i); if (el) el.value = '';
    });
    msg.textContent = '';
    flash('budgetFlash', 'Commande enregistrée.');
    await load();
  } catch (e) {
    msg.textContent = 'Erreur : ' + e.message;
    msg.style.color = '#a3242a';
    console.error(e);
  }
}

/* ---------------------- diagnostic ---------------------- */

async function lancerDiagnostic() {
  var sortie = document.getElementById('diagSortie');
  sortie.textContent = 'Diagnostic en cours...';
  var L = [];

  L.push('TABLES RESOLUES');
  Object.keys(resolvedNames).forEach(function (k) {
    var cols = colonnesConnues[k];
    L.push('  ' + k.padEnd(14) + ' -> ' + resolvedNames[k] +
      (cols ? '\n' + ''.padEnd(20) + 'colonnes : ' + cols.join(', ') : '   *** INTROUVABLE ***'));
  });

  L.push('');
  L.push('STATUTS DERIVES (aucune colonne stockee, calcul en direct)');
  var valeurs = {};
  rawRows.materiels.forEach(function (m) { valeurs[m._statut] = (valeurs[m._statut] || 0) + 1; });
  L.push('  ' + (Object.keys(valeurs).map(function (v) { return '"' + v + '" x' + valeurs[v]; }).join(', ') || 'aucune ligne'));
  L.push('  colonne "statut" encore dans ' + resolvedNames.materiels + ' : ' +
    (aColonne('materiels', 'statut') ? 'OUI - a supprimer, elle ne sert plus et finira par mentir' : 'non'));
  L.push('  hors_service_motif : ' + (aColonne('materiels', 'hors_service_motif') ? 'ok' : 'MANQUANTE'));
  L.push('  hors_service_date  : ' + (aColonne('materiels', 'hors_service_date') ? 'ok' : 'MANQUANTE'));
  L.push('  suite (INCIDENTS)  : ' + (aColonne('incidents', 'suite') ? 'ok' : 'MANQUANTE'));

  L.push('');
  L.push('TEST D\'ECRITURE REEL');
  var cible = rawRows.materiels[0];
  if (!cible) {
    L.push('  aucun exemplaire : test impossible.');
  } else {
    var origine = cible.lieu_stockage || 0;
    L.push('  cible : ' + (cible.numero_marquage || '#' + cible.id) + ' (id ' + cible.id + ')');
    try {
      var res = await appliquer([['UpdateRecord', resolvedNames.materiels, cible.id, { lieu_stockage: origine }]]);
      L.push('  reponse brute d\'applyUserActions : ' + JSON.stringify(res));
      var relu = await lireValeur('materiels', cible.id, 'lieu_stockage');
      L.push('  relu apres ecriture : ' + JSON.stringify(relu));
      L.push('  => ECRITURE ' + (String(relu) === String(origine) ? 'FONCTIONNELLE' : 'A VERIFIER'));
    } catch (e) {
      L.push('  => ECHEC : ' + e.message);
    }
  }

  L.push('');
  L.push('PERSONNALISATION (table CONFIG)');
  if (!configDiag) {
    L.push('  aucune table CONFIG lue : le widget utilise ses valeurs par defaut.');
  } else {
    L.push('  table "' + configDiag.table + '" lue via colonnes cle="' + configDiag.colCle +
      '", valeur="' + configDiag.colVal + '"');
    L.push('  ' + configDiag.appliquees + ' valeur(s) appliquee(s).');
    if (configDiag.inconnues.length) {
      L.push('  cle(s) ignoree(s) car non reconnue(s) : ' + configDiag.inconnues.join(', '));
      L.push('    (cles valides : ' + Object.keys(CONFIG).join(', ') + ')');
    }
  }
  L.push('');
  L.push('PHOTOS');
  if (!aColonne('lots', 'photo')) {
    L.push('  colonne "photo" absente de LOTS : aucune image affichee (fonctionnement normal).');
    L.push('  Pour en ajouter : creer dans LOTS une colonne "photo" de type Attachments.');
  } else {
    var avecPhoto = rawRows.lots.filter(function (l) { return idsPiecesJointes(l.photo).length; }).length;
    L.push('  LOTS : colonne "photo" presente. ' + avecPhoto + ' lot(s) sur ' + rawRows.lots.length + ' ont une image.');
  }
  if (!aColonne('incidents', 'photo')) {
    L.push('  INCIDENTS : pas de colonne "photo" (facultative, type Attachments).');
  } else {
    var incPhoto = rawRows.incidents.filter(function (i) { return idsPiecesJointes(i.photo).length; }).length;
    L.push('  INCIDENTS : colonne "photo" presente. ' + incPhoto + ' incident(s) sur ' +
      rawRows.incidents.length + ' ont une image.');
  }
  L.push('');
  L.push('MARQUAGES');
  /* doublons : plusieurs exemplaires portant le meme marquage (normalise) */
  var parNorm = {};
  rawRows.materiels.forEach(function (m) {
    var nm = normMarquage(m.numero_marquage);
    if (!nm) return;
    (parNorm[nm] = parNorm[nm] || []).push(m.numero_marquage || '#' + m.id);
  });
  var doublonsM = Object.keys(parNorm).filter(function (k) { return parNorm[k].length > 1; });
  if (!doublonsM.length) {
    L.push('  Aucun doublon de marquage.');
  } else {
    L.push('  ' + doublonsM.length + ' marquage(s) en double :');
    doublonsM.slice(0, 8).forEach(function (k) {
      L.push('    - ' + parNorm[k].join(', '));
    });
    if (doublonsM.length > 8) L.push('    ...');
  }
  /* hors-prefixe : marquage ne commencant pas par le prefixe de sa categorie */
  if (aColonne('categories', 'prefixe')) {
    var prefParCat = {};
    rawRows.categories.forEach(function (c) {
      if (c.prefixe) prefParCat[c.id] = normMarquage(c.prefixe);
    });
    var horsPrefixe = [];
    rawRows.materiels.forEach(function (m) {
      var lot = rawRows.lots.filter(function (l) { return l.id === m.lot; })[0];
      if (!lot) return;
      var pref = prefParCat[lot.categorie];
      if (!pref) return;
      var nm = normMarquage(m.numero_marquage);
      if (nm && nm.indexOf(pref) !== 0) horsPrefixe.push(m.numero_marquage || '#' + m.id);
    });
    if (!horsPrefixe.length) {
      L.push('  Tous les marquages suivent le prefixe de leur categorie.');
    } else {
      L.push('  ' + horsPrefixe.length + ' marquage(s) ne suivent pas le prefixe de leur categorie :');
      L.push('    ' + horsPrefixe.slice(0, 12).join(', ') + (horsPrefixe.length > 12 ? '...' : ''));
    }
  } else {
    L.push('  (colonne "prefixe" absente de CATEGORIES : controle du prefixe desactive.)');
  }

  L.push('');
  L.push('CATEGORIES \u2014 NATURE REGLEMENTAIRE');
  /* Pas d'alerte, pas de heuristique de detection d'erreur : juste
     l'information visible la ou on va quand un classement surprend (ex. la
     reparation refusee sur une categorie qu'on pensait ouverte). Utile aussi
     pour les clubs qui reprennent une base creee sous l'ancien libelle
     "Soumis au vieillissement ?", ambigu entre EPI-non-soumis et non-EPI. */
  if (!rawRows.categories.length) {
    L.push('  aucune categorie enregistree.');
  } else {
    var avecMaint = aColonne('categories', 'maintenance_fabricant');
    rawRows.categories.forEach(function (c) {
      var nature = NATURE_EPI_LABELS[c.type_epi] ||
        (c.type_epi ? '"' + c.type_epi + '" (valeur inattendue)' : 'non renseignee');
      /* (2026.5.14) meme regle pour le non-EPI : plus de "reparation libre" */
      var rep = (avecMaint
            ? (c.maintenance_fabricant ? 'reparation ouverte (maintenance fabricant cochee)' : 'reparation fermee (case non cochee)')
            : 'reparation fermee (colonne maintenance_fabricant absente)');
      L.push('  ' + (c.nom || '#' + c.id).padEnd(22) + nature.padEnd(40) + '-> ' + rep);
    });
    if (!avecMaint) {
      L.push('  colonne "maintenance_fabricant" absente de CATEGORIES : aucun EPI ne peut etre');
      L.push('  declare reparable, quelle que soit la categorie. Pour l\'activer : creer dans');
      L.push('  CATEGORIES une colonne "maintenance_fabricant" de type Booleen (Toggle), puis la');
      L.push('  cocher pour les categories dont la notice fabricant prevoit une reparation.');
    }
  }

  L.push('');
  L.push('STRUCTURE DU DOCUMENT');
  try {
    var etD = await analyserStructure();
    L.push('  marque de structure : ' + (etD.marqueur || 'aucune') + ' | logiciel : ' + SCHEMA_VERSION);
    if (!etD.absents.length) L.push('  complete : tous les elements attendus sont presents.');
    else etD.absents.forEach(function (a) {
      L.push('  manquant : ' + a.libelle + (versionSup(a.depuis, etD.marqueur) ? ' (nouveaute : creation automatique)' : ' (facultatif ou ancien)'));
    });
    if (erreurStructure) L.push('  *** ' + erreurStructure);
  } catch (eD) { L.push('  verification impossible : ' + eD.message); }

  L.push('');
  L.push('ENTRETIENS');
  if (!resolvedNames.entretiens) {
    L.push('  table ENTRETIENS absente : la sous-rubrique Entretien est masquee, le reste du');
    L.push('  logiciel fonctionne normalement. Pour l\'activer, creer une table ENTRETIENS avec');
    L.push('  les colonnes : materiel (Reference vers MATERIELS), date_entretien (Date),');
    L.push('  auteur (Reference vers ADHERENTS), commentaire (Texte).');
  } else {
    L.push('  table "' + resolvedNames.entretiens + '" presente. ' + rawRows.entretiens.length +
      ' entretien(s) enregistre(s).');
    ['materiel', 'date_entretien', 'auteur', 'commentaire'].forEach(function (col) {
      if (!aColonne('entretiens', col)) L.push('  *** colonne "' + col + '" ABSENTE : la declaration echouera.');
    });
    var orphelinsEnt = rawRows.entretiens.filter(function (e) {
      return !rawRows.materiels.some(function (m) { return m.id === e.materiel; });
    }).length;
    if (orphelinsEnt) {
      L.push('  *** ' + orphelinsEnt + ' ligne(s) pointent vers un exemplaire introuvable (materiel supprime ?).');
    }
  }

  L.push('');
  L.push('PROLONGATION DE LA DUREE DE VIE PAR REPARATION');
  var colsProlong = [['categories', 'prolongation_par_reparation', 'CATEGORIES', 'Booleen'],
                     ['reparations', 'date_fabrication_piece', 'REPARATIONS', 'Date'],
                     ['reparations', 'duree_vie_piece_mois', 'REPARATIONS', 'Entier']];
  var manquantes = colsProlong.filter(function (c) { return !aColonne(c[0], c[1]); });
  if (!manquantes.length) {
    var nProlonges = Object.keys(calculerProlongations(rawRows.reparations)).length;
    L.push('  active. ' + refLists.categories.filter(function (c) { return c.prolongation_par_reparation; }).length +
      ' categorie(s) cochee(s), ' + nProlonges + ' exemplaire(s) prolonge(s).');
  } else {
    L.push('  inactive : colonne(s) a creer pour l\'activer :');
    manquantes.forEach(function (c) { L.push('    ' + c[2] + '.' + c[1] + ' (' + c[3] + ')'); });
  }

  L.push('');
  L.push('REPARATIONS');
  if (!resolvedNames.reparations) {
    L.push('  table REPARATIONS absente : le statut "En reparation" ne sera jamais utilise, le');
    L.push('  reste du logiciel fonctionne normalement. Pour l\'activer, creer une table');
    L.push('  REPARATIONS avec les colonnes : materiel (Reference vers MATERIELS),');
    L.push('  date_declaree (Date), motif (Texte), date_effectuee (Date), intervenant (Texte),');
    L.push('  description (Texte), pieces_remplacees (Texte).');
  } else {
    var totalRep = rawRows.reparations.length;
    var enCoursRep = rawRows.reparations.filter(function (r) { return !r.date_effectuee; }).length;
    L.push('  table "' + resolvedNames.reparations + '" presente. ' + totalRep +
      ' reparation(s) enregistree(s), ' + enCoursRep + ' en cours.');
    var orphelinesRep = rawRows.reparations.filter(function (r) {
      return !rawRows.materiels.some(function (m) { return m.id === r.materiel; });
    }).length;
    if (orphelinesRep) {
      L.push('  *** ' + orphelinesRep + ' ligne(s) pointent vers un exemplaire introuvable (materiel supprime ?).');
    }
  }

  L.push('');
  L.push('ECHEANCE DU PROCHAIN CONTROLE');
  var modeCtrl = CONFIG.mode_prochain_controle || 'systematique';
  if (modeCtrl === 'systematique') {
    L.push('  mode "systematique" (par defaut) : chaque controle, quelle que soit sa raison,');
    L.push('  decale la date du prochain d\'un an. Reglable dans Reglages du club -> Fonctionnement.');
  } else {
    L.push('  mode "routine" : seuls les controles de routine decalent cette date.');
    if (!aColonne('controles', 'type_controle')) {
      L.push('  *** colonne "type_controle" ABSENTE de CONTROLES : ce mode est active mais sans');
      L.push('  effet reel, faute de moyen de distinguer un controle de routine d\'un controle');
      L.push('  suite a incident ou reparation. Creer la colonne (Choix, ou Texte) pour qu\'il');
      L.push('  s\'applique reellement.');
    } else {
      var sansType = rawRows.controles.filter(function (c) { return !((c.type_controle || '').trim()); }).length;
      L.push('  colonne "type_controle" presente. ' + sansType + ' controle(s) sur ' +
        rawRows.controles.length + ' sans type renseigne (compte comme routine par defaut).');
    }
  }

  L.push('');
  L.push('DECLARATION DE REPARATION (colonnes facultatives)');
  if (!aColonne('adherents', 'role')) {
    L.push('  colonne "role" ABSENTE de ADHERENTS : les listes Controleur/Intervenant proposent');
    L.push('  tous les adherents, sans filtrage par habilitation.');
  } else {
    var habilites = refLists.adherents.filter(function (a) { return a.role === 'Controleur EPI habilite'; }).length;
    L.push('  colonne "role" presente. ' + habilites + ' adherent(s) marque(s) "Controleur EPI');
    L.push('  habilite" sur ' + refLists.adherents.length + ' — ce sont eux qui apparaissent dans les');
    L.push('  listes Controleur/Intervenant (repli sur la liste complete si aucun marque).');
  }
  if (!aColonne('reparations', 'intervenant_qui')) {
    L.push('  colonne "intervenant_qui" ABSENTE de REPARATIONS : le champ "Qui" (adherent precis');
    L.push('  quand Intervenant = Club) ne s\'affiche PAS, meme si "role" est presente sur');
    L.push('  ADHERENTS — ce sont deux garde-fous distincts. Creer la colonne (Reference vers');
    L.push('  ADHERENTS) pour l\'activer.');
  } else {
    L.push('  colonne "intervenant_qui" presente : le champ "Qui" s\'affiche normalement.');
  }

  L.push('');
  L.push('TYPES DE COLONNES (Reference)');
  var fr = referencesFautives();
  if (!fr.length) L.push('  toutes les colonnes de reference sont correctes.');
  else fr.forEach(function (x) { L.push(texteFautive(x)); });

  L.push('');
  L.push('COHERENCE VIEILLISSEMENT');
  var incoherents = rawRows.lots.filter(function (l) {
    return Number(l.duree_vie_mois) && categorieNonSoumise(l.categorie);
  });
  if (!incoherents.length) L.push('  aucun lot non soumis au vieillissement n\'a de duree de vie renseignee.');
  else incoherents.forEach(function (l) {
    L.push('  *** "' + l.designation + '" : duree ' + l.duree_vie_mois + ' mois sur categorie non soumise' +
      ' -> la reforme calendaire s\'appliquera. Editez le lot pour vider la duree.');
  });

  L.push('');
  L.push('RATTACHEMENT AUX LOTS');
  var orphelins = rawRows.materiels.filter(function (m) { return !m.lot; }).length;
  L.push('  exemplaires sans lot : ' + orphelins + ' / ' + rawRows.materiels.length +
    (orphelins ? '   <- a rattacher : un exemplaire doit toujours appartenir a un lot' : ''));
  L.push('  lots enregistres     : ' + rawRows.lots.length);

  sortie.textContent = L.join('\n');
  await load();
}

/* ---------------------- aide ---------------------- */

function brancherErreurs() {
  var b = document.getElementById('erreurFermer');
  if (b) b.onclick = function () {
    document.getElementById('erreurGlobale').hidden = true;
    document.getElementById('erreurTexte').textContent = '';
  };
}

/* L'aide est une fenetre modale a menu lateral : on ouvre sur une rubrique
   precise plutot que de faire defiler une grille de cartes. */
function afficherRubriqueAide(cle) {
  document.querySelectorAll('#aideNav .aide-nav-item').forEach(function (b) {
    b.classList.toggle('actif', b.dataset.sec === cle);
  });
  document.querySelectorAll('#aideSections .aide-sec').forEach(function (s) {
    s.classList.toggle('actif', s.id === 'sec-' + cle);
  });
  var zone = document.getElementById('aideSections');
  if (zone) zone.scrollTop = 0;
}

function ouvrirAide(cle) {
  var panneau = document.getElementById('aidePanel');
  var btn = document.getElementById('btnAide');
  if (!panneau) return;
  panneau.hidden = false;
  if (btn) btn.classList.add('actif');
  afficherRubriqueAide(cle || 'bienvenue');
}

function fermerAide() {
  var panneau = document.getElementById('aidePanel');
  var btn = document.getElementById('btnAide');
  if (panneau) panneau.hidden = true;
  if (btn) btn.classList.remove('actif');
}

function brancherApropos() {
  var btn = document.getElementById('btnApropos');
  if (!btn) return;
  /* les credits vivent dans l'aide : le bouton du bandeau l'ouvre
     directement sur la bonne rubrique — un seul contenu, deux acces */
  btn.onclick = function () { ouvrirAide('apropos'); };
}

/* (2026.5.5) La case "Aller a un marquage" du bandeau a ete supprimee : elle
   doublonnait la recherche de l'onglet Materiel et pretait a confusion (on y
   tapait "Petzl" -> "Aucun exemplaire"). Seul reste classeStatut, partage. */
/* Classe de pastille pour un statut derive (memes couleurs que les listes). */
function classeStatut(s) {
  return s === 'En service' ? 'ok' : (s === 'Prete' ? 'info'
    : (s === 'Examen requis' ? 'warn' : (s === 'En reparation' ? 'repair' : 'danger')));
}







/* ---------------------- panneau de reglages (CONFIG) ---------------------- */
var CHAMPS_CONFIG = [
  { cle: 'titre_appli',  label: 'Titre de l\'application', aide: 'Le grand titre du bandeau.' },
  { cle: 'sous_titre',   label: 'Sous-titre', aide: 'Nom du club et fédération, ex. « … · FFCAM » ou « … · FFME ».' },
  { cle: 'nom_club',     label: 'Nom du club', aide: 'Repris dans les crédits et les documents imprimés.' },
  { cle: 'annee',        label: 'Année', aide: '' },
  { cle: 'email_contact',label: 'E-mail de contact', aide: '' },
  { cle: 'auteur',       label: 'Auteur', aide: '' },
  { cle: 'description',  label: 'Description', aide: '' },
  { cle: 'couleur_principale', label: 'Couleur principale', couleur: true, groupe: 'Apparence', aide: 'Code hexadécimal (ex. #1B3668) ou vide pour la charte.' },
  { cle: 'couleur_accent',     label: 'Couleur d\'accent', couleur: true, groupe: 'Apparence', aide: 'Code hexadecimal (ex. #E30613) ou vide pour la charte.' },
  { cle: 'lien1_libelle', label: 'Lien 1 — libelle', groupe: 'Liens utiles', aide: 'Ex. « Règles EPI FFCAM » ou « Page EPI FFME ».' },
  { cle: 'lien1_url',     label: 'Lien 1 — adresse', groupe: 'Liens utiles', aide: 'Adresse complète (https://...).' },
  { cle: 'lien2_libelle', label: 'Lien 2 — libelle', groupe: 'Liens utiles', aide: 'Ex. « Norme NF S 72-701 ».' },
  { cle: 'lien2_url',     label: 'Lien 2 — adresse', groupe: 'Liens utiles', aide: 'Adresse complète (https://...).' },
  { cle: 'mode_prochain_controle', label: 'Calcul de l\'échéance du prochain contrôle',
    groupe: 'Fonctionnement', type: 'choix',
    choix: [
      { valeur: 'systematique', label: 'Chaque contrôle décale la date (par défaut)' },
      { valeur: 'routine', label: 'Seuls les contrôles de routine décalent la date' }
    ] }
];

function champConfigHtml(c) {
  var val = CONFIG[c.cle] == null ? '' : CONFIG[c.cle];
  var aide = c.aide ? '<p class="form-aide">' + esc(c.aide) + '</p>' : '';
  if (c.type === 'choix') {
    var courant = val || (c.choix[0] && c.choix[0].valeur);
    var radios = c.choix.map(function (o) {
      return '<label class="coche" style="display:block;margin:4px 0">' +
        '<input type="radio" name="reglage-' + c.cle + '" data-cle="' + c.cle + '" value="' + esc(o.valeur) + '"' +
        (o.valeur === courant ? ' checked' : '') + '> ' + esc(o.label) + '</label>';
    }).join('');
    return '<div class="form-field" style="grid-column:1/-1">' +
      '<label>' + esc(c.label) + '</label>' + radios +
      '<div id="reglageNote-' + c.cle + '" style="margin-top:6px"></div>' + aide + '</div>';
  }
  if (c.couleur) {
    var pick = couleurValide(val) ? val : '#1B3668';   /* le selecteur natif exige toujours une couleur */
    return '<div class="form-field"><label>' + esc(c.label) + '</label>' +
      '<div class="reglages-couleur">' +
      '<input type="color" class="couleur-pick" data-pick="' + c.cle + '" value="' + pick + '" aria-label="Choisir ' + esc(c.label) + '">' +
      '<input type="text" data-cle="' + c.cle + '" value="' + esc(val) + '" placeholder="#RRGGBB ou vide (charte)">' +
      '</div>' + aide + '</div>';
  }
  return '<div class="form-field"><label>' + esc(c.label) + '</label>' +
    '<input type="text" data-cle="' + c.cle + '" value="' + esc(val) + '">' + aide + '</div>';
}

function ouvrirReglages() {
  var corps = document.getElementById('reglagesCorps');
  var fonct = document.getElementById('reglagesFonctionnement');
  var so = document.getElementById('reglages-so');
  var save = document.getElementById('reglagesSave');
  var msg = document.getElementById('reglagesMsg');
  if (msg) msg.textContent = '';
  if (!configDiag || !configDiag.table) {
    /* rien a repartir entre deux sous-onglets tant que la table n'existe
       pas : on masque la barre plutot que d'afficher deux vides */
    if (so) so.style.display = 'none';
    if (fonct) fonct.hidden = true;
    corps.hidden = false;
    corps.innerHTML = '<p class="hint" style="margin:4px 2px">La table <b>CONFIG</b> n\'existe pas encore dans ce document. ' +
      'Elle contient les réglages du club (nom, couleurs, liens).</p>' +
      '<div class="form-actions"><button type="button" id="btnCreerConfig">Créer la table CONFIG</button>' +
      '<span class="form-msg" id="creerConfigMsg"></span></div>';
    document.getElementById('btnCreerConfig').onclick = async function () {
      try { await creerParCle(['config']); ouvrirReglages(); }
      catch (e) { document.getElementById('creerConfigMsg').textContent = 'Création impossible : ' + e.message + ' (droit de modifier la structure requis).'; }
    };
    if (save) save.style.display = 'none';
  } else {
    if (so) so.style.display = '';
    /* 'Identité' : MEME orthographe que le groupe par defaut du filtre
       ci-dessous. La passe d'accents (2026.5.4) n'avait accentue que le
       filtre : tout le groupe (titre, sous-titre du bandeau, nom du club...)
       avait disparu du panneau (signale par Pierre, corrige en 2026.5.12). */
    var groupesIdentite = ['Identité', 'Apparence', 'Liens utiles'];
    var htmlIdentite = '<p class="reglages-intro">Ces réglages personnalisent l\'affichage pour tout le club. Ils sont enregistrés dans la table CONFIG.</p>';
    groupesIdentite.forEach(function (g) {
      var champs = CHAMPS_CONFIG.filter(function (c) { return (c.groupe || 'Identité') === g; });
      if (!champs.length) return;
      htmlIdentite += '<h4 class="reglages-groupe">' + g + '</h4><div class="reglages-grille">' + champs.map(champConfigHtml).join('') + '</div>';
    });
    corps.innerHTML = htmlIdentite;

    var champsFonct = CHAMPS_CONFIG.filter(function (c) { return c.groupe === 'Fonctionnement'; });
    fonct.innerHTML = '<p class="reglages-intro">Ces réglages changent un comportement du logiciel pour tout le club, ' +
      'pas juste son apparence. Chacun s\'applique immédiatement au rechargement suivant, sans toucher à l\'historique déjà enregistré.</p>' +
      '<div class="reglages-grille">' + champsFonct.map(champConfigHtml).join('') + '</div>' +
      '<h4 class="reglages-groupe" style="margin-top:18px">Structure du document</h4><div id="structureZone"></div>';
    renderStructure(document.getElementById('structureZone'));

    if (save) save.style.display = '';
    [corps, fonct].forEach(function (zone) {
      zone.querySelectorAll('.reglages-couleur input[type="text"]').forEach(function (inp) {
        inp.oninput = function () {
          var pk = zone.querySelector('.couleur-pick[data-pick="' + inp.dataset.cle + '"]');
          if (pk && couleurValide(inp.value.trim())) pk.value = inp.value.trim();
        };
      });
      zone.querySelectorAll('.couleur-pick').forEach(function (pk) {
        pk.oninput = function () {
          var txt = zone.querySelector('input[type="text"][data-cle="' + pk.dataset.pick + '"]');
          if (txt) txt.value = pk.value;   /* choisir dans la roue remplit le code hexa */
        };
      });
      /* champs de type "choix" (radios) : encadre explicatif mis a jour au vol */
      zone.querySelectorAll('input[type="radio"][data-cle]').forEach(function (r) {
        r.onchange = function () { majNoteChoixConfig(r.dataset.cle); };
      });
    });
    CHAMPS_CONFIG.forEach(function (c) { if (c.type === 'choix') majNoteChoixConfig(c.cle); });

    document.querySelectorAll('#reglages-so .sous-onglet').forEach(function (b) {
      b.classList.toggle('actif', b.dataset.se === sousOngletReglages);
      b.onclick = function () {
        sousOngletReglages = b.dataset.se;
        document.querySelectorAll('#reglages-so .sous-onglet').forEach(function (bb) {
          bb.classList.toggle('actif', bb.dataset.se === sousOngletReglages);
        });
        corps.hidden = sousOngletReglages !== 'identite';
        fonct.hidden = sousOngletReglages !== 'fonctionnement';
        majZoneSauvegarde();
      };
    });
    corps.hidden = sousOngletReglages !== 'identite';
    fonct.hidden = sousOngletReglages !== 'fonctionnement';
    majZoneSauvegarde();
  }
  document.getElementById('reglagesPanel').hidden = false;
}

/* Encadre explicatif sous un champ "choix" (pour l'instant, un seul :
   mode_prochain_controle) : rappelle ce que fait l'option choisie, et pour
   "routine" specifiquement, previent si la colonne necessaire n'existe pas
   encore — le reglage resterait sinon silencieusement sans effet. */
function majNoteChoixConfig(cle) {
  var c = CHAMPS_CONFIG.filter(function (x) { return x.cle === cle; })[0];
  if (!c || c.type !== 'choix') return;
  var note = document.getElementById('reglageNote-' + cle);
  if (!note) return;
  var coche = document.querySelector('input[type="radio"][data-cle="' + cle + '"]:checked');
  var valeur = coche ? coche.value : (c.choix[0] && c.choix[0].valeur);
  if (cle === 'mode_prochain_controle') {
    if (valeur === 'routine') {
      var avecColonne = aColonne('controles', 'type_controle');
      note.innerHTML = '<div class="encadre-ok"><b>\u2713 Contrôles groupes préservés.</b> Un contrôle suite ' +
        'a incident ou après une réparation enregistre son résultat normalement, mais ne décale plus la date ' +
        'du prochain contrôle : elle continue de suivre le dernier contrôle <b>de routine</b>. Un lot contrôle ' +
        'ensemble le reste, même après un incident isole sur l\'un de ses exemplaires.</div>' +
        (avecColonne ? '' : '<div class="encadre-warn"><b>\u26a0 Colonne manquante.</b> La colonne ' +
          '<b>type_controle</b> n\'existe pas encore sur la table CONTRÔLES. Sans elle, aucun contrôle ne peut ' +
          'être reconnu comme \u00ab\u00a0de routine\u00a0\u00bb : ce réglage restera sans effet réel tant ' +
          'qu\'elle n\'est pas créée. Voir Aide \u2192 Diagnostic pour le détail.</div>');
    } else {
      note.innerHTML = '<div class="encadre">Comportement actuel. Chaque contrôle \u2014 de routine, suite ' +
        'a incident, ou après une réparation \u2014 repousse d\'un an la date du prochain contrôle à partir ' +
        'de sa propre date. Un incident isole peut donc décaler un exemplaire hors du rythme du reste de son lot.</div>';
    }
  }
}

function fermerReglages() {
  var p = document.getElementById('reglagesPanel');
  if (p) { p.hidden = true; var b = p.querySelector('.reglages-modale'); if (b) delete b.dataset.sale; }
}

async function enregistrerReglages() {
  var msg = document.getElementById('reglagesMsg');
  if (!configDiag || !configDiag.table) return;
  var valeurs = {}, erreur = null;
  CHAMPS_CONFIG.forEach(function (c) {
    if (c.type === 'choix') {
      var coche = document.querySelector('input[type="radio"][data-cle="' + c.cle + '"]:checked');
      var v = coche ? coche.value : (c.choix[0] && c.choix[0].valeur) || '';
      /* Choix bloquant plutot que degrade silencieusement : un club qui active
         "routine" sans la colonne necessaire se retrouverait avec un reglage
         enregistre mais sans aucun effet reel, sans jamais le savoir — voir
         AFFINAGE_REPARATION_EPI et la discussion sur ce meme principe. */
      if (c.cle === 'mode_prochain_controle' && v === 'routine' && !aColonne('controles', 'type_controle')) {
        erreur = 'Impossible d\'activer ce mode : la colonne "type_controle" n\'existe pas encore sur ' +
          'la table CONTRÔLES. Créez-la d\'abord (voir Aide \u2192 Diagnostic), puis revenez ici.';
      }
      valeurs[c.cle] = v;
      return;
    }
    var el = document.querySelector('[data-cle="' + c.cle + '"]');
    if (!el) return;
    var v = el.value.trim();
    if (c.couleur && v && !couleurValide(v)) erreur = 'Couleur invalide pour « ' + c.label + ' » (attendu : #RRGGBB, ou vide).';
    valeurs[c.cle] = v;
  });
  if (erreur) { msg.textContent = erreur; msg.style.color = '#a3242a'; return; }
  var parCle = {};
  (configRows || []).forEach(function (r) { if (r.cle) parCle[r.cle] = r; });
  var actions = [];
  Object.keys(valeurs).forEach(function (cle) {
    if (parCle[cle]) {
      var u = {}; u[configDiag.colVal] = valeurs[cle];
      actions.push(['UpdateRecord', configDiag.table, parCle[cle].id, u]);
    } else {
      var a = {}; a[configDiag.colCle] = cle; a[configDiag.colVal] = valeurs[cle];
      actions.push(['AddRecord', configDiag.table, null, a]);
    }
  });
  msg.textContent = 'Enregistrement...'; msg.style.color = '#666';
  try {
    await appliquer(actions);
    CHAMPS_CONFIG.forEach(function (c) { CONFIG[c.cle] = valeurs[c.cle]; });
    appliquerConfig();
    msg.textContent = 'Réglages enregistrés.'; msg.style.color = '#1A6B34';
    var bReg = document.querySelector('#reglagesPanel .reglages-modale'); if (bReg) delete bReg.dataset.sale;
    await load();
  } catch (e) {
    msg.textContent = 'Erreur : ' + e.message; msg.style.color = '#a3242a'; console.error(e);
  }
}

function brancherReglages() {
  var panneau = document.getElementById('reglagesPanel');
  if (!panneau) return;
  var btn = document.getElementById('btnReglages');   /* facultatif : le bouton peut vivre ailleurs (dans l'aide) */
  if (btn) btn.onclick = function () { if (panneau.hidden) ouvrirReglages(); else fermerReglages(); };
  var fermer = document.getElementById('btnReglagesClose');
  if (fermer) fermer.onclick = fermerReglages;
  var fond = document.getElementById('reglagesFond');
  var boiteReg = panneau.querySelector('.reglages-modale');
  suivreSaisie(boiteReg);
  if (fond) fond.onclick = function () { fermetureDouce(boiteReg, fermerReglages); };
  var save = document.getElementById('reglagesSave');
  if (save) save.onclick = enregistrerReglages;
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panneau.hidden) fermetureDouce(boiteReg, fermerReglages);
  });
}

/* Version imprimable de toute l'aide -> le navigateur propose « Enregistrer en PDF ».
   Reutilise sortirDocument (avec repli telechargement si window.open est bloque dans l'iframe). */
function enveloppeAidePrint(titre, corps) {
  var css =
    'body{font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1a2233;max-width:720px;margin:0 auto;padding:24px;line-height:1.5}' +
    'h1{color:#1B3668;font-size:23px;margin:0 0 4px;border-bottom:2px solid #E30613;padding-bottom:8px}' +
    '.sous{color:#7A8CAB;font-size:12px;margin:0 0 18px}' +
    '.aide-print-sec{page-break-inside:avoid;margin:0 0 16px}' +
    'h3{color:#1B3668;font-size:17px;margin:20px 0 6px;border-bottom:1px solid #D0D9EC;padding-bottom:4px}' +
    'h4{color:#234082;font-size:14px;margin:12px 0 4px}' +
    'p{margin:6px 0;font-size:13px}' +
    '.encadre{background:#EEF2F8;border-left:3px solid #1B3668;padding:8px 12px;margin:8px 0;font-size:12.5px;border-radius:4px}' +
    'ul{margin:6px 0;padding-left:20px;font-size:13px}li{margin:3px 0}' +
    '.apropos-lien{display:block;margin:2px 0}' +
    'a{color:#1B3668;text-decoration:none}' +
    'b{color:#132750}' +
    '.noprint button{background:#1B3668;color:#fff;border:none;padding:9px 16px;border-radius:6px;cursor:pointer;font-size:14px}' +
    '.epilog-tete{display:flex;align-items:center;gap:12px;margin-bottom:14px;' +
      'padding-bottom:12px;border-bottom:2px solid #1B3668}' +
    '.epilog-tete svg{flex:0 0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.epilog-tete .nom{font-size:20px;font-weight:800;letter-spacing:0.1em;color:#132750;line-height:1.1}' +
    '.epilog-tete .desc{font-size:11.5px;color:#666;margin-top:2px}' +
    '.epilog-pied{margin-top:26px;padding-top:8px;border-top:1px solid #ddd;' +
      'display:flex;align-items:center;gap:9px;font-size:10px;color:#888}' +
    '.epilog-pied svg{flex:0 0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.epilog-pied b{color:#555;letter-spacing:0.08em;font-size:11px}' +

    /* ---- Encart « À propos » ----
       Le corps imprime est une copie du DOM de l'aide : il embarque le SVG du
       logo et la structure de l'encart, mais PAS la feuille de style du widget.
       Sans les regles ci-dessous, chaque forme du SVG retombe sur le noir par
       defaut et le rectangle de fond recouvre le reste — d'ou le carre noir.
       Les couleurs sont donc redeclarees ici, en dur (document autonome). */
    '.apropos-box{display:flex;flex-wrap:wrap;align-items:stretch;border:1px solid #D0D9EC;' +
      'border-radius:10px;overflow:hidden;margin:10px 0 0;page-break-inside:avoid}' +
    '.apropos-logo{flex:0 0 190px;padding:18px;background:#F4F7FC;' +
      'border-right:1px solid #D0D9EC;display:flex;align-items:center;box-sizing:border-box}' +
    '.apropos-corps{padding:18px 20px;flex:1 1 0;min-width:0;box-sizing:border-box}' +
    '.logo-complet{display:block;width:100%;height:auto;' +
      '-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.logo-complet .lc-bg{fill:#0F172A}' +
    '.logo-complet .lc-shield{fill:#1E293B;stroke:#334155;stroke-width:3px}' +
    '.logo-complet .lc-carabiner{fill:none;stroke:#0EA5E9;stroke-width:28px;' +
      'stroke-linecap:round;stroke-linejoin:round}' +
    '.logo-complet .lc-gate{fill:#E2E8F0}' +
    '.logo-complet .lc-lock{fill:#F97316}' +
    '.logo-complet .lc-ridge{stroke:#FFFFFF;stroke-width:2.5px;opacity:0.6}' +
    '.logo-complet .lc-pin{fill:#0F172A}' +
    '.logo-complet .lc-mountain{fill:#1E293B;opacity:0.8}' +
    '.logo-complet .lc-facet{fill:#475569;opacity:0.5}' +
    '.logo-complet .lc-trunk{fill:#78350F}' +
    '.logo-complet .lc-tier-4{fill:#047857}' +
    '.logo-complet .lc-tier-3{fill:#10B981}' +
    '.logo-complet .lc-tier-2{fill:#34D399}' +
    '.logo-complet .lc-tier-1{fill:#6EE7B7}' +
    '.logo-complet .lc-highlight{fill:#FFFFFF;opacity:0.2}' +
    '.logo-complet .lc-titre{fill:#F8FAFC;font-family:system-ui,sans-serif;' +
      'font-weight:800;font-size:38px;letter-spacing:3px}' +
    '.logo-complet .lc-titre-accent{fill:#38BDF8}' +
    '.logo-complet .lc-sous{fill:#94A3B8;font-family:system-ui,sans-serif;' +
      'font-weight:600;font-size:14px;letter-spacing:2.5px}' +
    /* Rubriques de l'encart : sans ces regles tout s'empile en paragraphes nus */
    '.apropos-rubrique{font-size:9.5px;font-weight:700;letter-spacing:0.12em;' +
      'text-transform:uppercase;color:#E30613;margin-bottom:5px}' +
    '.apropos-soft{font-weight:800;font-size:17px;letter-spacing:0.1em;color:#132750}' +
    '.apropos-soft-desc,.apropos-desc{font-size:12px;color:#5A6B85;margin-top:2px}' +
    '.apropos-nom{font-weight:700;font-size:14px;color:#132750}' +
    '.apropos-filet{height:1px;background:#D0D9EC;margin:13px 0;border:0}' +
    '.apropos-liens{display:block;margin-top:2px}' +
    '.apropos-licence{display:flex;align-items:flex-start;gap:12px}' +
    '.apropos-licence img{border:0;display:block;margin-top:2px}' +
    '.apropos-licence>div{font-size:11.5px;color:#5A6B85;line-height:1.5}' +
    '.apropos-pied{background:#F4F7FC;border-top:1px solid #D0D9EC;padding:8px 18px;' +
      'display:flex;justify-content:space-between;font-size:11px;color:#5A6B85;' +
      'flex:1 1 100%;box-sizing:border-box}' +
    /* Bandeau d'accueil : le SVG reutilise les classes lc-* ci-dessus, donc il
       est deja colore. Restent la mise en page et le cadrage du pictogramme —
       sans quoi `.logo-complet{width:100%}` l'etirerait sur toute la page. */
    '.aide-hero{display:flex;align-items:center;gap:16px;padding:14px 16px;' +
      'margin-bottom:12px;background:#132750;border-radius:10px;page-break-inside:avoid;' +
      '-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.aide-hero-logo{flex:0 0 52px;width:52px;height:52px;background:#0F172A;' +
      'border-radius:10px;padding:6px;box-sizing:border-box}' +
    '.aide-hero-logo .logo-complet{width:100%;height:100%}' +
    '.aide-hero-nom{font-size:22px;font-weight:800;letter-spacing:0.1em;color:#FFFFFF;line-height:1.05}' +
    '.aide-hero-nom span{color:#34D399}' +
    '.aide-hero-baseline{font-size:11.5px;color:#C7D2E4;margin-top:3px}' +
    '.aide-hero-club{font-size:9.5px;font-weight:700;letter-spacing:0.11em;' +
      'text-transform:uppercase;color:#8FA2C0;margin-top:6px}' +
    '@media print{.noprint{display:none}body{padding:0;max-width:none}.aide-print-sec{margin-bottom:12px}}';
  return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>' + esc(titre) + '</title>' +
    '<style>' + css + '</style></head><body>' +
    '<div class="noprint" style="margin-bottom:16px"><button onclick="window.print()">Enregistrer en PDF / Imprimer</button></div>' +
    /* Pas de bandeau de logo ici : la premiere rubrique imprimee est
       « Bienvenue », qui porte deja le bandeau d'identite. */
    '<h1>' + esc(titre) + '</h1>' +
    '<p class="sous">' + esc(CONFIG.sous_titre || '') + ' — aide complète de l\'outil</p>' +
    corps +
    piedEpilog() +
    '</body></html>';
}

function imprimerAide() {
  var secs = document.querySelectorAll('#aidePanel .aide-sec');
  var corps = '';
  secs.forEach(function (s) {
    var html = s.innerHTML
      .replace(/<a\b[^>]*\bdata-sec\b[^>]*>[\s\S]*?<\/a>/gi, '')      /* liens de navigation interne */
      .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, '')            /* boutons interactifs (ex. « Lancer un diagnostic ») */
      .replace(/\s{2,}/g, ' ');
    corps += '<div class="aide-print-sec">' + html + '</div>';
  });
  var titre = 'Aide — ' + (CONFIG.titre_appli || 'Gestion du materiel');
  sortirDocument(enveloppeAidePrint(titre, corps), 'aide.html', null);
}

function brancherAide() {
  var btn = document.getElementById('btnAide');
  var panneau = document.getElementById('aidePanel');
  if (!btn || !panneau) return;
  btn.onclick = function () {
    if (panneau.hidden) ouvrirAide('bienvenue'); else fermerAide();
  };
  var fermer = document.getElementById('btnAideClose');
  if (fermer) fermer.onclick = fermerAide;
  var fond = document.getElementById('aideFond');
  if (fond) fond.onclick = fermerAide;   /* clic hors de la fenetre */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panneau.hidden) fermerAide();
  });
  document.querySelectorAll('#aideNav .aide-nav-item').forEach(function (b) {
    if (!b.dataset.sec) return;   /* item special (ex. Reglages) cable a part */
    b.onclick = function () { afficherRubriqueAide(b.dataset.sec); };
  });
  var navReg = document.getElementById('aideNavReglages');
  if (navReg) navReg.onclick = function () { fermerAide(); ouvrirReglages(); };
  var pdf = document.getElementById('btnAidePdf');
  if (pdf) pdf.onclick = imprimerAide;
  /* renvois internes ("En savoir plus") depuis une rubrique vers une autre */
  document.querySelectorAll('#aideSections .aide-lien').forEach(function (a) {
    a.onclick = function () { afficherRubriqueAide(a.dataset.sec); };
  });
  var diag = document.getElementById('btnDiag');
  if (diag) diag.onclick = lancerDiagnostic;
}

/* ---------------------- init ---------------------- */

brancherErreurs();
brancherAide();
brancherReglages();
brancherApropos();
renderMaterielActions();
renderPretsActions();
/* Indice de defilement horizontal, pour tous les tableaux/conteneurs
   defilants a la fois (voir .defile-dispo dans le CSS) — plutot que
   d'aller modifier chacune des ~27 fonctions qui construisent un tableau,
   un seul observateur qui regarde ce qui existe deja dans le DOM. Risque
   de regression minimal : aucune fonction de rendu existante n'est touchee. */
function elementsDefilants() {
  var candidats = document.querySelectorAll(
    '.content table, .scroll-y, .stat-bloc, .refs-scroll, .refs-bloc'
  );
  return Array.prototype.filter.call(candidats, function (el) {
    if (el.tagName === 'TABLE') {
      /* une table DANS un conteneur deja defilant ne defile pas elle-meme
         (c'est le conteneur qui bouge, la table reste display:table) */
      return !el.closest('.scroll-y, .stat-bloc, .refs-scroll, .refs-bloc');
    }
    return true;
  });
}
function majIndicesDefilement() {
  if (window.innerWidth > 480) return;   /* la regle .defile-dispo n'existe qu'en dessous de ce seuil */
  elementsDefilants().forEach(function (el) {
    var debordant = el.scrollWidth > el.clientWidth + 2;
    var finAtteinte = el.scrollLeft >= (el.scrollWidth - el.clientWidth - 2);
    el.classList.toggle('defile-dispo', debordant && !finAtteinte);
    if (debordant && !el.dataset.defilementBranche) {
      el.dataset.defilementBranche = '1';
      el.addEventListener('scroll', majIndicesDefilement, { passive: true });
    }
  });
}
window.addEventListener('resize', majIndicesDefilement);

/* Telephone (2026.5.16) : chaque cellule de tableau recoit le titre de sa
   colonne (data-label), et la ligne d'en-tete la classe tr-entete. La CSS
   telephone (< 640 px) s'en sert pour afficher les lignes en cartes
   \"Lieu : Coffre gymnase\". Au-dessus de 640 px, aucune regle n'utilise ces
   attributs : l'affichage ordinateur ne change pas (verifie au pixel pres).
   Generique : tous les tableaux, presents et a venir, sans toucher a leur code. */
function etiqueterTableaux() {
  document.querySelectorAll('table').forEach(function (t) {
    var entetes = null;
    Array.prototype.forEach.call(t.rows, function (tr) {
      var cells = tr.cells;
      if (!cells.length) return;
      var toutTh = Array.prototype.every.call(cells, function (c) { return c.tagName === 'TH'; });
      if (toutTh) {
        if (!tr.classList.contains('tr-entete')) tr.classList.add('tr-entete');
        entetes = [];
        Array.prototype.forEach.call(cells, function (c) {
          for (var k = 0; k < (c.colSpan || 1); k++) entetes.push((c.textContent || '').replace(/\s+/g, ' ').trim());
        });
        return;
      }
      if (!entetes) return;
      var idx = 0;
      Array.prototype.forEach.call(cells, function (c) {
        var lab = (c.colSpan || 1) > 1 ? '' : (entetes[idx] || '');
        if (c.getAttribute('data-label') !== lab) c.setAttribute('data-label', lab);
        /* cellule vide ("-" ou rien, sans champ ni bouton) : la CSS telephone la
           masque ; aucun effet ailleurs */
        var vide = lab !== '' && !c.querySelector('input, select, button, textarea, img') &&
          /^[\s\-\u2013\u2014]*$/.test(c.textContent || '');
        if (c.classList.contains('cellule-vide') !== vide) c.classList.toggle('cellule-vide', vide);
        idx += c.colSpan || 1;
      });
    });
  });
}
new MutationObserver(function () {
  clearTimeout(window.__etiqTimeout);
  window.__etiqTimeout = setTimeout(etiqueterTableaux, 60);
}).observe(document.body, { childList: true, subtree: true });
new MutationObserver(function () {
  clearTimeout(window.__defilTimeout);
  window.__defilTimeout = setTimeout(majIndicesDefilement, 150);
}).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

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
var VERSION_EPILOG = '2026.5.40';   /* = premiere entree du CHANGELOG : controle par tests/test_27 */
/* Version affichee dans le pied de page (2026.5.26) : permet de savoir en un coup d'oeil quelle
   version tourne dans CE document (le code vit dans chaque document, une ancienne copie peut
   subsister apres une mise a jour) */
(function () { var el = document.getElementById('creditsVersion'); if (el) el.textContent = 'v' + VERSION_EPILOG; })();
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
    if (!cible) return '#' + v;
    if (cible[ref[1]]) return String(cible[ref[1]]);
    return ref[0] === 'achats' ? 'Commande sans r\u00e9f\u00e9rence (#' + v + ')' : '#' + v;
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
    entetes: ['Marquage'].concat(avecSerie ? ['Num\u00e9ro de s\u00e9rie'] : []).concat(['Couleur', 'Taille ou longueur', 'Lot', 'Cat\u00e9gorie', 'Fabricant',
      'Mod\u00e8le', 'Date de fabrication', 'Dur\u00e9e de vie (mois)', 'Lieu', 'Mise en service', 'Fin de vie', 'Prolong\u00e9e par r\u00e9paration', 'Statut', 'Motif',
      'Prochain contr\u00f4le', 'Contr\u00f4le en retard', 'Sortie du parc', 'Prix unitaire', 'Commentaire', 'Photos']),
    lignes: mats.map(function (m) {
      var lot = (rawRows.lots || []).filter(function (l) { return l.id === m.lot; })[0] || {};
      var cat = categorieDeMateriel(m) || {};
      var hors = HORS_STOCK.indexOf(m._statut) !== -1;
      return [m.numero_marquage || ''].concat(avecSerie ? [m.numero_serie || ''] : []).concat([
        m.couleur || '', m.taille || '', lot.designation || '', cat.nom || '', lot.fabricant || '', lot.modele || '', lot.date_fabrication ? fmtDate(lot.date_fabrication) : '', lot.duree_vie_mois || '',
        valeurLisible('lieu_stockage', m.lieu_stockage), fmtDate(m.date_mise_en_service) === '-' ? '' : fmtDate(m.date_mise_en_service),
        m._finDeVie ? '31/12/' + m._finDeVie.getUTCFullYear() : 'Selon contr\u00f4le', m._prolongation ? 'Oui' : '',
        m._statut || '', m._raison || '',
        hors ? 'Sans objet' : (m._limiteControle ? fmtDate(m._limiteControle) : ''), m._controleEchu ? 'Oui' : '',
        dateSortieParc(m) ? fmtDate(dateSortieParc(m)) : '', Number(lot.prix_unitaire) || '', m.commentaire || '',
        aColonne('materiels', 'photo') ? (idsPiecesJointes(m.photo).length || '') : '']);
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
  messageExport('Pr\u00e9paration du classeur...');
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
    messageExport('Classeur t\u00e9l\u00e9charg\u00e9 (' + feuilles.length + ' feuilles).');
  } catch (e) {
    /* (2026.5.23) plus de repli en 14 fichiers CSV, juge inutilisable par Pierre */
    messageExport('Excel indisponible (' + e.message + ') : v\u00e9rifiez la connexion Internet et r\u00e9essayez. ' +
      'L\u2019inventaire seul reste exportable en CSV depuis la rubrique Mat\u00e9riel.', true);
  }
}
function messageExport(txt, erreur) {
  var el = document.getElementById('exportParcMsg');
  if (el) { el.textContent = txt; el.style.color = erreur ? '#a3242a' : ''; }
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
    return true;
  } catch (e) {
    messageSauvegarde('Erreur : ' + e.message, true);
    return false;
  }
}

/* ---------------------- remise a zero (2026.5.22) ----------------------
   Decisions de Pierre : deux choix seulement (tout effacer / garder les
   listes du club), reglages TOUJOURS conserves, sauvegarde .json telechargee
   OBLIGATOIREMENT avant, confirmation habituelle "SUPPRIMER". Effacement
   d'un bloc (enfants d'abord), tout ou rien. */
var TABLES_LISTES_CLUB = ['categories', 'lieux', 'fournisseurs', 'adherents'];
function tablesAEffacer(choix) {
  return TABLES_SAUVEGARDE.slice().reverse().filter(function (k) {
    return resolvedNames[k] && (choix === 'tout' || TABLES_LISTES_CLUB.indexOf(k) === -1);
  });
}
var NOMS_TABLES_RAZ = { categories: 'cat\u00e9gories', lieux: 'lieux', fournisseurs: 'fournisseurs', adherents: 'adh\u00e9rents',
  achats: 'commandes', lots: 'lots', materiels: 'exemplaires', controles: 'contr\u00f4les', emprunts: 'pr\u00eats',
  incidents: 'incidents', reparations: 'r\u00e9parations', entretiens: 'entretiens', demandes: 'demandes' };
function bilanRaz(choix) {
  return tablesAEffacer(choix).slice().reverse().map(function (k) {
    return { cle: k, nb: lignesDeCle(k).length };
  }).filter(function (x) { return x.nb; });
}
function majBilanRaz() {
  var choix = (document.querySelector('input[name="razChoix"]:checked') || {}).value || 'tout';
  var b = bilanRaz(choix), el = document.getElementById('razBilan');
  if (!el) return;
  el.innerHTML = b.length
    ? 'Sera effac\u00e9\u00a0: ' + b.map(function (x) {
        var nom = NOMS_TABLES_RAZ[x.cle];
        /* singulier : 1 lieu, 1 commande, 1 pret... (lieux -> lieu) */
        if (x.nb === 1) nom = nom === 'lieux' ? 'lieu' : nom.replace(/s$/, '');
        return x.nb + ' ' + nom;
      }).join(', ') + '.'
    : 'Rien \u00e0 effacer pour ce choix.';
  var go = document.getElementById('razSauver');
  if (go) go.disabled = !b.length;
}
async function lancerRaz() {
  var choix = (document.querySelector('input[name="razChoix"]:checked') || {}).value || 'tout';
  var zone = document.getElementById('razConfirmation');
  /* 1. sauvegarde obligatoire : on ne va pas plus loin sans elle */
  var ok = await exporterSauvegarde();
  if (!ok) { messageSauvegarde('Sauvegarde impossible : remise \u00e0 z\u00e9ro annul\u00e9e, rien n\u2019a \u00e9t\u00e9 effac\u00e9.', true); return; }
  /* 2. confirmation habituelle */
  zone.innerHTML = '<div class="encadre-warn" style="margin-top:8px"><b>Sauvegarde t\u00e9l\u00e9charg\u00e9e.</b> ' +
    'V\u00e9rifiez qu\u2019elle est bien dans vos t\u00e9l\u00e9chargements, puis confirmez. ' + esc(document.getElementById('razBilan').textContent) +
    '<p style="margin:8px 0 4px">Tapez <b>SUPPRIMER</b> pour confirmer :</p>' +
    '<input type="text" class="raz-confirm" autocomplete="off" style="max-width:220px">' +
    '<div class="form-actions" style="margin-top:8px"><button type="button" class="raz-go" style="background:#a3242a">Effacer d\u00e9finitivement</button>' +
    '<button type="button" class="secondary raz-annuler">Annuler</button></div></div>';
  zone.querySelector('.raz-annuler').onclick = function () { zone.innerHTML = ''; messageSauvegarde(''); };
  zone.querySelector('.raz-go').onclick = async function () {
    if (zone.querySelector('.raz-confirm').value.trim().toUpperCase() !== 'SUPPRIMER') {
      messageSauvegarde('Tapez SUPPRIMER pour confirmer.', true); return;
    }
    var actions = tablesAEffacer(choix).map(function (k) {
      return ['BulkRemoveRecord', resolvedNames[k], lignesDeCle(k).map(function (r) { return r.id; })];
    }).filter(function (a) { return a[2].length; });
    messageSauvegarde('Effacement en cours...');
    try {
      await appliquer(actions);                 /* tout ou rien */
      zone.innerHTML = '';
      await load();
      majBilanRaz();
      messageSauvegarde('Remise \u00e0 z\u00e9ro termin\u00e9e. Les r\u00e9glages du club sont conserv\u00e9s. ' +
        'En cas d\u2019erreur : r\u00e9importez la sauvegarde t\u00e9l\u00e9charg\u00e9e' + (choix === 'tout' ? '' : ' (apr\u00e8s un \u00ab Tout effacer \u00bb)') +
        ', ou utilisez l\u2019historique des versions de Grist.');
    } catch (e) {
      messageSauvegarde('Remise \u00e0 z\u00e9ro annul\u00e9e, rien n\u2019a \u00e9t\u00e9 effac\u00e9 : ' + e.message, true);
    }
  };
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
    '<p class="hint">Grist garde aussi son propre historique des versions et permet de t\u00e9l\u00e9charger une copie compl\u00e8te du document.</p>' +
    '<p class="hint">Fichier complet (.json), r\u00e9importable dans un autre document EPILOG, m\u00eame d\u2019une version plus r\u00e9cente. ' +
      'Les pi\u00e8ces jointes (photos, notices, factures) n\u2019y sont pas incluses.</p>' +
    '<div class="form-actions"><button type="button" id="sauvJson">T\u00e9l\u00e9charger la sauvegarde</button></div>' +
    '<p class="hint" style="margin-top:10px"><b>Importer une sauvegarde</b> \u2014 uniquement dans un document vide. ' +
      'Un aper\u00e7u s\u2019affiche avant toute \u00e9criture.</p>' +
    '<input type="file" id="sauvFichier" accept=".json,application/json">' +
    '<div id="sauvApercu" style="margin-top:8px"></div>' +
    '<details class="repli" style="margin-top:18px"><summary>Remettre \u00e0 z\u00e9ro (zone sensible)</summary>' +
    '<p class="hint">Efface les donn\u00e9es du club. Une <b>sauvegarde est t\u00e9l\u00e9charg\u00e9e d\u2019office avant</b>, ' +
      'puis une confirmation est demand\u00e9e. Les r\u00e9glages (nom du club, couleurs, liens) sont toujours conserv\u00e9s.</p>' +
    '<label class="coche" style="display:block;margin:4px 0"><input type="radio" name="razChoix" value="tout" checked> ' +
      '<b>Tout effacer</b> \u2014 mat\u00e9riel, historique, commandes et listes du club. Permet ensuite d\u2019importer une sauvegarde.</label>' +
    '<label class="coche" style="display:block;margin:4px 0"><input type="radio" name="razChoix" value="listes"> ' +
      '<b>Garder les listes du club</b> \u2014 efface le mat\u00e9riel, l\u2019historique et les commandes ; conserve cat\u00e9gories, ' +
      'lieux, fournisseurs et adh\u00e9rents (un import ne sera alors pas possible).</label>' +
    '<p class="hint" id="razBilan" style="margin:6px 0"></p>' +
    '<div class="form-actions"><button type="button" class="secondary" id="razSauver" style="color:#a3242a;border-color:#e8b4b7">' +
      'T\u00e9l\u00e9charger la sauvegarde et continuer</button></div>' +
    '<div id="razConfirmation"></div></details>' +
    '<p id="sauvMsg" class="form-msg" style="display:block;margin-top:8px"></p>';
  document.getElementById('sauvJson').onclick = exporterSauvegarde;
  document.getElementById('sauvFichier').onchange = function () { preparerImport(this.files && this.files[0]); };
  document.querySelectorAll('input[name="razChoix"]').forEach(function (r) {
    r.onchange = function () { document.getElementById('razConfirmation').innerHTML = ''; majBilanRaz(); };
  });
  document.getElementById('razSauver').onclick = lancerRaz;
  majBilanRaz();
}

/* ======================= structure du document (2026.5.27) =======================
   Demande de Pierre : a la mise a jour du code, le widget verifie la structure du
   document et cree lui-meme ce qui manque, au lieu de demander d'ajouter des tables
   et des colonnes a la main (et pour installer EPILOG dans un document vide).

   PRINCIPE. SCHEMA declare toutes les tables et colonnes attendues, avec la version
   qui a introduit chacune (`depuis`). Le document garde dans CONFIG une marque
   `structure_version` : la derniere version dont la structure a ete appliquee.
   - Ce qui est apparu APRES cette marque et manque est cree AUTOMATIQUEMENT.
   - Ce qui date d'AVANT et manque n'est jamais cree sans demande : un club peut
     avoir volontairement renonce a un module facultatif (ENTRETIENS...). Il le
     retrouve dans Reglages > Fonctionnement > Structure, avec un bouton.
   - Document sans marque mais avec MATERIELS : suppose a l'etat STRUCTURE_BASE (la
     veille de ce systeme), donc seules les nouveautes ulterieures sont creees.
   - Document SANS aucune table d'EPILOG : proposition d'installation complete.
   Les noms de table existants sont respectes (memes variantes de casse que le
   chargement), et rien n'est jamais supprime ni modifie : on ne fait qu'AJOUTER.
   Si l'utilisateur n'a pas le droit de modifier la structure, le widget l'indique
   et continue de fonctionner (aucun blocage). */
var SCHEMA_VERSION = '2026.5.27';   /* derniere version a avoir ajoute un element au SCHEMA */
var STRUCTURE_BASE = '2026.5.26';   /* etat suppose d'un document anterieur a ce systeme */
function defCol(id, type, opt) { var o = opt || {}; return { id: id, type: type, choix: o.choix || null, depuis: o.depuis || '0' }; }
var SCHEMA = [
  { cle: 'fournisseurs', coeur: true, noms: ['FOURNISSEURS', 'Fournisseurs', 'fournisseurs'],
    cols: [defCol('nom', 'Text'), defCol('contact', 'Text'), defCol('telephone', 'Text'), defCol('email', 'Text')] },
  { cle: 'categories', coeur: true, noms: ['CATEGORIES', 'Categories', 'categories'],
    cols: [defCol('nom', 'Text'), defCol('type_epi', 'Choice', { choix: TYPES_EPI }), defCol('duree_vie_defaut_mois', 'Numeric'),
           defCol('prefixe', 'Text'), defCol('maintenance_fabricant', 'Bool'), defCol('reparations_acceptees', 'Text'),
           defCol('peut_etre_decoupe', 'Bool'), defCol('prolongation_par_reparation', 'Bool')] },
  { cle: 'lieux', coeur: true, noms: ['LIEUX_STOCKAGE', 'Lieux_stockage', 'Lieux_Stockage', 'lieux_stockage'],
    cols: [defCol('nom', 'Text'), defCol('description', 'Text')] },
  { cle: 'adherents', coeur: true, noms: ['ADHERENTS', 'Adherents', 'adherents'],
    cols: [defCol('nom_complet', 'Text'), defCol('numero_licence', 'Text'), defCol('role', 'Choice', { choix: ROLES_DEFAUT }),
           defCol('email', 'Text'), defCol('telephone', 'Text')] },
  { cle: 'achats', coeur: true, noms: ['ACHATS', 'Achats', 'achats'],
    cols: [defCol('ref_commande', 'Text'), defCol('fournisseur', 'Ref:fournisseurs'), defCol('date_commande', 'Date'),
           defCol('date_reception', 'Date'), defCol('montant_total', 'Numeric'),
           defCol('financement', 'Choice', { choix: FINANCEMENT_DEFAUT }), defCol('facture', 'Attachments'), defCol('note_financement', 'Text')] },
  { cle: 'lots', coeur: true, noms: ['LOTS', 'Lots', 'lots'],
    cols: [defCol('designation', 'Text'), defCol('categorie', 'Ref:categories'), defCol('fabricant', 'Text'), defCol('modele', 'Text'),
           defCol('achat', 'Ref:achats'), defCol('date_fabrication', 'Date'), defCol('duree_vie_mois', 'Numeric'),
           defCol('prix_unitaire', 'Numeric'), defCol('quantite_achetee', 'Numeric'), defCol('commentaire', 'Text'),
           defCol('photo', 'Attachments'), defCol('notice', 'Attachments')] },
  { cle: 'materiels', coeur: true, noms: ['MATERIELS', 'Materiels', 'materiels'],
    cols: [defCol('lot', 'Ref:lots'), defCol('numero_marquage', 'Text'), defCol('lieu_stockage', 'Ref:lieux'),
           defCol('date_mise_en_service', 'Date'), defCol('hors_service_motif', 'Choice', { choix: MOTIFS_HORS_SERVICE }),
           defCol('hors_service_date', 'Date'), defCol('couleur', 'Text'), defCol('taille', 'Text'), defCol('commentaire', 'Text'),
           defCol('origine_decoupe', 'Ref:materiels'), defCol('numero_serie', 'Text'),
           defCol('photo', 'Attachments', { depuis: '2026.5.27' })] },
  { cle: 'controles', coeur: true, noms: ['CONTROLES', 'Controles', 'controles'],
    cols: [defCol('materiel', 'Ref:materiels'), defCol('date_controle', 'Date'), defCol('controleur', 'Ref:adherents'),
           defCol('resultat', 'Choice', { choix: RESULTATS_CONTROLE }), defCol('commentaire', 'Text'),
           defCol('type_controle', 'Choice', { choix: TYPE_CONTROLE_DEFAUT }), defCol('photo', 'Attachments')] },
  { cle: 'emprunts', coeur: true, noms: ['EMPRUNTS', 'Emprunts', 'emprunts'],
    cols: [defCol('materiel', 'Ref:materiels'), defCol('adherent', 'Ref:adherents'), defCol('date_emprunt', 'Date'),
           defCol('date_retour_prevue', 'Date'), defCol('date_retour_effective', 'Date'),
           defCol('etat_retour', 'Choice', { choix: ['Bon etat', 'Degrade', 'Perdu', 'Non rendu'] }),
           defCol('sortie_activite', 'Text'), defCol('numero_emprunt', 'Text')] },
  { cle: 'incidents', coeur: true, noms: ['INCIDENTS', 'Incidents', 'incidents'],
    cols: [defCol('materiel', 'Ref:materiels'), defCol('date_incident', 'Date'),
           defCol('gravite', 'Choice', { choix: ['Mineure', 'Moderee', 'Grave'] }), defCol('description', 'Text'),
           defCol('suite', 'Choice', { choix: SUITES }), defCol('photo', 'Attachments')] },
  { cle: 'reparations', noms: ['REPARATIONS', 'Reparations', 'reparations'],
    cols: [defCol('materiel', 'Ref:materiels'), defCol('date_declaree', 'Date'), defCol('motif', 'Text'), defCol('date_effectuee', 'Date'),
           defCol('intervenant', 'Text'), defCol('description', 'Text'), defCol('pieces_remplacees', 'Text'),
           defCol('date_fabrication_piece', 'Date'), defCol('duree_vie_piece_mois', 'Int')] },
  { cle: 'entretiens', noms: ['ENTRETIENS', 'Entretiens', 'entretiens'],
    cols: [defCol('materiel', 'Ref:materiels'), defCol('date_entretien', 'Date'), defCol('auteur', 'Ref:adherents'),
           defCol('commentaire', 'Text')] },
  { cle: 'demandes', noms: ['DEMANDES', 'DEMANDES_EMPRUNT', 'Demandes', 'demandes'],
    cols: [defCol('demandeur', 'Text'), defCol('besoin', 'Text'), defCol('date_emprunt', 'Date'),
           defCol('date_retour_prevue', 'DateTime:Europe/Paris'), defCol('sortie_activite', 'Text'), defCol('traitee', 'Bool')] },
  /* CONFIG : les noms de colonnes varient (cle/Cle, valeur/Valeur), le chargement les reconnait :
     on ne verifie que l'existence de la table */
  { cle: 'config', noms: ['CONFIG', 'Config', 'config', 'PARAMETRES', 'Parametres'], sansColonnes: true,
    cols: [defCol('Cle', 'Text'), defCol('Valeur', 'Text')] }
];

var etatStructure = null;       /* dernier etat analyse (bandeaux, reglages) */
var erreurStructure = '';       /* echec de la creation automatique (droits...) */
var structureTentee = false;    /* une seule tentative automatique par chargement de page */

function versionSup(a, b) {
  var pa = String(a || '0').split('.').map(Number), pb = String(b || '0').split('.').map(Number);
  for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
    var x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}
function valeurMarqueur() {
  var r = (configRows || []).filter(function (x) { return x.cle === 'structure_version'; })[0];
  return r && r.valeur ? String(r.valeur).trim() : '';
}

/* Compare le document au SCHEMA. Lecture seule. */
async function analyserStructure() {
  var presentes = null;
  try { presentes = await grist.docApi.listTables(); } catch (e) { presentes = null; }
  if (!presentes) presentes = Object.keys(resolvedNames).map(function (k) { return resolvedNames[k]; });
  var reels = {}, cols = {};
  for (var i = 0; i < SCHEMA.length; i++) {
    var def = SCHEMA[i];
    var reel = def.noms.filter(function (n) { return presentes.indexOf(n) !== -1; })[0] || null;
    reels[def.cle] = reel;
    if (!reel || def.sansColonnes) continue;
    if (colonnesConnues[def.cle] && resolvedNames[def.cle] === reel) cols[def.cle] = colonnesConnues[def.cle];
    else {
      try { cols[def.cle] = Object.keys(await grist.docApi.fetchTable(reel)); } catch (e) { cols[def.cle] = []; }
    }
  }
  var lu = valeurMarqueur();
  var absents = [];
  SCHEMA.forEach(function (def) {
    if (!reels[def.cle]) {
      absents.push({ type: 'table', cle: def.cle, nom: def.noms[0], def: def, depuis: def.depuis || '0',
                     libelle: 'table ' + def.noms[0] });
      return;
    }
    if (def.sansColonnes) return;
    def.cols.forEach(function (c) {
      if (cols[def.cle].indexOf(c.id) === -1) {
        absents.push({ type: 'colonne', cle: def.cle, nom: reels[def.cle], col: c, depuis: c.depuis,
                       libelle: reels[def.cle] + '.' + c.id });
      }
    });
  });
  return {
    reels: reels, absents: absents,
    sansStructure: SCHEMA.filter(function (d) { return d.coeur && reels[d.cle]; }).length === 0,
    marqueur: lu || (reels.materiels ? STRUCTURE_BASE : '')
  };
}

function typeGrist(type, reels) {
  var m = /^Ref:(.+)$/.exec(type);
  if (!m) return type;
  var def = SCHEMA.filter(function (d) { return d.cle === m[1]; })[0];
  return 'Ref:' + (reels[m[1]] || (def && def.noms[0]) || m[1]);
}
function infoColonne(c, reels) {
  var info = { type: typeGrist(c.type, reels), isFormula: false };
  if (c.choix) info.widgetOptions = JSON.stringify({ widget: 'TextBox', alignment: 'left', choices: c.choix, choiceOptions: {} });
  return info;
}
/* Actions Grist pour creer `liste` : tables dans l'ordre du SCHEMA (les references
   pointent vers des tables deja creees) ; une colonne qui reference SA PROPRE table
   (MATERIELS.origine_decoupe) est ajoutee apres la creation de la table. */
function actionsCreation(liste, reels) {
  var ordre = {};
  SCHEMA.forEach(function (d, i) { ordre[d.cle] = i; });
  var tri = liste.slice().sort(function (a, b) {
    return (ordre[a.cle] - ordre[b.cle]) || (a.type === 'table' ? -1 : 1);
  });
  var actions = [];
  tri.forEach(function (a) {
    if (a.type === 'table') {
      var propres = [], apres = [];
      a.def.cols.forEach(function (c) { (c.type === 'Ref:' + a.def.cle ? apres : propres).push(c); });
      actions.push(['AddTable', a.def.noms[0], propres.map(function (c) {
        var i = infoColonne(c, reels); i.id = c.id; return i;
      })]);
      apres.forEach(function (c) { actions.push(['AddColumn', a.def.noms[0], c.id, infoColonne(c, reels)]); });
    } else {
      actions.push(['AddColumn', a.nom, a.col.id, infoColonne(a.col, reels)]);
    }
  });
  return actions;
}
/* ecrit la marque de structure dans CONFIG (si la table existe et si on peut ecrire) */
async function memoriserStructure() {
  if (!configDiag || !configDiag.table) return false;
  try {
    var ex = (configRows || []).filter(function (r) { return r.cle === 'structure_version'; })[0];
    var champs = {}; champs[configDiag.colCle] = 'structure_version'; champs[configDiag.colVal] = SCHEMA_VERSION;
    await appliquer([ex ? ['UpdateRecord', configDiag.table, ex.id, champs] : ['AddRecord', configDiag.table, null, champs]]);
    await chargerConfig();   /* relit CONFIG : la marque (et son numero de ligne) est connue sans attendre le chargement suivant */
    return true;
  } catch (e) { return false; }
}
function resumeAbsents(liste) { return liste.map(function (a) { return a.libelle; }).join(', '); }

/* Appele par load() : cree ce qui est NOUVEAU depuis la derniere mise a jour.
   Renvoie vrai si la structure a change (load() se relance alors). */
async function assurerStructure() {
  if (structureTentee) return false;
  structureTentee = true;
  try {
    var et = await analyserStructure();
    etatStructure = et;
    if (et.sansStructure) return false;           /* installation : proposee, jamais automatique */
    var nouveaux = function (e) { return e.absents.filter(function (a) { return versionSup(a.depuis, e.marqueur); }); };
    var auto = nouveaux(et);
    if (auto.length) {
      /* re-verification juste avant d'ecrire : deux utilisateurs peuvent ouvrir le document en meme temps */
      var frais = await analyserStructure();
      auto = nouveaux(frais);
      if (auto.length) {
        await appliquer(actionsCreation(auto, frais.reels));
        etatStructure = null;
        erreurStructure = '';
        flashToast('Structure du document mise \u00e0 jour : ' + resumeAbsents(auto) + '.');
        setTimeout(function () { memoriserStructure(); }, 0);   /* CONFIG est relue au rechargement */
        return true;
      }
    }
    if (versionSup(SCHEMA_VERSION, et.marqueur)) await memoriserStructure();
  } catch (e) {
    erreurStructure = 'Mise \u00e0 jour automatique de la structure impossible : ' + (e && e.message ? e.message : e);
    console.error(erreurStructure);
  }
  return false;
}
/* installation dans un document vide / creation sur demande */
async function creerElementsStructure(liste, apres) {
  var et = await analyserStructure();
  await appliquer(actionsCreation(liste, et.reels));
  erreurStructure = '';
  etatStructure = null;
  await load();
  await memoriserStructure();
  if (apres) apres();
}
async function installerStructure() {
  var et = await analyserStructure();
  if (!et.absents.length) return;
  if (!confirm('Installer la structure d\u2019EPILOG dans ce document ?\n\n' + et.absents.length +
      ' tables seront cr\u00e9\u00e9es (' + et.absents.map(function (a) { return a.nom; }).join(', ') +
      ').\nRien n\u2019existant n\u2019est modifi\u00e9.')) return;
  try {
    await creerElementsStructure(et.absents);
    flashToast('Structure d\u2019EPILOG install\u00e9e.');
  } catch (e) {
    erreurStructure = 'Installation impossible : ' + e.message +
      ' (il faut le droit de modifier la structure du document : demandez \u00e0 un propri\u00e9taire).';
    flashToast(erreurStructure);
    try { etatStructure = await analyserStructure(); await load(); } catch (e2) { /* le bandeau reste tel quel */ }
  }
}
async function completerStructure(liste) {
  if (!liste || !liste.length) return;
  if (!confirm('Cr\u00e9er dans ce document :\n\n- ' + liste.map(function (a) { return a.libelle; }).join('\n- ') +
      '\n\nRien d\u2019existant n\u2019est modifi\u00e9.')) return;
  try {
    await creerElementsStructure(liste, function () { renderStructure(document.getElementById('structureZone')); });
    flashToast('Structure compl\u00e9t\u00e9e.');
  } catch (e) {
    erreurStructure = 'Cr\u00e9ation impossible : ' + e.message + ' (droit de modifier la structure requis).';
    renderStructure(document.getElementById('structureZone'));
  }
}
async function creerParCle(cles) {
  var et = await analyserStructure();
  var liste = et.absents.filter(function (a) { return cles.indexOf(a.cle) !== -1; });
  if (liste.length) await creerElementsStructure(liste);
}

/* Bandeau de la Vue d'ensemble */
function bandeauStructureHtml() {
  if (!etatStructure) return '';
  if (etatStructure.sansStructure) {
    return '<div class="encadre-warn" style="margin-bottom:12px"><b>Ce document ne contient pas encore la structure d\u2019EPILOG.</b> ' +
      'Elle peut \u00eatre install\u00e9e en un clic (' + etatStructure.absents.length + ' tables vides ; rien n\u2019existant n\u2019est modifi\u00e9). ' +
      (erreurStructure ? '<br><span style="color:#a3242a">' + esc(erreurStructure) + '</span>' : '') +
      '<div style="margin-top:8px"><button type="button" id="btnInstallerStructure">Installer la structure d\u2019EPILOG</button></div></div>';
  }
  if (erreurStructure) {
    var auto = etatStructure.absents.filter(function (a) { return versionSup(a.depuis, etatStructure.marqueur); });
    return '<div class="encadre-warn" style="margin-bottom:12px"><b>La structure de ce document n\u2019est pas \u00e0 jour</b>' +
      (auto.length ? ' (manquant : ' + esc(resumeAbsents(auto)) + ')' : '') + '. ' + esc(erreurStructure) +
      ' Un propri\u00e9taire du document doit ouvrir EPILOG une fois pour la compl\u00e9ter.</div>';
  }
  return '';
}
document.addEventListener('click', function (e) {
  var b = e.target && e.target.closest ? e.target.closest('#btnInstallerStructure') : null;
  if (b) installerStructure();
});

/* Reglages > Fonctionnement > Structure du document */
async function renderStructure(zone) {
  if (!zone) return;
  zone.innerHTML = '<p class="hint">V\u00e9rification...</p>';
  var et;
  try { et = await analyserStructure(); }
  catch (e) { zone.innerHTML = '<p class="hint" style="color:#a3242a">V\u00e9rification impossible : ' + esc(e.message) + '</p>'; return; }
  var html = '<p class="hint" style="margin:0 0 6px">Structure appliqu\u00e9e : version ' + esc(et.marqueur || 'inconnue') +
    ' (logiciel : ' + SCHEMA_VERSION + '). \u00c0 chaque mise \u00e0 jour, EPILOG cr\u00e9e lui-m\u00eame les tables et colonnes nouvelles.</p>';
  if (!et.absents.length) {
    html += '<p style="margin:4px 0">\u2713 Tous les \u00e9l\u00e9ments attendus sont pr\u00e9sents.</p>';
  } else {
    html += '<p style="margin:4px 0">' + et.absents.length + ' \u00e9l\u00e9ment(s) manquant(s) :</p><ul style="margin:4px 0 8px 18px">' +
      et.absents.map(function (a) {
        var auto = versionSup(a.depuis, et.marqueur);
        return '<li>' + esc(a.libelle) + ' <span class="hint">' + (auto && !erreurStructure
          ? '\u2014 sera cr\u00e9\u00e9 automatiquement au prochain chargement'
          : (auto ? '\u2014 cr\u00e9ation automatique impossible' : '\u2014 \u00e9l\u00e9ment plus ancien ou facultatif : jamais cr\u00e9\u00e9 sans votre demande')) + '</span></li>';
      }).join('') + '</ul><button type="button" id="btnCompleterStructure">Cr\u00e9er les \u00e9l\u00e9ments manquants</button>';
  }
  if (erreurStructure) html += '<p class="hint" style="color:#a3242a;margin-top:6px">' + esc(erreurStructure) + '</p>';
  zone.innerHTML = html;
  var b = zone.querySelector('#btnCompleterStructure');
  if (b) b.onclick = function () { completerStructure(et.absents); };
}

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
    commentaire: ['commentaire'], statut: ['statut'], sortie: ['sortie du parc', 'date de sortie'],
    dernierControle: ['dernier controle', 'date du dernier controle'],
    resultatControle: ['resultat', 'resultat du dernier controle', 'resultat du controle']
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
                     'photos', 'notice', 'commande', 'quantite achetee', 'facture', 'photo', 'controle echu'];
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
/* date du dernier controle : vide, « jamais » ou « - » = pas de controle (mots que l'export CSV ecrit) */
function impDateControle(v) {
  var t = impNorm(v);
  if (!t || t === '-' || /^(jamais|aucun|n\/?a)\b/.test(t)) return null;
  return impDate(v);
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
  if (/^jamais/.test(t)) return null;   /* l'export ecrit « jamais controle » pour un exemplaire jamais controle */
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
function impConstruirePlanBrut(classeur) {
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
    if (!cle) {
      /* feuilles du MODELE (mode d'emploi, listes) : normales, inutile de les signaler */
      if (['mode d\u2019emploi', 'mode d\'emploi', 'listes'].indexOf(impNorm(nom)) === -1) P.ignorees.feuilles.push(nom);
      return;
    }
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
    if (marq && /^exemple\b/.test(impNorm(marq))) bad('c\u2019est la ligne d\u2019exemple du mod\u00e8le : supprimez-la');
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
    var dc = impDateControle(v.dernierControle), rc = impResultat(v.resultatControle);
    if (dc === undefined) bad('date du dernier contr\u00f4le illisible (\u00ab ' + impTexte(v.dernierControle) + ' \u00bb) : jj/mm/aaaa');
    else if (dc && dc.approx) bad('date du dernier contr\u00f4le incompl\u00e8te : jj/mm/aaaa');
    if (rc === undefined) bad('r\u00e9sultat du dernier contr\u00f4le illisible (\u00ab ' + impTexte(v.resultatControle) + ' \u00bb) : Conforme, \u00c0 surveiller, \u00c0 r\u00e9parer ou R\u00e9form\u00e9');
    if (ok && rc && !dc) av('resultat_sans_date', 'R\u00e9sultats de dernier contr\u00f4le sans date (ignor\u00e9s)', 'ligne ' + n, 'donnees');
    if (!ok) return;
    rows.push({ n: n, marq: marq, quantite: quantite, cat: cat, lotNom: impTexte(v.lot), fab: impTexte(v.fabricant), mod: impTexte(v.modele),
      dFab: dFab, duree: duree, prix: prix, lieu: impTexte(v.lieu), mes: mes, serie: impTexte(v.serie), couleur: impTexte(v.couleur),
      taille: impTexte(v.taille), comm: impTexte(v.commentaire), motif: impMotifSortie(v.statut), sortie: sortie, dernier: dc, resCtl: rc });
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
        g.lotId = ex.id; g.lotNom = ex.designation; P.infos.lotsReutilises++; return;
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
  var marqAvecFeuille = {};   /* exemplaires que la feuille Controles decrit deja : elle fait foi */
  if (F.controles) F.controles.o.lignes.forEach(function (l) { var k = normMarquage(impTexte(l.v.exemplaire)); if (k) marqAvecFeuille[k] = true; });
  var adh = {}, idAdh = prochain('adherents'), vus = {}, aControle = {};
  (refLists.adherents || []).forEach(function (a) { adh[impNorm(a.nom_complet)] = { id: a.id, nom: a.nom_complet }; });
  /* un controle n'est un DOUBLON que si toute la ligne est identique (exemplaire, date, resultat, controleur,
     type, commentaire) : deux controles du meme jour dont l'un n'a pas de controleur sont deux controles
     (constate sur l'export reel du club). Meme regle face aux controles deja presents dans le document. */
  var dejaDoc = {}, adhNomId = {};
  (refLists.adherents || []).forEach(function (a) { adhNomId[a.id] = impNorm(a.nom_complet); });
  (rawRows.controles || []).forEach(function (c) {
    var d = toDate(c.date_controle);
    dejaDoc[[c.materiel, d ? Math.round(d.getTime() / 1000) : '', c.resultat, adhNomId[c.controleur] || '',
             impNorm(c.type_controle), impNorm(c.commentaire)].join('|')] = true;
  });
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
    var nomC = impTexte(v.controleur), typeL = impTexte(v.type);
    var cle = [matId, d.ts, res, impNorm(nomC), impNorm(typeL && typeControleChoices.indexOf(typeL) !== -1 ? typeL : 'Contr\u00f4le p\u00e9riodique'), impNorm(impTexte(v.commentaire))].join('|');
    if (vus[cle] || dejaDoc[cle]) { P.infos.controlesDoublons++; return; }
    vus[cle] = true;
    var controleur = null;
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
  /* « Dernier controle » de l'Inventaire (colonne courante d'un tableur, et de l'export CSV) : un controle par
     exemplaire, sauf si la feuille Controles en decrit deja pour lui. Resultat absent -> « Conforme » suppose. */
  unites.forEach(function (u) {
    var r = u.row, km = normMarquage(u.marq);
    if (!r.dernier || marqAvecFeuille[km] || !parMarq[km]) return;
    var res = r.resCtl || 'Conforme';
    if (!r.resCtl) av('controle_suppose', 'Dernier contr\u00f4le repris SANS r\u00e9sultat : \u00ab Conforme \u00bb suppos\u00e9 (le mat\u00e9riel est rest\u00e9 en service)', u.marq, 'donnees');
    P.creer.controles.push({ id: idCtl++, materiel: parMarq[km].id, date_controle: r.dernier.ts, controleur: null, resultat: res,
      commentaire: 'Repris de l\u2019inventaire d\u2019origine', type_controle: 'Contr\u00f4le p\u00e9riodique' });
    aControle[km] = true;
  });
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
/* l'analyse peut s'arreter sur une erreur a n'importe quel stade : on aplatit TOUJOURS les listes d'exemplaires */
function impConstruirePlan(classeur) {
  var P = impConstruirePlanBrut(classeur);
  Object.keys(P.av).forEach(function (k) {
    var a = P.av[k], plat = [];
    a.exemples.forEach(function (e) { if (Array.isArray(e)) plat = plat.concat(e); else plat.push(e); });
    a.exemples = plat;
  });
  return P;
}
/* erreurs identiques regroupees : « categorie X inconnue — 80 lignes » au lieu de 80 messages */
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
  var vues = l.slice(0, 8).join(', ') + (l.length > 8 ? ' \u2026' : '');
  return l.length === 1 ? ', ligne ' + vues : ', ' + l.length + ' lignes (' + vues + ')';
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
    (P.erreurs.length ? (function () {
      var G = impGrouperErreurs(P.erreurs);
      return '<h2>Erreurs \u00e0 corriger avant l\u2019import (' + G.length + ')</h2><table>' +
        G.slice(0, 200).map(function (g) { return '<tr><td style="width:24px">\u2610</td><td><b>' + esc(g.feuille) + impLibelleLignes(g) + '</b> : ' + esc(g.msg) + '</td></tr>'; }).join('') +
        (G.length > 200 ? '<tr><td></td><td>\u2026 et ' + (G.length - 200) + ' autres</td></tr>' : '') + '</table>';
    })() : '') +
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
async function impModeleSheetJS() {
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
      ['FACULTATIF : Mise en service \u2014 Couleur \u2014 Taille ou longueur \u2014 Commentaire \u2014 Prix unitaire \u2014 Dur\u00e9e de vie (mois) \u2014 Lot \u2014 Quantit\u00e9 \u2014 Dernier contr\u00f4le (et son r\u00e9sultat).'],
      ['MAT\u00c9RIEL D\u00c9J\u00c0 SORTI DU PARC : Statut = Perdu, Vol\u00e9, R\u00e9form\u00e9 ou C\u00e9d\u00e9, et Sortie du parc = la date. Pr\u00e9cisez la cause dans Commentaire.'],
      ['Laissez vide un Statut ordinaire : EPILOG le calcule lui-m\u00eame.'],
      [''],
      ['LES LOTS'],
      ['Un lot est un achat group\u00e9. EPILOG les constitue automatiquement : m\u00eame cat\u00e9gorie, m\u00eame fabricant, m\u00eame mod\u00e8le, m\u00eame ann\u00e9e de fabrication. Pour forcer un regroupement, remplissez la colonne \u00ab Lot \u00bb (m\u00eame nom = m\u00eame lot).'],
      ['La feuille \u00ab Lots \u00bb est facultative : elle sert \u00e0 pr\u00e9ciser un lot (prix, commentaire\u2026) dont le nom figure dans la colonne \u00ab Lot \u00bb.'],
      [''],
      ['LES CONTR\u00d4LES (facultatif)'],
      ['Le plus simple : la colonne \u00ab Dernier contr\u00f4le \u00bb de l\u2019Inventaire (un contr\u00f4le par exemplaire ; \u00ab Conforme \u00bb si le r\u00e9sultat n\u2019est pas indiqu\u00e9). La feuille \u00ab Contr\u00f4les \u00bb reprend tout l\u2019historique : une ligne par contr\u00f4le (Exemplaire = marquage, Date, R\u00e9sultat obligatoires). Sans elle, les exemplaires sont \u00ab sans contr\u00f4le enregistr\u00e9 \u00bb.'],
      [''],
      ['CE QUE L\u2019IMPORT NE FAIT PAS'],
      ['Il AJOUTE seulement : il ne modifie jamais un exemplaire existant, et refuse un marquage d\u00e9j\u00e0 pr\u00e9sent. Il ne reprend ni photos, ni notices, ni factures, ni commandes, ni pr\u00eats, ni incidents, ni r\u00e9parations.'],
      ['Une cat\u00e9gorie de l\u2019export complet, ou une feuille que l\u2019import ne lit pas, est simplement ignor\u00e9e (le rapport le dit).']
    ], [150]);
    feuille('Inventaire', [['Marquage*', 'Cat\u00e9gorie*', 'Lot', 'Fabricant', 'Mod\u00e8le', 'Num\u00e9ro de s\u00e9rie', 'Couleur', 'Taille ou longueur',
      'Lieu', 'Mise en service', 'Date de fabrication', 'Dur\u00e9e de vie (mois)', 'Prix unitaire', 'Quantit\u00e9', 'Commentaire', 'Statut', 'Sortie du parc', 'Dernier contr\u00f4le', 'R\u00e9sultat du dernier contr\u00f4le']],
      [14, 20, 22, 16, 18, 16, 12, 16, 22, 16, 18, 18, 14, 10, 30, 12, 16, 16, 26]);
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
    ['', 'FACULTATIF : Mise en service \u2014 Couleur \u2014 Taille ou longueur \u2014 Commentaire \u2014 Prix unitaire \u2014 Dur\u00e9e de vie (mois) \u2014 Lot \u2014 Quantit\u00e9 \u2014 Dernier contr\u00f4le (et son r\u00e9sultat).'],
    ['', 'MAT\u00c9RIEL D\u00c9J\u00c0 SORTI DU PARC : Statut = Perdu, Vol\u00e9, R\u00e9form\u00e9 ou C\u00e9d\u00e9, et Sortie du parc = la date. Pr\u00e9cisez la cause dans Commentaire. Laissez vide un Statut ordinaire : EPILOG le calcule lui-m\u00eame.'],
    ['', ''],
    ['h', 'LES LOTS'],
    ['', 'Un lot est un achat group\u00e9. EPILOG les constitue automatiquement : m\u00eame cat\u00e9gorie, m\u00eame fabricant, m\u00eame mod\u00e8le, m\u00eame ann\u00e9e de fabrication. Pour forcer un regroupement, remplissez la colonne \u00ab Lot \u00bb (m\u00eame nom = m\u00eame lot). La feuille \u00ab Lots \u00bb est facultative : elle pr\u00e9cise un lot (prix, commentaire\u2026) dont le nom figure dans la colonne \u00ab Lot \u00bb.'],
    ['', ''],
    ['h', 'LES CONTR\u00d4LES (facultatif)'],
    ['', 'Le plus simple : la colonne \u00ab Dernier contr\u00f4le \u00bb de l\u2019Inventaire (un contr\u00f4le par exemplaire ; \u00ab Conforme \u00bb si le r\u00e9sultat n\u2019est pas indiqu\u00e9). La feuille \u00ab Contr\u00f4les \u00bb reprend tout l\u2019historique : une ligne par contr\u00f4le (Exemplaire = marquage, Date, R\u00e9sultat obligatoires). Sans elle, les exemplaires sont \u00ab sans contr\u00f4le enregistr\u00e9 \u00bb.'],
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
      ['Sortie du parc', 16, 'fac', 'Date de la sortie (jj/mm/aaaa). Pr\u00e9cisez la cause dans Commentaire.'],
      ['Dernier contr\u00f4le', 16, 'fac', 'Date du dernier contr\u00f4le (jj/mm/aaaa). \u00c9vite que l\u2019exemplaire arrive sans contr\u00f4le : son \u00e9ch\u00e9ance part de cette date.'],
      ['R\u00e9sultat du dernier contr\u00f4le', 26, 'fac', 'Facultatif. \u00c0 d\u00e9faut : Conforme (le mat\u00e9riel est rest\u00e9 en service).']
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
  menu(inv, 'S2:S' + NB, 'ListeResultats', 'information', 'R\u00e9sultat', 'Conforme, \u00c0 surveiller, \u00c0 r\u00e9parer ou R\u00e9form\u00e9.');
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

/* ------------------------------ modele CSV (2026.5.31) ------------------------------
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
    'Commentaire': 'Ligne d\u2019exemple : a supprimer' };
  telechargerCsv([cols, cols.map(function (c) { return ex[c] === undefined ? '' : ex[c]; })], nomFichierDuJour('modele-import', 'csv'), 'importPanel');
  var msg = document.getElementById('impMsg');
  if (msg) { msg.style.color = ''; msg.textContent = 'Mod\u00e8le CSV t\u00e9l\u00e9charg\u00e9 : supprimez la ligne d\u2019exemple avant d\u2019importer.'; }
}
function impPopupModeleCsv() {
  if (document.getElementById('impPopup')) return;
  var cats = (refLists.categories || []).map(function (c) { return c.nom; });
  var fond = document.createElement('div');
  fond.id = 'impPopup';
  fond.setAttribute('role', 'dialog'); fond.setAttribute('aria-modal', 'true'); fond.setAttribute('aria-label', 'Mod\u00e8le CSV : limites');
  fond.style.cssText = 'position:fixed;inset:0;background:rgba(15,25,45,.55);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px';
  fond.innerHTML = '<div style="background:#fff;border-radius:12px;max-width:600px;width:100%;max-height:90vh;overflow:auto;padding:20px 22px;box-shadow:0 10px 40px rgba(0,0,0,.35)">' +
    '<h3 style="margin:0 0 8px;color:#1B3668">Mod\u00e8le CSV : \u00e0 savoir avant de le t\u00e9l\u00e9charger</h3>' +
    '<p style="margin:0 0 8px">Ce fichier reprend les <b>m\u00eames colonnes que l\u2019export CSV</b> du mat\u00e9riel (sans celles qu\u2019EPILOG calcule). Plus simple que le mod\u00e8le Excel, mais :</p>' +
    '<ul style="margin:0 0 10px 18px;line-height:1.5">' +
      '<li><b>Les cat\u00e9gories doivent d\u00e9j\u00e0 exister dans EPILOG</b> : un CSV ne peut pas les d\u00e9crire (nature r\u00e9glementaire, dur\u00e9e de vie). ' +
        (cats.length ? 'Celles de votre club : <b>' + cats.map(esc).join(', ') + '</b>.' : '<b>Aucune n\u2019existe encore</b> : cr\u00e9ez-les d\u2019abord dans Listes du club, ou utilisez le mod\u00e8le Excel.') + '</li>' +
      '<li>Ni mode d\u2019emploi ni menus : <b>ne renommez pas les titres de colonnes</b>, et <b>supprimez la ligne d\u2019exemple</b>.</li>' +
      '<li><b>Excel abime les CSV</b> \u00e0 l\u2019ouverture : z\u00e9ros initiaux perdus (007 devient 7), longs num\u00e9ros de s\u00e9rie transform\u00e9s, dates reformat\u00e9es. Utilisez un \u00e9diteur de texte, ou enregistrez au format \u00ab CSV UTF-8 \u00bb.</li>' +
      '<li>Dates au format <b>jj/mm/aaaa</b> (ou l\u2019ann\u00e9e seule pour la fabrication).</li>' +
      '<li>L\u2019import <b>ne reprend pas</b> : photos, notices, factures, commandes, pr\u00eats, incidents, r\u00e9parations, ni l\u2019historique complet des contr\u00f4les (seulement le dernier).</li></ul>' +
    '<div class="form-actions"><button type="button" id="impPopupOk">J\u2019ai compris, t\u00e9l\u00e9charger</button>' +
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

/* ============ rubrique Import / export (2026.5.33) ============
   Un seul endroit, organise par intention : reprendre un inventaire, exporter tout le
   parc, sauvegarder et restaurer. Les exports qui suivent un ecran (registre d'un lot,
   bon de pret, controles, achats, liste filtree du Materiel) restent a cote de leur objet. */
function renderDonnees() {
  var z = document.getElementById('pane-donnees');
  if (!z) return;
  z.innerHTML =
    '<div class="form-panel" style="margin-top:0"><h3 class="donnees-titre">1. Reprendre un inventaire</h3>' +
      '<div id="importPanel"></div></div>' +
    '<div class="form-panel" style="margin-top:12px"><h3 class="donnees-titre">2. Exporter tout le parc</h3>' +
      '<p class="hint" style="margin:0 0 8px">Tout le mat\u00e9riel, sans tenir compte des filtres de l\u2019onglet Mat\u00e9riel.</p>' +
      '<div class="export-parc" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">' +
        '<button type="button" id="exportParcXlsx">Classeur Excel (.xlsx)</button>' +
        '<button type="button" class="secondary" id="exportParcCsv">Inventaire (CSV)</button>' +
        '<button type="button" class="secondary" id="exportParcInv">Inventaire imprimable</button>' +
        '<button type="button" class="secondary" id="exportParcFiches">Fiches de vie (PDF)\u2026</button>' +
        '<span id="exportParcMsg" class="form-msg"></span></div>' +
      '<div id="exportFichesPanel"></div></div>' +
    '<div class="form-panel" style="margin-top:12px"><h3 class="donnees-titre">3. Sauvegarder et restaurer</h3>' +
      '<div id="donneesSauvegarde"></div></div>' +
    '<div id="donneesRepli"></div>';
  impMonterPanneau(document.getElementById('importPanel'));
  document.getElementById('exportParcXlsx').onclick = exporterLisibleXlsx;
  document.getElementById('exportParcCsv').onclick = function () { exporterInventaireCsv(true); };
  document.getElementById('exportParcInv').onclick = function () { exporterInventaireImprimable(true); };
  document.getElementById('exportParcFiches').onclick = ouvrirConfigFichesPdf;
  renderSauvegarde(document.getElementById('donneesSauvegarde'));
}
/* liens internes data-nav ajoutes apres coup (ex. carte « Premiers pas ») */
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('a.lien-import');
  if (a) { e.preventDefault(); naviguer('donnees'); }
});

/* ------------------------------ interface ------------------------------ */
function impBasculerPanneau() {
  var z = document.getElementById('importPanel');
  if (!z) return;
  if (z.innerHTML) { z.innerHTML = ''; return; }
  impMonterPanneau(z);
}
function impMonterPanneau(z) {
  z.innerHTML = '<div class="form-panel" style="margin-top:10px">' +
    '<p style="margin:0 0 6px"><b>Importer un inventaire existant</b> \u2014 pour passer d\u2019un tableur \u00e0 EPILOG sans tout ressaisir.</p>' +
    '<p class="hint" style="margin:0 0 8px">1. T\u00e9l\u00e9chargez le mod\u00e8le \u00b7 2. Collez-y votre inventaire (collage en valeurs) \u00b7 3. Importez-le ici : un aper\u00e7u et un rapport s\u2019affichent <b>avant</b> toute \u00e9criture.</p>' +
    '<div class="form-actions"><button type="button" class="secondary" id="impModele">T\u00e9l\u00e9charger le mod\u00e8le (Excel)</button>' +
      '<button type="button" class="secondary" id="impModeleCsv">Mod\u00e8le CSV\u2026</button>' +
      '<input type="file" id="impFichier" accept=".xlsx,.xls,.ods,.csv"> ' +
      '</div>' +
    '<p class="form-msg" id="impMsg" style="display:block;margin:6px 0"></p><div id="impResultat"></div></div>';
  document.getElementById('impModele').onclick = impTelechargerModele;
  document.getElementById('impModeleCsv').onclick = impPopupModeleCsv;
  document.getElementById('impFichier').onchange = function () {
    var f = this.files && this.files[0];
    this.value = '';   /* choisir deux fois de suite le MEME fichier (corrige entre-temps) ne declenche pas 'change' */
    impAnalyser(f);
  };
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
  var colsIgn = P.ignorees.colonnes.length
    ? '<div class="encadre-warn" style="margin-top:8px"><b>Colonnes non reconnues, donc ignor\u00e9es :</b> ' +
      P.ignorees.colonnes.slice(0, 12).map(function (c) { var i = c.indexOf(' : '); return '\u00ab ' + esc(c.slice(i + 3)) + ' \u00bb (' + esc(c.slice(0, i)) + ')'; }).join(', ') +
      (P.ignorees.colonnes.length > 12 ? ' \u2026' : '') +
      '.<br>Si l\u2019une contient des donn\u00e9es \u00e0 importer, renommez son titre comme dans le mod\u00e8le.</div>' : '';
  if (P.erreurs.length) {
    var G = impGrouperErreurs(P.erreurs);
    html += '<div class="encadre-warn"><b>' + G.length + ' erreur' + (G.length > 1 ? 's' : '') + ' \u00e0 corriger' +
      (P.erreurs.length > G.length ? ' (' + P.erreurs.length + ' lignes concern\u00e9es)' : '') + ' \u2014 rien n\u2019est import\u00e9.</b><ul style="margin:6px 0 0 18px">' +
      G.slice(0, 40).map(function (g) { return '<li><b>' + esc(g.feuille) + impLibelleLignes(g) + '</b> : ' + esc(g.msg) + '</li>'; }).join('') +
      (G.length > 40 ? '<li>\u2026 et ' + (G.length - 40) + ' autres (liste compl\u00e8te dans le rapport)</li>' : '') + '</ul></div>' + colsIgn +
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
      '</div>' + colsIgn +
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


/* ==================== Fenetres d'edition (2026.5.38) ====================
   Demande de Pierre (maquette validee) : toute edition et toute creation s'ouvre
   dans une fenetre en surimpression ; la liste reste en place derriere.
   PRINCIPE : on ne reecrit aucun formulaire. Les emplacements existants
   (conteneurs *-editor, formulaires de creation form*) deviennent des fenetres
   des qu'ils s'ouvrent : un observateur leur pose la classe .en-fenetre (CSS :
   position fixe, centree, largeur maitrisee, defilement interne) et affiche un
   voile. Fermer = vider le conteneur ou cliquer le bouton Annuler du formulaire,
   comme avant.
   SAISIE PROTEGEE (skill « fenetres protegees », adaptee) : tant que rien n'a ete
   tape, clic sur le voile ou Echap ferment ; apres une saisie reelle, la fenetre
   tremble et rappelle de fermer avec Annuler ou ✕. Les boutons explicites ferment
   toujours. Meme regle pour Reglages, Decouper et Scinder. */
var FENETRES = [
  { id: 'materiel-editor' }, { id: 'prets-editor' }, { id: 'controles-editor' },
  { id: 'incidents-editor' }, { id: 'budget-editor' }, { id: 'refs-editor' },
  { id: 'formLot', annuler: 'btnCancelLot', titre: 'Nouveau lot de mat\u00e9riel', objet: function () { return 'Un mod\u00e8le achet\u00e9 et ses exemplaires'; } },
  { id: 'formPret', annuler: 'btnCancelPret', large: true, titre: 'Nouveau pr\u00eat',
    objet: function () { return aColonne('emprunts', 'numero_emprunt') ? 'Bon n\u00b0 ' + genererNumeroEmprunt() : 'Un ou plusieurs exemplaires'; } },
  { id: 'formCtrl', annuler: 'btnCancelCtrl', large: true, titre: 'Nouveau contr\u00f4le', objet: function () { return 'Un ou plusieurs exemplaires'; } },
  { id: 'formInc', annuler: 'btnCancelInc', large: true, titre: 'D\u00e9clarer un incident', objet: function () { return 'Un ou plusieurs exemplaires'; } },
  { id: 'formDeclarerRep', annuler: 'btnCancelRep', large: true, titre: 'D\u00e9clarer une r\u00e9paration', objet: function () { return 'Un ou plusieurs exemplaires'; } },
  { id: 'formAchat', annuler: 'btnCancelAchat', titre: 'Nouvelle commande', objet: function () { return 'Commande, facture et financement'; } },
  { id: 'formEnt', annuler: 'btnCancelEnt', large: true, titre: 'D\u00e9clarer un entretien', objet: function () { return 'Un ou plusieurs exemplaires'; } }
];
/* En-tete des fenetres (maquette validee) : l'action en petites capitales rouges, puis l'objet en gras. */
function enteteFenetre(action, objet) {
  return '<div class="fenetre-entete"><div class="fenetre-action">' + esc(action) + '</div>' +
    (objet ? '<div class="fenetre-objet">' + esc(objet) + '</div>' : '') + '</div>';
}
/* ce sur quoi porte un editeur : le marquage, le nom, la reference... */
function objetEdite(entity, row) {
  if (!row) return '';
  var marq = function (id) { var m = (rawRows.materiels || []).filter(function (x) { return x.id === id; })[0]; return m ? (m.numero_marquage || ('#' + m.id)) : ''; };
  var lotDe = function (id) { return ((refLists.lots || []).filter(function (l) { return l.id === id; })[0] || {}).designation || ''; };
  var adh = function (id) { return ((refLists.adherents || []).filter(function (a) { return a.id === id; })[0] || {}).nom_complet || ''; };
  var j = function (parts, sep) { return parts.filter(Boolean).join(sep); };
  switch (entity) {
    case 'lot': return row.designation || '';
    case 'materiel': return j([row.numero_marquage, lotDe(row.lot)], ' \u2014 ');
    case 'emprunt': return j([marq(row.materiel), adh(row.adherent)], ' \u00b7 ');
    case 'controle': return j([marq(row.materiel), row.date_controle ? fmtDate(row.date_controle) : ''], ' \u00b7 ');
    case 'incident': return j([marq(row.materiel), row.date_incident ? fmtDate(row.date_incident) : ''], ' \u00b7 ');
    case 'adherent': return row.nom_complet || '';
    case 'achat': return row.ref_commande || '';
    default: return row.nom || '';
  }
}
/* Les anciens « faire defiler jusqu'au formulaire » : un emplacement devenu fenetre est deja
   sous les yeux, on ne fait plus bouger la page derriere (la liste garde sa place). */
function defilerVers(el, opts) {
  if (!el) return;
  majFenetres();
  if (el.classList && el.classList.contains('en-fenetre')) return;
  el.scrollIntoView(opts);
}
function fenetreDef(el) { return FENETRES.filter(function (d) { return d.id === el.id; })[0]; }
function fenetreOuverte(el) {
  var d = fenetreDef(el);
  if (!d) return false;
  if (d.annuler) return el.style.display !== 'none' && el.getClientRects().length > 0;
  return el.children.length > 0 && el.getClientRects().length > 0;
}
function fenetresOuvertes() {
  return FENETRES.map(function (d) { return document.getElementById(d.id); })
    .filter(function (el) { return el && fenetreOuverte(el); });
}
/* ferme sans question (boutons explicites, ou fenetre sans saisie) */
function fermerFenetre(el) {
  var d = fenetreDef(el);
  if (!d) return;
  delete el.dataset.sale;
  if (d.annuler) {
    var b = document.getElementById(d.annuler);
    if (b) b.click(); else el.style.display = 'none';
  } else {
    el.innerHTML = '';
  }
}
/* saisie protegee : commun aux fenetres d'edition et aux modales existantes */
function avisSaisie(boite) {
  if (boite) {
    boite.classList.remove('fenetre-tremble'); void boite.offsetWidth; boite.classList.add('fenetre-tremble');
    setTimeout(function () { boite.classList.remove('fenetre-tremble'); }, 450);
  }
  var ancien = document.getElementById('avisSaisie');
  if (ancien) ancien.remove();
  var a = document.createElement('div');
  a.id = 'avisSaisie'; a.className = 'avis-saisie'; a.setAttribute('role', 'status');
  a.textContent = 'Saisie en cours : fermez avec « Annuler » ou ✕.';
  document.body.appendChild(a);
  setTimeout(function () { if (a.parentNode) a.remove(); }, 3500);
}
function suivreSaisie(boite) {
  if (!boite || boite.__suivi) return;
  boite.__suivi = true;
  ['input', 'change'].forEach(function (ev) {
    boite.addEventListener(ev, function (e) {
      if (!(e.isTrusted || window.__saisieTest)) return;           /* seulement ce que l'utilisateur tape */
      var t = e.target;
      if (!t || !t.matches || !t.matches('input,textarea,select')) return;
      if (t.type === 'search' || t.type === 'file') return;          /* recherche, photo envoyee aussitot */
      boite.dataset.sale = '1';
    });
  });
}
/* fermeture « douce » (voile, Echap) : refusee si une saisie est en cours */
function fermetureDouce(boite, fermer) {
  if (boite && boite.dataset.sale === '1') { avisSaisie(boite); return false; }
  fermer();
  return true;
}
function majFenetres() {
  var ouvertes = [];
  FENETRES.forEach(function (d) {
    var el = document.getElementById(d.id);
    if (!el) return;
    var ouv = fenetreOuverte(el);
    if (ouv !== !!el.__ouverte) {
      el.__ouverte = ouv;
      delete el.dataset.sale;                                          /* chaque ouverture repart propre */
    }
    if (el.classList.contains('en-fenetre') !== ouv) el.classList.toggle('en-fenetre', ouv);
    var large = ouv && (d.large || !!el.querySelector('#ficheBoutons'));
    if (el.classList.contains('fenetre-large') !== large) el.classList.toggle('fenetre-large', large);
    if (ouv) {
      suivreSaisie(el);
      if (!el.querySelector(':scope > .fenetre-fermer')) {
        var x = document.createElement('button');
        x.type = 'button'; x.className = 'fenetre-fermer'; x.setAttribute('aria-label', 'Fermer'); x.textContent = '✕';
        x.onclick = function () { fermerFenetre(el); };
        el.insertBefore(x, el.firstChild);
      }
      if (d.titre) {
        var t = el.querySelector(':scope > .fenetre-titre');
        if (!t) {
          t = document.createElement('div'); t.className = 'fenetre-titre';
          el.insertBefore(t, el.querySelector(':scope > .fenetre-fermer').nextSibling);
        }
        var html = enteteFenetre(d.titre, d.objet ? d.objet() : '');
        if (t.innerHTML !== html) t.innerHTML = html;            /* objet recalcule (ex. numero du prochain bon) */
      }
      ouvertes.push(el);
    }
  });
  var voile = document.getElementById('voileFenetre');
  if (!voile) {
    voile = document.createElement('div');
    voile.id = 'voileFenetre'; voile.className = 'voile-fenetre'; voile.hidden = true;
    voile.addEventListener('click', function () {
      fenetresOuvertes().forEach(function (el) { fermetureDouce(el, function () { fermerFenetre(el); }); });
    });
    document.body.appendChild(voile);
  }
  if (voile.hidden !== !ouvertes.length) voile.hidden = !ouvertes.length;
  if (document.body.classList.contains('fenetre-ouverte') !== !!ouvertes.length) document.body.classList.toggle('fenetre-ouverte', !!ouvertes.length);
}
new MutationObserver(majFenetres).observe(document.body, {
  subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'hidden']
});
/* Echap : la fenetre d'edition ouverte, sauf si l'aide ou les reglages sont au-dessus (ils gerent la leur) */
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  var aide = document.getElementById('aidePanel'), reg = document.getElementById('reglagesPanel');
  if ((aide && !aide.hidden) || (reg && !reg.hidden) || document.getElementById('decoupeModale') || document.getElementById('scissionModale')) return;
  var ouv = fenetresOuvertes();
  if (!ouv.length) return;
  e.preventDefault();
  ouv.forEach(function (el) { fermetureDouce(el, function () { fermerFenetre(el); }); });
});

/* ------------------------- navigation (2026.5.17) -------------------------
   Menu lateral (ordinateur) et barre du bas (telephone) : ils ACTIONNENT les
   onglets et sous-onglets d'origine, toujours presents dans la page. Aucun
   ecran n'est reecrit ; tout chemin existant (alertes, liens internes, tests)
   qui clique un onglet met aussi la navigation a jour (majNav, observateur). */
function naviguer(cible) {
  var p = String(cible).split(':'), t = p[0], sous = p[1];
  if (t === 'plus') {
    document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
    document.querySelectorAll('.pane').forEach(function (x) { x.classList.remove('active'); });
    var pp = document.getElementById('pane-plus');
    if (pp) pp.classList.add('active');
  } else {
    var tab = document.querySelector('.tab[data-t="' + t + '"]');
    if (tab) tab.click();
    if (sous) {
      var barre = t === 'controles' ? 'epi-so' : (t === 'refs' ? 'refs-so' : null);
      var so = barre ? document.querySelector('#' + barre + ' .sous-onglet[data-se="' + sous + '"]') : null;
      if (so && !so.hidden) so.click();
    }
  }
  majNav();
  window.scrollTo(0, 0);
}
function majNav() {
  var tabA = document.querySelector('.tab.active');
  var plusA = document.getElementById('pane-plus');
  var t = tabA ? tabA.dataset.t : (plusA && plusA.classList.contains('active') ? 'plus' : '');
  var soE = document.querySelector('#epi-so .sous-onglet.actif');
  var soR = document.querySelector('#refs-so .sous-onglet.actif');
  document.querySelectorAll('[data-nav]').forEach(function (b) {
    var p = b.dataset.nav.split(':');
    var actif = p[0] === t;
    if (actif && p[1] && b.closest('#navLaterale')) {
      var so = t === 'controles' ? soE : (t === 'refs' ? soR : null);
      actif = !!so && so.dataset.se === p[1];
    }
    if (b.closest('#pane-plus')) actif = false;
    if (b.classList.contains('nav-actif') !== actif) b.classList.toggle('nav-actif', actif);
    if (actif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  /* compteurs et visibilite recopies des sous-onglets d'origine */
  document.querySelectorAll('#navLaterale [data-miroir]').forEach(function (s) {
    var src = document.getElementById(s.dataset.miroir);
    var txt = src ? src.textContent.replace(/[()]/g, '').trim() : '';
    if (s.textContent !== txt) s.textContent = txt;
  });
  var soEnt = document.querySelector('#epi-so .sous-onglet[data-se="entretiens"]');
  var nlEnt = document.querySelector('#navLaterale [data-nav="controles:entretiens"]');
  if (soEnt && nlEnt && nlEnt.hidden !== soEnt.hidden) nlEnt.hidden = soEnt.hidden;
  var cp = document.querySelector('#navLaterale [data-compte="prets"]');
  if (cp) {
    var n = (rawRows.materiels || []).filter(function (m) { return m._statut === 'Prete'; }).length;
    var v = n ? String(n) : '';
    if (cp.textContent !== v) cp.textContent = v;
  }
}
document.querySelectorAll('[data-nav]').forEach(function (b) {
  b.addEventListener('click', function () { naviguer(b.dataset.nav); });
});
/* Menu lateral retractable (2026.5.18) : icones seules + infobulles.
   Le choix est memorise dans ce navigateur (localStorage, protege : s'il est
   indisponible, le menu reste simplement deplie). */
function appliquerMenuReplie(replie) {
  var nl = document.getElementById('navLaterale');
  var bt = document.getElementById('nlReplier');
  if (!nl || !bt) return;
  nl.classList.toggle('replie', replie);
  var disp = nl.closest('.disposition');
  if (disp) disp.classList.toggle('menu-replie', replie);
  bt.setAttribute('aria-expanded', replie ? 'false' : 'true');
  bt.title = replie ? 'D\u00e9plier le menu' : 'R\u00e9duire le menu';
  var lib = bt.querySelector('.nl-lib');
  if (lib) lib.textContent = replie ? 'D\u00e9plier le menu' : 'R\u00e9duire le menu';
}
(function () {
  var replie = false;
  try { replie = localStorage.getItem('epilog.menuReplie') === '1'; } catch (e) { /* stockage indisponible */ }
  appliquerMenuReplie(replie);
  var bt = document.getElementById('nlReplier');
  if (bt) bt.addEventListener('click', function () {
    var r = !document.getElementById('navLaterale').classList.contains('replie');
    appliquerMenuReplie(r);
    try { localStorage.setItem('epilog.menuReplie', r ? '1' : '0'); } catch (e) { /* sans effet */ }
  });
})();
document.querySelectorAll('#pane-plus [data-plus]').forEach(function (b) {
  b.addEventListener('click', function () {
    if (b.dataset.plus === 'reglages') ouvrirReglages(); else ouvrirAide();
  });
});
new MutationObserver(function () {
  clearTimeout(window.__navTimeout);
  window.__navTimeout = setTimeout(majNav, 30);
}).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });

renderControlesActions();
grist.onRecords(load);

/* la detection des colonnes n'est connue qu'apres le premier chargement :
   le formulaire d'incident est donc construit ensuite */
load().then(function () {
  renderIncidentsActions();
  renderMaterielActions();
  /* formCtrl (Controles, incidents et reparations) est construit une seule fois par renderControlesActions(),
     appelé avant load() : aColonne('controles','type_controle') vaut false a ce moment.
     On reconstruit apres load() pour que le champ Type apparaisse si la colonne existe. */
  renderControlesActions();
  var mats = (rawRows && rawRows.materiels) ? rawRows.materiels.length : 0;
  majFiltresMateriel(mats, mats, false);
});
