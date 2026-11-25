"""Regression 2026.5.4 (corrigee 2026.5.12) : le groupe Identite du panneau de
reglages (titre et sous-titre du bandeau, nom du club...) avait disparu.
Parcours complet : ouvrir le panneau, changer le titre, enregistrer, bandeau."""
import sys; from harnais import ouvrir, Resultats, table; from donnees import construire
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
D["CONFIG"]["lignes"].append({"id": 1, "cle": "titre_appli", "valeur": "EPILOG"})
with ouvrir(D) as page:
    page.evaluate("ouvrirReglages()"); page.wait_for_timeout(80)
    corps = sa(page.inner_text("#reglagesCorps"))
    for lib in ["titre de l", "sous-titre", "nom du club", "lien 1", "couleur principale"]:
        R.verifier(lib in corps, "panneau : champ %r present" % lib)
    R.verifier("identite" in sa(corps), "panneau : groupe Identite affiche")
    page.fill('#reglagesCorps input[data-cle="titre_appli"]', "EPILOG - Gestion des EPI")
    page.fill('#reglagesCorps input[data-cle="sous_titre"]', "CAF de Test · FFCAM")
    page.click("#reglagesSave"); page.wait_for_timeout(600)
    cfg = {r.get("cle"): r.get("valeur") for r in table(page, "CONFIG")}
    R.verifier(cfg.get("titre_appli") == "EPILOG - Gestion des EPI" and cfg.get("sous_titre") == "CAF de Test · FFCAM",
               "reglages enregistres dans CONFIG : %s" % cfg)
    h1 = page.inner_text(".header-titles h1"); st = page.inner_text(".header-titles .subtitle")
    R.verifier("gestion des epi" in sa(h1) and "caf de test" in sa(st), "bandeau mis a jour : %r / %r" % (h1, st))
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
