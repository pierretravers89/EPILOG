"""2026.5.27 : verification et creation de la structure du document.
- document existant : ce qui est NOUVEAU depuis sa derniere mise a jour est cree seul ;
  ce qui est ancien et manquant ne l'est jamais sans demande ;
- document vide : proposition d'installation complete (ordre des tables, colonnes auto-referencees) ;
- droits insuffisants : message, aucun blocage, une seule tentative ;
- le SCHEMA correspond a la structure reelle du document du club."""
import sys, json, os; from harnais import ouvrir, Resultats, table; from donnees import construire
from outils_page import *
R = Resultats()
ICI = os.path.dirname(os.path.abspath(__file__))
def colonnes(page, t): return page.evaluate("t => (window.__DONNEES_TEST__[t] || {colonnes: null}).colonnes", t)
def ajouts(page): return page.evaluate("window.__ACTIONS__.filter(a => a[0] === 'AddColumn' || a[0] === 'AddTable')")
def cfg(page):
    """reglages de CONFIG, que les colonnes s'appellent cle/valeur (documents existants) ou Cle/Valeur (structure installee)"""
    return {(r.get("cle") or r.get("Cle")): (r.get("valeur") or r.get("Valeur")) for r in table(page, "CONFIG")}

# ---------- 0. parite SCHEMA / structure reelle du document du club
reel = json.load(open(os.path.join(ICI, "schema_reel.json")))
D, ids_mat, ids_lot = construire()
with ouvrir(D) as page:
    S = page.evaluate("SCHEMA.map(d => ({cle: d.cle, nom: d.noms[0], cols: d.cols.map(c => [c.id, c.type, c.depuis])}))")
    noms = {d["cle"]: d["nom"] for d in S}
    def type_reel(t):
        return "Ref:" + noms[t[4:]] if t.startswith("Ref:") else t
    ecarts = []
    for d in S:
        attendu = reel.get(d["nom"])
        if attendu is None: ecarts.append("table absente du relevé : " + d["nom"]); continue
        declare = {c[0]: type_reel(c[1]) for c in d["cols"] if c[2] == "0"}     # elements anterieurs a ce systeme
        if declare != attendu: ecarts.append("%s : %s" % (d["nom"], {k: (declare.get(k), attendu.get(k)) for k in set(declare) | set(attendu) if declare.get(k) != attendu.get(k)}))
    R.verifier(not ecarts and set(reel) - {"_source"} == {d["nom"] for d in S}, "SCHEMA = structure reelle du document du club %s" % (ecarts or ""))
    R.verifier(any(c[0] == "photo" and c[2] == "2026.5.27" for d in S if d["cle"] == "materiels" for c in d["cols"]), "MATERIELS.photo declaree comme nouveaute de 2026.5.27")

# ---------- 1. document existant, sans marque : la nouveaute est creee, pas le reste
D, ids_mat, ids_lot = construire()                    # pas de DEMANDES (module facultatif ancien), pas de photo sur MATERIELS
assert "photo" not in D["MATERIELS"]["colonnes"] and "DEMANDES" not in D
with ouvrir(D) as page:
    page.wait_for_timeout(500)
    R.verifier("photo" in colonnes(page, "MATERIELS"), "nouveaute : MATERIELS.photo creee automatiquement")
    aj = ajouts(page)
    R.verifier(len(aj) == 1 and aj[0][0] == "AddColumn" and aj[0][1] == "MATERIELS" and aj[0][2] == "photo" and aj[0][3]["type"] == "Attachments" and aj[0][3]["isFormula"] is False,
               "une seule action : AddColumn MATERIELS.photo (Attachments) : %s" % aj)
    R.verifier(colonnes(page, "DEMANDES") is None, "ancien module facultatif absent (DEMANDES) : PAS cree sans demande")
    R.verifier(cfg(page).get("structure_version") == "2026.5.27", "marque de structure ecrite dans CONFIG : %s" % cfg(page).get("structure_version"))
    R.verifier(page.evaluate("aColonne('materiels', 'photo')"), "l'outil voit la nouvelle colonne apres rechargement")
    R.verifier(page.evaluate("rawRows.materiels.length") == 6, "l'application fonctionne normalement (6 exemplaires)")
    # panneau Reglages : DEMANDES propose, jamais impose
    page.evaluate("ouvrirReglages()"); page.wait_for_timeout(200)
    page.click('#reglages-so [data-se="fonctionnement"]'); page.wait_for_timeout(200)
    z = sa(page.inner_text("#structureZone"))
    R.verifier("demandes" in z and "jamais cree sans votre demande" in z and "version 2026.5.27" in z, "panneau Structure : DEMANDES listee comme facultative : %r" % z[:260])
    page.once("dialog", lambda d: d.accept())
    page.click("#btnCompleterStructure"); page.wait_for_timeout(700)
    R.verifier(colonnes(page, "DEMANDES") == ["demandeur", "besoin", "date_emprunt", "date_retour_prevue", "sortie_activite", "traitee"], "sur demande : table DEMANDES creee avec ses colonnes")
    R.verifier("complete" in sa(page.inner_text("#structureZone")) or "tous les elements" in sa(page.inner_text("#structureZone")), "panneau : structure complete")
    page.evaluate("lancerDiagnostic()"); page.wait_for_timeout(300)
    diag = page.evaluate("document.getElementById('diagSortie').textContent")
    R.verifier("STRUCTURE DU DOCUMENT" in diag and "marque de structure : 2026.5.27" in diag, "diagnostic : section structure")
    R.verifier(not page.erreurs, "doc existant : aucune erreur JS %s" % page.erreurs)

# ---------- 2. marque deja a jour : une colonne retiree volontairement n'est pas recreee
D, ids_mat, ids_lot = construire()
D["CONFIG"]["lignes"].append({"id": 1, "cle": "structure_version", "valeur": "2026.5.27"})
with ouvrir(D) as page:
    page.wait_for_timeout(500)
    R.verifier("photo" not in colonnes(page, "MATERIELS") and ajouts(page) == [], "marque a jour : colonne absente NON recreee, aucune action")
    page.evaluate("ouvrirReglages()"); page.wait_for_timeout(200)
    page.click('#reglages-so [data-se="fonctionnement"]'); page.wait_for_timeout(200)
    R.verifier("materiels.photo" in sa(page.inner_text("#structureZone")), "panneau : MATERIELS.photo listee")
    page.once("dialog", lambda d: d.accept())
    page.click("#btnCompleterStructure"); page.wait_for_timeout(700)
    R.verifier("photo" in colonnes(page, "MATERIELS"), "sur demande : colonne creee")

# ---------- 3. document sans table CONFIG : nouveaute creee, bouton pour CONFIG
D, ids_mat, ids_lot = construire()
del D["CONFIG"]
with ouvrir(D) as page:
    page.wait_for_timeout(500)
    R.verifier("photo" in colonnes(page, "MATERIELS"), "sans CONFIG : la nouveaute est quand meme creee")
    page.evaluate("ouvrirReglages()"); page.wait_for_timeout(200)
    R.verifier(page.is_visible("#btnCreerConfig"), "sans CONFIG : bouton 'Creer la table CONFIG'")
    page.click("#btnCreerConfig"); page.wait_for_timeout(900)
    R.verifier(colonnes(page, "CONFIG") == ["Cle", "Valeur"], "CONFIG creee (Cle, Valeur)")
    R.verifier("titre" in sa(page.inner_text("#reglagesCorps")), "le panneau des reglages s'ouvre ensuite normalement")
    R.verifier(not page.erreurs, "sans CONFIG : aucune erreur JS %s" % page.erreurs)

# ---------- 4. droits insuffisants : message, aucun blocage, une seule tentative
D, ids_mat, ids_lot = construire()
D["__interdit_schema__"] = True
with ouvrir(D) as page:
    page.wait_for_timeout(500)
    R.verifier(page.evaluate("rawRows.materiels.length") == 6, "droits refuses : l'application fonctionne quand meme")
    R.verifier("photo" not in colonnes(page, "MATERIELS") and cfg(page).get("structure_version") is None, "droits refuses : rien cree, marque non ecrite")
    page.evaluate("() => naviguer('apercu')"); page.wait_for_timeout(200)
    b = sa(page.inner_text("#pane-apercu"))
    R.verifier("structure de ce document" in b and "pas a jour" in b and "materiels.photo" in b and "proprietaire" in b, "droits refuses : bandeau explicite : %r" % b[:200])
    n1 = len(ajouts(page))
    page.evaluate("load()"); page.wait_for_timeout(400)
    R.verifier(len(ajouts(page)) == n1 == 1, "une seule tentative par chargement de page (%d)" % len(ajouts(page)))
    R.verifier(not page.erreurs, "droits refuses : aucune erreur JS %s" % page.erreurs)

# ---------- 5. document vide : installation complete
D = {}
with ouvrir(D, sans_structure=True) as page:
    page.evaluate("() => naviguer('apercu')"); page.wait_for_timeout(300)
    R.verifier(page.is_visible("#btnInstallerStructure") and "Table(s) introuvable(s)" not in page.inner_text("#pane-apercu"),
               "document vide : proposition d'installation (sans liste de tables introuvables)")
    R.verifier(ajouts(page) == [], "document vide : rien n'est cree sans clic")
    page.once("dialog", lambda d: d.accept())
    page.click("#btnInstallerStructure"); page.wait_for_timeout(1200)
    act = ajouts(page)
    tables = [a[1] for a in act if a[0] == "AddTable"]
    ordre = ["FOURNISSEURS", "CATEGORIES", "LIEUX_STOCKAGE", "ADHERENTS", "ACHATS", "LOTS", "MATERIELS", "CONTROLES", "EMPRUNTS", "INCIDENTS", "REPARATIONS", "ENTRETIENS", "DEMANDES", "CONFIG"]
    R.verifier(tables == ordre, "14 tables creees, references avant ce qui les utilise : %s" % tables)
    mat = [a for a in act if a[0] == "AddTable" and a[1] == "MATERIELS"][0]
    R.verifier("origine_decoupe" not in [c["id"] for c in mat[2]] and any(a[0] == "AddColumn" and a[1] == "MATERIELS" and a[2] == "origine_decoupe" and a[3]["type"] == "Ref:MATERIELS" for a in act),
               "colonne auto-referencee ajoutee apres la table")
    cat = [a for a in act if a[0] == "AddTable" and a[1] == "CATEGORIES"][0]
    te = [c for c in cat[2] if c["id"] == "type_epi"][0]
    R.verifier(te["type"] == "Choice" and "Soumis a vieillissement" in te["widgetOptions"], "listes de choix creees (type_epi)")
    lots = page.evaluate("window.__DONNEES_TEST__.LOTS.types")
    R.verifier(lots["categorie"] == "Ref:CATEGORIES" and lots["photo"] == "Attachments", "types des colonnes de LOTS")
    R.verifier("photo" in colonnes(page, "MATERIELS") and cfg(page).get("structure_version") == "2026.5.27", "MATERIELS.photo presente, marque ecrite")
    R.verifier(page.evaluate("missingTables.length") == 0 and not page.is_visible("#btnInstallerStructure"), "plus de table manquante, plus de bandeau")
    R.verifier(page.evaluate("Array.isArray(rawRows.materiels) && rawRows.materiels.length") == 0, "l'application charge le document installe (vide)")
    R.verifier(not page.erreurs, "installation : aucune erreur JS %s" % page.erreurs)
# document vide, droits refuses
D = {"__interdit_schema__": True}
with ouvrir(D, sans_structure=True) as page:
    page.evaluate("() => naviguer('apercu')"); page.wait_for_timeout(300)
    page.once("dialog", lambda d: d.accept())
    page.click("#btnInstallerStructure"); page.wait_for_timeout(900)
    R.verifier("modifier la structure" in sa(page.inner_text("#pane-apercu")) and page.is_visible("#btnInstallerStructure"), "installation refusee : message, bouton conserve")
    R.verifier(not page.erreurs, "installation refusee : aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
