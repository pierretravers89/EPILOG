"""2026.5.15 : numeros de serie du fabricant (MATERIELS.numero_serie).
Creation de lot (apercu d'appariement, refus si trop de numeros ou doublon),
grille de 'Editer le lot' (objet en main, doublon signale), editeur
d'exemplaire, fiches, recherche (rappel fabricant), export ; sans la
colonne, rien n'apparait."""
import sys; from harnais import ouvrir, Resultats, table; from donnees import construire
from outils_page import *
R = Resultats()
# ---- sans colonne
D, ids_mat, ids_lot = construire()
with ouvrir(D) as page:
    page.evaluate("""() => { document.querySelector('.tab[data-t="materiel"]').click(); document.getElementById('btnToggleLot').click(); }""")
    R.verifier(page.query_selector("#lotSeries") is None, "sans colonne : pas de champ a la creation")
    page.evaluate("id => openEditor('lot', id)", ids_lot["Casques Boreo"]); page.wait_for_timeout(60)
    R.verifier(page.query_selector("#edSaisirSeries") is None, "sans colonne : pas de bouton dans Editer le lot")
    R.verifier(not page.erreurs, "sans colonne : aucune erreur JS %s" % page.erreurs)
# ---- avec colonne
D, ids_mat, ids_lot = construire()
D["MATERIELS"]["colonnes"].append("numero_serie")
D["ACHATS"]["colonnes"] += ["montant_total", "note_financement"]
for m in D["MATERIELS"]["lignes"]:
    if m["numero_marquage"] == "CAS-002": m["numero_serie"] = "PZ-777"
with ouvrir(D) as page:
    espionner_toasts(page)
    page.evaluate("""() => { document.querySelector('.tab[data-t="materiel"]').click(); document.getElementById('btnToggleLot').click(); }""")
    page.fill("#lotDesignation", "Casques jeunes 2026"); page.select_option("#lotCategorie", "2")
    page.fill("#lotFabricant", "Petzl")
    page.fill("#lotQuantite", "3"); page.fill("#lotPremier", "101")
    attendus = page.evaluate("genererMarquages()")
    page.fill("#lotSeries", "S1\nS2\nS3\nS4"); page.wait_for_timeout(50)
    ap = page.inner_text("#lotSeriesApercu")
    R.verifier(attendus[0] in ap and "S1" in ap and "4 num" in ap, "apercu : correspondance et trop de numeros signales : %r" % ap[:120])
    nb_mat = len(table(page, "MATERIELS"))
    page.click("#btnSubmitLot") if page.query_selector("#btnSubmitLot") else page.evaluate("creerLot()")
    page.wait_for_timeout(400)
    R.verifier(len(table(page, "MATERIELS")) == nb_mat, "trop de numeros : creation refusee, rien d'ecrit")
    page.fill("#lotSeries", "S1\nS1"); page.wait_for_timeout(30)
    page.evaluate("creerLot()"); page.wait_for_timeout(400)
    R.verifier(len(table(page, "MATERIELS")) == nb_mat, "doublon dans la liste : creation refusee")
    page.fill("#lotSeries", "S1\nS2"); page.wait_for_timeout(30)
    R.verifier("resteront sans num" in page.inner_text("#lotSeriesApercu"), "apercu : exemplaires restant sans numero signales")
    page.evaluate("creerLot()"); page.wait_for_timeout(600)
    cj = {m["numero_marquage"]: m.get("numero_serie") for m in table(page, "MATERIELS") if m["numero_marquage"] in attendus}
    R.verifier(cj == {attendus[0]: "S1", attendus[1]: "S2", attendus[2]: None}, "creation : numeros affectes dans l'ordre : %s" % cj)
    # ---- grille de Editer le lot
    page.evaluate("id => openEditor('lot', id)", ids_lot["Casques Boreo"]); page.wait_for_timeout(80)
    page.click("#edSaisirSeries"); page.wait_for_timeout(50)
    lignes = page.query_selector_all("#edSeriesGrille .serie-saisie")
    R.verifier(len(lignes) == 3, "grille : une ligne par exemplaire du lot (3)")
    page.fill('#edSeriesGrille .serie-saisie[data-mat="%d"]' % ids_mat["CAS-001"], "PZ-777"); page.wait_for_timeout(30)
    R.verifier("deux fois" in sa(page.inner_text("#edSeriesGrille")), "grille : meme numero deux fois dans le lot signale")
    page.click("#edSeriesGrille .series-save"); page.wait_for_timeout(300)
    R.verifier("deux fois" in sa(page.inner_text("#edSeriesGrille .series-msg")), "grille : enregistrement refuse sur doublon")
    page.fill('#edSeriesGrille .serie-saisie[data-mat="%d"]' % ids_mat["CAS-001"], "PZ-001")
    page.fill('#edSeriesGrille .serie-saisie[data-mat="%d"]' % ids_mat["CAS-003"], "S2"); page.wait_for_timeout(30)
    R.verifier("faute de frappe" in sa(page.inner_text("#edSeriesGrille")), "grille : numero deja porte par un autre lot du meme fabricant signale")
    page.click("#edSeriesGrille .series-save"); page.wait_for_timeout(700)
    s = {m["numero_marquage"]: m.get("numero_serie") for m in table(page, "MATERIELS") if m["numero_marquage"] in ("CAS-001", "CAS-002", "CAS-003")}
    R.verifier(s == {"CAS-001": "PZ-001", "CAS-002": "PZ-777", "CAS-003": "S2"}, "grille : numeros enregistres (avertissement non bloquant) : %s" % s)
    R.verifier(any("serie" in sa(t) for t in toasts(page)), "grille : confirmation")
    # ---- fiches, recherche, export
    ouvrir_fiche(page, ids_mat["CAS-003"])
    fi = sa(page.inner_text("#materiel-editor"))
    R.verifier("s2" in fi and ("aussi sur " + sa(attendus[1])) in fi, "fiche : numero et doublon signale")
    h = texte(fiche_imprimable(page, ids_mat["CAS-001"]))
    R.verifier("Numero de serie (fabricant) PZ-001" in h, "fiche de vie imprimee : numero de serie")
    page.evaluate("() => { filtresMat.q = 'pz-777'; load(); }"); page.wait_for_timeout(300)
    vis = page.evaluate("inventaireVisible.map(r => r.marquage)")
    R.verifier(vis == ["CAS-002"], "recherche par numero de serie (rappel fabricant) : %s" % vis)
    page.evaluate("id => openEditor('materiel', id)", ids_mat["CAS-002"]); page.wait_for_timeout(60)
    R.verifier(page.input_value('#materiel-editor [data-f="numero_serie"]') == "PZ-777", "editeur d'exemplaire : champ numero de serie")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
