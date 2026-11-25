"""Gestes reutilisables sur la page de test."""
ESPION_TOASTS = """() => {
  window.__TOASTS__ = [];
  var orig = window.flashToast;
  window.flashToast = function (t) { window.__TOASTS__.push(t); orig(t); };
}"""

def espionner_toasts(page):
    page.evaluate(ESPION_TOASTS)

def toasts(page):
    return page.evaluate("window.__TOASTS__ || []")

def ouvrir_fiche(page, mat_id):
    page.evaluate("id => { document.querySelector('.tab[data-t=\"materiel\"]').click(); ouvrirFicheExemplaire(id); }", mat_id)
    page.wait_for_timeout(100)

def fiche_imprimable(page, mat_id):
    return page.evaluate("id => corpsFicheMateriel(id)", mat_id)

def fiche_lot(page, lot_id):
    page.evaluate("() => { window.__DOCS__.length = 0; }")
    page.evaluate("id => ficheDeVieLot(id)", lot_id)
    page.wait_for_timeout(150)
    docs = page.evaluate("window.__DOCS__")
    return docs[-1] if docs else ""

def texte(html):
    import re
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))

def sa(t):
    """Texte sans accents ni casse : les tests ne dependent pas de la passe d'accents (2026.5.4)."""
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD', t) if unicodedata.category(c) != 'Mn').lower()
