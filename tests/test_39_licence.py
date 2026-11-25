"""2026.5.36 : passage sous licence EUPL 1.2 (documentation : CC BY-SA 4.0). Les mentions d'origine
sont presentes et exactes partout ou l'outil les affiche ; plus aucune trace de l'ancienne licence
NC, ni d'image chargee depuis creativecommons.org."""
import sys, os, re; from harnais import ouvrir, Resultats, SRC; from donnees import construire
from outils_page import *
R = Resultats()
js = open(os.path.join(SRC, "widget_pilotage.js"), encoding="utf-8").read()
html = open(os.path.join(SRC, "widget_pilotage.html"), encoding="utf-8").read()
R.verifier("SPDX-License-Identifier: EUPL-1.2" in js[:600] and "Licensed under the EUPL" in js[:600], "en-tete du JS : copyright puis « Licensed under the EUPL » et identifiant SPDX")
R.verifier(js[:600].index("Pierre Travers") < js[:600].index("Licensed under the EUPL"), "en-tete du JS : la mention de licence suit le copyright (exigence de l'EUPL)")
R.verifier("EUPL-1.2" in html[:400], "en-tete du HTML : identifiant SPDX")
for nom, txt in (("JS", js), ("HTML", html)):
    R.verifier(not re.search(r"BY-NC|NC-SA|NC-BY|Pas d.Utilisation Commerciale", txt), "%s : plus aucune mention de l'ancienne licence" % nom)
R.verifier("i.creativecommons.org" not in html, "plus d'image chargee depuis creativecommons.org")
D, ids_mat, ids_lot = construire()
with ouvrir(D) as page:
    ap = sa(page.evaluate("document.querySelector('.apropos-licence').textContent"))
    R.verifier("eupl 1.2" in ap and "cc by-sa 4.0" in ap and "meme licence" in ap, "rubrique « A propos » : EUPL 1.2, documentation CC BY-SA, condition de partage : %r" % ap[:120])
    lien = page.evaluate("document.querySelector('.apropos-licence a').href")
    R.verifier("eupl_v1.2_fr.pdf" in lien, "rubrique « A propos » : lien vers le texte officiel francais")
    pied = sa(page.evaluate("piedEpilog()"))
    R.verifier("licence eupl 1.2" in pied and "pierre travers" in pied, "pied des documents imprimes : auteur et licence : %r" % re.sub(r"<[^>]+>", "", pied)[-80:])
    page.evaluate("() => { window.__DOCS__.length = 0; imprimerAide(); }"); page.wait_for_timeout(300)
    aide = sa(page.evaluate("window.__DOCS__")[-1])
    R.verifier("eupl 1.2" in aide and "by-nc" not in aide, "aide imprimee : licence EUPL, pas de NC")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
