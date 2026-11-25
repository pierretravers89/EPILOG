"""2026.5.28 : recherche des prets par personne, numero de bon, sortie, marquage
(en cours ET termines) ; accents et majuscules sans importance ; plusieurs mots
cumules ; saisie conservee au rafraichissement ; onglet Materiel : recherche par
emprunteur actuel ; documents sans numero de bon."""
import sys; from harnais import ouvrir, Resultats; from donnees import construire, ts
from outils_page import *
R = Resultats()
def jeu(avec_numero=True):
    D, ids_mat, ids_lot = construire()
    D["ADHERENTS"]["lignes"].append({"id": 3, "nom_complet": "Hélène Dupré", "role": "Adherent"})
    base = dict(date_retour_prevue=None, etat_retour=None)
    ligne = lambda i, mat, adh, num, sortie, rendu=None: dict(id=i, materiel=ids_mat[mat], adherent=adh, date_emprunt=ts(0, 3),
        date_retour_effective=rendu, sortie_activite=sortie, **({"numero_emprunt": num} if avec_numero else {}), **base)
    D["EMPRUNTS"]["lignes"] += [ligne(1, "CAS-002", 2, "2026-001", "Falaise"),
                                ligne(2, "CAS-003", 3, "2026-002", "Stage jeunes"),
                                ligne(3, "COR-001-A", 2, "2026-003", "Bloc", rendu=ts(0, 1))]
    D["EMPRUNTS"]["lignes"][2]["etat_retour"] = "Bon etat"
    if not avec_numero: D["EMPRUNTS"]["colonnes"] = [c for c in D["EMPRUNTS"]["colonnes"] if c != "numero_emprunt"]
    return D, ids_mat
def visibles(page, classe):
    return page.evaluate("""c => Array.from(document.querySelectorAll('#prets-list .bon' + c)).filter(b => b.style.display !== 'none')
        .map(b => b.dataset.bon.replace('term:', ''))""", classe)
def chercher(page, q):
    page.fill("#filtreBon", q); page.wait_for_timeout(60)
D, ids_mat = jeu()
with ouvrir(D) as page:
    page.evaluate("() => document.querySelector('.tab[data-t=\"prets\"]').click()"); page.wait_for_timeout(250)
    R.verifier(page.is_visible("#filtreBon") and "personne" in page.get_attribute("#filtreBon", "placeholder"), "champ de recherche visible, annonce 'personne'")
    R.verifier(sorted(visibles(page, ":not(.bon-termine)")) == ["2026-001", "2026-002"] and visibles(page, ".bon-termine") == ["2026-003"], "sans saisie : tous les bons")
    chercher(page, "guillaume")
    R.verifier(visibles(page, ":not(.bon-termine)") == ["2026-001"] and visibles(page, ".bon-termine") == ["2026-003"], "par personne : en cours ET termines")
    R.verifier("1 bon en cours" in page.inner_text("#filtreBonCompte") and "1 bon termin" in page.inner_text("#filtreBonCompte"), "compteur : %r" % page.inner_text("#filtreBonCompte"))
    chercher(page, "HELENE")
    R.verifier(visibles(page, ":not(.bon-termine)") == ["2026-002"] and visibles(page, ".bon-termine") == [], "sans accent ni majuscule : 'HELENE' trouve Hélène Dupré")
    chercher(page, "hélène dupré"); R.verifier(visibles(page, ":not(.bon-termine)") == ["2026-002"], "avec accents aussi")
    chercher(page, "guillaume falaise")
    R.verifier(visibles(page, ":not(.bon-termine)") == ["2026-001"] and visibles(page, ".bon-termine") == [], "plusieurs mots cumules : 'guillaume falaise'")
    chercher(page, "stage")
    R.verifier(visibles(page, ":not(.bon-termine)") == ["2026-002"], "par sortie ou activite")
    chercher(page, "CAS-003"); R.verifier(visibles(page, ":not(.bon-termine)") == ["2026-002"], "par marquage d'un exemplaire")
    chercher(page, "2026-003"); R.verifier(visibles(page, ".bon-termine") == ["2026-003"] and visibles(page, ":not(.bon-termine)") == [], "par numero de bon (un bon termine)")
    chercher(page, "zzz")
    R.verifier(visibles(page, ":not(.bon-termine)") == [] and visibles(page, ".bon-termine") == [] and "0 bon" in page.inner_text("#filtreBonCompte"), "aucune correspondance : tout masque")
    # la saisie survit a un rafraichissement (retour d'un exemplaire, etc.)
    chercher(page, "guillaume")
    page.evaluate("load()"); page.wait_for_timeout(500)
    R.verifier(page.input_value("#filtreBon") == "guillaume" and visibles(page, ":not(.bon-termine)") == ["2026-001"], "saisie conservee apres rafraichissement")
    # navigation depuis la fiche d'un exemplaire (ancien comportement : le code remplit le champ)
    page.evaluate("() => { const f = document.getElementById('filtreBon'); f.value = '2026-002'; f.dispatchEvent(new Event('input')); }"); page.wait_for_timeout(80)
    R.verifier(visibles(page, ":not(.bon-termine)") == ["2026-002"], "filtre pose par le code (clic sur un badge de pret) toujours fonctionnel")
    chercher(page, "")
    R.verifier(len(visibles(page, "")) == 3 and page.inner_text("#filtreBonCompte") == "", "champ vide : tout reapparait, compteur efface")
    # ---- onglet Materiel : recherche par emprunteur actuel
    page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()"); page.wait_for_timeout(250)
    def marquages(q):
        page.evaluate("q => { filtresMat.q = q; load(); }", q); page.wait_for_timeout(400)
        return sorted(page.evaluate("inventaireVisible.map(r => r.marquage)"))
    R.verifier(marquages("guillaume") == ["CAS-002"], "Materiel : 'guillaume' trouve ce qu'il a EN CE MOMENT (pas le prete deja rendu) : %s" % marquages("guillaume"))
    R.verifier(marquages("helene") == ["CAS-003"], "Materiel : 'helene' sans accent")
    R.verifier(marquages("casques boreo") == ["CAS-001", "CAS-002", "CAS-003"], "Materiel : plusieurs mots (ancienne saisie 'casques boreo' toujours bonne)")
    R.verifier(marquages("") and "personne" in page.get_attribute("#fmQ", "placeholder"), "Materiel : l'invite annonce 'personne'")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
# ---- sans pret du tout : pas de champ
D, ids_mat, ids_lot = construire()
with ouvrir(D) as page:
    page.evaluate("() => document.querySelector('.tab[data-t=\"prets\"]').click()"); page.wait_for_timeout(250)
    R.verifier(page.query_selector("#filtreBon") is None, "aucun pret : pas de champ de recherche")
# ---- seulement des prets termines : le champ reste disponible
D, ids_mat = jeu()
D["EMPRUNTS"]["lignes"] = [e for e in D["EMPRUNTS"]["lignes"] if e["id"] == 3]
with ouvrir(D) as page:
    page.evaluate("() => document.querySelector('.tab[data-t=\"prets\"]').click()"); page.wait_for_timeout(250)
    R.verifier(page.is_visible("#filtreBon"), "seulement des prets termines : le champ est la (on peut retrouver un ancien prêt)")
    chercher(page, "guillaume"); R.verifier(visibles(page, ".bon-termine") == ["2026-003"], "... et il trouve le pret termine")
# ---- document sans colonne numero_emprunt : lignes de tableau
D, ids_mat = jeu(avec_numero=False)
with ouvrir(D) as page:
    page.evaluate("() => document.querySelector('.tab[data-t=\"prets\"]').click()"); page.wait_for_timeout(250)
    R.verifier(page.query_selector("#prets-list .bon") is None and page.is_visible("#filtreBon"), "document sans numero de bon : listes en tableaux, champ present")
    chercher(page, "helene")
    lignes = page.evaluate("""() => Array.from(document.querySelectorAll('#prets-list tr')).filter(t => t.querySelector('td') && t.style.display !== 'none').map(t => t.textContent)""")
    R.verifier(len(lignes) == 1 and "Dupr" in lignes[0], "tableaux : la ligne d'Helene seulement (%d)" % len(lignes))
    R.verifier(not page.erreurs, "tableaux : aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
