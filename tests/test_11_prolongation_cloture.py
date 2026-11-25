"""Prolongation saisie a la CLOTURE d'une reparation en cours (le chemin cite
par Pierre) : la reparation existante recoit la piece et sa duree."""
import sys; from harnais import ouvrir, Resultats, table; from donnees import ts
from donnees_degaines import donnees
from outils_page import *
R = Resultats()
D, ids, lot_id = donnees(True)
# DEG-001 : reparation EN COURS (sans date_effectuee), et pas de prolongation anterieure
D["REPARATIONS"]["lignes"] = [dict(id=1, materiel=ids["DEG-001"], date_declaree=ts(0, 3), motif="sangle usee",
                                   date_effectuee=None, intervenant=None, pieces_remplacees=None, description=None)]
with ouvrir(D) as page:
    R.verifier(page.evaluate("id => rawRows.materiels.filter(m => m.id === id)[0]._statut", ids["DEG-001"]) == "En reparation",
               "DEG-001 en reparation")
    ouvrir_fiche(page, ids["DEG-001"])
    page.click('#ficheBoutons [data-act="reparation"]'); page.wait_for_timeout(80)
    R.verifier(page.is_visible("#ffProlongBloc"), "cloture : bloc de prolongation visible")
    page.fill("#ffProlongDate", "2025-04-10"); page.fill('[data-ff="description"]', "sangle remplacee")
    page.fill("#ffEtatPieces", "sangle Express 12 cm")
    page.locator("#ffProlongBloc").screenshot(path="/tmp/prolong.png")
    page.click("#ffGo"); page.wait_for_timeout(500)
    r = table(page, "REPARATIONS")[0]
    R.verifier(r.get("date_effectuee") and r.get("duree_vie_piece_mois") == 120 and r.get("date_fabrication_piece"),
               "cloture : la reparation est close avec la piece et sa duree : %s" % r)
    f = page.evaluate("id => rawRows.materiels.filter(m => m.id === id)[0]._finDeVie.getUTCFullYear()", ids["DEG-001"])
    R.verifier(f == 2035, "cloture : fin de vie 31/12/2035 (piece 04/2025 + 120 mois) : %s" % f)
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
