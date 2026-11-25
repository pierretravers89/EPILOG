"""Menus de lots : groupes par categorie (optgroup) avec le fabricant, et
choix direct d'un lot => la categorie se regle seule ; revenir a 'Toutes'
efface le lot. Verifie sur LES SIX formulaires a filtres (pret, edition de
bon, controle, incident, reparation, entretien) + rattachement + editeur."""
import sys; from harnais import ouvrir, Resultats, table; from donnees import construire, ts
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
# depuis 2026.5.14 le formulaire de reparation ne liste que les categories
# reparables : on les ouvre ici, ce test porte sur les menus et la recherche
for c in D["CATEGORIES"]["lignes"]: c["maintenance_fabricant"] = True
# un bon en cours pour pouvoir ouvrir l'edition de bon (prefixe 'be')
D["EMPRUNTS"]["lignes"].append({"id": 1, "materiel": ids_mat["CAS-001"], "adherent": 1,
    "date_emprunt": ts(0, 1), "date_retour_prevue": None, "date_retour_effective": None,
    "numero_emprunt": "2026-001"})
# un exemplaire orphelin pour le rattachement
D["MATERIELS"]["lignes"].append({"id": 99, "lot": None, "numero_marquage": "ORPH-1", "lieu_stockage": 1,
    "date_mise_en_service": ts(1)})
id_cat_casques = [c["id"] for c in D["CATEGORIES"]["lignes"] if c["nom"] == "Casques"][0]

OUVERTURES = {
    "pr":  """() => { document.querySelector('.tab[data-t="prets"]').click(); document.getElementById('btnTogglePret').click(); }""",
    "be":  """() => { document.querySelector('.tab[data-t="prets"]').click(); ouvrirEditeurBon('2026-001'); }""",
    "ct":  """() => { document.querySelector('.tab[data-t="controles"]').click(); document.querySelector('#epi-so [data-se="controles"]').click(); document.getElementById('btnToggleCtrl').click(); }""",
    "in":  """() => { document.querySelector('.tab[data-t="controles"]').click(); document.querySelector('#epi-so [data-se="incidents"]').click(); document.getElementById('btnToggleInc').click(); }""",
    "rep": """() => { document.querySelector('.tab[data-t="controles"]').click(); document.querySelector('#epi-so [data-se="reparations"]').click(); document.getElementById('btnToggleRep').click(); }""",
    "ent": """() => { document.querySelector('.tab[data-t="controles"]').click(); document.querySelector('#epi-so [data-se="entretiens"]').click(); document.getElementById('btnToggleEnt').click(); }""",
}
GROUPES = "sel => Array.from(document.querySelectorAll(sel + ' optgroup')).map(g => g.label)"

with ouvrir(D) as page:
    for p, js in OUVERTURES.items():
        page.evaluate(js); page.wait_for_timeout(60)
        lot_sel, cat_sel = "#%sFiltreLot" % p, "#%sFiltreCat" % p
        groupes = page.evaluate(GROUPES, lot_sel)
        R.verifier("Casques" in groupes, "[%s] menu Lot groupe par categorie : %s" % (p, groupes))
        txt = page.eval_on_selector_all(lot_sel + " option", "os => os.map(o => o.textContent)")
        R.verifier(any("Casques Boreo (Petzl)" == t for t in txt), "[%s] fabricant dans le libelle du lot" % p)
        # choix direct du lot
        page.select_option(lot_sel, str(ids_lot["Casques Boreo"])); page.wait_for_timeout(60)
        R.verifier(page.input_value(cat_sel) == str(id_cat_casques), "[%s] la categorie se regle seule" % p)
        R.verifier(page.input_value(lot_sel) == str(ids_lot["Casques Boreo"]), "[%s] le lot reste choisi" % p)
        liste = page.inner_text("#%sListe" % p)
        R.verifier("CAS-00" in liste and "MOU" not in liste, "[%s] la liste montre le lot choisi" % p)
        # retour a 'Toutes' : le lot est efface, la categorie ne revient pas
        page.select_option(cat_sel, ""); page.wait_for_timeout(60)
        R.verifier(page.input_value(cat_sel) == "" and page.input_value(lot_sel) == "",
                   "[%s] 'Toutes' efface aussi le lot" % p)
        # fermer le panneau d'edition de bon pour ne pas gener la suite
        page.evaluate("() => { bonEnEdition = null; }")

    # rattachement d'orphelins
    page.evaluate("""() => { document.querySelector('.tab[data-t="materiel"]').click(); ouvrirRattachement(); }""")
    page.wait_for_timeout(60)
    R.verifier("Casques" in page.evaluate(GROUPES, "#ratLot"), "rattachement : lots groupes par categorie")
    # editeur d'exemplaire : champ Lot
    page.evaluate("id => openEditor('materiel', id)", ids_mat["CAS-002"]); page.wait_for_timeout(60)
    sel = '#materiel-editor select[data-f="lot"]'
    R.verifier("Casques" in page.evaluate(GROUPES, sel), "editeur : lots groupes par categorie")
    R.verifier(page.input_value(sel) == str(ids_lot["Casques Boreo"]), "editeur : le lot actuel reste selectionne")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
