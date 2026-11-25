import re
def souple(a): return r'\s+'.join(re.escape(x) for x in a.split())
def appl(p, liste):
    s=open(p,encoding='utf-8').read(); manq=[]
    for a,b in liste:
        s2,n=re.subn(souple(a), lambda m: b, s)
        if n==0: manq.append(a)
        s=s2
    open(p,'w',encoding='utf-8').write(s); return manq
H=[
 ("(et en tête du sous-onglet <b>Réparations</b>)", "(et en tête de la sous-rubrique <b>Réparations</b>)"),
 ("le sous-onglet <b>Réparations</b>", "la sous-rubrique <b>Réparations</b>"),
 ("Le sous-onglet n'existe que si", "La sous-rubrique n'existe que si"),
 ("à la liste ou à l'onglet concerné", "à la liste ou à la rubrique concernée"),
 ("L'onglet <b>Contrôles, incidents et réparations</b> se partage en deux sous-onglets, <b>Contrôles</b> et <b>Incidents</b> : on passe de l'un à l'autre d'un clic,",
  "La rubrique <b>Suivi des EPI</b> regroupe plusieurs sous-rubriques, dont <b>Contrôles</b> et <b>Incidents</b> : on passe de l'une à l'autre d'un clic,"),
 ("et dans le Contrôles, incidents et réparations", "et dans le Suivi des EPI"),
 (", dans Contrôles, incidents et réparations", ", dans Suivi des EPI"),
 ("(Contrôles, incidents et réparations)", "(Suivi des EPI)"),
 ('<div class="tab" data-t="controles">Contrôles, incidents et réparations</div>', '<div class="tab" data-t="controles">Suivi des EPI</div>'),
]
J=[("(onglet Contrôles, incidents et réparations, section « Incidents clôturés »)", "(rubrique Suivi des EPI, Incidents, section « Incidents clôturés »)")]
print("HTML manquants :", appl('/home/claude/v2/widget_pilotage.html', H))
print("JS manquants :", appl('/home/claude/v2/widget_pilotage.js', J))
