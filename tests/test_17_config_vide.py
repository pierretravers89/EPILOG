"""Table CONFIG VIDE (archive sans donnees) : le premier enregistrement des
reglages doit marcher. Bug du 08/10 : la colonne cachee manualSort, vide,
etait prise pour la colonne des valeurs -> refus de Grist (float vs str)."""
import sys; from harnais import ouvrir, Resultats, table; from donnees import construire
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
D["CONFIG"] = {"colonnes": ["manualSort", "Cle", "Valeur"], "lignes": []}   # comme le vrai Grist, vide
with ouvrir(D) as page:
    page.evaluate("ouvrirReglages()"); page.wait_for_timeout(80)
    nc = page.input_value('#reglagesCorps input[data-cle="nom_club"]')
    R.verifier("auxerre" not in sa(nc), "valeur par defaut neutre pour le nom du club : %r" % nc)
    page.fill('#reglagesCorps input[data-cle="nom_club"]', "CAF de Besancon")
    page.fill('#reglagesCorps input[data-cle="titre_appli"]', "EPILOG")
    page.click("#reglagesSave"); page.wait_for_timeout(700)
    msg = page.inner_text("#reglagesMsg")
    R.verifier("erreur" not in sa(msg), "premier enregistrement sans erreur : %r" % msg)
    rows = table(page, "CONFIG")
    cfg = {r.get("Cle"): r.get("Valeur") for r in rows}
    R.verifier(cfg.get("nom_club") == "CAF de Besancon" and cfg.get("titre_appli") == "EPILOG",
               "reglages ecrits dans Cle / Valeur : %s" % {k: cfg[k] for k in list(cfg)[:3]})
    R.verifier(all(r.get("manualSort") in (None,) or isinstance(r.get("manualSort"), (int, float)) for r in rows),
               "manualSort jamais touche")
    # second enregistrement : mise a jour, pas de doublons
    page.evaluate("ouvrirReglages()"); page.wait_for_timeout(80)
    page.fill('#reglagesCorps input[data-cle="titre_appli"]', "EPILOG v2")
    page.click("#reglagesSave"); page.wait_for_timeout(700)
    rows2 = table(page, "CONFIG")
    R.verifier(len(rows2) == len(rows) and {r["Cle"]: r["Valeur"] for r in rows2}["titre_appli"] == "EPILOG v2",
               "second enregistrement : mise a jour sans doublon (%d lignes)" % len(rows2))
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
# cas du document principal : table remplie, manualSort numerique
D, ids_mat, ids_lot = construire()
D["CONFIG"] = {"colonnes": ["manualSort", "Cle", "Valeur"], "lignes": [
    {"id": 1, "manualSort": 1, "Cle": "titre_appli", "Valeur": "EPILOG - Gestion des EPI"},
    {"id": 2, "manualSort": 2, "Cle": "nom_club", "Valeur": "Club Alpin Francais d'Auxerre"}]}
with ouvrir(D) as page:
    R.verifier("gestion des epi" in sa(page.inner_text(".header-titles h1")), "table remplie : titre lu depuis CONFIG")
    page.evaluate("ouvrirReglages()"); page.wait_for_timeout(80)
    page.fill('#reglagesCorps input[data-cle="titre_appli"]', "EPILOG bis")
    page.click("#reglagesSave"); page.wait_for_timeout(700)
    r = {x["Cle"]: x for x in table(page, "CONFIG")}
    R.verifier(r["titre_appli"]["Valeur"] == "EPILOG bis" and r["titre_appli"]["manualSort"] == 1,
               "table remplie : mise a jour de Valeur, manualSort intact")
    R.verifier(not page.erreurs, "table remplie : aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
