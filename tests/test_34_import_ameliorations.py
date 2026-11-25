"""2026.5.31 : (1) erreurs identiques regroupees ; (2) colonnes non reconnues visibles dans l'apercu ;
(3) « Dernier controle » (+ resultat) dans l'Inventaire ; (4) modele CSV colle a l'export, avec fenetre
d'avertissement ; (5) alignement export / modele / import ; (6) ALLER-RETOUR : l'export CSV, reimporte
dans un document qui a les memes categories, garde dates de sortie et derniers controles."""
import sys, os, re, calendar, csv, io, datetime; from harnais import ouvrir, Resultats, table, VENDOR
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
    D["MATERIELS"]["colonnes"].append("numero_serie"); D["CATEGORIES"]["colonnes"].append("prolongation_par_reparation"); D["LIEUX_STOCKAGE"]["colonnes"].append("description")
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

# ------------------------------------------------------------ 1. erreurs identiques regroupees
D, ids_mat, ids_lot = doc()
lig = ["Marquage;Catégorie;Date de fabrication"] + ["H-%03d;Harnais;01/01/2020" % i for i in range(1, 81)] + ["I-001;Casques;31/02/2020"] + ["S-%03d;Sacs;01/01/2020" % i for i in range(1, 4)]
with ouvrir(D) as page:
    importer(page, fichier("imp_groupe.csv", "\n".join(lig) + "\n")); z = zone(page)
    R.verifier("3 erreurs a corriger (84 lignes concernees)" in z, "titre : 3 erreurs pour 84 lignes : %r" % z[:70])
    R.verifier(z.count("harnais » inconnue") + z.count("harnais » inconnue") >= 1 and len(re.findall(r"categorie « harnais » inconnue", z)) == 1, "la categorie « Harnais » n'apparait qu'UNE fois")
    R.verifier("80 lignes (2, 3, 4, 5, 6, 7, 8, 9" in z, "lignes concernees citees (8 premieres, puis …) : %r" % re.findall(r"80 lignes \([^)]*\)", z))
    R.verifier("ligne 82" in z and "3 lignes (83, 84, 85)" in z, "erreur isolee (ligne 82) et groupe de 3 lignes")
    r = sa(rapport(page)); R.verifier("erreurs a corriger avant l" in r and "(3)" in r and r.count("harnais » inconnue") == 1, "le rapport imprime regroupe aussi")

# ------------------------------------------------------------ 2. colonnes non reconnues : visibles dans l'apercu
D, ids_mat, ids_lot = doc()
with ouvrir(D) as page:
    importer(page, fichier("imp_cols.csv", "Marquage;Catégorie;Marque;Année\nN-001;Casques;Petzl;2020\n")); z = zone(page)
    R.verifier("colonnes non reconnues" in z and "« marque »" in z and "« annee »" in z and "renommez" in z, "apercu : colonnes ignorees nommees : %r" % z[:260])
    R.verifier(page.is_visible("#impConfirmer"), "elles n'empechent pas l'import (avertissement, pas erreur)")
    importer(page, fichier("imp_cols2.csv", "Marquage;Catégorie;Marque\nN-002;Casque;Petzl\n")); z = zone(page)
    R.verifier("colonnes non reconnues" in z and "erreur" in z, "meme avertissement quand il y a aussi des erreurs")
    importer(page, fichier("imp_cols3.csv", "Marquage;Catégorie;Fin de vie;Controle echu;Photos;Motif;Prochain controle\nN-003;Casques;31/12/2030;non;;;01/01/2027\n")); z = zone(page)
    R.verifier("colonnes non reconnues" not in z, "les colonnes CALCULEES de l'export ne sont pas signalees")

# ------------------------------------------------------------ 3. dernier controle dans l'Inventaire
D, ids_mat, ids_lot = doc()
RECENT = (datetime.date.today() - datetime.timedelta(days=40)).strftime("%d/%m/%Y")   # relatif a AUJOURD'HUI : un controle fixe finit par etre echu
f3 = fichier("imp_dc.csv", "Marquage;Catégorie;Fabricant;Modèle;Date de fabrication;Dernier contrôle;Résultat du dernier contrôle\n"
    "C-001;Casques;Petzl;Boreo;2022;10/09/2025;À surveiller\nC-002;Casques;Petzl;Boreo;2022;" + RECENT + ";\nC-003;Casques;Petzl;Boreo;2022;;\n"
    "C-004;Casques;Petzl;Boreo;2022;jamais;jamais contrôle\nC-005;Casques;Petzl;Boreo;2022;;Conforme\n")
with ouvrir(D) as page:
    importer(page, f3); z = zone(page)
    R.verifier("2 controles" in z and "conforme » suppose" in z and "sans date" in z and "3 — exemplaires en circulation sans aucun controle" in z.replace("\n", " "), "apercu : 2 controles, 1 resultat suppose, 1 resultat sans date, 3 sans controle : %r" % z[:300])
    confirmer(page)
    M = {m["numero_marquage"]: m["id"] for m in table(page, "MATERIELS")}; C = {c["materiel"]: c for c in table(page, "CONTROLES")}
    R.verifier(C[M["C-001"]]["date_controle"] == ts_jma(10, 9, 2025) and C[M["C-001"]]["resultat"] == "A surveiller", "C-001 : date et resultat repris")
    c2 = C[M["C-002"]]
    R.verifier(c2["resultat"] == "Conforme" and c2["controleur"] is None and "inventaire d" in sa(c2["commentaire"]) and c2["type_controle"] == "Contrôle périodique", "C-002 : « Conforme » suppose, sans controleur, mention d'origine")
    R.verifier(all(M[k] not in C for k in ("C-003", "C-004", "C-005")), "C-003 (vide), C-004 (« jamais »), C-005 (resultat sans date) : aucun controle")
    st = page.evaluate("Object.fromEntries(rawRows.materiels.filter(m => m.numero_marquage.startsWith('C-')).map(m => [m.numero_marquage, m._statut + '|' + m._controleEchu]))")
    R.verifier(st["C-002"].startswith("En service") and "true" not in st["C-002"], "C-002 : echeance calculee depuis le dernier controle (pas echu) : %s" % st["C-002"])
    importer(page, fichier("imp_dc_ko.csv", "Marquage;Catégorie;Dernier contrôle;Résultat du dernier contrôle\nK-001;Casques;31/02/2025;\nK-002;Casques;10/09/2025;Bof\nK-003;Casques;2025;\n")); z = zone(page)
    R.verifier("3 erreurs" in z and "date du dernier controle illisible" in z and "resultat du dernier controle illisible" in z and "incomplete" in z, "dates et resultats de controle invalides : refuses, messages precis")
# la feuille Controles fait foi : pas de doublon avec « Dernier contrôle »
wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Inventaire"
ws.append(["Marquage", "Catégorie", "Date de fabrication", "Dernier contrôle"]); ws.append(["X-001", "Casques", "2022", "01/03/2025"]); ws.append(["X-002", "Casques", "2022", "02/03/2025"])
wc = wb.create_sheet("Contrôles"); wc.append(["Exemplaire", "Date du contrôle", "Résultat"]); wc.append(["X-001", "05/06/2025", "Conforme"])
wb.save("/tmp/imp_dc.xlsx")
D, ids_mat, ids_lot = doc()
with ouvrir(D) as page:
    sheetjs(page); importer(page, "/tmp/imp_dc.xlsx", 1800); confirmer(page)
    M = {m["numero_marquage"]: m["id"] for m in table(page, "MATERIELS")}; C = table(page, "CONTROLES")
    d1 = [c["date_controle"] for c in C if c["materiel"] == M["X-001"]]; d2 = [c["date_controle"] for c in C if c["materiel"] == M["X-002"]]
    R.verifier(d1 == [ts_jma(5, 6, 2025)] and d2 == [ts_jma(2, 3, 2025)], "X-001 : la feuille Controles fait foi (1 seul controle) ; X-002 : repris de l'Inventaire")

# ------------------------------------------------------------ 4. modele CSV et fenetre d'avertissement
ATTENDU = ["Marquage", "Numero de serie", "Couleur", "Taille ou longueur", "Lot", "Categorie", "Fabricant", "Modele", "Date de fabrication", "Duree de vie (mois)", "Lieu",
           "Mise en service", "Statut", "Sortie du parc", "Dernier controle", "Resultat", "Prix unitaire", "Quantite", "Commentaire"]
D, ids_mat, ids_lot = doc()
with ouvrir(D) as page:
    telecharges = []; page.on("download", lambda d: telecharges.append(d.suggested_filename))
    page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()"); page.wait_for_timeout(150)
    page.evaluate("() => naviguer('donnees')"); page.wait_for_timeout(120); R.verifier(page.is_visible("#impModele") and page.is_visible("#impModeleCsv"), "panneau : modele Excel ET modele CSV")
    page.click("#impModeleCsv"); page.wait_for_timeout(150)
    R.verifier(page.is_visible("#impPopup"), "fenetre d'avertissement affichee AVANT tout telechargement")
    p = sa(page.inner_text("#impPopup")); 
    R.verifier("categories doivent deja exister" in p and "casques" in p and "excel abime les csv" in p and "ne renommez pas" in p and "ligne d'exemple" in p.replace("’", "'") and "jj/mm/aaaa" in p and "ne reprend pas" in p, "contenu : categories (celles du club), Excel abime les CSV, titres, ligne d'exemple, dates, non repris")
    page.click("#impPopupNon"); page.wait_for_timeout(100)
    R.verifier(not page.query_selector("#impPopup") and telecharges == [], "Annuler : fenetre fermee, rien telecharge")
    page.click("#impModeleCsv"); page.keyboard.press("Escape"); page.wait_for_timeout(100)
    R.verifier(not page.query_selector("#impPopup") and telecharges == [], "Echap : fenetre fermee, rien telecharge")
    page.click("#impModeleCsv")
    with page.expect_download() as dl: page.click("#impPopupOk")
    dl.value.save_as("/tmp/modele_csv.csv"); page.wait_for_timeout(150)
    R.verifier(dl.value.suggested_filename.startswith("epilog-modele-import-") and dl.value.suggested_filename.endswith(".csv") and not page.query_selector("#impPopup"), "confirmation : telechargement, fenetre fermee : %s" % dl.value.suggested_filename)
    brut = open("/tmp/modele_csv.csv", "rb").read()
    R.verifier(brut[:3] == b"\xef\xbb\xbf" and b"\r\n" in brut, "fichier : UTF-8 avec BOM (ouverture directe dans Excel), fins de ligne CRLF")
    lignes = list(csv.reader(io.StringIO(brut.decode("utf-8-sig")), delimiter=";"))
    R.verifier(lignes[0] == ATTENDU and len(lignes) == 2, "titres = ceux de l'export sans les colonnes calculees, + Quantite : %s" % lignes[0])
    R.verifier(lignes[1][0] == "EXEMPLE - A SUPPRIMER" and lignes[1][lignes[0].index("Categorie")] == "Cordes", "ligne d'exemple, avec une categorie reelle du club")
    # le modele non modifie est refuse, avec un message precis
    importer(page, "/tmp/modele_csv.csv"); z = zone(page)
    R.verifier("ligne d'exemple du modele" in z.replace("’", "'") and "supprimez-la" in z and not page.query_selector("#impConfirmer"), "modele non modifie : ligne d'exemple refusee : %r" % z[:140])
    # remplace par un vrai exemplaire : importable (et son dernier controle est repris)
    texte = brut.decode("utf-8-sig").replace("EXEMPLE - A SUPPRIMER", "MOD-001").replace("Cordes", "Casques")
    importer(page, fichier("modele_rempli.csv", texte)); R.verifier("1 exemplaire" in zone(page) and "1 controle" in zone(page), "modele rempli : 1 exemplaire, son dernier controle : %r" % zone(page)[:90])
    R.verifier(not page.erreurs, "modele CSV : aucune erreur JS %s" % page.erreurs)
D, ids_mat, ids_lot = doc(vide=True)
with ouvrir(D, vide=True) as page:
    page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()"); page.wait_for_timeout(150)
    page.evaluate("() => naviguer('donnees')"); page.wait_for_timeout(120); page.click("#impModeleCsv"); page.wait_for_timeout(150)
    R.verifier("aucune n'existe encore" in sa(page.inner_text("#impPopup")).replace("’", "'"), "document sans categorie : la fenetre le dit et renvoie vers Listes du club / modele Excel")

# ------------------------------------------------------------ 5. alignement export / modele / import (une seule liste de colonnes)
D, ids_mat, ids_lot = doc()
with ouvrir(D) as page:
    cols = page.evaluate("INV_CSV.map(c => [c.t, !!c.calc])")
    toutes = [c[0] for c in cols]; modele = page.evaluate("impColonnesModeleCsv()")
    R.verifier(modele == ATTENDU, "modele CSV = export sans les colonnes calculees + Quantite (liste figee)")
    R.verifier([t for t in toutes if t in modele] == [t for t in modele if t != "Quantite"], "l'ordre du modele suit celui de l'export")
    inconnues = page.evaluate("(t) => impObjets([t], IMP_ALIAS.inventaire).inconnues.map(c => c.norm)", toutes)
    R.verifier(all(c in page.evaluate("IMP_CALCULEES") for c in inconnues), "tout titre de l'export est reconnu par l'import, ou connu comme calcule (%s)" % inconnues)
    R.verifier(page.evaluate("(t) => impObjets([t], IMP_ALIAS.inventaire).inconnues.length", modele) == 0, "tout titre du MODELE est reconnu par l'import")
    R.verifier(set(toutes) >= {"Sortie du parc", "Dernier controle", "Resultat"}, "l'export contient desormais « Sortie du parc »")

# ------------------------------------------------------------ 6. ALLER-RETOUR : export CSV -> reimport (memes categories, memes lieux)
fx = openpyxl.load_workbook(os.path.join(ICI, "export_reel_anonymise.xlsx"))
D1, _, _ = doc(vide=True)
with ouvrir(D1, vide=True) as page:
    sheetjs(page); importer(page, os.path.join(ICI, "export_reel_anonymise.xlsx"), 2500); confirmer(page, 2500)
    with page.expect_download() as dl: page.evaluate("() => exporterInventaireCsv()")
    dl.value.save_as("/tmp/export_aller_retour.csv")
    src = {"cats": table(page, "CATEGORIES"), "lieux": table(page, "LIEUX_STOCKAGE"), "mat": table(page, "MATERIELS"), "ctl": table(page, "CONTROLES")}
lignes = list(csv.DictReader(io.StringIO(open("/tmp/export_aller_retour.csv", encoding="utf-8-sig").read()), delimiter=";"))
D2, _, _ = doc(vide=True)
D2["CATEGORIES"]["lignes"] = [dict(c) for c in src["cats"]]; D2["LIEUX_STOCKAGE"]["lignes"] = [dict(l) for l in src["lieux"]]
with ouvrir(D2, vide=True) as page:
    importer(page, "/tmp/export_aller_retour.csv", 1500); z = zone(page)
    R.verifier("pret a importer" in z and "erreur" not in z.split("pret a importer")[0] and "colonnes non reconnues" not in z, "export reimporte : aucune erreur, aucune colonne non reconnue : %r" % z[:110])
    confirmer(page, 2000)
    M = {m["numero_marquage"]: m for m in table(page, "MATERIELS")}; sm = {m["numero_marquage"]: m for m in src["mat"]}
    R.verifier(len(M) == len(sm) == len(lignes), "%d exemplaires reimportes sur %d" % (len(M), len(lignes)))
    ecarts = {c: 0 for c in ["numero_serie", "couleur", "taille", "commentaire", "date_mise_en_service", "hors_service_motif", "hors_service_date"]}
    for k, m in M.items():
        for c in ecarts:
            if (m.get(c) or None) != (sm[k].get(c) or None): ecarts[c] += 1
    R.verifier(not any(ecarts.values()), "aucun ecart exemplaire par exemplaire, DATES DE SORTIE COMPRISES : %s" % {k: v for k, v in ecarts.items() if v})
    sorties = [k for k, m in sm.items() if m.get("hors_service_date")]
    R.verifier(len(sorties) > 0 and all(M[k]["hors_service_date"] == sm[k]["hors_service_date"] for k in sorties), "les %d dates de sortie sont conservees" % len(sorties))
    # derniers controles
    dern = {}
    for c in src["ctl"]:
        if c["materiel"] not in dern or c["date_controle"] > dern[c["materiel"]]: dern[c["materiel"]] = c["date_controle"]
    idm = {m["numero_marquage"]: m["id"] for m in src["mat"]}
    attendu = {k: dern[idm[k]] for k in idm if idm[k] in dern}
    Ct = {}
    idt = {m["numero_marquage"]: m["id"] for m in table(page, "MATERIELS")}
    for c in table(page, "CONTROLES"): Ct.setdefault(c["materiel"], []).append(c["date_controle"])
    obtenu = {k: Ct[idt[k]][0] for k in idt if idt[k] in Ct}
    R.verifier(obtenu == attendu and all(len(v) == 1 for v in Ct.values()), "dernier controle recree pour chacun des %d exemplaires qui en avaient un (une seule ligne chacun)" % len(attendu))
    R.verifier(not page.erreurs, "aller-retour : aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
