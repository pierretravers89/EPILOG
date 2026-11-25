"""2026.5.8 : dans l'onglet Materiel, Editer est l'avant-dernier bouton et
Supprimer le dernier, pour le lot, la ligne d'exemplaire et la fiche."""
import sys; from harnais import ouvrir, Resultats; from donnees import construire
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
# boutons VISIBLES seulement (depuis 2026.5.18, "..." existe mais est masque sur ordinateur)
TXT = "els => els.filter(e => e.offsetParent !== null).map(e => e.textContent.trim())"
with ouvrir(D) as page:
    page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()")
    lot = page.locator('#materiel-list .lot[data-lot="%d"]' % ids_lot["Casques Boreo"])
    b = [sa(t) for t in lot.locator(".lot-head button, .lot-actions button").evaluate_all(TXT) if t]
    b = [t for t in b if t]
    R.verifier(b[:4] == ["fiche du lot", "registre (pdf)", "scinder le lot", "editer le lot"] and b[4] == "supprimer",
               "lot : Fiche, Registre, Scinder, Editer, Supprimer : %s" % b[:5])
    page.evaluate("id => { document.querySelector('#materiel-list .lot[data-lot=\"' + id + '\"]').classList.add('open'); }", ids_lot["Casques Boreo"])
    ligne = page.locator('#materiel-list .lot[data-lot="%d"] td.td-actions' % ids_lot["Casques Boreo"]).first
    e = [sa(t) for t in ligne.locator("button").evaluate_all(TXT)]
    R.verifier(e[-2:] == ["editer l'exemplaire", "supprimer"] and e[0] == "fiche de vie",
               "exemplaire : Fiche de vie ... Editer, Supprimer : %s" % e)
    ouvrir_fiche(page, ids_mat["CAS-001"])
    f = [sa(t) for t in page.locator("#ficheBoutons button").evaluate_all(TXT)]
    R.verifier(f[-3:] == ["fiche de vie a imprimer", "editer l'exemplaire", "supprimer"],
               "fiche : ... Fiche de vie a imprimer, Editer, Supprimer : %s" % f)
    # les boutons marchent toujours apres deplacement
    page.click('#ficheBoutons [data-act="editer"]'); page.wait_for_timeout(60)
    R.verifier(page.query_selector('#materiel-editor [data-f="numero_marquage"]') is not None, "Editer ouvre toujours l'editeur")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
