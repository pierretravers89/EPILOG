"""2026.5.20 : sauvegarde .json et import dans un document VIDE. Numeros de
ligne conserves (liens intacts), colonnes absentes signalees et ignorees,
pieces jointes hors sauvegarde et listees, reglages repris, refus si le
document contient deja des donnees ou si le fichier n'est pas une sauvegarde,
tout ou rien en cas d'erreur."""
import sys, json, copy; from harnais import ouvrir, Resultats, table; from donnees import construire, ts
from outils_page import *
R = Resultats()
# ---- document source
A, ids_mat, ids_lot = construire()
A["CONTROLES"]["colonnes"].append("photo"); A["CONTROLES"]["lignes"][0]["photo"] = ["L", 40, 41]
A["CONFIG"] = {"colonnes": ["manualSort", "Cle", "Valeur"], "lignes": [{"id": 1, "manualSort": 1, "Cle": "nom_club", "Valeur": "CAF Test"}]}
A["EMPRUNTS"]["lignes"].append({"id": 7, "materiel": ids_mat["CAS-002"], "adherent": 2, "date_emprunt": ts(0, 2),
    "date_retour_prevue": None, "date_retour_effective": None, "numero_emprunt": "2026-007"})
with ouvrir(A) as page:
    page.evaluate("() => naviguer('donnees')"); page.wait_for_timeout(120)
    with page.expect_download() as dl:
        page.click("#sauvJson")
    dl.value.save_as("/tmp/sauvegarde_test.json")
    page.wait_for_timeout(200)
    R.verifier("piece" in sa(page.inner_text("#sauvMsg")), "message : pieces jointes non incluses signalees")
    # refus : document non vide
    page.set_input_files("#sauvFichier", "/tmp/sauvegarde_test.json"); page.wait_for_timeout(250)
    R.verifier("refuse" in sa(page.inner_text("#sauvMsg")) and "vide" in sa(page.inner_text("#sauvMsg")), "import refuse dans un document non vide")
    R.verifier(not page.erreurs, "source : aucune erreur JS %s" % page.erreurs)
S = json.load(open("/tmp/sauvegarde_test.json"))
R.verifier(S["format"] == "epilog-sauvegarde" and S["tables"]["materiels"]["lignes"][0]["id"] == A["MATERIELS"]["lignes"][0]["id"], "fichier : format et numeros de ligne")
R.verifier("manualSort" not in S["tables"]["materiels"]["colonnes"], "fichier : colonnes techniques exclues")
om = {(o["table"], o["colonne"]): o["nombre"] for o in S["pieces_jointes_omises"]}
R.verifier(om.get(("CONTROLES", "photo")) == 2 and om.get(("LOTS", "notice")) == 1, "fichier : pieces omises listees (2 photos, 1 notice) %s" % om)
R.verifier(["nom_club", "CAF Test"] in S["config"], "fichier : reglages inclus")
open("/tmp/pas_une_sauvegarde.json", "w").write('{"bonjour": 1}')

def document_vide(sans_couleur=True):
    B, _, _ = construire()
    for k in ["CATEGORIES", "LIEUX_STOCKAGE", "FOURNISSEURS", "ADHERENTS", "ACHATS", "LOTS", "MATERIELS",
              "CONTROLES", "EMPRUNTS", "INCIDENTS", "REPARATIONS", "ENTRETIENS"]:
        B[k]["lignes"] = []
    if sans_couleur: B["MATERIELS"]["colonnes"].remove("couleur")      # document cible plus ancien / different
    B["MATERIELS"]["colonnes"].append("numero_serie")                   # ... ou plus recent
    B["CONFIG"] = {"colonnes": ["manualSort", "Cle", "Valeur"], "lignes": []}
    return B
# ---- fichier invalide puis import reussi
B = document_vide()
with ouvrir(B, vide=True) as page:
    page.evaluate("() => naviguer('donnees')"); page.wait_for_timeout(120)
    page.set_input_files("#sauvFichier", "/tmp/pas_une_sauvegarde.json"); page.wait_for_timeout(200)
    R.verifier("n'est pas une sauvegarde" in page.inner_text("#sauvMsg").replace("’", "'"), "fichier quelconque refuse")
    page.set_input_files("#sauvFichier", "/tmp/sauvegarde_test.json"); page.wait_for_timeout(250)
    ap = page.inner_text("#sauvApercu")
    R.verifier("MATERIELS : 6" in ap and "CONTROLES : 2" in ap, "apercu : comptes par table")
    R.verifier("MATERIELS.couleur" in ap, "apercu : colonne absente du document signalee")
    R.verifier("photos" in sa(ap), "apercu : pieces jointes a rattacher signalees")
    R.verifier(len(table(page, "MATERIELS")) == 0, "rien d'ecrit avant confirmation")
    page.click("#sauvConfirmer"); page.wait_for_timeout(700)
    R.verifier("import termine" in sa(page.inner_text("#sauvMsg")), "message de fin : %r" % page.inner_text("#sauvMsg")[:60])
    for k in ["CATEGORIES", "LOTS", "MATERIELS", "CONTROLES", "EMPRUNTS"]:
        R.verifier(sorted(r["id"] for r in table(page, k)) == sorted(r["id"] for r in A[k]["lignes"]), "%s : memes lignes, memes numeros" % k)
    emp = [r for r in table(page, "EMPRUNTS") if r["id"] == 7][0]
    R.verifier(emp["materiel"] == ids_mat["CAS-002"] and emp["adherent"] == 2, "liens intacts (pret -> exemplaire, adherent)")
    dec = [r for r in table(page, "MATERIELS") if r["numero_marquage"] == "COR-001-A"][0]
    R.verifier(dec["origine_decoupe"] == ids_mat["COR-001"], "lien interne MATERIELS (decoupe) intact")
    R.verifier(all(r.get("photo") in (None,) for r in table(page, "CONTROLES")) or "photo" not in B["CONTROLES"]["colonnes"], "pieces jointes non ecrites")
    R.verifier({r["Cle"]: r["Valeur"] for r in table(page, "CONFIG")}.get("nom_club") == "CAF Test", "reglages importes")
    R.verifier(page.evaluate("rawRows.materiels.length") == 6 and page.evaluate("rawRows.materiels.filter(m => m.numero_marquage === 'CAS-002')[0]._statut") == "Prete",
               "outil recharge : statuts recalcules (CAS-002 prete)")
    R.verifier(not page.erreurs, "import : aucune erreur JS %s" % page.erreurs)
# ---- tout ou rien
B = document_vide()
with ouvrir(B, vide=True) as page:
    page.evaluate("() => naviguer('donnees')"); page.wait_for_timeout(120)
    page.set_input_files("#sauvFichier", "/tmp/sauvegarde_test.json"); page.wait_for_timeout(250)
    page.evaluate("() => { window.__ECHEC_SUR__ = 'CONTROLES'; }")
    page.click("#sauvConfirmer"); page.wait_for_timeout(600)
    R.verifier("rien n" in sa(page.inner_text("#sauvMsg")), "erreur : message 'rien n'a ete ecrit'")
    R.verifier(all(len(table(page, k)) == 0 for k in ["CATEGORIES", "LOTS", "MATERIELS", "CONTROLES"]), "erreur : aucune table partiellement remplie")
sys.exit(R.bilan())
