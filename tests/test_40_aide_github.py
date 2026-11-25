"""2026.5.37 : l'aide embarquee donne l'adresse du depot GitHub. La page « Mettre a jour EPILOG »
dit ou trouver la derniere version, comment recuperer les deux fichiers et ou signaler un probleme ;
la rubrique « A propos » porte le lien du depot. Liens ouverts dans un nouvel onglet."""
import sys, re; from harnais import ouvrir, Resultats; from donnees import construire
from outils_page import *
R = Resultats()
GH = "https://github.com/pierretravers89/EPILOG"
D, ids_mat, ids_lot = construire()
with ouvrir(D) as page:
    page.evaluate("ouvrirAide()"); page.wait_for_timeout(150)
    page.click('.aide-nav-item[data-sec="miseajour"]'); page.wait_for_timeout(150)
    sec = sa(page.inner_text("#sec-miseajour"))
    R.verifier("ou trouver la derniere version" in sec, "Mettre a jour : section « Ou trouver la derniere version »")
    R.verifier("releases" in sec and "changelog.md" in sec and "copy raw file" in sec and "issues" in sec,
               "Mettre a jour : versions, journal, recuperation des fichiers, signalements")
    R.verifier("jamais de donnees de votre club" in sec, "Mettre a jour : rappel de ne pas publier de donnees du club")
    liens = page.evaluate("[...document.querySelectorAll('#sec-miseajour a')].map(a => [a.href, a.target])")
    hrefs = [h for h, t in liens]
    R.verifier(any(h.rstrip('/') == GH for h in hrefs) and GH + "/releases" in hrefs and GH + "/issues" in hrefs,
               "Mettre a jour : liens vers le depot, les Releases et les Issues : %s" % hrefs)
    R.verifier(all(t == "_blank" for h, t in liens if "github.com" in h), "liens GitHub ouverts dans un nouvel onglet")
    page.click('.aide-nav-item[data-sec="apropos"]'); page.wait_for_timeout(150)
    ap = page.evaluate("[...document.querySelectorAll('#sec-apropos a')].map(a => a.href)")
    R.verifier(any(h.rstrip('/') == GH for h in ap), "A propos : lien vers le depot GitHub")
    R.verifier("eupl 1.2" in sa(page.inner_text("#sec-apropos")), "A propos : licence EUPL 1.2")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
