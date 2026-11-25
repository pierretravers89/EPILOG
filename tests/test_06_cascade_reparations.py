"""Supprimer un exemplaire efface aussi ses reparations (comme ses controles,
prets, incidents et entretiens) ; l'avertissement les compte."""
import sys; from harnais import ouvrir, Resultats, table; from donnees import construire, ts
from outils_page import sa
R = Resultats()
D, ids_mat, ids_lot = construire()
D["REPARATIONS"]["lignes"].append({"id": 1, "materiel": ids_mat["CAS-002"], "date_declaree": ts(0, 5),
                                    "motif": "boucle", "date_effectuee": None})
with ouvrir(D) as page:
    page.evaluate("id => { document.querySelector('.tab[data-t=\"materiel\"]').click(); demanderSuppression('materiel', id); }", ids_mat["CAS-002"])
    page.wait_for_timeout(50)
    R.verifier("reparation" in sa(page.inner_text("#materiel-editor")), "l'avertissement mentionne la reparation")
    page.fill("#materiel-editor .del-confirm", "SUPPRIMER")
    page.click("#materiel-editor .del-go")
    page.wait_for_timeout(400)
    R.verifier(len(table(page, "REPARATIONS")) == 0, "la reparation de l'exemplaire supprime est effacee")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
