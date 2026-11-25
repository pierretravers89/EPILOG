p='/home/claude/v2/widget_pilotage.js'; s=open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n, (s.count(a), a[:70]); s=s.replace(a,b)
rep("async function exporterRegistreLot(lotId) {", open('/home/claude/outils/fiches_pdf.js',encoding='utf-8').read() + "async function exporterRegistreLot(lotId) {")
# registre du lot : passe par la fonction commune
rep("""  var mats = (refLists.materiels || []).filter(function (m) { return m.lot === lotId; });
  if (!mats.length) return;
  var parties = [];
  for (var i = 0; i < mats.length; i++) {
    var c = await corpsFicheMateriel(mats[i].id);
    if (c) parties.push(c);
  }
  var corps = parties.map(function (part, idx) {
    return (idx > 0 ? '<div style="page-break-before:always"></div>' : '') + part;
  }).join('');
  var titre = 'Registre — ' + (lot.designation || 'lot ' + lotId);
  sortirDocument(enveloppeFiche(titre, corps), 'registre-' + (lot.designation || lotId) + '.html', null);""",
"""  var mats = (refLists.materiels || []).filter(function (m) { return m.lot === lotId; });
  if (!mats.length) return;
  await exporterFichesDeVie(mats.map(function (m) { return m.id; }), 'Registre — ' + (lot.designation || 'lot ' + lotId),
    'registre-' + (lot.designation || lotId) + '.html');""")
# Vue d'ensemble : Excel + fiches PDF (CSV retire)
rep("""      '<button type="button" class="secondary" id="exportParcCsv">Fichiers CSV</button>' +
      '<span id="exportParcMsg" class="form-msg"></span>' +
    '</div>' +""","""      '<button type="button" class="secondary" id="exportParcFiches">Fiches de vie (PDF)\\u2026</button>' +
      '<span id="exportParcMsg" class="form-msg"></span>' +
    '</div>' +
    '<div id="exportFichesPanel"></div>' +""")
rep("""  var bX = document.getElementById('exportParcXlsx'), bC = document.getElementById('exportParcCsv');
  if (bX) bX.onclick = exporterLisibleXlsx;
  if (bC) bC.onclick = function () { exporterLisibleCsv(); };""","""  var bX = document.getElementById('exportParcXlsx'), bF = document.getElementById('exportParcFiches');
  if (bX) bX.onclick = exporterLisibleXlsx;
  if (bF) bF.onclick = ouvrirConfigFichesPdf;""")
# Excel : plus de repli CSV (14 fichiers, juge inutilisable) -> message clair
rep("""    exporterLisibleCsv(feuilles, 'Excel indisponible (' + e.message + ') : ');""",
"""    /* (2026.5.23) plus de repli en 14 fichiers CSV, juge inutilisable par Pierre */
    messageExport('Excel indisponible (' + e.message + ') : v\\u00e9rifiez la connexion Internet et r\\u00e9essayez. ' +
      'L\\u2019inventaire seul reste exportable en CSV depuis la rubrique Mat\\u00e9riel.', true);""")
i=s.index('function exporterLisibleCsv('); j=s.index('\n}\n', i)+3
s=s[:i]+s[j:]
# date de sortie : fiche imprimable + Excel
rep("""      ligneInfo('Statut actuel', x.m._statut, (HORS_STOCK.indexOf(x.m._statut) !== -1) ? 'alerte' : '') +""",
"""      ligneInfo('Statut actuel', x.m._statut, (HORS_STOCK.indexOf(x.m._statut) !== -1) ? 'alerte' : '') +
      (dateSortieParc(x.m) ? ligneInfo('Sortie du parc', fmtDate(dateSortieParc(x.m)) +
        (conservationEchue(x.m) ? ' (conservation de 3 ans echue)' : '')) : '') +""")
rep("""      'Prochain contr\\u00f4le', 'Contr\\u00f4le en retard', 'Prix unitaire']),""","""      'Prochain contr\\u00f4le', 'Contr\\u00f4le en retard', 'Sortie du parc', 'Prix unitaire']),""")
rep("""        hors ? 'Sans objet' : (m._limiteControle ? fmtDate(m._limiteControle) : ''), m._controleEchu ? 'Oui' : '',
        Number(lot.prix_unitaire) || '']);""","""        hors ? 'Sans objet' : (m._limiteControle ? fmtDate(m._limiteControle) : ''), m._controleEchu ? 'Oui' : '',
        dateSortieParc(m) ? fmtDate(dateSortieParc(m)) : '', Number(lot.prix_unitaire) || '']);""")
open(p,'w',encoding='utf-8').write(s)
h=open('/home/claude/v2/widget_pilotage.html',encoding='utf-8').read()
a="""          <p><b>Export lisible</b> (dans la <b>Vue d'ensemble</b>, « Exporter tout le parc ») — tout le parc en clair, un thème par feuille (Excel) ou par fichier
             (CSV) :"""
import re
m=re.search(r"<p><b>Export lisible</b> \(dans la <b>Vue d'ensemble</b>, « Exporter tout le parc »\) — tout le parc en clair, un thème par feuille \(Excel\) ou par fichier\s+\(CSV\) :", h)
assert m, "aide export"
h=h[:m.start()]+"<p><b>Export lisible</b> (dans la <b>Vue d'ensemble</b>, « Exporter tout le parc ») — un classeur Excel, un thème par feuille :"+h[m.end():]
m2=re.search(r"\s+Si Excel ne peut pas être préparé, les fichiers CSV sont\s+produits à la place\.</p>", h)
assert m2, "aide repli"
h=h[:m2.start()]+"""</p>
          <p><b>Fiches de vie (PDF)</b> — au même endroit : une fenêtre permet de choisir les
             catégories, le lieu et les exemplaires (en circulation, sortis du parc, ou <b>sortis
             depuis plus de 3 ans</b>, dont la conservation réglementaire est échue). Une fiche par
             page ; on imprime ou on « Enregistre en PDF » depuis la fenêtre qui s'ouvre.</p>"""+h[m2.end():]
open('/home/claude/v2/widget_pilotage.html','w',encoding='utf-8').write(h)
print("ecrit")
