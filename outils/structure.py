import re
p='/home/claude/v2/widget_pilotage.js'; s=open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n, (s.count(a), a[:100]); s=s.replace(a,b)
# 0. version
rep("var VERSION_EPILOG = '2026.5.26';","var VERSION_EPILOG = '2026.5.27';")
# 1. module : avant le bloc navigation
rep("/* ------------------------- navigation (2026.5.17) -------------------------",
    open('/home/claude/outils/structure.js',encoding='utf-8').read() + "/* ------------------------- navigation (2026.5.17) -------------------------")
# 2. crochet dans load() : apres le chargement d'ENTRETIENS
rep("""  var tEnt = await fetchOptionnel('entretiens', ['ENTRETIENS', 'Entretiens', 'entretiens']);
  rawRows.entretiens = rowsOf(tEnt);
""","""  var tEnt = await fetchOptionnel('entretiens', ['ENTRETIENS', 'Entretiens', 'entretiens']);
  rawRows.entretiens = rowsOf(tEnt);

  /* Structure du document (2026.5.27) : cree ce qui est nouveau depuis la derniere mise a
     jour ; si quelque chose a ete cree, on recharge pour que tout le reste en tienne compte. */
  if (await assurerStructure()) return load();
""")
# 3. bandeau de la Vue d'ensemble
rep("""  var warn = missingTables.length
    ? '<div class="badge danger" style="display:block;margin-bottom:12px;padding:8px 12px">Table(s) introuvable(s) : ' +
      missingTables.join(', ') + '. Verifie le nom exact dans Grist.</div>'
    : '';""","""  var warn = (missingTables.length && !(etatStructure && etatStructure.sansStructure))
    ? '<div class="badge danger" style="display:block;margin-bottom:12px;padding:8px 12px">Table(s) introuvable(s) : ' +
      missingTables.join(', ') + '. Verifie le nom exact dans Grist.</div>'
    : '';
  warn += bandeauStructureHtml();""")
# 4. Reglages > Fonctionnement
rep("""      '<div class="reglages-grille">' + champsFonct.map(champConfigHtml).join('') + '</div>';

    if (save) save.style.display = '';""","""      '<div class="reglages-grille">' + champsFonct.map(champConfigHtml).join('') + '</div>' +
      '<h4 class="reglages-groupe" style="margin-top:18px">Structure du document</h4><div id="structureZone"></div>';
    renderStructure(document.getElementById('structureZone'));

    if (save) save.style.display = '';""")
# 5. CONFIG absente : bouton de creation
rep("""    corps.innerHTML = '<p class="hint" style="margin:4px 2px">La table <b>CONFIG</b> n\\'existe pas encore dans ce document. ' +
      'Créez-la dans Grist (deux colonnes : <b>cle</b> et <b>valeur</b>), comme indique dans le classeur schéma, ' +
      'puis rouvrez ce panneau — vous pourrez alors tout régler ici.</p>';""","""    corps.innerHTML = '<p class="hint" style="margin:4px 2px">La table <b>CONFIG</b> n\\'existe pas encore dans ce document. ' +
      'Elle contient les réglages du club (nom, couleurs, liens).</p>' +
      '<div class="form-actions"><button type="button" id="btnCreerConfig">Créer la table CONFIG</button>' +
      '<span class="form-msg" id="creerConfigMsg"></span></div>';
    document.getElementById('btnCreerConfig').onclick = async function () {
      try { await creerParCle(['config']); ouvrirReglages(); }
      catch (e) { document.getElementById('creerConfigMsg').textContent = 'Création impossible : ' + e.message + ' (droit de modifier la structure requis).'; }
    };""")
# 6. Diagnostic
rep("""  L.push('');
  L.push('ENTRETIENS');""","""  L.push('');
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
  L.push('ENTRETIENS');""")
open(p,'w',encoding='utf-8').write(s)
print("ecrit")
