p='/home/claude/v2/widget_pilotage.js'; s=open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n, (s.count(a), a[:70]); s=s.replace(a,b)
# exporterSauvegarde renvoie vrai/faux (la remise a zero en depend)
rep("""    messageSauvegarde('Sauvegarde t\\u00e9l\\u00e9charg\\u00e9e : ' + n + ' lignes' +
      (s.pieces_jointes_omises.length ? ', ' + s.pieces_jointes_omises.length + ' pi\\u00e8ce(s) jointe(s) non incluse(s).' : '.'));
  } catch (e) {
    messageSauvegarde('Erreur : ' + e.message, true);
  }
}""","""    messageSauvegarde('Sauvegarde t\\u00e9l\\u00e9charg\\u00e9e : ' + n + ' lignes' +
      (s.pieces_jointes_omises.length ? ', ' + s.pieces_jointes_omises.length + ' pi\\u00e8ce(s) jointe(s) non incluse(s).' : '.'));
    return true;
  } catch (e) {
    messageSauvegarde('Erreur : ' + e.message, true);
    return false;
  }
}

/* ---------------------- remise a zero (2026.5.22) ----------------------
   Decisions de Pierre : deux choix seulement (tout effacer / garder les
   listes du club), reglages TOUJOURS conserves, sauvegarde .json telechargee
   OBLIGATOIREMENT avant, confirmation habituelle \"SUPPRIMER\". Effacement
   d'un bloc (enfants d'abord), tout ou rien. */
var TABLES_LISTES_CLUB = ['categories', 'lieux', 'fournisseurs', 'adherents'];
function tablesAEffacer(choix) {
  return TABLES_SAUVEGARDE.slice().reverse().filter(function (k) {
    return resolvedNames[k] && (choix === 'tout' || TABLES_LISTES_CLUB.indexOf(k) === -1);
  });
}
var NOMS_TABLES_RAZ = { categories: 'cat\\u00e9gories', lieux: 'lieux', fournisseurs: 'fournisseurs', adherents: 'adh\\u00e9rents',
  achats: 'commandes', lots: 'lots', materiels: 'exemplaires', controles: 'contr\\u00f4les', emprunts: 'pr\\u00eats',
  incidents: 'incidents', reparations: 'r\\u00e9parations', entretiens: 'entretiens', demandes: 'demandes' };
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
    ? 'Sera effac\\u00e9\\u00a0: ' + b.map(function (x) { return x.nb + ' ' + NOMS_TABLES_RAZ[x.cle]; }).join(', ') + '.'
    : 'Rien \\u00e0 effacer pour ce choix.';
  var go = document.getElementById('razSauver');
  if (go) go.disabled = !b.length;
}
async function lancerRaz() {
  var choix = (document.querySelector('input[name="razChoix"]:checked') || {}).value || 'tout';
  var zone = document.getElementById('razConfirmation');
  /* 1. sauvegarde obligatoire : on ne va pas plus loin sans elle */
  var ok = await exporterSauvegarde();
  if (!ok) { messageSauvegarde('Sauvegarde impossible : remise \\u00e0 z\\u00e9ro annul\\u00e9e, rien n\\u2019a \\u00e9t\\u00e9 effac\\u00e9.', true); return; }
  /* 2. confirmation habituelle */
  zone.innerHTML = '<div class="encadre-warn" style="margin-top:8px"><b>Sauvegarde t\\u00e9l\\u00e9charg\\u00e9e.</b> ' +
    'V\\u00e9rifiez qu\\u2019elle est bien dans vos t\\u00e9l\\u00e9chargements, puis confirmez. ' + esc(document.getElementById('razBilan').textContent) +
    '<p style="margin:8px 0 4px">Tapez <b>SUPPRIMER</b> pour confirmer :</p>' +
    '<input type="text" class="raz-confirm" autocomplete="off" style="max-width:220px">' +
    '<div class="form-actions" style="margin-top:8px"><button type="button" class="raz-go" style="background:#a3242a">Effacer d\\u00e9finitivement</button>' +
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
      messageSauvegarde('Remise \\u00e0 z\\u00e9ro termin\\u00e9e. Les r\\u00e9glages du club sont conserv\\u00e9s. ' +
        'En cas d\\u2019erreur : r\\u00e9importez la sauvegarde t\\u00e9l\\u00e9charg\\u00e9e' + (choix === 'tout' ? '' : ' (apr\\u00e8s un \\u00ab Tout effacer \\u00bb)') +
        ', ou utilisez l\\u2019historique des versions de Grist.');
    } catch (e) {
      messageSauvegarde('Remise \\u00e0 z\\u00e9ro annul\\u00e9e, rien n\\u2019a \\u00e9t\\u00e9 effac\\u00e9 : ' + e.message, true);
    }
  };
}""")
# section dans la sous-rubrique
rep("""    '<input type="file" id="sauvFichier" accept=".json,application/json">' +
    '<div id="sauvApercu" style="margin-top:8px"></div>' +""","""    '<input type="file" id="sauvFichier" accept=".json,application/json">' +
    '<div id="sauvApercu" style="margin-top:8px"></div>' +
    '<h4 class="reglages-groupe" style="margin-top:18px">Remettre \\u00e0 z\\u00e9ro</h4>' +
    '<p class="hint">Efface les donn\\u00e9es du club. Une <b>sauvegarde est t\\u00e9l\\u00e9charg\\u00e9e d\\u2019office avant</b>, ' +
      'puis une confirmation est demand\\u00e9e. Les r\\u00e9glages (nom du club, couleurs, liens) sont toujours conserv\\u00e9s.</p>' +
    '<label class="coche" style="display:block;margin:4px 0"><input type="radio" name="razChoix" value="tout" checked> ' +
      '<b>Tout effacer</b> \\u2014 mat\\u00e9riel, historique, commandes et listes du club. Permet ensuite d\\u2019importer une sauvegarde.</label>' +
    '<label class="coche" style="display:block;margin:4px 0"><input type="radio" name="razChoix" value="listes"> ' +
      '<b>Garder les listes du club</b> \\u2014 efface le mat\\u00e9riel, l\\u2019historique et les commandes ; conserve cat\\u00e9gories, ' +
      'lieux, fournisseurs et adh\\u00e9rents (un import ne sera alors pas possible).</label>' +
    '<p class="hint" id="razBilan" style="margin:6px 0"></p>' +
    '<div class="form-actions"><button type="button" class="secondary" id="razSauver" style="color:#a3242a;border-color:#e8b4b7">' +
      'T\\u00e9l\\u00e9charger la sauvegarde et continuer</button></div>' +
    '<div id="razConfirmation"></div>' +""")
rep("""  document.getElementById('sauvFichier').onchange = function () { preparerImport(this.files && this.files[0]); };""",
"""  document.getElementById('sauvFichier').onchange = function () { preparerImport(this.files && this.files[0]); };
  document.querySelectorAll('input[name="razChoix"]').forEach(function (r) {
    r.onchange = function () { document.getElementById('razConfirmation').innerHTML = ''; majBilanRaz(); };
  });
  document.getElementById('razSauver').onclick = lancerRaz;
  majBilanRaz();""")
# la zone se reconstruit a chaque ouverture (bilan a jour)
rep("""  if (actif && !z.dataset.rendu) { renderSauvegarde(z); z.dataset.rendu = '1'; }""",
"""  if (actif) renderSauvegarde(z);   /* reconstruit : bilans a jour */""")
open(p,'w',encoding='utf-8').write(s)
h=open('/home/claude/v2/widget_pilotage.html',encoding='utf-8').read()
a='<button type="button" class="sous-onglet" data-se="sauvegarde">Sauvegarde</button>'
assert h.count(a)==1
h=h.replace(a,'<button type="button" class="sous-onglet" data-se="sauvegarde">Sauvegarder / importer des données</button>')
a2="""          <div class="encadre">Grist garde aussi son propre <b>historique des versions</b>"""
assert h.count(a2)==1
h=h.replace(a2,"""          <p><b>Remettre à zéro</b> — deux choix : <b>tout effacer</b> (indispensable avant
             d'importer une sauvegarde), ou effacer le matériel, l'historique et les commandes en
             <b>gardant les listes du club</b>. Une sauvegarde est téléchargée d'office avant, puis on
             confirme en tapant SUPPRIMER. Les réglages du club sont toujours conservés.</p>
"""+a2)
h=h.replace("<b>Réglages → Sauvegarde</b>.","<b>Réglages → Sauvegarder / importer des données</b>.")
open('/home/claude/v2/widget_pilotage.html','w',encoding='utf-8').write(h)
print("ecrit")
