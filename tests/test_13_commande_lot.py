"""2026.5.9 : commande accessible depuis "Modifier le lot" : resume, autres
lots de la meme commande, Modifier, facture, Creer + rattacher, menu lisible.
Piege verifie : apres creation, enregistrer le lot ne doit PAS detacher la
commande (menu 'Commande d'origine' perime)."""
import sys; from harnais import ouvrir, Resultats, table; from donnees import construire, ts
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
D["ACHATS"]["colonnes"] += ["montant_total", "note_financement"]
D["ACHATS"]["lignes"][0].update(montant_total=180, note_financement="")
for l in D["LOTS"]["lignes"]:
    if l["designation"] == "Mousquetons": l["achat"] = None      # lot sans commande
with ouvrir(D) as page:
    espionner_toasts(page)
    page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()")
    # ----- lot AVEC commande partagee (Casques + Cordes sur CMD-1)
    page.evaluate("id => openEditor('lot', id)", ids_lot["Casques Boreo"]); page.wait_for_timeout(80)
    bloc = page.inner_text("#materiel-editor .lot-commande")
    R.verifier("CMD-1" in bloc and "Vieux Campeur" in bloc, "resume : reference et fournisseur : %r" % bloc[:120])
    R.verifier("concerne aussi" in bloc and "Cordes 70 m" in bloc and "Mousquetons" not in bloc,
               "avertissement : la commande concerne aussi Cordes 70 m")
    R.verifier("Vieux Campeur" in " ".join(page.eval_on_selector_all('#materiel-editor [data-f="achat"] option', "os => os.map(o => o.textContent)")),
               "menu Commande d'origine lisible (reference — fournisseur — date)")
    R.verifier("Facture" in page.inner_text("#materiel-editor .lot-commande"), "etat de la facture affiche (2026.5.10 : champ dans le formulaire)")
    page.click("#edModifierCommande"); page.wait_for_timeout(50)
    page.fill('#edCommandeForm [data-f="ref_commande"]', "CMD-1-bis")
    page.fill('#edCommandeForm [data-f="montant_total"]', "199")
    page.click("#edCommandeForm .cmd-save"); page.wait_for_timeout(500)
    a = table(page, "ACHATS")[0]
    R.verifier(a["ref_commande"] == "CMD-1-bis" and a["montant_total"] == 199, "commande modifiee depuis le lot : %s" % a)
    R.verifier(len(table(page, "ACHATS")) == 1, "aucune commande creee en trop")
    # ----- lot SANS commande : creer et rattacher
    page.evaluate("id => openEditor('lot', id)", ids_lot["Mousquetons"]); page.wait_for_timeout(80)
    R.verifier("Aucune commande" in page.inner_text("#materiel-editor .lot-commande"), "lot sans commande : message et bouton Creer")
    page.click("#edCreerCommande"); page.wait_for_timeout(50)
    R.verifier(page.input_value('#edCommandeForm [data-f="montant_total"]') in ("12", "12.0"),
               "montant propose = prix x exemplaires (12 x 1) : %r" % page.input_value('#edCommandeForm [data-f="montant_total"]'))
    page.fill('#edCommandeForm [data-f="ref_commande"]', "CMD-2")
    page.click("#edCommandeForm .cmd-save"); page.wait_for_timeout(600)
    achats = table(page, "ACHATS"); nouv = [x for x in achats if x["ref_commande"] == "CMD-2"]
    lot = [l for l in table(page, "LOTS") if l["id"] == ids_lot["Mousquetons"]][0]
    R.verifier(nouv and lot["achat"] == nouv[0]["id"], "commande creee et rattachee au lot")
    # piege : enregistrer ensuite le lot (editeur encore ouvert ?) ne detache rien
    if page.query_selector("#materiel-editor .ed-save"):
        page.click("#materiel-editor .ed-save"); page.wait_for_timeout(500)
    lot = [l for l in table(page, "LOTS") if l["id"] == ids_lot["Mousquetons"]][0]
    R.verifier(nouv and lot["achat"] == nouv[0]["id"], "enregistrer le lot apres coup ne detache pas la commande (%s)" % lot["achat"])
    # le lot montre desormais la commande creee
    page.evaluate("id => openEditor('lot', id)", ids_lot["Mousquetons"]); page.wait_for_timeout(80)
    R.verifier("CMD-2" in page.inner_text("#materiel-editor .lot-commande"), "editeur du lot rouvert sur la nouvelle commande")
    page.locator("#materiel-editor").screenshot(path="/tmp/cmd_lot.png")
    # non-regression : edition classique depuis Achats et budget
    page.evaluate("() => document.querySelector('.tab[data-t=\"budget\"]').click()")
    page.evaluate("id => openEditor('achat', id)", nouv[0]["id"]); page.wait_for_timeout(60)
    page.fill('#budget-editor [data-f="ref_commande"]', "CMD-2-budget")
    page.click("#budget-editor .ed-save"); page.wait_for_timeout(500)
    R.verifier(any(x["ref_commande"] == "CMD-2-budget" for x in table(page, "ACHATS")), "edition depuis Achats et budget inchangee")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
