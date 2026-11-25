"""2026.5.20 : export lisible. Excel (SheetJS servi localement a la place de
cdnjs) avec un onglet par theme, des noms a la place des numeros internes,
des dates jj/mm/aaaa ; repli en CSV si la bibliotheque ne se charge pas."""
import os, sys, re, io; from harnais import ouvrir, Resultats, VENDOR; from donnees import construire
from outils_page import *
import openpyxl
R = Resultats()
SHEETJS = open(os.path.join(VENDOR, "package", "dist", "xlsx.full.min.js"), "rb").read()
D, ids_mat, ids_lot = construire()
with ouvrir(D) as page:
    page.route("**/cdnjs.cloudflare.com/ajax/libs/xlsx/**", lambda r: r.fulfill(status=200, content_type="application/javascript", body=SHEETJS))
    # (2026.5.33) l'export lisible est dans la rubrique Import / export ; la Vue d'ensemble n'a plus qu'un lien
    page.evaluate("() => naviguer('apercu')"); page.wait_for_timeout(150)
    R.verifier(page.query_selector("#pane-apercu #exportParcXlsx") is None and page.is_visible("#lienDonnees"), "Vue d'ensemble : un lien vers Import / export, plus de boutons d'export")
    page.click("#lienDonnees"); page.wait_for_timeout(200)
    R.verifier(page.is_visible("#exportParcXlsx") and page.is_visible("#exportParcFiches") and page.is_visible("#exportParcCsv") and page.is_visible("#exportParcInv"),
               "rubrique Import / export : Excel, CSV, inventaire imprimable, fiches de vie")
    with page.expect_download() as dl:
        page.click("#exportParcXlsx")
    f = dl.value; R.verifier(re.match(r"epilog-export-\d{4}-\d{2}-\d{2}\.xlsx", f.suggested_filename), "nom de fichier : %s" % f.suggested_filename)
    f.save_as("/tmp/export_test.xlsx"); wb = openpyxl.load_workbook("/tmp/export_test.xlsx")
    noms = wb.sheetnames
    R.verifier(noms[0] == "Résumé" and "Inventaire" in noms and "Contrôles" in noms and "Adhérents" in noms, "onglets : %s" % noms)
    inv = [[c.value for c in r] for r in wb["Inventaire"].iter_rows()]
    R.verifier(inv[0][0] == "Marquage" and "Statut" in inv[0], "Inventaire : en-tetes lisibles")
    cas = [r for r in inv if r[0] == "CAS-001"][0]
    R.verifier("Casques Boreo" in cas and "Casques" in cas and "Local club" in cas, "Inventaire : noms a la place des numeros internes")
    R.verifier(any(re.match(r"\d\d/\d\d/20\d\d$", str(v or "")) for v in cas), "Inventaire : dates jj/mm/aaaa")
    ct = [[c.value for c in r] for r in wb["Contrôles"].iter_rows()]
    R.verifier("Exemplaire" in ct[0] and "Contrôleur" in ct[0] and any("Pierre Travers" in [str(x) for x in r] for r in ct[1:]),
               "Controles : exemplaire et controleur en clair")
    res = [[c.value for c in r] for r in wb["Résumé"].iter_rows()]
    R.verifier(any(r[0] == "Inventaire" and r[1] == 6 for r in res), "Resume : 6 exemplaires comptes")
    R.verifier("Sortie du parc" in inv[0] and any(r[0] == "COR-001" and r[inv[0].index("Sortie du parc")] for r in inv),
               "Inventaire : date de sortie du parc (COR-001 reformee)")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
# ---- (2026.5.23) bibliotheque indisponible : message clair, AUCUNE avalanche de CSV
D, ids_mat, ids_lot = construire()
with ouvrir(D) as page:
    page.route("**/cdnjs.cloudflare.com/**", lambda r: r.abort())
    noms = []
    page.on("download", lambda d: noms.append(d.suggested_filename))
    page.evaluate("() => naviguer('donnees')"); page.wait_for_timeout(150)
    page.click("#exportParcXlsx"); page.wait_for_timeout(2500)
    m = page.inner_text("#exportParcMsg")
    R.verifier("excel indisponible" in sa(m) and "reessayez" in sa(m), "message clair : %r" % m[:90])
    R.verifier(noms == [], "aucun fichier telecharge (%s)" % noms)
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
