"""Avertissement (non bloquant) quand un lot porte le nom de sa categorie :
creation, edition du lot, scission. Insensible a la casse, aux accents et au
pluriel ; disparait des que le nom se distingue."""
import sys; from harnais import ouvrir, Resultats, table; from donnees import construire
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
ids_cat = {c["nom"]: c["id"] for c in D["CATEGORIES"]["lignes"]}
def alerte(page, zone):
    el = page.query_selector(zone + " .alerte-nom-lot")
    return el is not None and el.is_visible()

with ouvrir(D) as page:
    # 1. creation
    page.evaluate("""() => { document.querySelector('.tab[data-t="materiel"]').click(); document.getElementById('btnToggleLot').click(); }""")
    page.select_option("#lotCategorie", str(ids_cat["Casques"]))
    page.fill("#lotDesignation", "casques"); page.wait_for_timeout(30)
    R.verifier(alerte(page, "#formLot"), "creation : 'casques' dans Casques -> avertissement")
    page.fill("#lotDesignation", "Casque"); page.wait_for_timeout(30)
    R.verifier(alerte(page, "#formLot"), "creation : singulier 'Casque' -> avertissement")
    page.fill("#lotDesignation", "Casques Boreo 2026"); page.wait_for_timeout(30)
    R.verifier(not alerte(page, "#formLot"), "creation : nom distinctif -> pas d'avertissement")
    page.fill("#lotDesignation", "Cordes"); page.wait_for_timeout(30)
    R.verifier(not alerte(page, "#formLot"), "creation : 'Cordes' dans Casques -> pas d'avertissement")
    page.select_option("#lotCategorie", str(ids_cat["Cordes"])); page.wait_for_timeout(30)
    R.verifier(alerte(page, "#formLot"), "creation : changer la categorie recalcule l'avertissement")
    txt = page.inner_text("#formLot .alerte-nom-lot")
    R.verifier("distingue" in sa(txt), "le message explique quoi faire : %r" % txt)
    page.click("#btnToggleLot")

    # 2. edition du lot
    page.evaluate("id => openEditor('lot', id)", ids_lot["Cordes 70 m"]); page.wait_for_timeout(50)
    R.verifier(not alerte(page, "#materiel-editor"), "edition : nom actuel distinctif -> rien")
    page.fill('#materiel-editor [data-f="designation"]', "Cordes"); page.wait_for_timeout(30)
    R.verifier(alerte(page, "#materiel-editor"), "edition : renommer en 'Cordes' -> avertissement")
    # non bloquant : l'enregistrement passe
    page.click("#materiel-editor .ed-save"); page.wait_for_timeout(400)
    lot = [l for l in table(page, "LOTS") if l["id"] == ids_lot["Cordes 70 m"]][0]
    R.verifier(lot["designation"] == "Cordes", "edition : l'enregistrement n'est pas bloque")

    # 3. scission
    page.evaluate("id => ouvrirFenetreScission(id)", ids_lot["Casques Boreo"]); page.wait_for_timeout(80)
    page.fill("#scissionDesignation", "Casques"); page.wait_for_timeout(30)
    R.verifier(alerte(page, "#scissionChampsNouveau"), "scission : nouveau lot 'Casques' -> avertissement")
    page.fill("#scissionDesignation", "Casques jeunes"); page.wait_for_timeout(30)
    R.verifier(not alerte(page, "#scissionChampsNouveau"), "scission : nom distinctif -> rien")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
