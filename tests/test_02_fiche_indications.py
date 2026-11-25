"""Fiche de vie imprimable : notice fabricant, periodicite des controles,
date du prochain controle (exemplaire) ; periodicite et colonne 'Prochain
controle' (fiche du lot). Aucune mecanique nouvelle : on relit _limiteControle."""
import sys; from harnais import ouvrir, Resultats; from donnees import construire
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
with ouvrir(D) as page:
    h = texte(fiche_imprimable(page, ids_mat["CAS-001"]))
    attendu = page.evaluate("id => fmtDate(rawRows.materiels.filter(m => m.id === id)[0]._limiteControle)", ids_mat["CAS-001"])
    R.verifier("Notice fabricant Jointe au registre" in h, "notice jointe affichee sur la fiche exemplaire")
    R.verifier("Periodicite des controles" in h and "12 mois" in h, "periodicite affichee")
    R.verifier("Prochain controle " + attendu in h, "prochain controle = %s" % attendu)

    h2 = texte(fiche_imprimable(page, ids_mat["COR-001-A"]))
    R.verifier("Notice fabricant Non jointe" in h2, "notice absente signalee 'Non jointe'")

    h3 = texte(fiche_imprimable(page, ids_mat["COR-001"]))
    R.verifier("Prochain controle Sans objet" in h3, "exemplaire reforme : prochain controle 'Sans objet'")

    # exemplaire jamais controle : echeance = mise en service + 1 an, avec la mention
    h4 = texte(fiche_imprimable(page, ids_mat["CAS-003"]))
    att4 = page.evaluate("id => fmtDate(rawRows.materiels.filter(m => m.id === id)[0]._limiteControle)", ids_mat["CAS-003"])
    R.verifier(att4 in h4 and "premier controle" in h4, "jamais controle : %s + mention premier controle" % att4)

    lot = texte(fiche_lot(page, ids_lot["Casques Boreo"]))
    R.verifier("Periodicite des controles" in lot, "periodicite sur la fiche du lot")
    R.verifier("Prochain controle" in lot and attendu in lot, "colonne prochain controle dans le tableau des exemplaires")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)

# sans colonne notice : la ligne disparait
D, ids_mat, ids_lot = construire()
D["LOTS"]["colonnes"].remove("notice")
with ouvrir(D) as page:
    h = texte(fiche_imprimable(page, ids_mat["CAS-001"]))
    R.verifier("Notice fabricant" not in h, "sans colonne notice : pas de ligne Notice")
sys.exit(R.bilan())
