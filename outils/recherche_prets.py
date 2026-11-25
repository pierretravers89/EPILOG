import re
p='/home/claude/v2/widget_pilotage.js'; s=open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n, (s.count(a), a[:100]); s=s.replace(a,b)
def rep_re(pat, fn, n=1):
    global s
    s2, k = re.subn(pat, fn, s, flags=re.S)
    assert k==n, (k, pat[:80]); s=s2
rep("var VERSION_EPILOG = '2026.5.27';","var VERSION_EPILOG = '2026.5.28';")

# 1. outils de recherche tolerante, avant renderBonsEnCours
rep("function renderBonsEnCours(prets, totalParBon) {", r"""/* Recherche tolerante (2026.5.28) : sans accents ni majuscules ; plusieurs mots = tous doivent se
   retrouver (« guillaume falaise »). Sert a la recherche des prets et a celle de l'onglet Materiel. */
function normRecherche(t) {
  return String(t === null || t === undefined ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}
function correspondRecherche(q, cible) {
  var mots = normRecherche(q).split(' ').filter(Boolean);
  if (!mots.length) return true;
  var c = normRecherche(cible);
  return mots.every(function (m) { return c.indexOf(m) !== -1; });
}
/* ce qu'on peut chercher dans un bon : numero, personne, sortie, marquages */
function rechercheDeBon(cle, items) {
  return [String(cle).replace(/^term:/, ''), items[0].adherent, items[0].sortie,
    items.map(function (e) { return e.materiel; }).join(' ')].join(' ');
}
var rechercheBons = '';   /* saisie conservee d'un rafraichissement a l'autre */
function appliquerRechercheBons() {
  var champ = document.getElementById('filtreBon');
  var q = champ ? champ.value : '';
  rechercheBons = q;
  var nEn = 0, nTe = 0;
  var bons = document.querySelectorAll('#prets-list .bon');
  if (bons.length) {
    bons.forEach(function (bl) {
      var ok = correspondRecherche(q, bl.dataset.recherche || bl.dataset.bon || '');
      bl.style.display = ok ? '' : 'none';
      if (ok) { if (bl.classList.contains('bon-termine')) nTe++; else nEn++; }
    });
  } else {
    /* documents sans numero de bon : listes en tableaux, on filtre les lignes */
    document.querySelectorAll('#prets-list tr').forEach(function (tr) {
      if (!tr.querySelector('td')) return;
      var ok = correspondRecherche(q, tr.textContent);
      tr.style.display = ok ? '' : 'none';
      if (ok) nEn++;
    });
  }
  var c = document.getElementById('filtreBonCompte');
  if (c) {
    c.textContent = !q.trim() ? '' : (bons.length
      ? nEn + ' bon' + (nEn > 1 ? 's' : '') + ' en cours \u00b7 ' + nTe + ' bon' + (nTe > 1 ? 's' : '') + ' termin\u00e9' + (nTe > 1 ? 's' : '') + ' correspondent'
      : nEn + ' ligne' + (nEn > 1 ? 's' : '') + ' correspondent');
  }
}

function renderBonsEnCours(prets, totalParBon) {""")
# 2. le champ n'est plus dans la section "en cours" : il passe au-dessus des deux listes
rep_re(r"  return '<div style=\"max-width:240px;margin:2px 0 10px\">' \+\s*'<input id=\"filtreBon\" type=\"text\" placeholder=\"Filtrer par n\\u00b0 de bon\.\.\.\">' \+\s*'</div>' \+ ordre\.map\(",
       lambda m: "  return ordre.map(")
rep_re(r"    '<h2 class=\"section-titre\" style=\"margin-top:16px\">' \+\s*\(vuePrets === 'retard' \? 'Prets en cours",
       lambda m: """    /* recherche (2026.5.28) : au-dessus des DEUX listes, visible meme sans pret en cours */
    ((pretsEnCours.length || pretsTermines.length)
      ? '<div style="max-width:480px;margin:14px 0 0"><input id="filtreBon" type="search" value="' + esc(rechercheBons) + '" ' +
          'placeholder="Rechercher un pr\\u00eat : personne, n\\u00b0 de bon, sortie, marquage..."></div>' +
        '<p class="hint" id="filtreBonCompte" style="margin:4px 0 0;min-height:16px"></p>'
      : '') +
""" + m.group(0))
# 3. donnees de recherche portees par chaque bon
rep("""'" data-bon="' + esc(cle) + '">' +
      '<div class="bon-tete">' +""","""'" data-bon="' + esc(cle) + '" data-recherche="' + esc(normRecherche(rechercheDeBon(cle, items))) + '">' +
      '<div class="bon-tete">' +""")
rep("""'" data-bon="' + esc(key) + '">' +
      '<div class="bon-tete">' +""","""'" data-bon="' + esc(key) + '" data-recherche="' + esc(normRecherche(rechercheDeBon(key, items))) + '">' +
      '<div class="bon-tete">' +""")
# 4. branchement
rep_re(r"  var filtreBon = document\.getElementById\('filtreBon'\);\s*if \(filtreBon\) filtreBon\.oninput = function \(\) \{.*?\n  \};\n",
       lambda m: """  var filtreBon = document.getElementById('filtreBon');
  if (filtreBon) { filtreBon.oninput = appliquerRechercheBons; appliquerRechercheBons(); }
""")
# 5. Materiel : recherche tolerante + emprunteur actuel
rep("""    m._statut = d.statut;
    m._raison = d.raison;""","""    m._statut = d.statut;
    m._raison = d.raison;
    /* personne qui a l'exemplaire en ce moment (recherche de l'onglet Materiel, 2026.5.28) */
    var poE = ctx.pretOuvert[m.id];
    m._emprunteur = poE ? (ctx.adhMap[poE.adherent] || '') : '';""")
rep("""      var q = filtresMat.q.toLowerCase();
      var cible = (m.numero_marquage || '') + ' ' + (m.numero_serie || '') + ' ' +
        (lot ? lot.designation + ' ' + (lot.fabricant || '') + ' ' + (lot.modele || '') : '');
      if (cible.toLowerCase().indexOf(q) === -1) return false;""","""      var cible = (m.numero_marquage || '') + ' ' + (m.numero_serie || '') + ' ' +
        (lot ? lot.designation + ' ' + (lot.fabricant || '') + ' ' + (lot.modele || '') : '') + ' ' + (m._emprunteur || '');
      if (!correspondRecherche(filtresMat.q, cible)) return false;""")
rep("""'<input type="text" id="fmQ" placeholder="Marquage, lot, fabricant...">'""","""'<input type="text" id="fmQ" placeholder="Marquage, lot, fabricant, personne...">'""")
open(p,'w',encoding='utf-8').write(s)

# ---------- aide ----------
h=open('/home/claude/v2/widget_pilotage.html',encoding='utf-8').read()
i=h.index('id="sec-prets"'); j=h.index('</section>', i)
h=h[:j]+"""          <p><b>Retrouver un prêt.</b> Le champ « Rechercher un prêt », au-dessus des listes, cherche
             dans les prêts en cours <b>et</b> terminés : tapez le nom d'une personne, un numéro de
             bon, une sortie ou un marquage (accents et majuscules sans importance ; plusieurs mots se
             cumulent, par exemple « guillaume falaise »). Un compteur indique combien de bons
             correspondent. Dans <b>Matériel</b>, le champ Rechercher retrouve aussi un exemplaire par
             le nom de la personne qui l'a empruntée en ce moment.</p>
        """+h[j:]
open('/home/claude/v2/widget_pilotage.html','w',encoding='utf-8').write(h)
print("ecrit")
