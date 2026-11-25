import re
p='/home/claude/v2/widget_pilotage.js'; s=open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n, (s.count(a), a[:90]); s=s.replace(a,b)
# 1. version dans le pied de page
rep("var VERSION_EPILOG = '2026.5.25';   /* = premiere entree du CHANGELOG : controle par tests/test_27 */",
"""var VERSION_EPILOG = '2026.5.26';   /* = premiere entree du CHANGELOG : controle par tests/test_27 */
/* Version affichee dans le pied de page (2026.5.26) : permet de savoir en un coup d'oeil quelle
   version tourne dans CE document (le code vit dans chaque document, une ancienne copie peut
   subsister apres une mise a jour) */
(function () { var el = document.getElementById('creditsVersion'); if (el) el.textContent = 'v' + VERSION_EPILOG; })();""")
# 2. commentaire deja contenu dans Observations : pas repete dans l'inventaire imprime
rep("""      var det = colonnesDetail(items, function (r, c) { return r[c]; }, p.decoupable);
      return '<h2>' + esc(k) + '</h2>' +""","""      /* le motif du statut (colonne Observations) reprend deja le commentaire d'un exemplaire
         sorti du parc (\"Perdu le ... \\u2014 Perdu dans le ravin.\") : on ne le repete pas */
      var det = colonnesDetail(items, function (r, c) {
        if (c === 'commentaire' && r.commentaire && String(r.raison || '').indexOf(r.commentaire) !== -1) return '';
        return r[c];
      }, p.decoupable);
      return '<h2>' + esc(k) + '</h2>' +""")
open(p,'w',encoding='utf-8').write(s)
h=open('/home/claude/v2/widget_pilotage.html',encoding='utf-8').read()
a='<span class="credits-soft">EPI<span>LOG</span></span>'
assert h.count(a)==1
h=h.replace(a, a+'\n    <span class="credits-version" id="creditsVersion"></span>')
b="  .credits-baseline { opacity: 0.72; margin-left: -3px; }"
assert h.count(b)==1
h=h.replace(b, b+"\n  .credits-version { opacity: 0.6; font-size: 11px; margin-left: -2px; }")
open('/home/claude/v2/widget_pilotage.html','w',encoding='utf-8').write(h)
print("ecrit")
