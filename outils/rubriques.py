import re
REMPL_HTML = [
 ("sur un écran intermédiaire, par les onglets en haut. Dans cette aide,\n             « onglet » désigne la rubrique du même nom.", "sur un écran intermédiaire, par les onglets en haut."),
 ("Les cartes en haut des onglets sont des filtres", "Les cartes en haut des rubriques sont des filtres"),
 ("les onglets concernés", "les rubriques concernées"),
 ("— onglet « Listes du club »</h4>", "— rubrique « Listes du club »</h4>"),
 ("— onglet Matériel</h4>", "— rubrique Matériel</h4>"),
 ("Onglet <b>Matériel</b>, tapez", "Rubrique <b>Matériel</b>, tapez"),
 ("sans changer d'onglet", "sans changer de rubrique"),
 ("Onglet <b>Prêts</b>, bouton", "Rubrique <b>Prêts</b>, bouton"),
 ("en haut de l'onglet.", "en haut de la rubrique."),
 ("même depuis l'autre sous-onglet", "même depuis une autre sous-rubrique"),
 ("(et en tête du sous-onglet <b>Réparations</b>)", "(et en tête de la sous-rubrique <b>Réparations</b>)"),
 ("Depuis le sous-onglet Réparations", "Depuis la sous-rubrique Réparations"),
 ("le sous-onglet <b>Réparations</b>", "la sous-rubrique <b>Réparations</b>"),
 ("Le sous-onglet <b>Entretien</b>", "La sous-rubrique <b>Entretien</b>"),
 ("Le sous-onglet n'existe que si", "La sous-rubrique n'existe que si"),
 ("Les grands chiffres en haut des onglets", "Les grands chiffres en haut des rubriques"),
 ("bascule sur l'onglet Prêts", "bascule sur la rubrique Prêts"),
 ("à la liste ou à l'onglet concerné", "à la liste ou à la rubrique concernée"),
 ("<p>L'onglet <b>Listes du club</b>", "<p>La rubrique <b>Listes du club</b>"),
 ("<p>L'onglet <b>Achats et budget</b>", "<p>La rubrique <b>Achats et budget</b>"),
 ("en bas de l'onglet Matériel", "en bas de la rubrique Matériel"),
]
REMPL_JS = [
 ("dans l\\'onglet Matériel.'", "dans la rubrique Matériel.'"),
 ("depuis l\\'onglet Matériel, avec le lot", "depuis la rubrique Matériel, avec le lot"),
 ("pour ses exemplaires, dans le sous-onglet '", "pour ses exemplaires, dans la sous-rubrique '"),
 ("depuis l’onglet Matériel (badge", "depuis la rubrique Matériel (badge"),
 ("(onglet « Listes du club »)", "(rubrique « Listes du club »)"),
 ("dans l\\'onglet <b>Listes du club</b>", "dans la rubrique <b>Listes du club</b>"),
 ("(onglet Contrôles, incidents et réparations, section « Incidents clôturés »)", "(rubrique Suivi des EPI, Incidents, section « Incidents clôturés »)"),
 ("le sous-onglet Entretien est masque", "la sous-rubrique Entretien est masquee"),
]
def appliquer(p, liste):
    s=open(p,encoding='utf-8').read(); manq=[]
    for a,b in liste:
        n=s.count(a)
        if n==0: manq.append(a)
        s=s.replace(a,b)
    open(p,'w',encoding='utf-8').write(s); return manq
print("HTML manquants :", appliquer('/home/claude/v2/widget_pilotage.html', REMPL_HTML))
print("JS manquants :", appliquer('/home/claude/v2/widget_pilotage.js', REMPL_JS))
