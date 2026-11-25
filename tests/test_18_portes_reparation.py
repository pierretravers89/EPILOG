"""2026.5.14 : (1) pas de porte vers la reparation quand la categorie est
fermee (ni reparation ni decoupe) : bouton de fiche, liste groupee, options
'A reparer' / 'Reparation a prevoir' ; (2) le non-EPI suit la meme regle ;
(3) prolongation reservee aux EPI soumis au vieillissement. Une reparation
EN COURS reste toujours cloturable."""
import sys; from harnais import ouvrir, Resultats, table; from donnees import construire, ts
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
D["CATEGORIES"]["colonnes"].append("prolongation_par_reparation")
D["REPARATIONS"]["colonnes"] += ["intervenant", "pieces_remplacees", "description", "date_fabrication_piece", "duree_vie_piece_mois"]
cid = max(c["id"] for c in D["CATEGORIES"]["lignes"]) + 1
D["CATEGORIES"]["lignes"].append(dict(id=cid, nom="Raquettes", type_epi="Non-EPI", duree_vie_defaut_mois=None,
    prefixe="RAQ", maintenance_fabricant=False, peut_etre_decoupe=False, prolongation_par_reparation=False))
lid = max(l["id"] for l in D["LOTS"]["lignes"]) + 1
D["LOTS"]["lignes"].append(dict(id=lid, designation="Raquettes TSL", categorie=cid, fabricant="TSL", modele="", achat=1,
    date_fabrication=ts(2), duree_vie_mois=None, prix_unitaire=50, notice=None))
mid = max(m["id"] for m in D["MATERIELS"]["lignes"]) + 1
D["MATERIELS"]["lignes"] += [dict(id=mid, lot=lid, numero_marquage="RAQ-001", lieu_stockage=1, date_mise_en_service=ts(1)),
                             dict(id=mid + 1, lot=lid, numero_marquage="RAQ-002", lieu_stockage=1, date_mise_en_service=ts(1))]
# RAQ-002 : reparation EN COURS, ouverte avant le changement de regle
D["REPARATIONS"]["lignes"].append(dict(id=1, materiel=mid + 1, date_declaree=ts(0, 5), motif="fixation", date_effectuee=None))
cas = [c for c in D["CATEGORIES"]["lignes"] if c["nom"] == "Casques"][0]   # EPI, maintenance non cochee
with ouvrir(D) as page:
    # ---- fiche d'un casque (EPI ferme) : pas de bouton, pas d'option
    ouvrir_fiche(page, ids_mat["CAS-001"])
    R.verifier(page.query_selector('#ficheBoutons [data-act="signaler-reparation"]') is None, "EPI ferme : pas de bouton 'Declarer une reparation'")
    page.click('#ficheBoutons [data-act="incident"]'); page.wait_for_timeout(60)
    suites = page.eval_on_selector_all('#ficheAction [data-ff="suite"] option', "os => os.map(o => o.value)")
    R.verifier("Reparation a prevoir" not in suites and "Controle a realiser" in suites, "incident : pas de 'Reparation a prevoir' : %s" % suites)
    R.verifier("reparation non prevue" in sa(page.inner_text("#ficheAction")), "incident : une ligne explique pourquoi")
    page.click("#ffNon")
    page.click('#ficheBoutons [data-act="controler"]'); page.wait_for_timeout(60)
    res = page.eval_on_selector_all('#ficheAction [data-ff="resultat"] option', "os => os.map(o => o.value)")
    R.verifier("A reparer" not in res and "Conforme" in res and "Reforme" in res, "controle : pas de 'A reparer' : %s" % res)
    page.click("#ffNon")
    # ---- corde (fermee a la reparation mais DECOUPABLE) : la porte reste
    ouvrir_fiche(page, ids_mat["COR-001-A"])
    R.verifier(page.query_selector('#ficheBoutons [data-act="signaler-reparation"]') is not None, "corde decoupable : bouton conserve (decoupe)")
    # ---- non-EPI non coche : ferme aussi (point 2)
    ouvrir_fiche(page, mid)
    R.verifier(page.query_selector('#ficheBoutons [data-act="signaler-reparation"]') is None, "non-EPI sans case : plus de reparation libre")
    # ---- reparation en cours : toujours cloturable
    ouvrir_fiche(page, mid + 1)
    R.verifier(page.query_selector('#ficheBoutons [data-act="reparation"]') is not None, "reparation EN COURS : toujours cloturable")
    # ---- formulaire groupe : casques et raquettes absents, cordes presentes
    page.evaluate("""() => { document.querySelector('.tab[data-t="controles"]').click();
        document.querySelector('#epi-so [data-se="reparations"]').click(); document.getElementById('btnToggleRep').click(); }""")
    page.wait_for_timeout(80)
    liste = page.inner_text("#repListe")
    R.verifier("CAS-00" not in liste and "RAQ-001" not in liste and "COR-001-A" in liste,
               "groupe : seuls les exemplaires reparables ou decoupables : %r" % liste[:120])
    # ---- editeur de categorie : case visible pour non-EPI ; prolongation selon la nature
    page.evaluate("id => { document.querySelector('.tab[data-t=refs]').click(); openEditor('categorie', id); }", cid)
    page.wait_for_timeout(80)
    R.verifier(page.is_visible('#refs-editor [data-f="maintenance_fabricant"]'), "editeur : case reparation visible pour un non-EPI")
    page.check('#refs-editor [data-f="maintenance_fabricant"]'); page.wait_for_timeout(30)
    R.verifier(not page.is_visible('#refs-editor [data-f="prolongation_par_reparation"]'), "non-EPI coche : pas de prolongation")
    page.select_option('#refs-editor [data-f="type_epi"]', "Non soumis a vieillissement"); page.wait_for_timeout(30)
    R.verifier(not page.is_visible('#refs-editor [data-f="prolongation_par_reparation"]'), "non soumis : pas de prolongation")
    page.select_option('#refs-editor [data-f="type_epi"]', "Soumis a vieillissement"); page.wait_for_timeout(30)
    R.verifier(page.is_visible('#refs-editor [data-f="prolongation_par_reparation"]'), "soumis + case cochee : prolongation proposee")
    page.check('#refs-editor [data-f="prolongation_par_reparation"]')
    page.select_option('#refs-editor [data-f="type_epi"]', "Non soumis a vieillissement"); page.wait_for_timeout(30)
    R.verifier(not page.is_checked('#refs-editor [data-f="prolongation_par_reparation"]'), "repasser en non soumis decoche la prolongation")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
