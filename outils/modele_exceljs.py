import re
p='/home/claude/v2/widget_pilotage.js'; s=open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n, (s.count(a), a[:90]); s=s.replace(a,b)
rep("var VERSION_EPILOG = '2026.5.29';","var VERSION_EPILOG = '2026.5.30';")
# l'ancien generateur devient le repli
rep("async function impTelechargerModele() {\n  var msg = document.getElementById('impMsg');\n  try {\n    var X = await chargerSheetJS();",
    "async function impModeleSheetJS() {\n  var msg = document.getElementById('impMsg');\n  try {\n    var X = await chargerSheetJS();")
rep("/* ------------------------------ interface ------------------------------ */\nfunction impBasculerPanneau() {",
    open('/home/claude/outils/modele_exceljs.js',encoding='utf-8').read() + "/* ------------------------------ interface ------------------------------ */\nfunction impBasculerPanneau() {")
# feuilles du modele : ignorees sans bruit dans le rapport
rep("""    var cle = IMP_NOMS_FEUILLES[impNorm(nom)];
    if (!cle) { P.ignorees.feuilles.push(nom); return; }""","""    var cle = IMP_NOMS_FEUILLES[impNorm(nom)];
    if (!cle) {
      /* feuilles du MODELE (mode d'emploi, listes) : normales, inutile de les signaler */
      if (['mode d\\u2019emploi', 'mode d\\'emploi', 'listes'].indexOf(impNorm(nom)) === -1) P.ignorees.feuilles.push(nom);
      return;
    }""")
open(p,'w',encoding='utf-8').write(s)
h=open('/home/claude/v2/widget_pilotage.html',encoding='utf-8').read()
a=re.search(r"collez-y\s+votre\s+inventaire — une ligne par exemplaire, en « collage spécial → valeurs » — puis importez-le\.</p>", h)
assert a, "ancre aide"
h=h[:a.end()]+"""
          <p>Le modèle contient des <b>menus déroulants</b> (catégorie, lieu, lot, statut, résultat…) qui
             regroupent ce qui est déjà dans EPILOG <b>et</b> ce que vous décrivez dans les autres feuilles :
             une catégorie nouvellement décrite apparaît dans le menu de l'Inventaire. Les titres de colonnes
             sont colorés selon l'importance (voir le mode d'emploi). Attention : un collage normal remplace
             les menus des cellules collées ; utilisez « Collage spécial → Valeurs ». L'import contrôle de
             toute façon chaque ligne.</p>"""+h[a.end():]
open('/home/claude/v2/widget_pilotage.html','w',encoding='utf-8').write(h)
print("ecrit")
