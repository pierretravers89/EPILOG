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
function C(id, type, opt) { var o = opt || {}; return { id: id, type: type, choix: o.choix || null, depuis: o.depuis || '0' }; }
var SCHEMA = [
  { cle: 'fournisseurs', coeur: true, noms: ['FOURNISSEURS', 'Fournisseurs', 'fournisseurs'],
    cols: [C('nom', 'Text'), C('contact', 'Text'), C('telephone', 'Text'), C('email', 'Text')] },
  { cle: 'categories', coeur: true, noms: ['CATEGORIES', 'Categories', 'categories'],
    cols: [C('nom', 'Text'), C('type_epi', 'Choice', { choix: TYPES_EPI }), C('duree_vie_defaut_mois', 'Numeric'),
           C('prefixe', 'Text'), C('maintenance_fabricant', 'Bool'), C('reparations_acceptees', 'Text'),
           C('peut_etre_decoupe', 'Bool'), C('prolongation_par_reparation', 'Bool')] },
  { cle: 'lieux', coeur: true, noms: ['LIEUX_STOCKAGE', 'Lieux_stockage', 'Lieux_Stockage', 'lieux_stockage'],
    cols: [C('nom', 'Text'), C('description', 'Text')] },
  { cle: 'adherents', coeur: true, noms: ['ADHERENTS', 'Adherents', 'adherents'],
    cols: [C('nom_complet', 'Text'), C('numero_licence', 'Text'), C('role', 'Choice', { choix: ROLES_DEFAUT }),
           C('email', 'Text'), C('telephone', 'Text')] },
  { cle: 'achats', coeur: true, noms: ['ACHATS', 'Achats', 'achats'],
    cols: [C('ref_commande', 'Text'), C('fournisseur', 'Ref:fournisseurs'), C('date_commande', 'Date'),
           C('date_reception', 'Date'), C('montant_total', 'Numeric'),
           C('financement', 'Choice', { choix: FINANCEMENT_DEFAUT }), C('facture', 'Attachments'), C('note_financement', 'Text')] },
  { cle: 'lots', coeur: true, noms: ['LOTS', 'Lots', 'lots'],
    cols: [C('designation', 'Text'), C('categorie', 'Ref:categories'), C('fabricant', 'Text'), C('modele', 'Text'),
           C('achat', 'Ref:achats'), C('date_fabrication', 'Date'), C('duree_vie_mois', 'Numeric'),
           C('prix_unitaire', 'Numeric'), C('quantite_achetee', 'Numeric'), C('commentaire', 'Text'),
           C('photo', 'Attachments'), C('notice', 'Attachments')] },
  { cle: 'materiels', coeur: true, noms: ['MATERIELS', 'Materiels', 'materiels'],
    cols: [C('lot', 'Ref:lots'), C('numero_marquage', 'Text'), C('lieu_stockage', 'Ref:lieux'),
           C('date_mise_en_service', 'Date'), C('hors_service_motif', 'Choice', { choix: MOTIFS_HORS_SERVICE }),
           C('hors_service_date', 'Date'), C('couleur', 'Text'), C('taille', 'Text'), C('commentaire', 'Text'),
           C('origine_decoupe', 'Ref:materiels'), C('numero_serie', 'Text'),
           C('photo', 'Attachments', { depuis: '2026.5.27' })] },
  { cle: 'controles', coeur: true, noms: ['CONTROLES', 'Controles', 'controles'],
    cols: [C('materiel', 'Ref:materiels'), C('date_controle', 'Date'), C('controleur', 'Ref:adherents'),
           C('resultat', 'Choice', { choix: RESULTATS_CONTROLE }), C('commentaire', 'Text'),
           C('type_controle', 'Choice', { choix: TYPE_CONTROLE_DEFAUT }), C('photo', 'Attachments')] },
  { cle: 'emprunts', coeur: true, noms: ['EMPRUNTS', 'Emprunts', 'emprunts'],
    cols: [C('materiel', 'Ref:materiels'), C('adherent', 'Ref:adherents'), C('date_emprunt', 'Date'),
           C('date_retour_prevue', 'Date'), C('date_retour_effective', 'Date'),
           C('etat_retour', 'Choice', { choix: ['Bon etat', 'Degrade', 'Perdu', 'Non rendu'] }),
           C('sortie_activite', 'Text'), C('numero_emprunt', 'Text')] },
  { cle: 'incidents', coeur: true, noms: ['INCIDENTS', 'Incidents', 'incidents'],
    cols: [C('materiel', 'Ref:materiels'), C('date_incident', 'Date'),
           C('gravite', 'Choice', { choix: ['Mineure', 'Moderee', 'Grave'] }), C('description', 'Text'),
           C('suite', 'Choice', { choix: SUITES }), C('photo', 'Attachments')] },
  { cle: 'reparations', noms: ['REPARATIONS', 'Reparations', 'reparations'],
    cols: [C('materiel', 'Ref:materiels'), C('date_declaree', 'Date'), C('motif', 'Text'), C('date_effectuee', 'Date'),
           C('intervenant', 'Text'), C('description', 'Text'), C('pieces_remplacees', 'Text'),
           C('date_fabrication_piece', 'Date'), C('duree_vie_piece_mois', 'Int')] },
  { cle: 'entretiens', noms: ['ENTRETIENS', 'Entretiens', 'entretiens'],
    cols: [C('materiel', 'Ref:materiels'), C('date_entretien', 'Date'), C('auteur', 'Ref:adherents'),
           C('commentaire', 'Text')] },
  { cle: 'demandes', noms: ['DEMANDES', 'DEMANDES_EMPRUNT', 'Demandes', 'demandes'],
    cols: [C('demandeur', 'Text'), C('besoin', 'Text'), C('date_emprunt', 'Date'),
           C('date_retour_prevue', 'DateTime:Europe/Paris'), C('sortie_activite', 'Text'), C('traitee', 'Bool')] },
  /* CONFIG : les noms de colonnes varient (cle/Cle, valeur/Valeur), le chargement les reconnait :
     on ne verifie que l'existence de la table */
  { cle: 'config', noms: ['CONFIG', 'Config', 'config', 'PARAMETRES', 'Parametres'], sansColonnes: true,
    cols: [C('Cle', 'Text'), C('Valeur', 'Text')] }
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
    etatStructure = await analyserStructure();
    if (typeof render === 'function') { try { await load(); } catch (e2) { /* sans effet */ } }
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
          : (auto ? '\u2014 cr\u00e9ation automatique impossible' : '\u2014 module facultatif ou ancien : jamais cr\u00e9\u00e9 sans votre demande')) + '</span></li>';
      }).join('') + '</ul><button type="button" id="btnCompleterStructure">Cr\u00e9er les \u00e9l\u00e9ments manquants</button>';
  }
  if (erreurStructure) html += '<p class="hint" style="color:#a3242a;margin-top:6px">' + esc(erreurStructure) + '</p>';
  zone.innerHTML = html;
  var b = zone.querySelector('#btnCompleterStructure');
  if (b) b.onclick = function () { completerStructure(et.absents); };
}

