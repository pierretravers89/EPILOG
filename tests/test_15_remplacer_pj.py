"""2026.5.11 : photo du modele, notice (editeur de lot) et facture (Achats et
budget) sont REMPLACEES ; la galerie de photos d'un controle AJOUTE toujours.
Envoi reel vers un serveur Grist simule."""
import sys, json; from harnais import ouvrir, Resultats, table; from donnees import construire
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
D["CONTROLES"]["colonnes"].append("photo")
D["CONTROLES"]["lignes"][0]["photo"] = ["L", 40]
for l in D["LOTS"]["lignes"]:
    if l["designation"] == "Casques Boreo": l.update(photo=["L", 20], notice=["L", 5])
open("/tmp/f.pdf", "wb").write(b"%PDF-1.4"); open("/tmp/f.png", "wb").write(
    bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000"))
etat = {"id": 900}
def serveur(route):
    etat["id"] += 1
    route.fulfill(status=200, content_type="application/json", body=json.dumps([etat["id"]]))
def lot(page): return [l for l in table(page, "LOTS") if l["id"] == ids_lot["Casques Boreo"]][0]
with ouvrir(D) as page:
    page.route("**/attachments*", serveur)
    page.on("dialog", lambda d: d.accept())
    page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()")
    page.evaluate("id => openEditor('lot', id)", ids_lot["Casques Boreo"]); page.wait_for_timeout(80)
    page.set_input_files('#materiel-editor input[data-pj-table="lots"][data-pj-col="photo"]', "/tmp/f.png"); page.wait_for_timeout(600)
    R.verifier(lot(page)["photo"] == ["L", 901], "photo du modele remplacee : %s" % lot(page)["photo"])
    page.evaluate("id => openEditor('lot', id)", ids_lot["Casques Boreo"]); page.wait_for_timeout(80)
    page.set_input_files('#materiel-editor input[data-pj-table="lots"][data-pj-col="notice"]', "/tmp/f.pdf"); page.wait_for_timeout(600)
    R.verifier(lot(page)["notice"] == ["L", 902], "notice remplacee : %s" % lot(page)["notice"])
    # facture depuis Achats et budget
    page.evaluate("() => document.querySelector('.tab[data-t=\"budget\"]').click()"); page.wait_for_timeout(80)
    page.set_input_files('#budget-list input[data-pj-table="achats"][data-pj-col="facture"]', "/tmp/f.pdf"); page.wait_for_timeout(600)
    R.verifier(table(page, "ACHATS")[0]["facture"] == ["L", 903], "facture (Achats et budget) remplacee : %s" % table(page, "ACHATS")[0]["facture"])
    # galerie : ajout
    page.evaluate("() => document.querySelector('.tab[data-t=\"controles\"]').click()")
    page.evaluate("id => openEditor('controle', id)", table(page, "CONTROLES")[0]["id"]); page.wait_for_timeout(120)
    inp = page.query_selector('input[data-pj-table="controles"][data-pj-col="photo"]')
    R.verifier(inp is not None and inp.get_attribute("data-pj-remplacer") is None, "galerie : bouton d'AJOUT (pas de remplacement)")
    if inp:
        page.set_input_files('input[data-pj-table="controles"][data-pj-col="photo"]', "/tmp/f.png"); page.wait_for_timeout(600)
        R.verifier(table(page, "CONTROLES")[0]["photo"] == ["L", 40, 904], "galerie : photo ajoutee a cote : %s" % table(page, "CONTROLES")[0]["photo"])
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
