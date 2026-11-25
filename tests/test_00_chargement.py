"""Le widget se charge sans erreur JS sur les donnees de test (avec et sans ENTRETIENS)."""
import sys; from harnais import ouvrir, Resultats; from donnees import construire
R = Resultats()
for avec in (True, False):
    D, ids_mat, ids_lot = construire(avec_entretiens=avec)
    with ouvrir(D) as page:
        R.verifier(not page.erreurs, "chargement sans erreur JS (ENTRETIENS %s) %s" % ("present" if avec else "absent", page.erreurs))
        n = page.evaluate("rawRows.materiels.length")
        R.verifier(n == 6, "6 exemplaires charges")
        R.verifier(page.query_selector("#rechercheMarquage") is None, "plus de recherche dans le bandeau (2026.5.5)")
        bx = page.evaluate("() => { const a = document.querySelector('.header-actions').getBoundingClientRect(); return a.right > window.innerWidth - 80; }")
        R.verifier(bx, "boutons Reglages / Aide toujours a droite du bandeau")
sys.exit(R.bilan())
