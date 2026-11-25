"""2026.5.25 : details des exemplaires (n° de serie, couleur, taille ou
longueur, commentaire) dans l'inventaire imprime, la fiche du lot, le
registre, le CSV et l'Excel. Colonnes ajoutees seulement si au moins un
exemplaire du lot les renseigne ; 'Longueur' pour les categories
decoupables ; valeurs echappees."""
import sys, re; from harnais import ouvrir, Resultats, table; from donnees import construire
from outils_page import *
R = Resultats()
D, ids_mat, ids_lot = construire()
D["MATERIELS"]["colonnes"].append("numero_serie")
for m in D["MATERIELS"]["lignes"]:
    n = m["numero_marquage"]
    if n == "CAS-001": m.update(couleur="Rouge", taille="M", numero_serie="21A0345")
    if n == "CAS-002": m.update(commentaire="Casque du stage jeunes")
    if n == "COR-001-A": m.update(taille="35 m", commentaire="Decoupe de COR-001 <b>test</b>")
def entetes(html, titre):
    """cellules <th> du premier tableau place apres le <h2> `titre`"""
    i = html.index("<h2>" + titre + "</h2>"); j = html.index("<table>", i); k = html.index("</tr>", j)
    return [sa(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<th[^>]*>(.*?)</th>", html[j:k], flags=re.S)]
def lignes(html, titre):
    i = html.index("<h2>" + titre + "</h2>"); j = html.index("<table>", i); k = html.index("</table>", j)
    return [[re.sub(r"<[^>]+>", "", c) for c in re.findall(r"<td[^>]*>(.*?)</td>", r, flags=re.S)] for r in re.findall(r"<tr>(.*?)</tr>", html[j:k], flags=re.S)[1:]]
BASE = ["marquage", "lieu", "statut", "dernier controle", "observations"]
with ouvrir(D) as page:
    page.evaluate("() => document.querySelector('.tab[data-t=\"materiel\"]').click()"); page.wait_for_timeout(200)
    # ------------ inventaire imprimable
    page.evaluate("() => { window.__DOCS__.length = 0; exporterInventaireImprimable(); }"); page.wait_for_timeout(300)
    inv = page.evaluate("window.__DOCS__")[-1]
    R.verifier(entetes(inv, "Casques Boreo") == ["marquage", "n° de serie", "couleur", "taille", "lieu", "statut", "dernier controle", "observations", "commentaire"],
               "inventaire, casques : colonnes de detail dans l'ordre : %s" % entetes(inv, "Casques Boreo"))
    ec = entetes(inv, "Cordes 70 m")
    R.verifier("longueur" in ec and "taille" not in ec and "commentaire" in ec and "couleur" not in ec and "n° de serie" not in ec,
               "inventaire, cordes : 'Longueur', et seulement les colonnes renseignees : %s" % ec)
    R.verifier(entetes(inv, "Mousquetons") == BASE, "inventaire, mousquetons : tableau habituel, sans colonne vide : %s" % entetes(inv, "Mousquetons"))
    ligne = [l for l in lignes(inv, "Casques Boreo") if l[0] == "CAS-001"][0]
    R.verifier(ligne[1:4] == ["21A0345", "Rouge", "M"], "inventaire : valeurs sur la bonne ligne : %s" % ligne[:4])
    R.verifier("Casque du stage jeunes" in inv and "&lt;b&gt;test&lt;/b&gt;" in inv and "<b>test</b>" not in inv, "inventaire : commentaires presents et echappes")
    # ------------ fiche du lot
    page.evaluate("() => { window.__DOCS__.length = 0; }")
    page.evaluate("id => ficheDeVieLot(id)", ids_lot["Casques Boreo"]); page.wait_for_timeout(400)
    fl = page.evaluate("window.__DOCS__")[-1]
    # le tableau des exemplaires : celui dont le premier en-tete est "Marquage"
    m = re.search(r"<table><tr><th[^>]*>Marquage</th>.*?</table>", fl, flags=re.S)
    th = [sa(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<th[^>]*>(.*?)</th>", m.group(0).split("</tr>")[0], flags=re.S)]
    R.verifier(th[:4] == ["marquage", "n° de serie", "couleur", "taille"] and th[-1] == "commentaire" and "prochain controle" in th,
               "fiche du lot : colonnes de detail autour des colonnes habituelles : %s" % th)
    R.verifier("Casque du stage jeunes" in fl and "Rouge" in fl, "fiche du lot : valeurs presentes")
    page.evaluate("() => { window.__DOCS__.length = 0; }")
    page.evaluate("id => ficheDeVieLot(id)", ids_lot["Cordes 70 m"]); page.wait_for_timeout(400)
    fc = page.evaluate("window.__DOCS__")[-1]
    R.verifier("<th>Longueur</th>" in fc and "<th>Taille</th>" not in fc and "35 m" in fc, "fiche du lot, cordes : colonne 'Longueur' et valeur '35 m'")
    page.evaluate("() => { window.__DOCS__.length = 0; }")
    page.evaluate("id => ficheDeVieLot(id)", ids_lot["Mousquetons"]); page.wait_for_timeout(400)
    fm = page.evaluate("window.__DOCS__")[-1]
    R.verifier("<th>Couleur</th>" not in fm and "<th>Commentaire</th>" not in fm and "<th>Longueur</th>" not in fm, "fiche du lot, mousquetons : aucune colonne ajoutee")
    # ------------ fiche de vie d'un exemplaire / registre
    h2 = texte(fiche_imprimable(page, ids_mat["CAS-002"]))
    R.verifier("Commentaire Casque du stage jeunes" in h2, "fiche de vie : ligne Commentaire")
    h1 = texte(fiche_imprimable(page, ids_mat["CAS-001"]))
    R.verifier("Commentaire Casque" not in h1 and "Couleur Rouge" in h1 and "Taille M" in h1, "fiche de vie : pas de ligne vide ; couleur et taille toujours la")
    page.evaluate("() => { window.__DOCS__.length = 0; }")
    page.evaluate("id => exporterRegistreLot(id)", ids_lot["Casques Boreo"]); page.wait_for_timeout(600)
    reg = page.evaluate("window.__DOCS__")[-1]
    R.verifier("Casque du stage jeunes" in reg, "registre du lot : commentaire de l'exemplaire present")
    # ------------ Excel et CSV
    inv_x = [f for f in page.evaluate("donneesLisibles()") if f["nom"] == "Inventaire"][0]
    en = inv_x["entetes"]
    R.verifier(en[:4] == ["Marquage", "Numéro de série", "Couleur", "Taille ou longueur"] and en[-2:] == ["Commentaire", "Photos"], "Excel : colonnes ajoutees : %s" % en[:5])
    rx = [r for r in inv_x["lignes"] if r[0] == "CAS-001"][0]
    R.verifier(rx[2] == "Rouge" and rx[3] == "M", "Excel : valeurs de CAS-001")
    with page.expect_download() as dl:
        page.evaluate("() => exporterInventaireCsv()")
    dl.value.save_as("/tmp/inv_test.csv")
    csv = open("/tmp/inv_test.csv", encoding="utf-8-sig").read().splitlines()
    R.verifier(csv[0].startswith("Marquage;") or csv[0].startswith("Marquage,"), "CSV : en-tete")
    sep = ";" if csv[0].startswith("Marquage;") else ","
    cols = csv[0].split(sep)
    R.verifier(cols[2:4] == ["Couleur", "Taille ou longueur"] and cols[-2:] == ["Commentaire", "Photos"], "CSV : colonnes ajoutees : %s" % cols[:5])
    R.verifier(any(l.startswith("CAS-001" + sep) and "Rouge" in l for l in csv), "CSV : valeurs de CAS-001")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
