"""2026.5.26 : cas REEL (structure du document du CAF d'Auxerre). Couleur et
taille doivent apparaitre pour les degaines, crashpads et morceaux decoupes
(couleur null) dans l'inventaire, la fiche du lot, le registre et l'Excel ;
un commentaire deja repris dans 'Observations' n'est pas repete ; la version
du logiciel est lisible dans le pied de page."""
import sys, re; from harnais import ouvrir, Resultats
from donnees_reelles import construire_reel
from outils_page import *
R = Resultats()
def th(html, titre):
    i = html.index("<h2>" + titre + "</h2>"); j = html.index("<table>", i); k = html.index("</tr>", j)
    return [re.sub(r"<[^>]+>", "", c) for c in re.findall(r"<th[^>]*>(.*?)</th>", html[j:k], flags=re.S)]
with ouvrir(construire_reel()) as page:
    page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()"); page.wait_for_timeout(300)
    R.verifier(page.inner_text("#creditsVersion") == "v" + page.evaluate("VERSION_EPILOG"), "pied de page : version visible (%s)" % page.inner_text("#creditsVersion"))
    page.evaluate("() => { window.__DOCS__.length = 0; exporterInventaireImprimable(); }"); page.wait_for_timeout(300)
    inv = page.evaluate("window.__DOCS__")[-1]
    R.verifier(th(inv, "Dégaines")[:3] == ["Marquage", "Couleur", "Taille"], "inventaire, degaines : Couleur et Taille : %s" % th(inv, "Dégaines"))
    R.verifier(th(inv, "Crashpads")[:3] == ["Marquage", "Couleur", "Taille"], "inventaire, crashpads : Couleur et Taille")
    cs = th(inv, "Cordes à simple 80 mètres")
    R.verifier("Longueur" in cs and "Couleur" not in cs, "inventaire, cordes decoupables : 'Longueur' sans colonne Couleur (couleur null) : %s" % cs)
    bb = th(inv, "Baudrier Petzl test scinder lot")
    R.verifier("Commentaire" not in bb and inv.count("Perdu dans le ravin.") == 1, "inventaire : commentaire deja dans Observations non repete (%d fois)" % inv.count("Perdu dans le ravin."))
    for titre, lot in [("Dégaines", 9), ("Crashpads", 8)]:
        page.evaluate("() => { window.__DOCS__.length = 0; }")
        page.evaluate("id => ficheDeVieLot(id)", lot); page.wait_for_timeout(500)
        fl = page.evaluate("window.__DOCS__")[-1]
        mm = re.search(r"<table><tr><th[^>]*>Marquage</th>.*?</table>", fl, flags=re.S)
        t = [re.sub(r"<[^>]+>", "", c) for c in re.findall(r"<th[^>]*>(.*?)</th>", mm.group(0).split("</tr>")[0], flags=re.S)]
        R.verifier(t[1:3] == ["Couleur", "Taille"], "fiche du lot, %s : Couleur et Taille : %s" % (titre, t))
    page.evaluate("() => { window.__DOCS__.length = 0; }")
    page.evaluate("id => ficheDeVieLot(id)", 9); page.wait_for_timeout(500)
    R.verifier("Orange" in page.evaluate("window.__DOCS__")[-1] and "longueur 12 cm" in page.evaluate("window.__DOCS__")[-1], "fiche du lot degaines : valeurs 'Orange' et 'longueur 12 cm'")
    deg = page.evaluate("rawRows.materiels.filter(m => m.numero_marquage === 'DEGAIN001')[0].id")
    h = texte(fiche_imprimable(page, deg))
    R.verifier("Couleur Orange" in h and "Taille longueur 12 cm" in h, "registre (fiche de vie DEGAIN001) : couleur et taille")
    x = [f for f in page.evaluate("donneesLisibles()") if f["nom"] == "Inventaire"][0]
    r = [l for l in x["lignes"] if l[0] == "DEGAIN001"][0]
    R.verifier(r[x["entetes"].index("Couleur")] == "Orange" and r[x["entetes"].index("Taille ou longueur")] == "longueur 12 cm", "Excel : valeurs de DEGAIN001")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
