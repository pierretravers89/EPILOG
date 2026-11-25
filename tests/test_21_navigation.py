"""2026.5.17 : navigation. Ordinateur (>= 1000 px) : menu lateral qui actionne
onglets et sous-onglets, entree active suivie, compteurs recopies, Entretien
masque si la table manque. Telephone (<= 640 px) : barre du bas + page Plus.
Entre les deux : onglets d'origine."""
import sys; from harnais import ouvrir, Resultats; from donnees import construire, ts
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire(avec_entretiens=False)
D["EMPRUNTS"]["lignes"].append({"id": 1, "materiel": ids_mat["CAS-002"], "adherent": 2, "date_emprunt": ts(0, 2),
    "date_retour_prevue": None, "date_retour_effective": None, "numero_emprunt": "2026-001"})
def vis(page, sel): return page.is_visible(sel)
def actif(page):
    """entrees actives de la navigation VISIBLE (l'autre barre, masquee, suit aussi)"""
    return page.evaluate("() => Array.from(document.querySelectorAll('#navLaterale .nav-actif, #navBas .nav-actif')).filter(b => b.offsetParent !== null).map(b => b.dataset.nav)")
with ouvrir(D) as page:
    # ---------- ordinateur
    page.set_viewport_size({"width": 1300, "height": 900}); page.wait_for_timeout(150)
    R.verifier(vis(page, "#navLaterale") and not vis(page, ".tabs-bar") and not vis(page, "#navBas"), "ordinateur : menu lateral, sans onglets ni barre du bas")
    page.click('#navLaterale [data-nav="materiel"]'); page.wait_for_timeout(80)
    R.verifier(vis(page, "#pane-materiel") and actif(page) == ["materiel"], "menu -> Materiel affiche et surligne")
    page.click('#navLaterale [data-nav="controles:incidents"]'); page.wait_for_timeout(80)
    R.verifier(vis(page, "#pane-controles") and vis(page, "#epi-incidents") and actif(page) == ["controles:incidents"],
               "menu -> Suivi des EPI / Incidents : bon sous-ecran : %s" % actif(page))
    page.click('#navLaterale [data-nav="refs:adherents"]'); page.wait_for_timeout(80)
    R.verifier(vis(page, "#pane-refs") and actif(page) == ["refs:adherents"], "menu -> Listes / Adherents")
    R.verifier(not vis(page, '#navLaterale [data-nav="controles:entretiens"]'), "sans table ENTRETIENS : entree masquee")
    R.verifier(page.inner_text('#navLaterale [data-compte="prets"]') == "1", "compteur de prets recopie dans le menu")
    al = page.inner_text('#navLaterale [data-miroir="epiCompteCtrl"]')
    R.verifier("retard" in al, "alerte de controles recopiee : %r" % al)
    # un chemin interne (clic d'onglet par le code) met aussi le menu a jour
    page.evaluate("() => document.querySelector('.tab[data-t=\"budget\"]').click()"); page.wait_for_timeout(120)
    R.verifier(actif(page) == ["budget"], "clic d'onglet par le code : menu synchronise : %s" % actif(page))
    w = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    R.verifier(w[0] <= w[1] + 1, "ordinateur : pas de debordement %s" % w)
    # ---------- intermediaire
    page.set_viewport_size({"width": 800, "height": 900}); page.wait_for_timeout(150)
    R.verifier(vis(page, ".tabs-bar") and not vis(page, "#navLaterale") and not vis(page, "#navBas"), "800 px : onglets d'origine seulement")
    # ---------- telephone
    page.set_viewport_size({"width": 390, "height": 844}); page.wait_for_timeout(150)
    R.verifier(vis(page, "#navBas") and not vis(page, ".tabs-bar") and not vis(page, "#navLaterale"), "telephone : barre du bas seulement")
    page.click('#navBas [data-nav="prets"]'); page.wait_for_timeout(80)
    R.verifier(vis(page, "#pane-prets") and "prets" in actif(page), "barre -> Prets")
    page.click('#navBas [data-nav="plus"]'); page.wait_for_timeout(80)
    R.verifier(vis(page, "#pane-plus") and not vis(page, "#pane-prets"), "barre -> Plus affiche la page Plus")
    page.click('#pane-plus [data-nav="refs:fournisseurs"]'); page.wait_for_timeout(80)
    R.verifier(vis(page, "#pane-refs") and page.evaluate("document.querySelector('#refs-so .sous-onglet.actif').dataset.se") == "fournisseurs",
               "Plus -> Fournisseurs")
    page.click('#navBas [data-nav="plus"]'); page.wait_for_timeout(80)
    page.click('#pane-plus [data-plus="reglages"]'); page.wait_for_timeout(120)
    R.verifier(page.evaluate("!document.getElementById('reglages').hidden") if page.query_selector('#reglages') else vis(page, ".reglages-modale"),
               "Plus -> Reglages ouvre le panneau")
    page.evaluate("() => { try { fermerReglages(); } catch (e) {} }")
    page.click('#navBas [data-nav="materiel"]'); page.wait_for_timeout(120)
    bas = page.evaluate("() => { const n = document.getElementById('navBas').getBoundingClientRect(); return [Math.round(n.bottom), window.innerHeight]; }")
    R.verifier(abs(bas[0] - bas[1]) <= 1, "telephone : barre collee en bas de l'ecran %s" % bas)
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
