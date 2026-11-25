"""2026.5.18 : menu lateral retractable (memorise), actions rares d'un lot
derriere '...' sur telephone, sous-rubriques en pastilles sur telephone,
vocabulaire 'rubrique' dans l'aide et nom 'Suivi des EPI' partout."""
import sys, re; from harnais import ouvrir, Resultats; from donnees import construire
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
with ouvrir(D) as page:
    page.set_viewport_size({"width": 1300, "height": 900}); page.wait_for_timeout(150)
    larg = lambda: page.evaluate("() => Math.round(document.getElementById('navLaterale').getBoundingClientRect().width)")
    l0 = larg()
    page.click("#nlReplier"); page.wait_for_timeout(250)
    l1 = larg()
    R.verifier(l0 >= 220 and l1 <= 70, "menu replie : %d px -> %d px" % (l0, l1))
    R.verifier(not page.is_visible('#navLaterale [data-nav="controles:incidents"]') and page.is_visible('#navLaterale .nl-court[data-nav="controles"]'),
               "replie : sous-entrees masquees, icone Suivi des EPI visible")
    R.verifier(page.get_attribute('#navLaterale [data-nav="materiel"]', "title") == "Matériel", "replie : infobulle sur les icones")
    page.click('#navLaterale .nl-court[data-nav="controles"]'); page.wait_for_timeout(100)
    R.verifier(page.is_visible("#pane-controles"), "replie : l'icone Suivi des EPI ouvre la rubrique")
    R.verifier(page.is_visible('#epi-so [data-se="incidents"]'), "replie : barre de sous-rubriques visible (Incidents accessible)")
    page.click('#epi-so [data-se="incidents"]'); page.wait_for_timeout(80)
    R.verifier(page.is_visible("#epi-incidents"), "replie : passage a Incidents")
    R.verifier(page.evaluate("localStorage.getItem('epilog.menuReplie')") == "1", "etat replie memorise")
    page.reload(); page.wait_for_function("window.rawRows && rawRows.materiels && rawRows.materiels.length > 0"); page.wait_for_timeout(250)
    R.verifier(larg() <= 70, "apres rechargement : menu toujours replie")
    page.click("#nlReplier"); page.wait_for_timeout(250)
    R.verifier(larg() >= 220 and page.evaluate("localStorage.getItem('epilog.menuReplie')") == "0", "menu deplie a nouveau")
    R.verifier(not page.is_visible("#epi-so"), "deplie : barre de sous-rubriques de nouveau masquee (dans le menu)")
    # ---- telephone : actions rares
    page.set_viewport_size({"width": 390, "height": 844}); page.wait_for_timeout(150)
    page.click('#navBas [data-nav="materiel"]'); page.wait_for_timeout(100)
    page.evaluate("id => document.querySelector('#materiel-list .lot[data-lot=\"' + id + '\"] .lot-head').click()", ids_lot["Casques Boreo"]); page.wait_for_timeout(150)
    lot = '#materiel-list .lot[data-lot="%d"]' % ids_lot["Casques Boreo"]
    R.verifier(page.is_visible(lot + " .btn-fiche") and not page.is_visible(lot + " .btn-registre"), "telephone : Registre masque derriere ...")
    ouvert_avant = page.evaluate("s => document.querySelector(s).classList.contains('open')", lot)
    page.click(lot + " .btn-plus-actions"); page.wait_for_timeout(80)
    R.verifier(page.is_visible(lot + " .btn-registre") and page.is_visible(lot + " .btn-scinder-lot"), "telephone : ... revele les actions rares")
    R.verifier(page.evaluate("s => document.querySelector(s).classList.contains('open')", lot) == ouvert_avant, "... ne replie pas le lot")
    # ---- telephone : pastilles
    page.click('#navBas [data-nav="controles"]'); page.wait_for_timeout(100)
    rad = page.evaluate("() => getComputedStyle(document.querySelector('#epi-so .sous-onglet')).borderRadius")
    R.verifier(rad == "18px", "telephone : sous-rubriques en pastilles (%s)" % rad)
    # ---- ordinateur : '...' absent, rien de masque
    page.set_viewport_size({"width": 1300, "height": 900}); page.wait_for_timeout(150)
    page.click('#navLaterale [data-nav="materiel"]'); page.wait_for_timeout(100)
    R.verifier(not page.is_visible(lot + " .btn-plus-actions") and page.is_visible(lot + " .btn-registre"), "ordinateur : tous les boutons visibles, pas de ...")
    # ---- vocabulaire
    aide = page.evaluate("() => document.querySelector('.aide-sections') ? document.querySelector('.aide-sections').innerText : document.body.innerText")
    restes = [m for m in re.findall(r"(?i)\b(?:sous-)?onglets?\b", aide)]
    R.verifier(len(restes) <= 2, "aide : 'onglet' ne subsiste que pour les onglets reels et le navigateur (%d)" % len(restes))
    R.verifier("Contrôles, incidents et réparations" not in page.evaluate("document.body.innerText"), "ancien nom absent de la page")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
