"""Suppression d'un entretien depuis l'historique du sous-onglet : panneau de
confirmation, ligne effacee, rien d'autre ne change."""
import sys; from harnais import ouvrir, Resultats, table; from donnees import construire
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
with ouvrir(D) as page:
    page.evaluate("""() => { document.querySelector('.tab[data-t="controles"]').click();
        document.querySelector('#epi-so [data-se="entretiens"]').click(); }""")
    page.click('#entretiens-list .btn-del[data-ent="entretien"]')
    page.wait_for_timeout(50)
    panneau = page.inner_text("#entretiens-editor")
    R.verifier("CAS-001" in panneau and "Tapez SUPPRIMER" in panneau, "panneau de confirmation affiche")
    nb_ctrl = len(table(page, "CONTROLES"))
    page.fill("#entretiens-editor .del-confirm", "SUPPRIMER")
    page.click("#entretiens-editor .del-go")
    page.wait_for_timeout(400)
    R.verifier(len(table(page, "ENTRETIENS")) == 0, "ligne supprimee")
    R.verifier(len(table(page, "CONTROLES")) == nb_ctrl and len(table(page, "MATERIELS")) == 6, "rien d'autre ne change")
    R.verifier(page.is_visible("#epi-entretiens"), "on reste sur le sous-onglet Entretien apres rechargement")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
