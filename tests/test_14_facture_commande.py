"""2026.5.10 : facture DANS le formulaire de commande de l'editeur de lot,
envoi reel (serveur Grist simule) ; remplacement, pas ajout ; a la creation
comme a la modification ; la commande reste enregistree si l'envoi echoue."""
import sys, json; from harnais import ouvrir, Resultats, table; from donnees import construire
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
D["ACHATS"]["colonnes"] += ["montant_total", "note_financement"]
for l in D["LOTS"]["lignes"]:
    if l["designation"] == "Mousquetons": l["achat"] = None
open("/tmp/facture.pdf", "wb").write(b"%PDF-1.4 test")
etat = {"id": 500, "echec": False}
def serveur(route):
    if etat["echec"]: return route.fulfill(status=500, body="erreur")
    etat["id"] += 1
    route.fulfill(status=200, content_type="application/json", body=json.dumps([etat["id"]]))
with ouvrir(D) as page:
    page.route("**/attachments*", serveur)
    page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()")
    # ----- modification : CMD-1 a deja une facture (['L', 7]) -> remplacee
    page.evaluate("id => openEditor('lot', id)", ids_lot["Casques Boreo"]); page.wait_for_timeout(80)
    R.verifier("Facture" in page.inner_text("#materiel-editor .lot-commande") and "jointe" in page.inner_text("#materiel-editor .lot-commande"),
               "resume : facture jointe")
    R.verifier(page.query_selector("#materiel-editor .lot-commande [data-pj-table]") is None, "plus de bouton facture separe")
    page.click("#edModifierCommande"); page.wait_for_timeout(50)
    R.verifier(page.query_selector("#edCommandeForm .cmd-facture") is not None, "champ facture DANS le formulaire")
    R.verifier("remplace" in page.inner_text("#edCommandeForm"), "avertit qu'une facture existe deja")
    page.set_input_files("#edCommandeForm .cmd-facture", "/tmp/facture.pdf")
    page.once("dialog", lambda d: d.accept())
    page.click("#edCommandeForm .cmd-save"); page.wait_for_timeout(700)
    a = table(page, "ACHATS")[0]
    R.verifier(a["facture"] == ["L", 501], "facture REMPLACEE (pas ajoutee) : %s" % a["facture"])
    # ----- creation avec facture
    page.evaluate("id => openEditor('lot', id)", ids_lot["Mousquetons"]); page.wait_for_timeout(80)
    page.click("#edCreerCommande"); page.wait_for_timeout(50)
    page.fill('#edCommandeForm [data-f="ref_commande"]', "CMD-2")
    page.set_input_files("#edCommandeForm .cmd-facture", "/tmp/facture.pdf")
    page.click("#edCommandeForm .cmd-save"); page.wait_for_timeout(800)
    n = [x for x in table(page, "ACHATS") if x["ref_commande"] == "CMD-2"]
    lot = [l for l in table(page, "LOTS") if l["id"] == ids_lot["Mousquetons"]][0]
    R.verifier(n and n[0].get("facture") == ["L", 502] and lot["achat"] == n[0]["id"],
               "creation : commande + facture + rattachement : %s" % (n[0] if n else None))
    # ----- envoi en echec : la commande est quand meme modifiee, message clair
    etat["echec"] = True
    page.evaluate("id => openEditor('lot', id)", ids_lot["Mousquetons"]); page.wait_for_timeout(80)
    page.click("#edModifierCommande"); page.wait_for_timeout(50)
    page.fill('#edCommandeForm [data-f="ref_commande"]', "CMD-2b")
    page.set_input_files("#edCommandeForm .cmd-facture", "/tmp/facture.pdf")
    page.once("dialog", lambda d: d.accept())
    page.click("#edCommandeForm .cmd-save"); page.wait_for_timeout(800)
    R.verifier(any(x["ref_commande"] == "CMD-2b" for x in table(page, "ACHATS")), "echec d'envoi : la commande est enregistree quand meme")
    err = page.evaluate("(document.getElementById('erreurTexte') || {}).textContent || ''")
    R.verifier("facture" in sa(err), "echec d'envoi : message explicite : %r" % err[:90])
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
