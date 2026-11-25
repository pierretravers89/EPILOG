"""2026.5.29 : import d'un inventaire existant (tableur -> EPILOG).
Lecture CSV (UTF-8 et Windows-1252) et xlsx, regroupement en lots, numerotation, sorties du parc,
controles, nouvelles categories, garde-fous (erreurs localisees, tout ou rien, doublons, strict),
rapport imprimable, modele a telecharger, et ACCEPTATION : ton export reel (anonymise), importe dans
un document vide, doit redonner exactement les memes exemplaires, lots, categories, lieux, controles."""
import sys, os, re, calendar; from harnais import ouvrir, Resultats, table, VENDOR
from donnees import construire
from outils_page import *
import openpyxl
R = Resultats()
ICI = os.path.dirname(os.path.abspath(__file__))
SHEETJS = open(os.path.join(VENDOR, "package", "dist", "xlsx.full.min.js"), "rb").read()
TABLES = ["CATEGORIES", "LIEUX_STOCKAGE", "FOURNISSEURS", "ADHERENTS", "ACHATS", "LOTS", "MATERIELS", "CONTROLES", "EMPRUNTS", "INCIDENTS", "REPARATIONS", "ENTRETIENS"]
def ts_jma(j, m, a): return calendar.timegm((a, m, j, 0, 0, 0))
def doc(vide=False):
    D, ids_mat, ids_lot = construire()
    D["MATERIELS"]["colonnes"].append("numero_serie"); D["CATEGORIES"]["colonnes"].append("prolongation_par_reparation")
    D["LIEUX_STOCKAGE"]["colonnes"].append("description")
    if vide:
        for k in TABLES: D[k]["lignes"] = []
    return D, ids_mat, ids_lot
def fichier(nom, texte, enc="utf-8-sig"):
    chemin = "/tmp/" + nom; open(chemin, "wb").write(texte.encode(enc)); return chemin
def sheetjs(page): page.route("**/cdnjs.cloudflare.com/ajax/libs/xlsx/**", lambda r: r.fulfill(status=200, content_type="application/javascript", body=SHEETJS))
def importer(page, chemin, attendre=900):
    page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()"); page.wait_for_timeout(150)
    page.evaluate("() => naviguer('donnees')"); page.wait_for_timeout(120)
    page.set_input_files("#impFichier", chemin); page.wait_for_timeout(attendre)
def zone(page): return sa(page.inner_text("#impResultat"))
def confirmer(page, attendre=900): page.click("#impConfirmer"); page.wait_for_timeout(attendre)
def rapport(page, bouton="#impRapport"):
    page.evaluate("() => { window.__DOCS__.length = 0; }"); page.click(bouton); page.wait_for_timeout(300)
    return page.evaluate("window.__DOCS__")[-1]
def noms(page, t, col): return sorted(r[col] for r in table(page, t))

# ---------------------------------------------------------------- 0. interface
D, ids_mat, ids_lot = doc()
with ouvrir(D) as page:
    page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()"); page.wait_for_timeout(150)
    R.verifier(page.is_visible("#btnImport"), "Materiel : bouton 'Importer un inventaire' (renvoie vers la rubrique)")
    page.click("#btnImport"); page.wait_for_timeout(150)
    R.verifier(page.is_visible("#pane-donnees") and page.is_visible("#impModele") and page.is_visible("#impFichier"), "le bouton ouvre la rubrique Import / export : modele et choix du fichier")
    R.verifier(not page.erreurs, "interface : aucune erreur JS %s" % page.erreurs)

# ---------------------------------------------------------------- 1. import simple : lots deduits, lieu cree, rapport
D, ids_mat, ids_lot = doc()
f1 = fichier("imp_simple.csv", "Marquage;Catégorie;Fabricant;Modèle;Date de fabrication;Lieu;Mise en service;Numéro de série\n"
    "IMP-001;Casques;Petzl;Boreo;15/03/2020;Local club;01/09/2021;SN1\nIMP-002;Casques;Petzl;Boreo;20/11/2020;Local club;01/09/2021;\nIMP-003;Casques;Petzl;Boreo;01/02/2022;Cave;;\n")
with ouvrir(D) as page:
    importer(page, f1)
    z = zone(page)
    R.verifier("3 exemplaires" in z and "2 lots" in z and "1 lieu nouveau" in z and "0 categorie nouvelle" in z, "apercu chiffre : %r" % z[:120])
    R.verifier("sans aucun controle" in z and "sans numero de serie" in z, "apercu : avertissements (controle, serie)")
    R.verifier(len(table(page, "MATERIELS")) == 6, "rien n'est ecrit avant confirmation")
    r = rapport(page); R.verifier("ce qui reste" in sa(r) and "a traiter en priorite" in sa(r) and "apercu avant import" in sa(r), "rapport consultable AVANT l'import")
    confirmer(page)
    R.verifier("import termine" in sa(page.inner_text("#impMsg")) and page.is_visible("#impRapport"), "import termine, rapport disponible")
    M = {m["numero_marquage"]: m for m in table(page, "MATERIELS")}; L = {l["designation"]: l for l in table(page, "LOTS")}
    R.verifier(len(M) == 9 and "Casques Petzl Boreo 2020" in L and "Casques Petzl Boreo 2022" in L, "3 exemplaires, 2 lots deduits (categorie + fabricant + modele + annee) : %s" % sorted(L))
    l20 = L["Casques Petzl Boreo 2020"]
    R.verifier(l20["date_fabrication"] == ts_jma(15, 3, 2020) and l20["quantite_achetee"] == 2 and l20["duree_vie_mois"] == 120, "lot 2020 : date de la 1re ligne, 2 exemplaires, duree de la categorie")
    R.verifier(M["IMP-001"]["lot"] == l20["id"] and M["IMP-002"]["lot"] == l20["id"] and M["IMP-003"]["lot"] == L["Casques Petzl Boreo 2022"]["id"], "exemplaires rattaches au bon lot")
    cave = [x for x in table(page, "LIEUX_STOCKAGE") if x["nom"] == "Cave"]
    R.verifier(len(cave) == 1 and M["IMP-003"]["lieu_stockage"] == cave[0]["id"], "lieu 'Cave' cree et rattache")
    R.verifier(M["IMP-001"]["date_mise_en_service"] == ts_jma(1, 9, 2021) and M["IMP-001"]["numero_serie"] == "SN1", "mise en service et numero de serie")
    rp = rapport(page)
    R.verifier("rapport d" in sa(rp) and "import effectue" in sa(rp) and "non repris par l" in sa(rp) and "photos" in sa(rp), "rapport final : import effectue, section 'non repris'")
    # reimport du meme fichier : refus (doublons)
    importer(page, f1)
    R.verifier("erreur" in zone(page) and "deja present" in zone(page) and not page.query_selector("#impConfirmer"), "re-import du meme fichier : refuse (marquages deja presents)")
    R.verifier(not page.erreurs, "import simple : aucune erreur JS %s" % page.erreurs)

# ---------------------------------------------------------------- 2. quantite : numerotation par EPILOG, annee seule, a etiqueter
D, ids_mat, ids_lot = doc()
f2 = fichier("imp_quantite.csv", "Marquage;Catégorie;Fabricant;Modèle;Date de fabrication;Lieu;Quantité\n;Casques;Petzl;Boreo;2020;Local club;5\n")
with ouvrir(D) as page:
    importer(page, f2); z = zone(page)
    R.verifier("5 exemplaires" in z and "dont 5 a numeroter" in z and "annee seule" in z, "quantite 5 : numerotes par EPILOG, annee seule signalee : %r" % z[:150])
    r = sa(rapport(page))
    R.verifier("a etiqueter" in r and "cas001 a cas005" in r, "rapport : liste a etiqueter compactee en plage (CAS001 a CAS005)")
    confirmer(page)
    M = sorted(m["numero_marquage"] for m in table(page, "MATERIELS") if m["numero_marquage"].startswith("CAS0"))
    R.verifier(M == ["CAS001", "CAS002", "CAS003", "CAS004", "CAS005"], "marquages generes : %s" % M)
    lot = [l for l in table(page, "LOTS") if l["designation"].startswith("Casques Petzl Boreo")][0]
    R.verifier(lot["date_fabrication"] == ts_jma(1, 1, 2020), "annee seule 2020 -> 1er janvier (fin de vie prudente)")

# ---------------------------------------------------------------- 3. erreurs : tout est refuse, chaque erreur est localisee
D, ids_mat, ids_lot = doc()
f3 = fichier("imp_erreurs.csv", "Marquage;Catégorie;Date de fabrication;Quantité\nE-001;Casque;01/01/2020;\nE-001;Casques;01/01/2020;\nCAS-001;Casques;01/01/2020;\n"
    "E-004;Casques;31/02/2020;\nE-005;Casques;01/01/2020;3\n;;01/01/2020;\n")
with ouvrir(D) as page:
    importer(page, f3); z = zone(page)
    R.verifier("6 erreurs a corriger" in z and "rien n'est importe" in z.replace("’", "'"), "6 erreurs, rien n'est importe : %r" % z[:100])
    R.verifier("ligne 2" in z and "vouliez-vous dire" in z and "casques" in z, "ligne 2 : categorie inconnue AVEC suggestion")
    R.verifier("ligne 3" in z and "en double" in z and "ligne 4" in z and "deja present dans le document" in z, "lignes 3 et 4 : doublon dans le fichier, marquage deja dans le document")
    R.verifier("ligne 5" in z and "date de fabrication illisible" in z and "ligne 6" in z and "quantite" in z and "ligne 7" in z and "categorie manquante" in z, "lignes 5, 6, 7 localisees")
    R.verifier(not page.query_selector("#impConfirmer") and len(table(page, "MATERIELS")) == 6, "pas de bouton Importer ; rien d'ecrit")
    r = sa(rapport(page))
    R.verifier("erreurs a corriger avant l" in r and "ligne 2" in r and "non effectue" in r, "rapport des erreurs imprimable")

# ---------------------------------------------------------------- 4. sorties du parc, accents, encodage Windows-1252
D, ids_mat, ids_lot = doc()
f4 = fichier("imp_sorties.csv", "Marquage;Catégorie;Fabricant;Modèle;Date de fabrication;Statut;Sortie du parc;Commentaire\n"
    "X-001;Casques;Petzl;Boreo;2018;Perdu;10/05/2024;Perdu en falaise\nX-002;Casques;Petzl;Boreo;2018;Réformé;;\nX-003;Casques;Petzl;Boreo;2018;En service;;\n", enc="cp1252")
with ouvrir(D) as page:
    importer(page, f4); z = zone(page)
    R.verifier("3 exemplaires" in z and "sans date de sortie" in z and "sans cause precisee" in z, "CSV Windows-1252 lu ; sorties sans date / sans cause signalees : %r" % z[:160])
    confirmer(page)
    M = {m["numero_marquage"]: m for m in table(page, "MATERIELS")}
    R.verifier(M["X-001"]["hors_service_motif"] == "Perdu" and M["X-001"]["hors_service_date"] == ts_jma(10, 5, 2024) and M["X-001"]["commentaire"] == "Perdu en falaise", "sortie 'Perdu' avec date et cause")
    R.verifier(M["X-002"]["hors_service_motif"] == "Reforme" and M["X-002"]["hors_service_date"] is None and "cause non" in sa(M["X-002"]["commentaire"]), "sortie 'Reforme' sans date : commentaire generique ajoute")
    R.verifier(not M["X-003"].get("hors_service_motif"), "statut ordinaire 'En service' : ignore (calcule par EPILOG)")
    st = page.evaluate("Object.fromEntries(rawRows.materiels.filter(m => m.numero_marquage.startsWith('X-')).map(m => [m.numero_marquage, m._statut]))")
    R.verifier(st["X-001"] == "Perdu" and st["X-002"] == "Reforme", "statuts recalcules par EPILOG : %s" % st)

# ---------------------------------------------------------------- 5. lot existant : rattachement ; categorie differente : refus
D, ids_mat, ids_lot = doc()
with ouvrir(D) as page:
    importer(page, fichier("imp_lot_ok.csv", "Marquage;Catégorie;Lot\nR-001;Casques;Casques Boreo\n"))
    R.verifier("0 lot" in zone(page) and "1 existant" in zone(page), "lot existant : aucun lot cree, 1 complete")
    confirmer(page)
    r1 = [m for m in table(page, "MATERIELS") if m["numero_marquage"] == "R-001"][0]
    R.verifier(r1["lot"] == ids_lot["Casques Boreo"] and len(table(page, "LOTS")) == 3, "exemplaire rattache au lot existant, aucun lot cree")
    importer(page, fichier("imp_lot_ko.csv", "Marquage;Catégorie;Lot\nR-002;Cordes;Casques Boreo\n"))
    R.verifier("autre categorie" in zone(page) and not page.query_selector("#impConfirmer"), "lot existant avec une autre categorie : refuse")

# ---------------------------------------------------------------- 6. tout ou rien
D, ids_mat, ids_lot = doc()
with ouvrir(D) as page:
    importer(page, f1)
    page.evaluate("() => { window.__ECHEC_SUR__ = 'MATERIELS'; }")
    confirmer(page, 700)
    R.verifier("rien n'a ete ecrit" in sa(page.inner_text("#impMsg")).replace("’", "'"), "echec simule : message 'rien n'a ete ecrit'")
    R.verifier(len(table(page, "MATERIELS")) == 6 and len(table(page, "LOTS")) == 3 and len(table(page, "LIEUX_STOCKAGE")) == 1, "echec simule : aucune table partiellement remplie")

# ---------------------------------------------------------------- 7. suggestion de sauvegarde
D, ids_mat, ids_lot = doc()
with ouvrir(D) as page:
    importer(page, f1); R.verifier("sauvegarde" in zone(page), "document non vide : sauvegarde suggeree")
D, ids_mat, ids_lot = doc(vide=True)
with ouvrir(D, vide=True) as page:
    importer(page, fichier("imp_vide.csv", "Marquage;Catégorie\nV-001;Casques\n"))
    R.verifier("erreur" in zone(page), "document vide sans categories : la categorie est inconnue (a decrire dans la feuille Categories)")

# ---------------------------------------------------------------- 8. modele a telecharger (ExcelJS : menus deroulants), puis xlsx rempli
import shutil, subprocess
EXCELJS = open(os.path.join(VENDOR, "exceljs", "package", "dist", "exceljs.min.js"), "rb").read()
def exceljs(page): page.route("**/cdnjs.cloudflare.com/ajax/libs/exceljs/**", lambda r: r.fulfill(status=200, content_type="application/javascript", body=EXCELJS))
D, ids_mat, ids_lot = doc()
with ouvrir(D) as page:
    sheetjs(page); exceljs(page); page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()"); page.wait_for_timeout(150)
    page.evaluate("() => naviguer('donnees')"); page.wait_for_timeout(120)
    with page.expect_download() as dl: page.click("#impModele")
    dl.value.save_as("/tmp/modele.xlsx"); page.wait_for_timeout(300)
    R.verifier("avec menus deroulants" in sa(page.inner_text("#impMsg")), "message : modele avec menus deroulants : %r" % page.inner_text("#impMsg"))
    wb = openpyxl.load_workbook("/tmp/modele.xlsx")
    R.verifier(wb.sheetnames == ["Mode d’emploi", "Inventaire", "Catégories", "Lots", "Lieux de stockage", "Contrôles", "Listes"], "modele : feuilles %s" % wb.sheetnames)
    inv_ws = wb["Inventaire"]; ent = [c.value for c in inv_ws[1]]
    R.verifier(ent[:2] == ["Marquage*", "Catégorie*"] and "Date de fabrication" in ent and "Quantité" in ent and "Statut" in ent, "modele : titres de colonnes de l'Inventaire")
    R.verifier(inv_ws.freeze_panes == "A2", "modele : ligne de titres figee")
    fond = lambda ws, c: ws[c].fill.fgColor.rgb
    R.verifier(fond(inv_ws, "A1") == "FF1B3668" and fond(inv_ws, "K1") == "FFB45309" and fond(inv_ws, "D1") == "FF5B7DB1" and fond(inv_ws, "G1") == "FFDCE6F5",
               "modele : couleurs des titres (obligatoire / sous condition / recommande / facultatif)")
    R.verifier(inv_ws["A1"].comment is not None and "numérote" in inv_ws["A1"].comment.text, "modele : notes d'aide sur les titres")
    texte = " ".join(str(r[0]) for r in wb["Mode d’emploi"].iter_rows(values_only=True) if r[0])
    R.verifier("OBLIGATOIRE" in texte and "AJOUTE seulement" in texte and "MENUS DÉROULANTS" in texte and "Collage spécial" in texte, "modele : mode d'emploi (obligatoire, menus, collage special, ajoute seulement)")
    # --- menus deroulants : chaque champ a choix limite pointe vers la feuille Listes par un nom defini
    def dv(ws): return {(str(v.sqref), v.type, v.formula1, v.errorStyle or "stop") for v in ws.data_validations.dataValidation}
    di, dc, dl_, dk, dlo = dv(inv_ws), dv(wb["Catégories"]), dv(wb["Contrôles"]), dv(wb["Lots"]), None
    R.verifier(("B2:B2000", "list", "ListeCategories", "stop") in di and ("C2:C2000", "list", "ListeLots", "information") in di and ("I2:I2000", "list", "ListeLieux", "information") in di
               and ("P2:P2000", "list", "ListeStatuts", "information") in di, "menus de l'Inventaire : Categorie (strict), Lot, Lieu, Statut : %s" % sorted(x[:3] for x in di if x[1] == "list"))
    R.verifier(("N2:N2000", "whole", "1", "stop") in di and ("L2:L2000", "whole", "1", "stop") in di and any(x[1] == "decimal" for x in di), "controles de saisie : quantite et duree entieres, prix positif")
    R.verifier(("B2:B200", "list", "ListeNatures", "stop") in dc and all((c + "2:" + c + "200", "list", "ListeOuiNon", "stop") in dc for c in "EGH"), "menus de Categories : nature, Oui/Non")
    R.verifier(("C2:C200", "list", "ListeResultats", "stop") in dl_ and ("F2:F200", "list", "ListeTypesControle", "information") in dl_ and ("A2:A2000", "list", "ListeMarquagesFichier", "information") in dl_, "menus de Controles : resultat, type, exemplaire")
    R.verifier(("B2:B200", "list", "ListeCategories", "stop") in dk, "menu de Lots : categorie")
    noms_def = {n: wb.defined_names[n].attr_text for n in wb.defined_names}
    R.verifier(all(n in noms_def for n in ["ListeCategories", "ListeLieux", "ListeLots", "ListeNatures", "ListeOuiNon", "ListeResultats", "ListeStatuts", "ListeTypesControle", "ListeMarquagesFichier"]), "noms definis vers la feuille Listes : %s" % sorted(noms_def))
    R.verifier(noms_def["ListeCategories"].startswith("Listes!$F$2:$F$"), "ListeCategories : colonne de l'union (existant + decrit) : %s" % noms_def["ListeCategories"])
    L = wb["Listes"]; vals = {c.value for r in L.iter_rows() for c in r if isinstance(c.value, str)}
    R.verifier({"Casques", "Cordes", "Mousquetons", "Baudriers", "Local club"} <= vals, "Listes : categories et lieux DU CLUB en valeurs")
    form = [c.value for r in L.iter_rows() for c in r if isinstance(c.value, str) and c.value.startswith("=")]
    R.verifier(any("Catégories" in f for f in form) and any("Lieux de stockage" in f for f in form) and any("'Lots'" in f for f in form), "Listes : formules qui lisent les feuilles Categories, Lieux de stockage, Lots (%d formules)" % len(form))
    # --- la liste se met a jour : on decrit une categorie et un lieu, LibreOffice recalcule
    cat = wb["Catégories"]; cat.append(["Sacs à dos", "EPI non soumis au vieillissement"]); wb["Lieux de stockage"].append(["Cave du club"])
    wb.save("/tmp/modele_union.xlsx")
    if shutil.which("soffice"):
        shutil.rmtree("/tmp/lo", ignore_errors=True)
        subprocess.run(["soffice", "--headless", "--convert-to", "xlsx", "--outdir", "/tmp/lo", "/tmp/modele_union.xlsx"], capture_output=True, timeout=240,
                       env=dict(os.environ, HOME="/tmp/lohome"))
        calc = openpyxl.load_workbook("/tmp/lo/modele_union.xlsx", data_only=True)["Listes"]
        def colonne(debut): 
            c = [i for i, x in enumerate(next(calc.iter_rows(max_row=1))) if x.value and str(x.value).startswith(debut)][0]
            return [r[c].value for r in calc.iter_rows(min_row=2) if r[c].value]
        R.verifier(["Sacs à dos"] == [x for x in colonne("Catégories utilisables") if x not in ("Casques", "Cordes", "Mousquetons", "Baudriers")] and "Casques" in colonne("Catégories utilisables"),
                   "LibreOffice recalcule : la liste des categories = celles du club + « Sacs à dos » decrite dans l'autre feuille : %s" % colonne("Catégories utilisables"))
        R.verifier("Cave du club" in colonne("Lieux utilisables") and "Local club" in colonne("Lieux utilisables"), "idem pour les lieux : %s" % colonne("Lieux utilisables"))
        lo = openpyxl.load_workbook("/tmp/lo/modele_union.xlsx")["Inventaire"]
        R.verifier(any(v.type == "list" and "B2" in str(v.sqref) for v in lo.data_validations.dataValidation), "les menus survivent a une ouverture/reenregistrement dans un autre tableur")
    else:
        print("  (LibreOffice absent : verification du recalcul ignoree)")
    # --- modele rempli (ouvert dans un tableur, complete, reenregistre) puis importe
    wb = openpyxl.load_workbook("/tmp/modele.xlsx")
    inv = wb["Inventaire"]
    inv.append(["IMP-100", "Casques", None, "Petzl", "Boreo", None, "Rouge", None, "Local club", "01/09/2021", "15/03/2020", None, None, None, None, None, None])
    inv.append(["SAC-001", "Sacs à dos", None, "Millet", "Prolighter", None, None, None, "Local club", None, None, None, None, None, None, None, None])
    cat = wb["Catégories"]; cat.append(["Sacs à dos", "EPI non soumis au vieillissement", None, None, "Non", None, "Non", "Non"])
    ctl = wb["Contrôles"]; ctl.append(["IMP-100", "10/09/2025", "Conforme", "Jean Nouveau", "RAS", None])
    wb.save("/tmp/modele_rempli.xlsx")
    page.set_input_files("#impFichier", "/tmp/modele_rempli.xlsx"); page.wait_for_timeout(1800)
    z = zone(page)
    R.verifier("2 exemplaires" in z and "1 categorie nouvelle" in z and "1 controle" in z and "1 controleur" in z, "xlsx rempli : analyse correcte : %r" % z[:170])
    r_modele = sa(rapport(page))
    R.verifier("mode d’emploi" not in r_modele and "mode d'emploi" not in r_modele and "feuilles non lues" not in r_modele, "rapport : les feuilles du MODELE (mode d'emploi, listes) ne sont pas signalees comme ignorees")
    R.verifier("prefixes de marquage" in z or "prefixe" in r_modele, "prefixe de marquage deduit du nom de la categorie")
    confirmer(page, 1200)
    C = {c["nom"]: c for c in table(page, "CATEGORIES")}
    R.verifier("Sacs à dos" in C and C["Sacs à dos"]["type_epi"] == "Non soumis a vieillissement" and C["Sacs à dos"]["prefixe"] == "SACS", "nouvelle categorie : nature lue (« EPI non soumis »), prefixe SACS")
    A = [a for a in table(page, "ADHERENTS") if a["nom_complet"] == "Jean Nouveau"]
    ct = [c for c in table(page, "CONTROLES") if c["materiel"] == [m for m in table(page, "MATERIELS") if m["numero_marquage"] == "IMP-100"][0]["id"]]
    R.verifier(len(A) == 1 and A[0]["role"] == "Controleur EPI habilite", "controleur cree avec le role des controleurs")
    R.verifier(len(ct) == 1 and ct[0]["date_controle"] == ts_jma(10, 9, 2025) and ct[0]["resultat"] == "Conforme" and ct[0]["controleur"] == A[0]["id"] and ct[0]["type_controle"] == "Contrôle périodique", "controle importe : date, resultat, controleur, type par defaut")
    R.verifier(not page.erreurs, "xlsx : aucune erreur JS %s" % page.erreurs)

# ---- repli : ExcelJS indisponible -> modele SANS menus, avec un message clair
D, ids_mat, ids_lot = doc()
with ouvrir(D) as page:
    sheetjs(page); page.route("**/cdnjs.cloudflare.com/ajax/libs/exceljs/**", lambda r: r.abort())
    page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()"); page.wait_for_timeout(150)
    page.evaluate("() => naviguer('donnees')"); page.wait_for_timeout(120)
    with page.expect_download() as dl: page.click("#impModele")
    dl.value.save_as("/tmp/modele_simple.xlsx"); page.wait_for_timeout(300)
    R.verifier("sans menus deroulants" in sa(page.inner_text("#impMsg")), "repli : message 'SANS menus deroulants' : %r" % page.inner_text("#impMsg")[:90])
    ws = openpyxl.load_workbook("/tmp/modele_simple.xlsx")
    R.verifier(len(ws.sheetnames) == 7 and not ws["Inventaire"].data_validations.dataValidation, "repli : le modele reste utilisable (7 feuilles, sans menus)")
    R.verifier(not page.erreurs, "repli : aucune erreur JS %s" % page.erreurs)

# ---------------------------------------------------------------- 9. ACCEPTATION : ton export reel (anonymise) dans un document vide
fx = openpyxl.load_workbook(os.path.join(ICI, "export_reel_anonymise.xlsx"))
def feuille(nom):
    rows = list(fx[nom].iter_rows(values_only=True)); h = list(rows[0]); return [dict(zip(h, r)) for r in rows[1:]]
inv, lots, cats, lieux, ctls = feuille("Inventaire"), feuille("Lots"), feuille("Catégories"), feuille("Lieux de stockage"), feuille("Contrôles")
SORTIES = {"Perdu", "Vole", "Reforme", "Cede"}
attendu_sorties = [r for r in inv if r["Statut"] in SORTIES]
D, ids_mat, ids_lot = doc(vide=True)
with ouvrir(D, vide=True) as page:
    sheetjs(page); importer(page, os.path.join(ICI, "export_reel_anonymise.xlsx"), 2500)
    z = zone(page)
    R.verifier("erreur" not in z.split("pret a importer")[0] and "pret a importer" in z, "export reel : aucune erreur d'analyse : %r" % z[:200])
    R.verifier("%d exemplaires" % len(inv) in z and "%d lots" % len({r["Lot"] for r in inv}) in z and "%d categories nouvelles" % len(cats) in z, "apercu : %d exemplaires, %d lots, %d categories" % (len(inv), len({r["Lot"] for r in inv}), len(cats)))
    rp = sa(rapport(page))
    R.verifier("feuilles non lues" in rp and "prets" in rp and "commandes" in rp and "incidents" in rp, "rapport : feuilles d'historique ignorees et nommees")
    confirmer(page, 2500)
    M = table(page, "MATERIELS"); L = {l["id"]: l for l in table(page, "LOTS")}; Cat = {c["id"]: c["nom"] for c in table(page, "CATEGORIES")}
    Li = {x["id"]: x["nom"] for x in table(page, "LIEUX_STOCKAGE")}
    R.verifier(len(M) == len(inv) and len(L) == len({r["Lot"] for r in inv}) and len(Cat) == len(cats) and len(Li) == len(lieux), "tables : %d exemplaires, %d lots, %d categories, %d lieux" % (len(M), len(L), len(Cat), len(Li)))
    par_m = {m["numero_marquage"]: m for m in M}
    manque = [r["Marquage"] for r in inv if r["Marquage"] not in par_m]
    faux = [r["Marquage"] for r in inv if r["Marquage"] in par_m and (L[par_m[r["Marquage"]]["lot"]]["designation"] != r["Lot"]
            or Cat[L[par_m[r["Marquage"]]["lot"]]["categorie"]] != r["Catégorie"] or (Li.get(par_m[r["Marquage"]]["lieu_stockage"]) or "") != (r["Lieu"] or ""))]
    R.verifier(not manque and not faux, "chaque exemplaire : meme lot, meme categorie, meme lieu (manquants %s, differents %s)" % (manque[:3], faux[:3]))
    Lf = {l["Désignation"]: l for l in lots}
    def jma(t): j, m, a = (int(x) for x in str(t).split("/")); return ts_jma(j, m, a)
    ecarts = [d for d, l in Lf.items() if l["Date de fabrication"] and [x for x in L.values() if x["designation"] == d][0]["date_fabrication"] != jma(l["Date de fabrication"])]
    R.verifier(not ecarts, "dates de fabrication des lots reprises de la feuille Lots (ecarts : %s)" % ecarts)
    sor = [m for m in M if m.get("hors_service_motif")]
    R.verifier(len(sor) == len(attendu_sorties), "sorties du parc : %d reprises sur %d attendues" % (len(sor), len(attendu_sorties)))
    R.verifier(len(table(page, "CONTROLES")) == len(ctls), "controles : %d importes sur %d" % (len(table(page, "CONTROLES")), len(ctls)))
    ad = [a["nom_complet"] for a in table(page, "ADHERENTS")]
    R.verifier(sorted(ad) == sorted({c["Contrôleur"] for c in ctls if c["Contrôleur"]}), "controleurs crees : %s" % ad)
    st = page.evaluate("Object.fromEntries(rawRows.materiels.map(m => [m.numero_marquage, m._statut]))")
    perdus = [r["Marquage"] for r in attendu_sorties if r["Statut"] == "Perdu"]
    R.verifier(all(st[m] == "Perdu" for m in perdus), "statuts recalcules : les exemplaires 'Perdu' le sont toujours (%d)" % len(perdus))
    R.verifier(not page.erreurs, "acceptation : aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
