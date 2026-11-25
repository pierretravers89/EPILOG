"""2026.5.3 : recherche (marquage, lot, modele, fabricant) ; dates affichees en
jj/mm/aaaa ; filtre de lieu sur pret, edition de bon, controle et entretien
(pas sur incident ni reparation)."""
import sys, re; from harnais import ouvrir, Resultats; from donnees import construire, ts
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
# depuis 2026.5.14 le formulaire de reparation ne liste que les categories
# reparables : on les ouvre ici, ce test porte sur les menus et la recherche
for c in D["CATEGORIES"]["lignes"]: c["maintenance_fabricant"] = True
D["LIEUX_STOCKAGE"]["lignes"].append({"id": 2, "nom": "Coffre gymnase"})
for m in D["MATERIELS"]["lignes"]:
    if m["numero_marquage"] == "MOU-001": m["lieu_stockage"] = 2
D["EMPRUNTS"]["lignes"].append({"id": 1, "materiel": ids_mat["CAS-002"], "adherent": 1, "date_emprunt": ts(0, 1),
    "date_retour_prevue": None, "date_retour_effective": None, "numero_emprunt": "2026-001"})
OUV = {
 "pr":  """() => { document.querySelector('.tab[data-t="prets"]').click(); document.getElementById('btnTogglePret').click(); }""",
 "be":  """() => { document.querySelector('.tab[data-t="prets"]').click(); ouvrirEditeurBon('2026-001'); }""",
 "ct":  """() => { document.querySelector('.tab[data-t="controles"]').click(); document.querySelector('#epi-so [data-se="controles"]').click(); document.getElementById('btnToggleCtrl').click(); }""",
 "in":  """() => { document.querySelector('.tab[data-t="controles"]').click(); document.querySelector('#epi-so [data-se="incidents"]').click(); document.getElementById('btnToggleInc').click(); }""",
 "rep": """() => { document.querySelector('.tab[data-t="controles"]').click(); document.querySelector('#epi-so [data-se="reparations"]').click(); document.getElementById('btnToggleRep').click(); }""",
 "ent": """() => { document.querySelector('.tab[data-t="controles"]').click(); document.querySelector('#epi-so [data-se="entretiens"]').click(); document.getElementById('btnToggleEnt').click(); }""",
}
with ouvrir(D) as page:
    for p, js in OUV.items():
        page.evaluate(js); page.wait_for_timeout(60)
        a_lieu = page.query_selector("#%sFiltreLieu" % p) is not None
        R.verifier(a_lieu == (p in ("pr", "be", "ct", "ent")), "[%s] filtre de lieu %s" % (p, "present" if a_lieu else "absent"))
        # recherche par modele, par fabricant
        page.fill("#%sRecherche" % p, "boreo"); page.wait_for_timeout(60)
        R.verifier("CAS-00" in page.inner_text("#%sListe" % p), "[%s] recherche par modele (Boreo)" % p)
        page.fill("#%sRecherche" % p, "beal"); page.wait_for_timeout(60)
        R.verifier("COR-001-A" in page.inner_text("#%sListe" % p), "[%s] recherche par fabricant (Beal)" % p)
        page.fill("#%sRecherche" % p, ""); page.wait_for_timeout(30)
        if a_lieu:
            page.select_option("#%sFiltreLieu" % p, "2"); page.wait_for_timeout(60)
            liste = page.inner_text("#%sListe" % p)
            R.verifier("MOU-001" in liste and "CAS-00" not in liste, "[%s] le lieu filtre la liste" % p)
            page.fill("#%sRecherche" % p, "CAS"); page.wait_for_timeout(60)
            R.verifier("Local club" in page.inner_text("#%s-ailleurs" % p), "[%s] message 'ailleurs'" % p)
            page.fill("#%sRecherche" % p, ""); page.select_option("#%sFiltreLieu" % p, "")
        page.evaluate("() => { bonEnEdition = null; }")
    # dates en jj/mm/aaaa sur la fiche interactive et la fiche imprimable
    ouvrir_fiche(page, ids_mat["CAS-001"])
    fi = page.inner_text("#materiel-editor")
    R.verifier(not re.search(r"\b20\d\d-\d\d-\d\d\b", fi), "fiche interactive : aucune date ISO")
    R.verifier(re.search(r"\b\d\d/\d\d/20\d\d\b", fi) is not None, "fiche interactive : dates jj/mm/aaaa")
    h = texte(fiche_imprimable(page, ids_mat["CAS-001"]))
    R.verifier(not re.search(r"\b20\d\d-\d\d-\d\d\b", h), "fiche imprimable : aucune date ISO")
    lot = texte(fiche_lot(page, ids_lot["Casques Boreo"]))
    R.verifier(not re.search(r"\b20\d\d-\d\d-\d\d\b", lot), "fiche du lot : aucune date ISO")
    # les champs date restent en ISO (format exige par le navigateur)
    page.evaluate(OUV["ct"]); page.wait_for_timeout(50)
    R.verifier(re.match(r"20\d\d-\d\d-\d\d$", page.input_value("#ctDate")) is not None, "champ date du formulaire reste valide")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
