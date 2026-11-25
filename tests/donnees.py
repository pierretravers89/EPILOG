"""Donnees de test EPILOG. Aucun id code en dur dans les references :
tout passe par les dictionnaires d'ids construits ici."""
import time, json

JOUR = 86400
def ts(annees_avant=0, jours_avant=0):
    """Timestamp (secondes, minuit UTC) d'une date relative a aujourd'hui."""
    t = int(time.time()) - annees_avant * 365 * JOUR - jours_avant * JOUR
    return t - t % JOUR

def construire(avec_entretiens=True):
    D = {}
    def table(nom, colonnes, lignes):
        D[nom] = {"colonnes": colonnes, "lignes": [dict(id=i + 1, **l) for i, l in enumerate(lignes)]}
        return {l.get("_cle", i + 1): i + 1 for i, l in enumerate(lignes)}

    cat = table("CATEGORIES", ["nom", "type_epi", "duree_vie_defaut_mois", "prefixe",
                               "maintenance_fabricant", "reparations_acceptees", "peut_etre_decoupe"], [
        dict(nom="Cordes", type_epi="Soumis a vieillissement", duree_vie_defaut_mois=120, prefixe="COR",
             maintenance_fabricant=False, peut_etre_decoupe=True),
        dict(nom="Casques", type_epi="Soumis a vieillissement", duree_vie_defaut_mois=120, prefixe="CAS",
             maintenance_fabricant=False, peut_etre_decoupe=False),
        dict(nom="Baudriers", type_epi="Soumis a vieillissement", duree_vie_defaut_mois=120, prefixe="BAU",
             maintenance_fabricant=True, peut_etre_decoupe=True),
        dict(nom="Mousquetons", type_epi="Non soumis a vieillissement", duree_vie_defaut_mois=None, prefixe="MOU",
             maintenance_fabricant=False, peut_etre_decoupe=False),
    ])
    for l in D["CATEGORIES"]["lignes"]: l.pop("_cle", None)
    ids_cat = {l["nom"]: l["id"] for l in D["CATEGORIES"]["lignes"]}

    table("LIEUX_STOCKAGE", ["nom"], [dict(nom="Local club")])
    table("FOURNISSEURS", ["nom"], [dict(nom="Vieux Campeur")])
    table("ADHERENTS", ["nom_complet", "role"], [
        dict(nom_complet="Pierre Travers", role="Controleur EPI habilite"),
        dict(nom_complet="Guillaume Test", role="Adherent")])
    table("ACHATS", ["ref_commande", "fournisseur", "date_commande", "date_reception", "financement", "facture"], [
        dict(ref_commande="CMD-1", fournisseur=1, date_commande=ts(3), date_reception=ts(3), financement="Club",
             facture=["L", 7])])
    table("LOTS", ["designation", "categorie", "fabricant", "modele", "achat", "date_fabrication",
                   "duree_vie_mois", "prix_unitaire", "quantite_achetee", "commentaire", "photo", "notice"], [
        dict(designation="Casques Boreo", categorie=ids_cat["Casques"], fabricant="Petzl", modele="Boreo",
             achat=1, date_fabrication=ts(3), duree_vie_mois=120, prix_unitaire=60, notice=["L", 5]),
        dict(designation="Cordes 70 m", categorie=ids_cat["Cordes"], fabricant="Beal", modele="Joker",
             achat=1, date_fabrication=ts(3), duree_vie_mois=120, prix_unitaire=200, notice=None),
        dict(designation="Mousquetons", categorie=ids_cat["Mousquetons"], fabricant="Petzl", modele="Am'D",
             achat=1, date_fabrication=ts(3), duree_vie_mois=None, prix_unitaire=12, notice=None),
    ])
    ids_lot = {l["designation"]: l["id"] for l in D["LOTS"]["lignes"]}

    mats = [
        dict(lot=ids_lot["Casques Boreo"], numero_marquage="CAS-001", date_mise_en_service=ts(2)),
        dict(lot=ids_lot["Casques Boreo"], numero_marquage="CAS-002", date_mise_en_service=ts(2)),
        dict(lot=ids_lot["Casques Boreo"], numero_marquage="CAS-003", date_mise_en_service=ts(0, 30)),
        dict(lot=ids_lot["Cordes 70 m"], numero_marquage="COR-001", date_mise_en_service=ts(2),
             hors_service_motif="Reforme", hors_service_date=ts(0, 10)),
        dict(lot=ids_lot["Cordes 70 m"], numero_marquage="COR-001-A", date_mise_en_service=ts(0, 10)),
        dict(lot=ids_lot["Mousquetons"], numero_marquage="MOU-001", date_mise_en_service=ts(2)),
    ]
    table("MATERIELS", ["lot", "numero_marquage", "lieu_stockage", "date_mise_en_service", "hors_service_motif",
                        "hors_service_date", "couleur", "taille", "commentaire", "origine_decoupe"],
          [dict(lieu_stockage=1, **m) for m in mats])
    ids_mat = {l["numero_marquage"]: l["id"] for l in D["MATERIELS"]["lignes"]}
    for l in D["MATERIELS"]["lignes"]:
        if l["numero_marquage"] == "COR-001-A":
            l["origine_decoupe"] = ids_mat["COR-001"]

    table("CONTROLES", ["materiel", "date_controle", "controleur", "resultat", "commentaire", "type_controle"], [
        dict(materiel=ids_mat["CAS-001"], date_controle=ts(0, 100), controleur=1, resultat="Conforme",
             commentaire="RAS", type_controle="Contrôle périodique"),
        dict(materiel=ids_mat["CAS-002"], date_controle=ts(1, 30), controleur=1, resultat="Conforme",
             commentaire="", type_controle="Contrôle périodique"),
    ])
    table("EMPRUNTS", ["materiel", "adherent", "date_emprunt", "date_retour_prevue", "date_retour_effective",
                       "etat_retour", "sortie_activite", "numero_emprunt"], [])
    table("INCIDENTS", ["materiel", "date_incident", "gravite", "description", "suite"], [])
    table("REPARATIONS", ["materiel", "date_declaree", "motif", "date_effectuee", "intervenant",
                          "description", "pieces_remplacees"], [])
    table("CONFIG", ["cle", "valeur"], [])
    if avec_entretiens:
        table("ENTRETIENS", ["materiel", "date_entretien", "auteur", "commentaire"], [
            dict(materiel=ids_mat["CAS-001"], date_entretien=ts(0, 40), auteur=1,
                 commentaire="Casques desinfectes apres le stage jeunes")])
    return D, ids_mat, ids_lot

if __name__ == "__main__":
    print(json.dumps(construire()[0])[:300])
