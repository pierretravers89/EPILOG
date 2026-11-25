"""Bugs de toasts : 'Pret cree' (act === 'pret' au lieu de 'preter') et
marquages 'undefined' (mat.marquage au lieu de mat.numero_marquage)."""
import sys; from harnais import ouvrir, Resultats, table; from donnees import construire
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
with ouvrir(D) as page:
    espionner_toasts(page)
    # pret depuis la fiche d'un exemplaire
    ouvrir_fiche(page, ids_mat["CAS-003"])
    page.click('#ficheBoutons [data-act="preter"]')
    page.select_option('#ficheAction [data-ff="adherent"]', index=1)
    page.click('#ffGo')
    page.wait_for_timeout(400)
    emp = table(page, "EMPRUNTS")
    R.verifier(len(emp) == 1 and emp[0]["materiel"] == ids_mat["CAS-003"], "le pret est enregistre")
    R.verifier(any("Prêt créé" in t for t in toasts(page)), "toast 'Prêt créé' affiche : %s" % toasts(page))

    # controle groupe : le toast cite les marquages
    page.evaluate("""ids => { document.querySelector('.tab[data-t="controles"]').click();
        document.getElementById('btnToggleCtrl').click();
        ids.forEach(function(i){ SELECTION.ct[i] = true; });
        document.getElementById('ctControleur').selectedIndex = 1; }""", [ids_mat["CAS-001"], ids_mat["CAS-002"]])
    page.evaluate("addControle()")
    page.wait_for_timeout(400)
    t = [x for x in toasts(page) if "controle" in sa(x)]
    R.verifier(t and "CAS-001" in t[-1] and "CAS-002" in t[-1] and "undefined" not in t[-1],
               "toast de controle avec marquages : %s" % t)
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
