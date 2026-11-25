import time
from donnees import construire, ts

def donnees(avec_colonnes=True):
    D, ids_mat, ids_lot = construire()
    if avec_colonnes:
        D["CATEGORIES"]["colonnes"].append("prolongation_par_reparation")
        D["REPARATIONS"]["colonnes"] += ["date_fabrication_piece", "duree_vie_piece_mois", "intervenant", "pieces_remplacees", "description"]
    else:
        D["REPARATIONS"]["colonnes"] += ["intervenant", "pieces_remplacees", "description"]
    cat_id = max(c["id"] for c in D["CATEGORIES"]["lignes"]) + 1
    D["CATEGORIES"]["lignes"].append(dict(id=cat_id, nom="Degaines", type_epi="Soumis a vieillissement",
        duree_vie_defaut_mois=120, prefixe="DEG", maintenance_fabricant=True, peut_etre_decoupe=False,
        **({"prolongation_par_reparation": True} if avec_colonnes else {})))
    for c in D["CATEGORIES"]["lignes"]:
        if c["nom"] == "Casques": c["maintenance_fabricant"] = True    # reparable, mais NON prolongeable
    lot_id = max(l["id"] for l in D["LOTS"]["lignes"]) + 1
    # fabriquees en 2015 : fin de vie 31/12/2025 -> reformees au calendrier
    D["LOTS"]["lignes"].append(dict(id=lot_id, designation="Degaines Spirit", categorie=cat_id, fabricant="Petzl",
        modele="Spirit", achat=1, date_fabrication=int(time.mktime((2015, 3, 1, 0, 0, 0, 0, 0, 0))) // 86400 * 86400,
        duree_vie_mois=120, prix_unitaire=20, notice=None))
    base = max(m["id"] for m in D["MATERIELS"]["lignes"])
    for i in range(1, 4):
        D["MATERIELS"]["lignes"].append(dict(id=base + i, lot=lot_id, numero_marquage="DEG-00%d" % i, lieu_stockage=1,
                                            date_mise_en_service=ts(5)))
    ids = {m["numero_marquage"]: m["id"] for m in D["MATERIELS"]["lignes"]}
    # DEG-001 : sangle changee en 2025, sangle fabriquee le 01/06/2024
    if avec_colonnes:
        D["REPARATIONS"]["lignes"].append(dict(id=1, materiel=ids["DEG-001"], date_declaree=ts(0, 300), motif="sangle usee",
            date_effectuee=ts(0, 300), intervenant="Club", pieces_remplacees="sangle", description="sangle changee",
            date_fabrication_piece=int(time.mktime((2024, 6, 1, 0, 0, 0, 0, 0, 0))) // 86400 * 86400, duree_vie_piece_mois=120))
    return D, ids, lot_id

