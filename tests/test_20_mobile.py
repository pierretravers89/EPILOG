"""2026.5.16 : affichage telephone. Sur 390 px : aucune page ne deborde en
largeur, les tableaux sont en cartes etiquetees, les champs vides masques.
Sur 1300 px : les tableaux restent de vrais tableaux (ordinateur inchange ;
la preuve au pixel pres se fait avec captures_ecrans.py + compare_captures.py)."""
import sys; from harnais import ouvrir, Resultats; from donnees import construire, ts
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
ONGLETS = ["dashboard", "materiel", "prets", "controles", "budget", "refs"]
with ouvrir(D) as page:
    page.set_viewport_size({"width": 390, "height": 844}); page.wait_for_timeout(200)
    for o in ONGLETS:
        page.evaluate("t => { const e = document.querySelector('.tab[data-t=\"' + t + '\"]'); if (e) e.click(); }", o)
        page.wait_for_timeout(200)
        w = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
        R.verifier(w[0] <= w[1] + 1, "telephone, onglet %s : pas de debordement lateral %s" % (o, w))
    page.evaluate("id => { document.querySelector('.tab[data-t=\"materiel\"]').click(); document.querySelector('#materiel-list .lot[data-lot=\"' + id + '\"] .lot-head').click(); }", ids_lot["Casques Boreo"])
    page.wait_for_timeout(250)
    info = page.evaluate("""() => { const td = document.querySelector('#materiel-list .lot.open table td');
        const tr = document.querySelector('#materiel-list .lot.open table tr.tr-entete');
        return { label: td && td.getAttribute('data-label'), disp: td && getComputedStyle(td).display,
                 entete: tr && getComputedStyle(tr).display,
                 vides: Array.from(document.querySelectorAll('#materiel-list .lot.open td.cellule-vide')).every(c => getComputedStyle(c).display === 'none') }; }""")
    R.verifier(info["label"] == "Marquage", "cellules etiquetees par leur colonne : %s" % info["label"])
    R.verifier(info["disp"] == "block" and info["entete"] == "none", "telephone : cartes (cellule en bloc, en-tete masque) %s" % info)
    R.verifier(info["vides"], "telephone : champs vides masques")
    ouvrir_fiche(page, ids_mat["CAS-001"])
    w = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    R.verifier(w[0] <= w[1] + 1, "telephone, fiche d'un exemplaire : pas de debordement %s" % w)
    # ordinateur : vrais tableaux
    page.set_viewport_size({"width": 1300, "height": 900}); page.wait_for_timeout(200)
    page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()"); page.wait_for_timeout(200)
    d = page.evaluate("""() => { const t = document.querySelector('#materiel-list table'); const td = t && t.querySelector('td');
        const tr = t && t.querySelector('tr.tr-entete'); const v = document.querySelector('td.cellule-vide');
        return [t && getComputedStyle(t).display, td && getComputedStyle(td).display, tr && getComputedStyle(tr).display,
                v ? getComputedStyle(v).display : 'table-cell']; }""")
    R.verifier(d == ["table", "table-cell", "table-row", "table-cell"], "ordinateur : tableau, cellules, en-tete et cases vides inchanges : %s" % d)
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
