"""Photographie les principaux ecrans a une largeur donnee.
Usage : python3 captures_ecrans.py <dossier> <largeur> [hauteur]
Sert a prouver que l'affichage ordinateur reste identique au pixel pres
(comparaison avant/apres) et a montrer le rendu telephone.
ATTENTION : les donnees de test ont des dates relatives a aujourd'hui ; prendre
la reference et les captures a comparer LE MEME JOUR (sinon toutes les dates
affichees changent d'un jour, constate le 19/10)."""
import sys, os
from harnais import ouvrir; from donnees import construire, ts
dossier, larg = sys.argv[1], int(sys.argv[2]); haut = int(sys.argv[3]) if len(sys.argv) > 3 else 900
os.makedirs(dossier, exist_ok=True)
D, ids_mat, ids_lot = construire()
D["EMPRUNTS"]["lignes"].append({"id": 1, "materiel": ids_mat["CAS-002"], "adherent": 2, "date_emprunt": ts(0, 2),
    "date_retour_prevue": ts(0, -5), "date_retour_effective": None, "numero_emprunt": "2026-001", "sortie_activite": "Falaise"})
ECRANS = [
  ("01_vue_ensemble", "() => document.querySelector('.tab[data-t=\"dashboard\"], .tab').click()"),
  ("02_materiel", "() => document.querySelector('.tab[data-t=\"materiel\"]').click()"),
  ("03_materiel_lot_ouvert", "id => { document.querySelector('.tab[data-t=\"materiel\"]').click(); document.querySelector('#materiel-list .lot[data-lot=\"' + id + '\"] .lot-head').click(); }"),
  ("04_fiche", "id => { document.querySelector('.tab[data-t=\"materiel\"]').click(); ouvrirFicheExemplaire(id); }"),
  ("05_prets", "() => document.querySelector('.tab[data-t=\"prets\"]').click()"),
  ("06_pret_formulaire", "() => { document.querySelector('.tab[data-t=\"prets\"]').click(); document.getElementById('btnTogglePret').click(); }"),
  ("07_controles", "() => document.querySelector('.tab[data-t=\"controles\"]').click()"),
  ("08_controle_formulaire", "() => { document.querySelector('.tab[data-t=\"controles\"]').click(); document.getElementById('btnToggleCtrl').click(); }"),
  ("09_budget", "() => document.querySelector('.tab[data-t=\"budget\"]').click()"),
  ("10_listes", "() => document.querySelector('.tab[data-t=\"refs\"]').click()"),
  ("11_reglages", "() => ouvrirReglages()"),
]
with ouvrir(D) as page:
    page.set_viewport_size({"width": larg, "height": haut})
    page.add_style_tag(content="*{transition:none!important;animation:none!important;caret-color:transparent!important}")
    for nom, js in ECRANS:
        page.evaluate("() => { try { fermerReglages(); } catch (e) {} }")
        arg = ids_mat["CAS-002"] if "fiche" in nom else ids_lot["Casques Boreo"]
        page.evaluate(js, arg) if "id =>" in js else page.evaluate(js)
        page.wait_for_timeout(250)
        page.screenshot(path=os.path.join(dossier, nom + ".png"), full_page=True)
    print("erreurs JS :", page.erreurs)
