"""2026.5.23 : fiches de vie en PDF depuis la Vue d'ensemble, avec fenetre de
configuration (categories, lieu, statut dont 'sortis depuis plus de 3 ans'),
compteur, document une fiche par page ; date de sortie du parc deduite."""
import sys, re; from harnais import ouvrir, Resultats, table; from donnees import construire, ts
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
D["LIEUX_STOCKAGE"]["lignes"].append({"id": 2, "nom": "Coffre gymnase"})
for m in D["MATERIELS"]["lignes"]:
    if m["numero_marquage"] == "MOU-001":        # perdu il y a 4 ans : conservation echue
        m.update(hors_service_motif="Perdu", hors_service_date=ts(4), lieu_stockage=2)
def compte(page): return page.inner_text("#fpCompte")
with ouvrir(D) as page:
    page.evaluate("() => naviguer('donnees')"); page.wait_for_timeout(150)
    page.click("#exportParcFiches"); page.wait_for_timeout(80)
    R.verifier(page.is_visible("#fpGenerer"), "fenetre de configuration ouverte")
    R.verifier(compte(page).startswith("4 fiches"), "defaut : exemplaires en circulation (4) : %r" % compte(page))
    page.uncheck('.fp-cat[value="%d"]' % [c["id"] for c in D["CATEGORIES"]["lignes"] if c["nom"] == "Casques"][0]); page.wait_for_timeout(30)
    R.verifier(compte(page).startswith("1 fiche"), "sans les casques : 1 fiche : %r" % compte(page))
    R.verifier(page.evaluate("document.getElementById('fpToutes').indeterminate"), "case Toutes en etat intermediaire")
    page.check("#fpToutes"); page.wait_for_timeout(30)
    page.check('input[name="fpStatut"][value="sortis"]'); page.wait_for_timeout(30)
    R.verifier(compte(page).startswith("2 fiches"), "sortis du parc : 2 (corde reformee, mousqueton perdu) : %r" % compte(page))
    page.check('input[name="fpStatut"][value="sortis3"]'); page.wait_for_timeout(30)
    R.verifier(compte(page).startswith("1 fiche"), "sortis depuis plus de 3 ans : 1 (le mousqueton) : %r" % compte(page))
    page.select_option("#fpLieu", "1"); page.wait_for_timeout(30)
    R.verifier("aucun" in sa(compte(page)) and page.is_disabled("#fpGenerer"), "lieu sans correspondance : bouton desactive")
    page.select_option("#fpLieu", ""); page.check('input[name="fpStatut"][value="tous"]'); page.wait_for_timeout(30)
    page.evaluate("() => { window.__DOCS__.length = 0; }")
    page.click("#fpGenerer"); page.wait_for_timeout(800)
    docs = page.evaluate("window.__DOCS__")
    R.verifier(len(docs) == 1, "un seul document produit")
    d = docs[-1] if docs else ""
    R.verifier(d.count("page-break-before:always") == 5 and all(m in d for m in ["CAS-001", "COR-001-A", "MOU-001"]),
               "6 fiches, une par page")
    R.verifier("Sortie du parc" in d and "conservation de 3 ans echue" in d, "fiche : date de sortie et conservation echue")
    R.verifier("pret" in sa(page.inner_text("#fpMsg")), "message de fin : %r" % page.inner_text("#fpMsg")[:70])
    # le registre d'un lot passe par la meme fonction
    page.evaluate("() => { window.__DOCS__.length = 0; }")
    page.evaluate("id => exporterRegistreLot(id)", ids_lot["Casques Boreo"]); page.wait_for_timeout(500)
    reg = page.evaluate("window.__DOCS__")
    R.verifier(reg and reg[-1].count("page-break-before:always") == 2 and "Registre" in reg[-1], "registre d'un lot inchange (3 fiches)")
    # second clic : referme la fenetre
    page.click("#exportParcFiches"); page.wait_for_timeout(50)
    R.verifier(not page.query_selector("#fpGenerer"), "second clic : fenetre refermee")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
