"""Declaration d'entretien : table facultative ENTRETIENS, sous-onglet,
declaration groupee, fiche interactive, fiches imprimables, cascade a la
suppression, diagnostic. Aucun effet sur le statut ni sur l'echeance."""
import sys, time; from harnais import ouvrir, Resultats, table; from donnees import construire, ts
from outils_page import *
R = Resultats()

def aller_entretien(page):
    page.evaluate("""() => { document.querySelector('.tab[data-t="controles"]').click();
        document.querySelector('#epi-so [data-se="entretiens"]').click(); }""")
    page.wait_for_timeout(50)

# ---- sans la table : rien n'apparait
D, ids_mat, ids_lot = construire(avec_entretiens=False)
with ouvrir(D) as page:
    btn = page.query_selector('#epi-so [data-se="entretiens"]')
    R.verifier(btn is None or not btn.is_visible(), "sans ENTRETIENS : sous-onglet invisible")
    h = texte(fiche_imprimable(page, ids_mat["CAS-001"]))
    R.verifier("Entretien" not in h, "sans ENTRETIENS : pas de section sur la fiche imprimable")
    ouvrir_fiche(page, ids_mat["CAS-001"])
    R.verifier("entretiens" not in page.inner_text("#materiel-editor").lower(), "sans ENTRETIENS : pas d'historique sur la fiche")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)

# ---- avec la table
D, ids_mat, ids_lot = construire()
with ouvrir(D) as page:
    espionner_toasts(page)
    page.evaluate("""() => document.querySelector('.tab[data-t="controles"]').click()""")
    # depuis 2026.5.17, sur ordinateur, l'entree est dans le menu lateral
    R.verifier(page.is_visible('#navLaterale [data-nav="controles:entretiens"]'), "entree Entretien visible dans le menu")
    aller_entretien(page)
    R.verifier(page.is_visible("#epi-entretiens"), "le sous-onglet Entretien s'affiche")
    R.verifier("Casques desinfectes" in page.inner_text("#epi-entretiens"), "l'historique liste l'entretien existant")
    page.click("#btnToggleEnt")
    R.verifier(page.is_visible("#formEnt"), "le formulaire s'ouvre")
    form = page.inner_html("#formEnt")
    R.verifier("ne remplace pas un controle" in sa(form), "bulle d'aide presente")
    # eligibilite : pas de reforme dans la liste
    page.select_option("#entFiltreLot", str(ids_lot["Cordes 70 m"]))
    page.wait_for_timeout(50)
    liste = page.inner_text("#entListe")
    R.verifier("COR-001-A" in liste and "COR-001 " not in liste + " " and liste.count("COR-001") == 1,
               "un exemplaire reforme n'est pas propose : %r" % liste)
    # validation : rien de coche
    page.click("#btnSubmitEnt")
    R.verifier("cochez" in sa(page.inner_text("#entMsg")), "refus sans exemplaire coche")
    # declaration groupee (depuis 2026.5.2, le lot Cordes a regle la categorie :
    # on repasse par 'Toutes' pour atteindre un lot d'une autre categorie)
    page.select_option("#entFiltreCat", "")
    page.wait_for_timeout(30)
    page.select_option("#entFiltreLot", str(ids_lot["Casques Boreo"]))
    page.wait_for_timeout(50)
    for m in ("CAS-002", "CAS-003"):
        page.check('#entListe input[value="%d"]' % ids_mat[m])
    # date future refusee
    page.fill("#entDate", time.strftime("%Y-%m-%d", time.gmtime(time.time() + 5 * 86400)))
    page.click("#btnSubmitEnt")
    R.verifier("futur" in page.inner_text("#entMsg"), "date future refusee")
    page.fill("#entDate", time.strftime("%Y-%m-%d", time.gmtime()))
    page.select_option("#entAuteur", index=2)
    page.fill("#entCommentaire", "Lavage eau tiede")
    avant = page.evaluate("""() => rawRows.materiels.map(m => [m.id, m._statut,
        m._limiteControle ? m._limiteControle.toISOString() : null])""")
    nb_ctrl = len(table(page, "CONTROLES"))
    page.click("#btnSubmitEnt")
    page.wait_for_timeout(400)
    ent = table(page, "ENTRETIENS")
    nouveaux = [e for e in ent if e.get("commentaire") == "Lavage eau tiede"]
    R.verifier(len(nouveaux) == 2, "deux lignes ENTRETIENS creees")
    R.verifier(all(e["date_entretien"] == ts() for e in nouveaux), "date du jour enregistree")
    R.verifier(all(e["auteur"] == 2 for e in nouveaux) , "auteur enregistre")
    R.verifier(sorted(e["materiel"] for e in nouveaux) == sorted([ids_mat["CAS-002"], ids_mat["CAS-003"]]), "bons exemplaires")
    R.verifier(len(table(page, "CONTROLES")) == nb_ctrl, "aucun controle cree")
    apres = page.evaluate("""() => rawRows.materiels.map(m => [m.id, m._statut,
        m._limiteControle ? m._limiteControle.toISOString() : null])""")
    R.verifier(avant == apres, "statuts et echeances inchanges")
    R.verifier(any("ntretien" in t and "CAS-002" in t for t in toasts(page)), "toast de confirmation : %s" % toasts(page))

    # fiche interactive
    ouvrir_fiche(page, ids_mat["CAS-002"])
    fi = page.inner_text("#materiel-editor")
    R.verifier("entretiens" in fi.lower() and "Lavage eau tiede" in fi, "historique d'entretien sur la fiche interactive")

    # fiche imprimable exemplaire
    h = texte(fiche_imprimable(page, ids_mat["CAS-001"]))
    R.verifier("Entretien" in h and "Casques desinfectes" in h, "section Entretien sur la fiche imprimable")
    R.verifier("notice du fabricant" in h, "mention 'selon la notice du fabricant'")
    h0 = texte(fiche_imprimable(page, ids_mat["MOU-001"]))
    R.verifier("Aucun entretien enregistre" in h0, "etat vide explicite quand la table existe")

    # fiche du lot
    lot = texte(fiche_lot(page, ids_lot["Casques Boreo"]))
    R.verifier("Entretien" in lot and "CAS-003" in lot and "Lavage eau tiede" in lot, "section Entretien sur la fiche du lot")

    # diagnostic
    page.evaluate("lancerDiagnostic()")
    page.wait_for_timeout(200)
    diag = page.evaluate("document.getElementById('diagSortie').textContent")
    R.verifier("ENTRETIENS" in diag and "presente" in diag, "le diagnostic signale la table ENTRETIENS")

    # suppression d'un exemplaire : cascade sur ses entretiens
    page.evaluate("id => demanderSuppression('materiel', id)", ids_mat["CAS-001"])
    page.wait_for_timeout(50)
    R.verifier("entretien" in page.inner_text("#materiel-editor").lower(), "l'avertissement mentionne les entretiens")
    page.fill("#materiel-editor .del-confirm", "SUPPRIMER")
    page.click("#materiel-editor .del-go")
    page.wait_for_timeout(400)
    R.verifier(not [e for e in table(page, "ENTRETIENS") if e["materiel"] == ids_mat["CAS-001"]],
               "les entretiens de l'exemplaire supprime sont effaces")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
