"""2026.5.22 : remise a zero. Deux choix (tout / garder les listes du club),
reglages toujours conserves, sauvegarde telechargee obligatoirement avant,
confirmation SUPPRIMER (casse indifferente), effacement tout ou rien."""
import sys, json; from harnais import ouvrir, Resultats, table; from donnees import construire, ts
from outils_page import *
R = Resultats()
def donnees():
    D, ids_mat, ids_lot = construire()
    D["CONFIG"] = {"colonnes": ["manualSort", "Cle", "Valeur"], "lignes": [{"id": 1, "manualSort": 1, "Cle": "nom_club", "Valeur": "CAF Test"}]}
    D["EMPRUNTS"]["lignes"].append({"id": 1, "materiel": ids_mat["CAS-002"], "adherent": 2, "date_emprunt": ts(0, 2),
        "date_retour_prevue": None, "date_retour_effective": None, "numero_emprunt": "2026-001"})
    return D
def ouvrir_raz(page, choix="tout"):
    page.evaluate("() => naviguer('donnees')"); page.wait_for_timeout(120)
    page.evaluate("() => { document.querySelector('#donneesSauvegarde details').open = true; }")
    page.check('input[name="razChoix"][value="%s"]' % choix); page.wait_for_timeout(40)
DONNEES = ["CATEGORIES", "LIEUX_STOCKAGE", "FOURNISSEURS", "ADHERENTS", "ACHATS", "LOTS", "MATERIELS", "CONTROLES", "EMPRUNTS"]
# ---- tout effacer
with ouvrir(donnees()) as page:
    R.verifier("Sauvegarder / importer des données" in page.evaluate("document.querySelector('#reglages-so [data-se=\"sauvegarde\"]').textContent"),
               "sous-rubrique renommee")
    ouvrir_raz(page, "tout")
    bil = page.inner_text("#razBilan")
    R.verifier("6 exemplaires" in bil and "2 contrôles" in bil and "1 prêt," in bil and "1 lieu," in bil and "adhérents" in bil, "bilan en chiffres (singulier respecte) : %r" % bil)
    R.verifier(page.query_selector("#razConfirmation .raz-confirm") is None, "pas de confirmation avant la sauvegarde")
    with page.expect_download() as dl:
        page.click("#razSauver")
    R.verifier(dl.value.suggested_filename.startswith("epilog-sauvegarde-"), "sauvegarde telechargee d'office : %s" % dl.value.suggested_filename)
    page.wait_for_timeout(200)
    R.verifier(page.is_visible("#razConfirmation .raz-confirm"), "puis demande de confirmation")
    page.fill("#razConfirmation .raz-confirm", "oui"); page.click("#razConfirmation .raz-go"); page.wait_for_timeout(200)
    R.verifier("supprimer" in sa(page.inner_text("#sauvMsg")) and len(table(page, "MATERIELS")) == 6, "mauvais mot : rien n'est efface")
    page.fill("#razConfirmation .raz-confirm", "  supprimer "); page.click("#razConfirmation .raz-go"); page.wait_for_timeout(600)
    R.verifier(all(len(table(page, k)) == 0 for k in DONNEES), "tout effacer : toutes les tables de donnees vides")
    R.verifier({r["Cle"]: r["Valeur"] for r in table(page, "CONFIG")}.get("nom_club") == "CAF Test", "reglages conserves")
    R.verifier("terminee" in sa(page.inner_text("#sauvMsg")) and "historique des versions" in sa(page.inner_text("#sauvMsg")), "message final avec rappel de l'historique Grist")
    R.verifier(page.evaluate("tablesNonVides().length") == 0, "document pret pour un import")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
# ---- garder les listes du club
with ouvrir(donnees()) as page:
    ouvrir_raz(page, "listes")
    bil = page.inner_text("#razBilan")
    R.verifier("exemplaires" in bil and "adhérents" not in bil and "catégories" not in bil, "bilan sans les listes : %r" % bil)
    with page.expect_download():
        page.click("#razSauver")
    page.wait_for_timeout(200)
    page.fill("#razConfirmation .raz-confirm", "SUPPRIMER"); page.click("#razConfirmation .raz-go"); page.wait_for_timeout(600)
    R.verifier(all(len(table(page, k)) == 0 for k in ["ACHATS", "LOTS", "MATERIELS", "CONTROLES", "EMPRUNTS"]), "parc, historique et commandes effaces")
    R.verifier(all(len(table(page, k)) > 0 for k in ["CATEGORIES", "LIEUX_STOCKAGE", "FOURNISSEURS", "ADHERENTS"]), "listes du club conservees")
    R.verifier(not page.erreurs, "listes : aucune erreur JS %s" % page.erreurs)
# ---- sauvegarde impossible : on s'arrete
with ouvrir(donnees()) as page:
    ouvrir_raz(page, "tout")
    page.evaluate("() => { const f = grist.docApi.fetchTable; grist.docApi.fetchTable = async () => { throw new Error('reseau coupe'); }; }")
    page.click("#razSauver"); page.wait_for_timeout(400)
    R.verifier("annulee" in sa(page.inner_text("#sauvMsg")) and page.query_selector("#razConfirmation .raz-confirm") is None,
               "sauvegarde impossible : arret, pas de confirmation proposee")
    R.verifier(len(table(page, "MATERIELS")) == 6, "sauvegarde impossible : rien d'efface")
# ---- erreur pendant l'effacement : tout ou rien
with ouvrir(donnees()) as page:
    ouvrir_raz(page, "tout")
    with page.expect_download():
        page.click("#razSauver")
    page.wait_for_timeout(200)
    page.evaluate("() => { window.__ECHEC_SUR__ = 'CATEGORIES'; }")
    page.fill("#razConfirmation .raz-confirm", "SUPPRIMER"); page.click("#razConfirmation .raz-go"); page.wait_for_timeout(500)
    R.verifier("rien n" in sa(page.inner_text("#sauvMsg")), "erreur : message 'rien n'a ete efface'")
    R.verifier(len(table(page, "MATERIELS")) == 6 and len(table(page, "CONTROLES")) == 2, "erreur : aucune table videe (tout ou rien)")
sys.exit(R.bilan())
