"""2026.5.34 : exemplaire unique. Raccourci « Exemplaire unique » a la creation (quantite 1,
champ masque, aide), affichage « exemplaire unique » dans la liste et la fiche du lot quand il
ne compte qu'un exemplaire, « lot de N » sinon. Rien de stocke de nouveau."""
import sys; from harnais import ouvrir, Resultats, table; from donnees import construire
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
D["ACHATS"]["colonnes"] += ["montant_total", "note_financement"]
with ouvrir(D) as page:
    page.evaluate("""() => { document.querySelector('.tab[data-t="materiel"]').click(); document.getElementById('btnToggleLot').click(); }""")
    page.wait_for_timeout(100)
    champ = "#lotQuantite"
    R.verifier(page.query_selector("#lotUnique") is not None, "formulaire : case « Exemplaire unique » presente")
    page.check("#lotUnique"); page.wait_for_timeout(40)
    R.verifier(page.evaluate("document.getElementById('lotQuantite').value") == "1", "case cochee : quantite a 1")
    R.verifier(not page.is_visible(champ), "case cochee : champ Quantite masque")
    aide = sa(page.inner_text("#lotUniqueAide"))
    R.verifier("exemplaire unique" in aide and "ajouter" in aide, "aide explicite : %r" % aide[:80])
    page.uncheck("#lotUnique"); page.wait_for_timeout(40)
    R.verifier(page.is_visible(champ), "case decochee : champ Quantite de nouveau visible")
    page.fill(champ, "1"); page.wait_for_timeout(40)
    R.verifier("quantit" in sa(page.inner_text("#lotUniqueAide")) and "1" in page.inner_text("#lotUniqueAide"),
               "quantite saisie a 1 sans case : aide discrete (%r)" % page.inner_text("#lotUniqueAide")[:70])
    page.fill(champ, "3"); page.wait_for_timeout(40)
    R.verifier(page.inner_text("#lotUniqueAide") == "" and not page.is_visible("#lotUniqueAide"), "quantite 3 : aucune aide")
    # creation d'un lot a exemplaire unique
    page.fill(champ, "1"); page.check("#lotUnique")
    page.fill("#lotDesignation", "Sangle unique test"); page.select_option("#lotCategorie", "2")
    nb = len(table(page, "MATERIELS"))
    page.evaluate("creerLot()"); page.wait_for_timeout(500)
    R.verifier(len(table(page, "MATERIELS")) == nb + 1, "creation : un seul exemplaire ecrit")
    R.verifier(not page.is_checked("#lotUnique") if page.query_selector("#lotUnique") else True, "formulaire reinitialise : case decochee")
    lot = [l for l in table(page, "LOTS") if l.get("designation") == "Sangle unique test"][0]
    page.evaluate("() => naviguer('materiel')"); page.wait_for_timeout(300)
    texte = sa(page.inner_text("#materiel-list"))
    R.verifier("exemplaire unique" in texte, "liste : le lot d'un exemplaire s'affiche « exemplaire unique »")
    R.verifier("lot de 1" not in texte, "liste : pas de « lot de 1 »")
    # fiche du lot
    page.evaluate("() => { window.__DOCS__.length = 0; }")
    page.evaluate("id => ficheDeVieLot(id)", lot["id"]); page.wait_for_timeout(400)
    fl = page.evaluate("window.__DOCS__")[-1]
    R.verifier("1 (exemplaire unique)" in fl, "fiche du lot : quantite « 1 (exemplaire unique) »")
    # un lot de plusieurs exemplaires garde son libelle
    import re
    multiples = re.findall(r"lot de (\d+)", texte)
    R.verifier(multiples and all(int(n) > 1 for n in multiples), "lots multiples : libelle « lot de N » conserve (%s)" % multiples)
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
