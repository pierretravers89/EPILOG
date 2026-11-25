"""2026.5.33 : rubrique unique « Import / export » (reprendre un inventaire, exporter tout le parc,
sauvegarder et restaurer) ; anciens emplacements = liens ; exports liés à un écran inchangés."""
import sys, re; from harnais import ouvrir, Resultats, table; from donnees import construire
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
with ouvrir(D) as page:
    # --- navigation : menu lateral, onglet d'origine
    R.verifier(page.is_visible('#navLaterale [data-nav="donnees"]'), "menu lateral : entree « Import / export »")
    page.click('#navLaterale [data-nav="donnees"]'); page.wait_for_timeout(200)
    R.verifier(page.is_visible("#pane-donnees") and "nav-actif" in page.get_attribute('#navLaterale [data-nav="donnees"]', "class"), "rubrique ouverte et entree du menu active")
    corps = sa(page.inner_text("#pane-donnees"))
    for t in ["1. reprendre un inventaire", "2. exporter tout le parc", "3. sauvegarder et restaurer"]:
        R.verifier(t in corps, "section : %s" % t)
    R.verifier(page.is_visible("#impFichier") and page.is_visible("#impModele") and page.is_visible("#impModeleCsv"), "import : modele Excel, modele CSV, fichier")
    R.verifier(page.is_visible("#sauvJson") and page.is_visible("#sauvFichier"), "sauvegarde .json et import de sauvegarde")
    R.verifier(not page.is_visible("#razSauver") and "remettre a zero" in sa(page.inner_text("#donneesSauvegarde summary")), "remise a zero : repliee, a part")
    page.evaluate("() => { document.querySelector('#donneesSauvegarde details').open = true; }")
    R.verifier(page.is_visible("#razSauver"), "remise a zero : accessible une fois depliee")
    # --- export de tout le parc : insensible aux filtres de l'onglet Materiel
    page.evaluate("() => naviguer('materiel')"); page.wait_for_timeout(150)
    page.fill("#fmQ", "CAS-001"); page.wait_for_timeout(500)
    nb_filtre = page.evaluate("inventaireVisible.length"); nb_tout = page.evaluate("inventaireTout.length")
    R.verifier(nb_filtre == 1 and nb_tout == 6, "filtre actif : liste affichee %d, parc complet %d" % (nb_filtre, nb_tout))
    with page.expect_download() as dl: page.click("#btnExportCsv")
    p1 = "/tmp/liste_filtree.csv"; dl.value.save_as(p1)
    R.verifier(len(open(p1, encoding="utf-8-sig").read().splitlines()) == 2, "onglet Materiel : « Exporter la liste » = liste filtree (1 ligne)")
    page.evaluate("() => naviguer('donnees')"); page.wait_for_timeout(200)
    with page.expect_download() as dl: page.click("#exportParcCsv")
    p2 = "/tmp/parc_complet.csv"; dl.value.save_as(p2)
    R.verifier(len(open(p2, encoding="utf-8-sig").read().splitlines()) == 7, "rubrique : CSV = tout le parc (6 lignes) malgre le filtre")
    page.evaluate("() => { window.__DOCS__.length = 0; }"); page.click("#exportParcInv"); page.wait_for_timeout(500)
    inv = page.evaluate("window.__DOCS__")[-1]
    R.verifier("CAS-001" in inv and "MOU-001" in inv, "rubrique : inventaire imprimable = tout le parc")
    # --- anciens emplacements = liens
    page.evaluate("() => naviguer('apercu')"); page.wait_for_timeout(600)
    R.verifier(page.query_selector("#pane-apercu #exportParcXlsx") is None and page.is_visible("#lienDonnees"), "Vue d'ensemble : lien, plus de boutons (visible : %s)" % page.is_visible("#lienDonnees"))
    page.evaluate("ouvrirReglages()"); page.wait_for_timeout(60)
    page.click('#reglages-so [data-se="sauvegarde"]'); page.wait_for_timeout(60)
    R.verifier(page.query_selector("#reglagesSauvegarde #sauvJson") is None and page.is_visible("#reglagesVersDonnees"), "Reglages : plus d'action, un lien")
    page.click("#reglagesVersDonnees"); page.wait_for_timeout(200)
    R.verifier(page.is_visible("#pane-donnees") and not page.is_visible("#reglagesPanel"), "le lien ferme les Reglages et ouvre la rubrique")
    # --- exports lies a un ecran : toujours la
    page.evaluate("() => naviguer('prets')"); page.wait_for_timeout(100)
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
# --- document vide : « Premiers pas » propose l'import
D2, _, _ = construire()
for k in ["CONTROLES", "EMPRUNTS", "MATERIELS"]:
    if k in D2: D2[k]["lignes"] = []
with ouvrir(D2, vide=True) as page:
    page.evaluate("() => naviguer('apercu')"); page.wait_for_timeout(250)
    R.verifier(page.query_selector("#pane-apercu a.lien-import") is not None, "Premiers pas : lien « importez-le »")
    page.click("#pane-apercu a.lien-import"); page.wait_for_timeout(200)
    R.verifier(page.is_visible("#impFichier"), "le lien mene au panneau d'import")
    R.verifier(not page.erreurs, "document vide : aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
