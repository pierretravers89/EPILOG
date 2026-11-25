"""Formulaire de pret : le filtre Lieu de stockage doit restreindre les menus
Categorie et Lot, et la liste vide doit dire ou se trouve le materiel
(bug signale le 07/10 : baudriers ranges au gymnase, filtre sur le local)."""
import sys; from harnais import ouvrir, Resultats; from donnees import construire
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
D["LIEUX_STOCKAGE"]["lignes"].append({"id": 2, "nom": "Coffre gymnase"})
id_gym = 2
for m in D["MATERIELS"]["lignes"]:
    if m["numero_marquage"] == "MOU-001": m["lieu_stockage"] = id_gym
with ouvrir(D) as page:
    page.evaluate("""() => { document.querySelector('.tab[data-t="prets"]').click();
        document.getElementById('btnTogglePret').click(); }""")
    page.wait_for_timeout(50)
    # lot choisi d'abord, puis un lieu qui n'en contient pas
    page.select_option("#prFiltreLot", str(ids_lot["Mousquetons"]))
    page.wait_for_timeout(30)
    R.verifier("MOU-001" in page.inner_text("#prListe"), "sans filtre de lieu, MOU-001 est propose")
    page.select_option("#prFiltreLieu", "1")
    page.wait_for_timeout(50)
    cats = page.eval_on_selector_all("#prFiltreCat option", "os => os.map(o => o.textContent)")
    lots = page.eval_on_selector_all("#prFiltreLot option", "os => os.map(o => o.textContent)")
    R.verifier("Mousquetons" not in cats, "le menu Categorie ne propose que ce qui est dans le lieu : %s" % cats)
    R.verifier("Mousquetons" not in lots, "le menu Lot ne propose que ce qui est dans le lieu : %s" % lots)
    R.verifier(page.input_value("#prFiltreLot") == "", "le lot absent du lieu est retire du choix")
    # recherche precise dans le mauvais lieu : le message renvoie au bon
    page.fill("#prRecherche", "MOU")
    page.wait_for_timeout(50)
    zone = page.inner_text("#pr-ailleurs") if page.query_selector("#pr-ailleurs") else ""
    R.verifier("Coffre gymnase (1)" in zone, "un message indique le materiel range ailleurs : %r" % zone)
    page.fill("#prRecherche", "")
    # le lieu du gymnase montre bien le mousqueton
    page.select_option("#prFiltreLieu", str(id_gym))
    page.wait_for_timeout(50)
    R.verifier("MOU-001" in page.inner_text("#prListe"), "dans le bon lieu, MOU-001 est propose")
    R.verifier(not (page.inner_text("#pr-ailleurs").strip() if page.query_selector("#pr-ailleurs") else ""),
               "pas de message quand tout est visible")
    # recherche precise dans le mauvais lieu : le message renvoie au bon
    page.fill("#prRecherche", "CAS")
    page.wait_for_timeout(50)
    R.verifier("Local club (3)" in page.inner_text("#pr-ailleurs"), "recherche 'CAS' au gymnase : renvoi vers Local club (3)")
    R.verifier("aucun materiel" in sa(page.inner_text("#prListe")), "et la liste est vide")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
