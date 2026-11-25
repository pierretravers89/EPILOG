p='/home/claude/v2/widget_pilotage.js'; s=open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n, (s.count(a), a[:80]); s=s.replace(a,b)
rep("/* ------------------------- navigation (2026.5.17) -------------------------", open('/home/claude/outils/sauvegarde.js',encoding='utf-8').read() + "/* ------------------------- navigation (2026.5.17) -------------------------")
rep("""        corps.hidden = sousOngletReglages !== 'identite';
        fonct.hidden = sousOngletReglages !== 'fonctionnement';
      };
    });
    corps.hidden = sousOngletReglages !== 'identite';
    fonct.hidden = sousOngletReglages !== 'fonctionnement';""","""        corps.hidden = sousOngletReglages !== 'identite';
        fonct.hidden = sousOngletReglages !== 'fonctionnement';
        majZoneSauvegarde();
      };
    });
    corps.hidden = sousOngletReglages !== 'identite';
    fonct.hidden = sousOngletReglages !== 'fonctionnement';
    majZoneSauvegarde();""")
rep("""var sousOngletReglages = 'identite'; /* Reglages du club : identite | fonctionnement */""",
"""var sousOngletReglages = 'identite'; /* Reglages du club : identite | fonctionnement | sauvegarde */
/* sous-rubrique Sauvegarde (2026.5.20) : ses boutons agissent tout de suite,
   le bouton Enregistrer du pied de panneau n'y a pas de sens -> masque */
function majZoneSauvegarde() {
  var z = document.getElementById('reglagesSauvegarde');
  var save = document.getElementById('reglagesSave');
  if (!z) return;
  var actif = sousOngletReglages === 'sauvegarde';
  z.hidden = !actif;
  if (actif && !z.dataset.rendu) { renderSauvegarde(z); z.dataset.rendu = '1'; }
  if (save) save.style.display = actif ? 'none' : '';
}""")
open(p,'w',encoding='utf-8').write(s)
h=open('/home/claude/v2/widget_pilotage.html',encoding='utf-8').read()
a='''        <button type="button" class="sous-onglet" data-se="fonctionnement">Fonctionnement</button>
      </div>
      <div id="reglagesCorps"></div>
      <div id="reglagesFonctionnement" hidden></div>'''
assert h.count(a)==1
h=h.replace(a,'''        <button type="button" class="sous-onglet" data-se="fonctionnement">Fonctionnement</button>
        <button type="button" class="sous-onglet" data-se="sauvegarde">Sauvegarde</button>
      </div>
      <div id="reglagesCorps"></div>
      <div id="reglagesFonctionnement" hidden></div>
      <div id="reglagesSauvegarde" hidden></div>''')
open('/home/claude/v2/widget_pilotage.html','w',encoding='utf-8').write(h)
print("ecrit")
