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
        '<span class="hint">(conservation r\u00e9glementaire \u00e9chue : fiches \u00e0 archiver)</span></label>' +
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

