"""2026.5.27 : photos individuelles des exemplaires (MATERIELS.photo, creee par le
systeme de structure). Ajout depuis l'editeur avec reduction a l'envoi, galerie de
la fiche, section de la fiche de vie / du registre, vignettes dans la fiche du lot et
l'inventaire imprime, nombre de photos dans l'Excel et le CSV ; rien sans photo."""
import sys, os, re, json, io; from harnais import ouvrir, Resultats, table; from donnees import construire
from outils_page import *
from PIL import Image
R = Resultats()
# Images fabriquees par le test lui-meme (il ne depend d'aucun fichier laisse dans /tmp) :
# une vraie photo bruitee de 3000x2000 (~6 Mo, comme un telephone) et une petite image unie.
if not os.path.exists("/tmp/grande.jpg"):
    Image.frombytes("RGB", (3000, 2000), os.urandom(3000 * 2000 * 3)).save("/tmp/grande.jpg", quality=92)
if not os.path.exists("/tmp/petite.png"):
    Image.new("RGB", (640, 480), (200, 80, 40)).save("/tmp/petite.png")
def avec_photos():
    D, ids_mat, ids_lot = construire()
    D["MATERIELS"]["colonnes"].append("photo")
    for m in D["MATERIELS"]["lignes"]:
        if m["numero_marquage"] == "CAS-001": m["photo"] = ["L", 41, 42]
        if m["numero_marquage"] == "CAS-002": m["photo"] = ["L", 43]
    return D, ids_mat, ids_lot
def urls(html): return re.findall(r'src="([^"]*attachments/\d+/download[^"]*)"', html)
def th(html, titre):
    i = html.index("<h2>" + titre + "</h2>"); j = html.index("<table>", i); k = html.index("</tr>", j)
    return [re.sub(r"<[^>]+>", "", c) for c in re.findall(r"<th[^>]*>(.*?)</th>", html[j:k], flags=re.S)]

D, ids_mat, ids_lot = avec_photos()
etat = {"id": 700}
def serveur(route):
    etat["id"] += 1
    route.fulfill(status=200, content_type="application/json", body=json.dumps([etat["id"]]))
# Le banc d'essai ne voit pas le CONTENU d'un fichier envoye : on espionne televerserFichierSeul pour
# relever ce qui part reellement (nom, type, poids, dimensions).
ESPION = """() => { const orig = window.televerserFichierSeul; window.__ENVOIS__ = [];
  window.televerserFichierSeul = async function (f) {
    const b = await createImageBitmap(f);
    window.__ENVOIS__.push({ name: f.name, type: f.type, size: f.size, w: b.width, h: b.height });
    return orig(f); }; }"""
with ouvrir(D) as page:
    page.route("**/attachments?*", serveur); page.route("**/attachments", serveur)
    page.evaluate(ESPION)
    # ------------- editeur : bloc photos, reduction a l'envoi
    page.evaluate("id => openEditor('materiel', id)", ids_mat["CAS-003"]); page.wait_for_timeout(120)
    R.verifier(page.query_selector('#materiel-editor .ed-photos input[data-pj-table="materiels"]') is not None, "editeur : bloc photos present")
    import os
    page.set_input_files('#materiel-editor .ed-photos input[data-pj-table="materiels"]', "/tmp/grande.jpg"); page.wait_for_timeout(2500)
    e = page.evaluate("window.__ENVOIS__")[-1]
    R.verifier(e["type"] == "image/jpeg" and max(e["w"], e["h"]) <= 1600 and e["w"] > e["h"] and e["size"] < os.path.getsize("/tmp/grande.jpg") / 3,
               "photo de 3000x2000 reduite a l'envoi : %dx%d, %.1f Mo -> %.2f Mo" % (e["w"], e["h"], os.path.getsize("/tmp/grande.jpg") / 1e6, e["size"] / 1e6))
    r3 = [m for m in table(page, "MATERIELS") if m["id"] == ids_mat["CAS-003"]][0]
    R.verifier(r3["photo"] == ["L", 701], "photo rattachee a l'exemplaire : %s" % r3["photo"])
    page.evaluate("id => openEditor('materiel', id)", ids_mat["CAS-003"]); page.wait_for_timeout(120)
    page.set_input_files('#materiel-editor .ed-photos input[data-pj-table="materiel"]'.replace('"materiel"]', '"materiels"]'), "/tmp/petite.png"); page.wait_for_timeout(1200)
    e2 = page.evaluate("window.__ENVOIS__")[-1]
    R.verifier(e2["type"] == "image/png" and e2["name"] == "petite.png" and (e2["w"], e2["h"]) == (640, 480), "petite photo (640x480) : envoyee telle quelle")
    r3 = [m for m in table(page, "MATERIELS") if m["id"] == ids_mat["CAS-003"]][0]
    R.verifier(r3["photo"] == ["L", 701, 702], "les photos s'ajoutent a la suite : %s" % r3["photo"])
    # ------------- fiche interactive : galerie
    ouvrir_fiche(page, ids_mat["CAS-001"]); page.wait_for_timeout(300)
    R.verifier(len(page.query_selector_all("#galerieMat-%d .galerie-item" % ids_mat["CAS-001"])) == 2, "fiche : galerie de 2 photos")
    ouvrir_fiche(page, ids_mat["MOU-001"]); page.wait_for_timeout(200)
    R.verifier(not page.is_visible("#galerieMat-%d" % ids_mat["MOU-001"]), "fiche sans photo : pas de galerie")
    # ------------- fiche de vie / registre
    h1 = fiche_imprimable(page, ids_mat["CAS-001"])
    R.verifier("Photos de l’exemplaire" in h1 and len(urls(h1)) == 2, "fiche de vie : section et 2 images (%d)" % len(urls(h1)))
    h0 = fiche_imprimable(page, ids_mat["MOU-001"])
    R.verifier("Photos de l’exemplaire" not in h0, "fiche de vie sans photo : pas de section")
    # ------------- fiche du lot
    page.evaluate("() => { window.__DOCS__.length = 0; }")
    page.evaluate("id => ficheDeVieLot(id)", ids_lot["Casques Boreo"]); page.wait_for_timeout(700)
    fl = page.evaluate("window.__DOCS__")[-1]
    mm = re.search(r"<table><tr><th[^>]*>Marquage</th>.*?</table>", fl, flags=re.S)
    t = [re.sub(r"<[^>]+>", "", c) for c in re.findall(r"<th[^>]*>(.*?)</th>", mm.group(0).split("</tr>")[0], flags=re.S)]
    R.verifier(t[:2] == ["Marquage", "Photo"] and mm.group(0).count('class="photo-vign"') == 5, "fiche du lot : colonne Photo, 5 vignettes (CAS-001 x2, CAS-002 x1, CAS-003 x2 ajoutees) : %d" % mm.group(0).count('class="photo-vign"'))
    page.evaluate("() => { window.__DOCS__.length = 0; }")
    page.evaluate("id => ficheDeVieLot(id)", ids_lot["Mousquetons"]); page.wait_for_timeout(500)
    R.verifier("<th>Photo</th>" not in page.evaluate("window.__DOCS__")[-1], "fiche du lot sans photo : pas de colonne")
    # ------------- inventaire imprime
    page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()"); page.wait_for_timeout(300)
    page.evaluate("() => { window.__DOCS__.length = 0; exporterInventaireImprimable(); }"); page.wait_for_timeout(900)
    inv = page.evaluate("window.__DOCS__")[-1]
    R.verifier("Photo" in th(inv, "Casques Boreo") and "Photo" not in th(inv, "Mousquetons") and "Photo" not in th(inv, "Cordes 70 m"), "inventaire : colonne Photo seulement pour le lot qui en a : %s" % th(inv, "Casques Boreo"))
    R.verifier(inv.count('class="photo-vign"') == 5, "inventaire : 5 vignettes (%d)" % inv.count('class="photo-vign"'))
    # ------------- Excel et CSV : nombre de photos
    x = [f for f in page.evaluate("donneesLisibles()") if f["nom"] == "Inventaire"][0]
    ip = x["entetes"].index("Photos")
    nb = {l[0]: l[ip] for l in x["lignes"]}
    R.verifier(nb["CAS-001"] == 2 and nb["CAS-002"] == 1 and nb["MOU-001"] == "", "Excel : nombre de photos par exemplaire : %s" % {k: nb[k] for k in ("CAS-001", "CAS-002", "MOU-001")})
    with page.expect_download() as dl:
        page.evaluate("() => exporterInventaireCsv()")
    dl.value.save_as("/tmp/inv_photos.csv")
    csv = open("/tmp/inv_photos.csv", encoding="utf-8-sig").read().splitlines()
    sep = ";" if csv[0].startswith("Marquage;") else ","
    R.verifier(csv[0].split(sep)[-1] == "Photos" and any(l.startswith("CAS-001" + sep) and l.rstrip().endswith(sep + "2") for l in csv), "CSV : colonne Photos et valeur 2 pour CAS-001")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)

# ------------- sans la colonne : rien n'apparait, et le systeme la cree
D, ids_mat, ids_lot = construire()
with ouvrir(D) as page:
    page.wait_for_timeout(600)
    R.verifier(page.evaluate("aColonne('materiels', 'photo')"), "document sans la colonne : creee par le systeme de structure")
    page.evaluate("id => openEditor('materiel', id)", ids_mat["CAS-001"]); page.wait_for_timeout(150)
    R.verifier(page.query_selector('#materiel-editor .ed-photos') is not None, "... et le bloc photos apparait dans l'editeur")
    h = fiche_imprimable(page, ids_mat["CAS-001"])
    R.verifier("Photos de l’exemplaire" not in h, "exemplaire sans photo : fiche de vie sans section")
    R.verifier(not page.erreurs, "sans photo : aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
