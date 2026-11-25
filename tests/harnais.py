"""Harnais Playwright pour EPILOG.
Usage : from harnais import ouvrir ; with ouvrir(D) as page: ...
Le widget est charge SANS grist-plugin-api.js : mock_grist.js le remplace."""
import json, os, re, contextlib
from playwright.sync_api import sync_playwright

ICI = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get("EPILOG_SRC", os.path.join(ICI, "..", "src"))
# bibliotheques Excel (SheetJS, ExcelJS) servies localement aux tests : voir tests/README.md
VENDOR = os.environ.get("EPILOG_VENDOR", os.path.join(ICI, "..", "vendor"))

def page_html(donnees):
    html = open(os.path.join(SRC, "widget_pilotage.html"), encoding="utf-8").read()
    html = re.sub(r'<script src="https://docs\.getgrist\.com/grist-plugin-api\.js"></script>', "", html)
    js = open(os.path.join(SRC, "widget_pilotage.js"), encoding="utf-8").read()
    mock = open(os.path.join(ICI, "mock_grist.js"), encoding="utf-8").read()
    injection = ("<script>window.__DONNEES_TEST__ = " + json.dumps(donnees) + ";</script>"
                 "<script>" + mock + "</script><script>" + js + "</script>")
    return html.replace("</body>", injection + "</body>") if "</body>" in html else html + injection

@contextlib.contextmanager
def ouvrir(donnees, vide=False, sans_structure=False):
    with sync_playwright() as p:
        nav = p.chromium.launch()
        page = nav.new_page(viewport={"width": 1300, "height": 900})
        erreurs = []
        page.on("pageerror", lambda e: erreurs.append(str(e)))
        chemin = os.path.join("/tmp", "epilog_test.html")
        open(chemin, "w", encoding="utf-8").write(page_html(donnees))
        page.goto("file://" + chemin)
        if sans_structure:   # document sans AUCUNE table : le premier chargement signale les tables manquantes
            page.wait_for_function("window.missingTables && missingTables.length > 0")
        elif vide:   # document sans aucune ligne : on attend la fin du premier chargement
            page.wait_for_function("window.resolvedNames && resolvedNames.materiels && window.rawRows && Array.isArray(rawRows.materiels)")
        else:
            page.wait_for_function("window.rawRows && rawRows.materiels && rawRows.materiels.length > 0")
        page.wait_for_timeout(200)
        page.erreurs = erreurs
        yield page
        nav.close()

def table(page, nom):
    return page.evaluate("n => window.__DONNEES_TEST__[n].lignes", nom)

def recharger(page):
    page.evaluate("load()")
    page.wait_for_timeout(150)

class Resultats:
    def __init__(self): self.ok = 0; self.ko = []
    def verifier(self, cond, libelle):
        if cond: self.ok += 1; print("  ok   " + libelle)
        else: self.ko.append(libelle); print("  ECHEC " + libelle)
    def bilan(self):
        print("\n%d verifications reussies, %d echec(s)" % (self.ok, len(self.ko)))
        for k in self.ko: print("  - " + k)
        return 0 if not self.ko else 1
