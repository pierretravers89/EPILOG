"""2026.5.35 : exemplaire retrouve. Un exemplaire Perdu ou Vole se declare « retrouve » : la sortie
d'inventaire est levee, un incident « Controle a realiser » garde l'episode (dates, commentaire de perte
recopie puis vide) et met l'exemplaire en « Examen requis » jusqu'au prochain controle. Meme ecriture si
l'on vide la sortie dans l'editeur ; Reforme / Cede restent corrigeables librement, sans incident."""
import sys; from harnais import ouvrir, Resultats, table; from donnees import construire, ts
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
for m in D["MATERIELS"]["lignes"]:
    if m["numero_marquage"] == "MOU-001": m.update(hors_service_motif="Perdu", hors_service_date=ts(0, 30), commentaire="Perdu dans le ravin")
    if m["numero_marquage"] == "CAS-003": m.update(hors_service_motif="Vole", hors_service_date=ts(0, 20), commentaire="Vole au local")
    if m["numero_marquage"] == "CAS-002": m.update(hors_service_motif="Cede", hors_service_date=ts(0, 5), commentaire="Donne a la section jeunes")
def ligne(page, marq): return [m for m in table(page, "MATERIELS") if m["numero_marquage"] == marq][0]
def statut(page, marq): return page.evaluate("id => rawRows.materiels.filter(m => m.id === id)[0]._statut", ids_mat[marq])
with ouvrir(D) as page:
    page.evaluate("() => naviguer('materiel')"); page.wait_for_timeout(250)
    # ---- boutons : seulement pour Perdu / Vole
    rap = lambda marq: page.query_selector('.btn-retrouve-rapide[data-mat="%d"]' % ids_mat[marq]) is not None
    R.verifier(rap("MOU-001") and rap("CAS-003"), "tableau du lot : bouton « Retrouve » pour Perdu et Vole")
    R.verifier(not rap("CAS-002") and not rap("COR-001") and not rap("CAS-001"), "pas de bouton pour Cede, Reforme ni un exemplaire en service")
    page.evaluate("id => ouvrirFicheExemplaire(id)", ids_mat["CAS-001"]); page.wait_for_timeout(100)
    R.verifier(page.query_selector('#ficheBoutons [data-act="retrouve"]') is None, "fiche d'un exemplaire en service : pas de « Declarer retrouve »")
    page.evaluate("id => ouvrirFicheExemplaire(id)", ids_mat["CAS-002"]); page.wait_for_timeout(100)
    R.verifier(page.query_selector('#ficheBoutons [data-act="retrouve"]') is None, "fiche d'un exemplaire cede : pas de bouton")
    # ---- declarer retrouve depuis le tableau (Perdu)
    page.evaluate("() => naviguer('materiel')"); page.wait_for_timeout(200)
    # lot entierement hors parc : range dans le volet replie des lots hors service -> clic par script
    page.evaluate("id => document.querySelector('.btn-retrouve-rapide[data-mat=\"' + id + '\"]').click()", ids_mat["MOU-001"]); page.wait_for_timeout(250)
    R.verifier(page.is_visible('#ficheAction [data-ff="date"]'), "le bouton rapide ouvre la fiche sur le formulaire")
    zone = sa(page.inner_text("#ficheAction"))
    R.verifier("declare perdu" in zone and "perdu dans le ravin" in zone and "examen requis" in zone, "rappel de la perte et de la consequence : %r" % zone[:140])
    R.verifier("assurance" not in zone, "perte : pas de rappel assurance / police")
    nb_inc = len(table(page, "INCIDENTS"))
    import datetime
    avant = (datetime.date.today() - datetime.timedelta(days=40)).isoformat()
    page.fill('#ficheAction [data-ff="date"]', avant); page.click("#ffGo"); page.wait_for_timeout(200)
    R.verifier("avant d" in sa(page.inner_text("#ffMsg")) and len(table(page, "INCIDENTS")) == nb_inc, "date anterieure a la perte : refusee, rien d'ecrit")
    futur = (datetime.date.today() + datetime.timedelta(days=3)).isoformat()
    page.fill('#ficheAction [data-ff="date"]', futur); page.click("#ffGo"); page.wait_for_timeout(200)
    R.verifier("futur" in sa(page.inner_text("#ffMsg")) and len(table(page, "INCIDENTS")) == nb_inc, "date future : refusee")
    page.fill('#ficheAction [data-ff="date"]', datetime.date.today().isoformat())
    page.fill('#ficheAction [data-ff="observation"]', "Sous le pont, sangle intacte")
    page.click("#ffGo"); page.wait_for_timeout(700)
    l = ligne(page, "MOU-001")
    R.verifier(not l.get("hors_service_motif") and not l.get("hors_service_date"), "sortie d'inventaire levee : %r / %r" % (l.get("hors_service_motif"), l.get("hors_service_date")))
    R.verifier(not l.get("commentaire"), "commentaire de perte vide sur l'exemplaire : %r" % l.get("commentaire"))
    incs = table(page, "INCIDENTS")
    R.verifier(len(incs) == nb_inc + 1, "un incident cree")
    inc = incs[-1]; d = sa(inc.get("description", ""))
    R.verifier(inc.get("suite") == "Controle a realiser" and inc.get("materiel") == ids_mat["MOU-001"], "incident : suite « Controle a realiser »")
    R.verifier("retrouve le" in d and "declare perdu le" in d and "perdu dans le ravin" in d and "sous le pont" in d, "incident : episode complet : %r" % d)
    R.verifier(statut(page, "MOU-001") == "Examen requis", "statut : Examen requis (%s)" % statut(page, "MOU-001"))
    fiche = sa(texte(fiche_imprimable(page, ids_mat["MOU-001"])))
    R.verifier("retrouve le" in fiche, "fiche de vie : l'episode y figure")
    # ---- un controle conforme le jour meme le remet en service
    page.evaluate("""id => grist.docApi.applyUserActions([['AddRecord', 'CONTROLES', null, {materiel: id,
        date_controle: Math.floor(Date.now()/86400000)*86400, controleur: 1, resultat: 'Conforme', commentaire: '', type_controle: 'Contrôle périodique'}]])""", ids_mat["MOU-001"])
    page.evaluate("load()"); page.wait_for_timeout(400)
    R.verifier(statut(page, "MOU-001") == "En service", "apres controle conforme le jour meme : En service (%s)" % statut(page, "MOU-001"))
    # ---- vol : rappel assurance / police
    page.evaluate("id => { ouvrirFicheExemplaire(id); ficheAction(id, 'retrouve', null); }", ids_mat["CAS-003"]); page.wait_for_timeout(150)
    R.verifier("assurance" in sa(page.inner_text("#ficheAction")), "vol : rappel discret assurance / police")
    page.click("#ffNon")
    # ---- editeur : vider la sortie d'un vol = meme fait enregistre
    page.evaluate("id => openEditor('materiel', id)", ids_mat["CAS-003"]); page.wait_for_timeout(120)
    sel = '#materiel-editor select[data-f="hors_service_motif"]'
    avis = "#materiel-editor p.hint:has-text('Retirer une perte')"
    R.verifier(not page.is_visible(avis), "editeur : avis masque tant que la sortie est en place")
    page.select_option(sel, ""); page.wait_for_timeout(50)
    R.verifier(page.is_visible(avis), "editeur : avis affiche quand on vide la sortie d'un vol")
    nb_inc = len(table(page, "INCIDENTS"))
    page.evaluate("id => saveEditor('materiel', id, document.getElementById('materiel-editor'))", ids_mat["CAS-003"]); page.wait_for_timeout(700)
    l = ligne(page, "CAS-003"); incs = table(page, "INCIDENTS")
    R.verifier(not l.get("hors_service_motif") and len(incs) == nb_inc + 1 and "declare vole" in sa(incs[-1]["description"]) and "vole au local" in sa(incs[-1]["description"]),
               "editeur : incident cree avec l'episode du vol : %r" % (incs[-1].get("description") if incs else None))
    R.verifier(not l.get("commentaire"), "editeur : commentaire non retouche -> vide (recopie dans l'incident)")
    R.verifier(statut(page, "CAS-003") == "Examen requis", "editeur : Examen requis")
    # ---- editeur : corriger un « Cede » reste libre, sans incident
    page.evaluate("id => openEditor('materiel', id)", ids_mat["CAS-002"]); page.wait_for_timeout(120)
    page.select_option(sel, ""); page.wait_for_timeout(50)
    R.verifier(not page.is_visible(avis), "editeur, Cede : pas d'avis")
    nb_inc = len(table(page, "INCIDENTS"))
    page.evaluate("id => saveEditor('materiel', id, document.getElementById('materiel-editor'))", ids_mat["CAS-002"]); page.wait_for_timeout(700)
    R.verifier(len(table(page, "INCIDENTS")) == nb_inc and not ligne(page, "CAS-002").get("hors_service_motif"), "editeur, Cede : correction libre, aucun incident")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
