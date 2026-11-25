"""2026.5.32 : l'inventaire imprime montre la photo du modele de chaque lot qui en a une,
a cote du titre du lot ; rien pour les lots sans photo ; la colonne Photo par exemplaire reste inchangee."""
import sys, re; from harnais import ouvrir, Resultats; from donnees import construire
R = Resultats()
D, ids_mat, ids_lot = construire()
if "photo" not in D["LOTS"]["colonnes"]: D["LOTS"]["colonnes"].append("photo")
for l in D["LOTS"]["lignes"]:
    if l["id"] == ids_lot["Casques Boreo"]: l["photo"] = ["L", 51]
    if l["id"] == ids_lot["Cordes 70 m"]: l["photo"] = ["L", 52]
D["MATERIELS"]["colonnes"].append("photo")
for m in D["MATERIELS"]["lignes"]:
    if m["numero_marquage"] == "CAS-001": m["photo"] = ["L", 41]
with ouvrir(D) as page:
    page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()"); page.wait_for_timeout(300)
    page.evaluate("() => { window.__DOCS__.length = 0; exporterInventaireImprimable(); }"); page.wait_for_timeout(900)
    inv = page.evaluate("window.__DOCS__")[-1]
    lots = re.findall(r'<img class="photo-vign photo-lot" src="[^"]*attachments/(\d+)/download', inv)
    R.verifier(sorted(lots) == ["51", "52"], "vignettes de lot : une par lot qui a une photo : %s" % lots)
    i = inv.index("<h2>Casques Boreo</h2>")
    R.verifier("photo-lot" in inv[max(0, i - 300):i] and 'attachments/51/' in inv[max(0, i - 300):i], "vignette placee juste avant le titre du lot")
    j = inv.index("<h2>Mousquetons</h2>")
    R.verifier("photo-lot" not in inv[max(0, j - 300):j], "lot sans photo : aucune vignette")
    R.verifier(inv.count('class="photo-vign"') == 1, "photos d'exemplaires inchangees : %d" % inv.count('class="photo-vign"'))
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
