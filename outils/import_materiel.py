import re
p='/home/claude/v2/widget_pilotage.js'; s=open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n, (s.count(a), a[:100]); s=s.replace(a,b)
def rep_re(pat, fn, n=1):
    global s
    s2, k = re.subn(pat, fn, s, flags=re.S)
    assert k==n, (k, pat[:90]); s=s2
rep("var VERSION_EPILOG = '2026.5.28';","var VERSION_EPILOG = '2026.5.29';")
# 1. module : avant le bloc navigation
rep("/* ------------------------- navigation (2026.5.17) -------------------------",
    open('/home/claude/outils/import_materiel.js',encoding='utf-8').read() + "/* ------------------------- navigation (2026.5.17) -------------------------")
# 2. bouton + panneau + branchement
rep("""      '<button class="secondary" id="btnExportInv">Inventaire imprimable</button>' +
      '<span id="lotFlash" class="form-msg"></span>' +
    '</div>' +
""","""      '<button class="secondary" id="btnExportInv">Inventaire imprimable</button>' +
      '<button class="secondary" id="btnImport">Importer un inventaire\\u2026</button>' +
      '<span id="lotFlash" class="form-msg"></span>' +
    '</div>' +
    '<div id="importPanel"></div>' +
""")
rep("""  document.getElementById('btnExportInv').onclick = exporterInventaireImprimable;
""","""  document.getElementById('btnExportInv').onclick = exporterInventaireImprimable;
  document.getElementById('btnImport').onclick = impBasculerPanneau;
""")
# 3. export : date de fabrication et duree de vie du lot dans l'Inventaire (Excel et CSV)
rep("""      id: m.id, nbPhotos: aColonne('materiels', 'photo') ? (idsPiecesJointes(m.photo).length || '') : '',""",
"""      id: m.id, nbPhotos: aColonne('materiels', 'photo') ? (idsPiecesJointes(m.photo).length || '') : '',
      dateFab: lot.date_fabrication ? fmtDate(lot.date_fabrication) : '', dureeLot: lot.duree_vie_mois || '',""")
rep("""'Couleur', 'Taille ou longueur', 'Lot', 'Categorie', 'Fabricant', 'Modele', 'Lieu', 'Mise en service',""",
    """'Couleur', 'Taille ou longueur', 'Lot', 'Categorie', 'Fabricant', 'Modele', 'Date de fabrication', 'Duree de vie (mois)', 'Lieu', 'Mise en service',""")
rep("""r.couleur, r.taille, r.lot, r.categorie, r.fabricant, r.modele, r.lieu, r.miseEnService,""",
    """r.couleur, r.taille, r.lot, r.categorie, r.fabricant, r.modele, r.dateFab, r.dureeLot, r.lieu, r.miseEnService,""")
rep_re(r"'Mod\\u00e8le', 'Lieu', 'Mise en service'", lambda m: r"'Mod\u00e8le', 'Date de fabrication', 'Dur\u00e9e de vie (mois)', 'Lieu', 'Mise en service'")
rep_re(r"lot\.fabricant \|\| '', lot\.modele \|\| '',\s*valeurLisible\('lieu_stockage', m\.lieu_stockage\)",
       lambda m: "lot.fabricant || '', lot.modele || '', lot.date_fabrication ? fmtDate(lot.date_fabrication) : '', lot.duree_vie_mois || '',\n        valeurLisible('lieu_stockage', m.lieu_stockage)")
# 4. une commande sans reference n'apparait plus comme « #8 » (identifiant interne introuvable par nom)
rep("""    return cible ? String(cible[ref[1]] || '#' + v) : '#' + v;""","""    if (!cible) return '#' + v;
    if (cible[ref[1]]) return String(cible[ref[1]]);
    return ref[0] === 'achats' ? 'Commande sans r\\u00e9f\\u00e9rence (#' + v + ')' : '#' + v;""")
open(p,'w',encoding='utf-8').write(s)

# ---------- aide ----------
h=open('/home/claude/v2/widget_pilotage.html',encoding='utf-8').read()
i=h.index('<section class="aide-sec" id="sec-sauvegarde">'); j=h.index('</section>', i)+len('</section>')
h=h[:j]+"""

        <section class="aide-sec" id="sec-import">
          <h3>Importer un inventaire existant</h3>
          <p>Pour passer d'un tableur à EPILOG sans tout ressaisir : rubrique Matériel →
             « Importer un inventaire… ». Téléchargez d'abord le <b>modèle</b> (un classeur Excel : mode
             d'emploi, Inventaire, Catégories, Lots, Lieux de stockage, Contrôles, Listes), collez-y votre
             inventaire — une ligne par exemplaire, en « collage spécial → valeurs » — puis importez-le.</p>
          <p><b>Obligatoire</b> : le marquage (ou une quantité, EPILOG numérote alors lui-même) et la
             catégorie ; pour le matériel soumis au vieillissement, la <b>date de fabrication</b> (ou
             l'année), qui fonde la fin de vie. Fabricant, modèle, lieu et numéro de série sont fortement
             recommandés ; tout le reste est facultatif.</p>
          <p>Avant toute écriture, un <b>aperçu</b> chiffre ce qui sera créé, et un <b>rapport à imprimer</b>
             (PDF) liste ce qui reste à faire à la main : numéros à étiqueter, données à compléter, photos
             et factures non reprises… Au moindre doute — marquage en double, catégorie inconnue, date
             illisible —, <b>rien n'est écrit</b> et l'erreur est localisée par feuille et numéro de ligne.
             L'import ne fait qu'<b>ajouter</b> : il ne modifie jamais un exemplaire existant.</p>
          <p>Les lots sont constitués automatiquement (même catégorie, fabricant, modèle et année de
             fabrication). Un export complet d'EPILOG (Excel) peut lui-même être importé : les feuilles et
             colonnes qui ne sont pas reprises sont simplement ignorées.</p>
        </section>"""+h[j:]
mn=re.search(r'<button type="button" class="aide-nav-item" data-sec="sauvegarde">.*?</button>', h, flags=re.S)
assert mn, "nav sauvegarde"
h=h[:mn.end()]+"""
        <button type="button" class="aide-nav-item" data-sec="import">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M5 3h14"/></svg>
          <span class="aide-nav-label">Importer un inventaire</span></button>"""+h[mn.end():]
open('/home/claude/v2/widget_pilotage.html','w',encoding='utf-8').write(h)
print("ecrit")
