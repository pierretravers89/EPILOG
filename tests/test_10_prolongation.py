"""2026.5.6 : prolongation de la duree de vie par reparation (degaines).
Fin de vie = date de fabrication de la PIECE NEUVE + sa duree (pas l'ancienne
date repoussee), stockee sur la reparation ; par exemplaire ; seulement pour
les categories cochees ; cinq chemins de saisie ; sans les colonnes, rien."""
import sys, time; from harnais import ouvrir, Resultats, table; from donnees import construire, ts
from outils_page import *
R = Resultats()

from donnees_degaines import donnees

def statut(page, mid): return page.evaluate("id => rawRows.materiels.filter(m => m.id === id)[0]._statut", mid)
def fin(page, mid): return page.evaluate("id => { const m = rawRows.materiels.filter(m => m.id === id)[0]; return m._finDeVie ? m._finDeVie.getUTCFullYear() : null; }", mid)

# ---------- sans les colonnes : rien ne change
D, ids, lot_id = donnees(False)
with ouvrir(D) as page:
    R.verifier(statut(page, ids["DEG-001"]) == "Reforme", "sans colonnes : degaine de 2015 reformee au calendrier")
    ouvrir_fiche(page, ids["DEG-002"])
    R.verifier(page.query_selector('#ficheBoutons [data-act="signaler-reparation"]') is None,
               "sans colonnes : degaine reformee, pas de bouton de reparation")
    ouvrir_fiche(page, ids["CAS-002"])
    page.click('#ficheBoutons [data-act="signaler-reparation"]'); page.wait_for_timeout(60)
    R.verifier(page.query_selector("#ffProlongBloc") is None, "sans colonnes : aucun champ de prolongation")
    R.verifier(not page.erreurs, "sans colonnes : aucune erreur JS %s" % page.erreurs)

D, ids, lot_id = donnees(True)
with ouvrir(D) as page:
    espionner_toasts(page)
    # ---------- calcul
    R.verifier(fin(page, ids["DEG-001"]) == 2034, "fin de vie = fabrication piece (06/2024) + 120 mois -> 2034 (%s)" % fin(page, ids["DEG-001"]))
    R.verifier(statut(page, ids["DEG-001"]) != "Reforme", "DEG-001 prolongee : pas reformee (%s)" % statut(page, ids["DEG-001"]))
    R.verifier(statut(page, ids["DEG-002"]) == "Reforme", "DEG-002 sans reparation : reformee (fin 2025)")
    page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()")
    R.verifier("1 prolong" in page.inner_text("#materiel-list"), "en-tete du lot : 1 prolonge par reparation")
    # fiches
    ouvrir_fiche(page, ids["DEG-001"])
    fi = page.inner_text("#materiel-editor")
    R.verifier("31/12/2034" in fi and "prolong" in sa(fi), "fiche interactive : 31/12/2034 (prolongee)")
    h = texte(fiche_imprimable(page, ids["DEG-001"]))
    R.verifier("31/12/2034" in h and "initialement 31/12/2025" in h and "sangle" in h,
               "fiche imprimable : date, origine et date initiale")
    # ---------- chemin 1 : degaine reformee AU CALENDRIER -> la reparation reste possible
    ouvrir_fiche(page, ids["DEG-003"])
    R.verifier("prolonger" in sa(page.inner_text("#ficheBoutons")), "reforme calendaire prolongeable : bouton 'Declarer une reparation (prolonger)'")
    page.click('#ficheBoutons [data-act="signaler-reparation"]'); page.wait_for_timeout(60)
    page.click("#ffEtatDejaFaite"); page.wait_for_timeout(40)
    R.verifier(page.is_visible("#ffProlongBloc"), "fiche : bloc de prolongation visible (categorie cochee)")
    R.verifier(page.input_value("#ffProlongDuree") == "120", "duree pre-remplie avec celle de la categorie")
    page.fill("#ffProlongDate", "2026-01-15"); page.wait_for_timeout(40)
    R.verifier("31/12/2036" in page.inner_text("#ffProlongApercu") and "actuellement 31/12/2025" in page.inner_text("#ffProlongApercu"),
               "apercu : piece 01/2026 + 120 mois -> 2036, actuelle 2025 : %r" % page.inner_text("#ffProlongApercu"))
    page.fill("#ffRepDescription", "sangle usee"); page.fill("#ffEtatPieces", "sangle")
    page.click("#ffGo"); page.wait_for_timeout(500)
    r3 = [r for r in table(page, "REPARATIONS") if r["materiel"] == ids["DEG-003"]]
    R.verifier(r3 and r3[-1].get("duree_vie_piece_mois") == 120 and r3[-1].get("date_fabrication_piece"),
               "fiche : la reparation porte la piece et sa duree : %s" % (r3[-1] if r3 else None))
    R.verifier(fin(page, ids["DEG-003"]) == 2036, "fiche : fin de vie recalculee 2036")
    R.verifier(statut(page, ids["DEG-003"]) == "Examen requis", "apres reparation : examen requis avant remise en service (%s)" % statut(page, ids["DEG-003"]))

    # ---------- categorie non cochee : rien
    ouvrir_fiche(page, ids["CAS-002"])
    page.click('#ficheBoutons [data-act="signaler-reparation"]'); page.wait_for_timeout(60)
    page.click("#ffEtatDejaFaite"); page.wait_for_timeout(40)
    R.verifier(not page.is_visible("#ffProlongBloc"), "casque (reparable, non prolongeable) : bloc masque")
    page.click("#ffNon")

    # ---------- chemin groupe : categories mixtes, date future refusee
    page.evaluate("""ids => { document.querySelector('.tab[data-t="controles"]').click();
        document.querySelector('#epi-so [data-se="reparations"]').click();
        document.getElementById('btnToggleRep').click(); }""", [])
    page.wait_for_timeout(60)
    # comme Pierre : etat d'abord, puis on coche A LA MAIN (bug du 07/10 : la
    # coche ne recalculait pas le bloc, le test d'origine forcait la selection)
    page.click("#repEtatDejaFaite"); page.wait_for_timeout(40)
    R.verifier(not page.is_visible("#repProlongBloc"), "groupe : rien de coche -> bloc masque")
    page.check('#repListe input[value="%d"]' % ids["CAS-001"]); page.wait_for_timeout(40)
    R.verifier(not page.is_visible("#repProlongBloc"), "groupe : un casque seul -> bloc masque")
    page.check('#repListe input[value="%d"]' % ids["DEG-002"]); page.wait_for_timeout(40)
    R.verifier(page.is_visible("#repProlongBloc"), "groupe : bloc visible (une degaine dans la selection)")
    futur = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 40 * 86400))
    page.fill("#repProlongDate", futur); page.wait_for_timeout(40)
    R.verifier("futur" in page.inner_text("#repProlongApercu"), "groupe : date future signalee")
    page.fill("#repProlongDate", "2025-09-01"); page.wait_for_timeout(40)
    R.verifier("pour 1 exemplaire" in page.inner_text("#repProlongApercu") or "31/12/2035" in page.inner_text("#repProlongApercu"),
               "groupe : apercu %r" % page.inner_text("#repProlongApercu"))
    page.fill("#repRepDescription", "sangle")
    page.click("#btnSubmitRep"); page.wait_for_timeout(500)
    reps = table(page, "REPARATIONS")
    rd = [r for r in reps if r["materiel"] == ids["DEG-002"]]
    rc = [r for r in reps if r["materiel"] == ids["CAS-001"]]
    R.verifier(rd and rd[-1].get("duree_vie_piece_mois") == 120, "groupe : la degaine est prolongee")
    R.verifier(rc and not rc[-1].get("date_fabrication_piece"), "groupe : le casque n'est PAS prolonge")
    R.verifier(statut(page, ids["DEG-002"]) == "Examen requis" and fin(page, ids["DEG-002"]) == 2035,
               "groupe : DEG-002 sort de la reforme calendaire, fin 2035 (%s)" % statut(page, ids["DEG-002"]))

    # ---------- supprimer la reparation rend l'ancienne date
    page.evaluate("""ids => { const t = window.__DONNEES_TEST__.REPARATIONS; t.lignes = t.lignes.filter(r => r.materiel !== ids); }""", ids["DEG-001"])
    page.evaluate("load()"); page.wait_for_timeout(300)
    R.verifier(fin(page, ids["DEG-001"]) == 2025 and statut(page, ids["DEG-001"]) == "Reforme",
               "reparation supprimee : retour a la fin de vie du lot (2025, reformee)")

    # ---------- editeur de categorie : dependance a la maintenance
    cat = [c for c in D["CATEGORIES"]["lignes"] if c["nom"] == "Degaines"][0]["id"]
    page.evaluate("id => { document.querySelector('.tab[data-t=\"refs\"]').click(); openEditor('categorie', id); }", cat)
    page.wait_for_timeout(80)
    sel = '#refs-editor [data-f="prolongation_par_reparation"]'
    R.verifier(page.is_visible(sel) and page.is_checked(sel), "editeur : coche visible et cochee")
    page.uncheck('#refs-editor [data-f="maintenance_fabricant"]'); page.wait_for_timeout(40)
    R.verifier(not page.is_visible(sel) and not page.is_checked(sel), "editeur : sans maintenance, masquee et decochee")
    # diagnostic
    page.evaluate("lancerDiagnostic()"); page.wait_for_timeout(200)
    d = page.evaluate("document.getElementById('diagSortie').textContent")
    R.verifier("PROLONGATION" in d and "active" in d, "diagnostic : prolongation active")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
