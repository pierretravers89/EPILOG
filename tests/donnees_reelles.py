"""Jeu de donnees reproduisant la structure REELLE du document du CAF d'Auxerre
(releve le 20/10 via le connecteur Grist) : dequaines orange et noires, crashpads,
morceaux de corde decoupes (couleur vide / null), baudrier perdu avec commentaire.
Sert aux tests de non-regression 'cas reel' : un jeu invente n'aurait pas montre
ces particularites (couleur null, tailles numeriques, commentaires auto)."""
def tab(cols, lignes): return {"colonnes": cols, "lignes": lignes}
def construire_reel():
    CAT = [(1,"Baudriers","Soumis a vieillissement",120,"BAUD",True,False,False),
           (2,"Cordes à simple","Soumis a vieillissement",120,"COR-SIMP",False,True,False),
           (6,"Dégaines","Soumis a vieillissement",120,"DEGAIN",True,False,True),
           (7,"Crashpads","Non soumis a vieillissement",None,"CRASHPAD",True,False,False)]
    D = {}
    D["CATEGORIES"] = tab(["nom","type_epi","duree_vie_defaut_mois","prefixe","maintenance_fabricant","peut_etre_decoupe","prolongation_par_reparation","reparations_acceptees"],
        [dict(id=c[0],nom=c[1],type_epi=c[2],duree_vie_defaut_mois=c[3],prefixe=c[4],maintenance_fabricant=c[5],peut_etre_decoupe=c[6],prolongation_par_reparation=c[7],reparations_acceptees="") for c in CAT])
    D["LIEUX_STOCKAGE"] = tab(["nom","description"], [dict(id=1,nom="Local du cadran - Auxerre",description=""), dict(id=2,nom="Coffre gymnase Serge Mésonès",description="")])
    D["FOURNISSEURS"] = tab(["nom","contact","telephone","email"], [dict(id=1,nom="Vieux Campeur",contact="",telephone="",email="")])
    D["ADHERENTS"] = tab(["nom_complet","numero_licence","role","email","telephone"], [dict(id=1,nom_complet="Pierre Travers",numero_licence="",role="Responsable materiel",email="",telephone="")])
    D["ACHATS"] = tab(["ref_commande","fournisseur","date_commande","date_reception","montant_total","financement","facture","note_financement"],
        [dict(id=i,ref_commande="CMD-%d"%i,fournisseur=1,date_commande=1780000000,date_reception=1780000000,montant_total=100,financement="Club",facture=None,note_financement="") for i in range(1,9)])
    LOTS = [(8,"Crashpads",7,"OCUN","Paddy Sundance Bergfreunde",7,None,138.56),(9,"Dégaines",6,"CAMP","Photon Wire Express KS Dyneema",8,120,12.82),
            (11,"Dégaines Petzl",6,"","super",0,120,25),(10,"Baudrier Petzl test scinder lot",1,"Petzl",None,0,None,None),(6,"Cordes à simple 80 mètres",2,"BEAL","",5,120,168)]
    D["LOTS"] = tab(["designation","categorie","fabricant","modele","achat","date_fabrication","duree_vie_mois","prix_unitaire","quantite_achetee","commentaire","photo","notice"],
        [dict(id=l[0],designation=l[1],categorie=l[2],fabricant=l[3],modele=l[4],achat=l[5],date_fabrication=1768176000,duree_vie_mois=l[6],prix_unitaire=l[7],quantite_achetee=10,commentaire="",photo=None,notice=None) for l in LOTS])
    M = []
    def m(lot, marq, lieu=2, couleur="", taille="", comm="", motif="", mdate=None, origine=0, mes=1785542400):
        M.append(dict(id=len(M)+1,lot=lot,numero_marquage=marq,lieu_stockage=lieu,date_mise_en_service=mes,hors_service_motif=motif,hors_service_date=mdate,couleur=couleur,taille=taille,commentaire=comm,origine_decoupe=origine,numero_serie=""))
    m(10,"BAU-001",motif="Perdu",mdate=1786004078,comm="Perdu dans le ravin."); m(10,"BAU-002"); m(10,"BAU-003")
    for i in range(1,6): m(8,"CRASHPAD%03d"%i,lieu=1,couleur="Noir",taille="100x120",mes=1786320000)
    for i in range(1,25): m(9,"DEGAIN%03d"%i,couleur="Orange",taille="longueur 12 cm")
    m(6,"COR-SIMP001",lieu=1,mes=1785369600)
    m(6,"COR-SIMP002",lieu=1,motif="Reforme",mdate=1789430400,mes=1785369600,comm="Découpée le 2026-09-15 : Coupure de la gaine. 2 morceaux : COR-SIMP002-A (35), COR-SIMP002-B (20).")
    m(6,"COR-SIMP002-A",lieu=1,couleur=None,taille="35",origine=len(M),mes=1789430400); m(6,"COR-SIMP002-B",lieu=1,couleur=None,taille="20",origine=len(M)-1,mes=1789430400)
    for i in range(25,45): m(11,"DEGAIN%03d"%i,couleur="Noir",taille="30cm",mes=1791849600)
    D["MATERIELS"] = tab(["lot","numero_marquage","lieu_stockage","date_mise_en_service","hors_service_motif","hors_service_date","couleur","taille","commentaire","origine_decoupe","numero_serie"], M)
    for k,c in [("CONTROLES",["materiel","date_controle","controleur","resultat","commentaire","type_controle","photo"]),
                ("EMPRUNTS",["materiel","adherent","date_emprunt","date_retour_prevue","date_retour_effective","etat_retour","sortie_activite","numero_emprunt"]),
                ("INCIDENTS",["materiel","date_incident","gravite","description","suite","photo"]),
                ("REPARATIONS",["materiel","date_declaree","motif","date_effectuee","intervenant","description","pieces_remplacees","date_fabrication_piece","duree_vie_piece_mois"]),
                ("ENTRETIENS",["materiel","date_entretien","auteur","commentaire"]),("CONFIG",["manualSort","Cle","Valeur"])]:
        D[k] = tab(c, [])
    return D
