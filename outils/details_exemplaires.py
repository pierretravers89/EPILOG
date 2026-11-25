import re
p='/home/claude/v2/widget_pilotage.js'; s=open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n, (s.count(a), a[:90]); s=s.replace(a,b)

# ---------- helper ----------
rep("function exporterInventaireImprimable() {", r"""/* Colonnes de detail des exemplaires dans les documents imprimes (2026.5.25,
   demande de Pierre : couleur, taille, commentaires...). Une colonne n'est
   ajoutee QUE si au moins un exemplaire du tableau la renseigne : un lot sans
   couleur ni taille garde son tableau habituel, sans colonne vide qui
   l'elargirait. `acces(item, cle)` lit la valeur ('serie' | 'couleur' |
   'taille' | 'commentaire') : l'inventaire manipule des lignes deja
   calculees, la fiche du lot des lignes brutes de MATERIELS. Le champ unique
   `taille` porte une LONGUEUR pour les categories decoupables (cordes,
   sangles), une taille sinon : meme libelle que les fiches. */
function colonnesDetail(items, acces, decoupable) {
  var defs = [
    { cle: 'serie', label: 'N\u00b0 de s\u00e9rie', fin: false },
    { cle: 'couleur', label: 'Couleur', fin: false },
    { cle: 'taille', label: decoupable ? 'Longueur' : 'Taille', fin: false },
    { cle: 'commentaire', label: 'Commentaire', fin: true }
  ];
  var det = defs.filter(function (d) {
    return items.some(function (it) { return String(acces(it, d.cle) || '').trim() !== ''; });
  });
  return {
    avant: det.filter(function (d) { return !d.fin; }),
    apres: det.filter(function (d) { return d.fin; }),
    th: function (liste) { return liste.map(function (d) { return '<th>' + esc(d.label) + '</th>'; }).join(''); },
    td: function (liste, it) {
      return liste.map(function (d) { return '<td>' + esc(String(acces(it, d.cle) || '')) + '</td>'; }).join('');
    },
    n: det.length
  };
}

function exporterInventaireImprimable() {""")

# ---------- objet inventaire ----------
rep("""      echu: m._controleEchu ? 'oui' : 'non',
      prix: lot.prix_unitaire || ''
    };""","""      echu: m._controleEchu ? 'oui' : 'non',
      prix: lot.prix_unitaire || '',
      /* details de l'exemplaire (2026.5.25) : inventaire imprime, CSV, Excel */
      couleur: m.couleur || '', taille: m.taille || '', commentaire: m.commentaire || '',
      decoupable: decoupeOuverte(categorieDeMateriel(m))
    };""")

# ---------- inventaire imprimable ----------
rep("""      var p = items[0];
      return '<h2>' + esc(k) + '</h2>' +""","""      var p = items[0];
      var det = colonnesDetail(items, function (r, c) { return r[c]; }, p.decoupable);
      return '<h2>' + esc(k) + '</h2>' +""")
rep("""        '<table><tr><th style="width:85px">Marquage</th><th>Lieu</th>' +
          '<th style="width:80px">Statut</th><th style="width:80px">Dernier controle</th><th>Observations</th></tr>' +
        items.map(function (r) {
          return '<tr><td>' + esc(r.marquage) + '</td><td>' + esc(r.lieu) + '</td>' +""","""        '<table><tr><th style="width:85px">Marquage</th>' + det.th(det.avant) + '<th>Lieu</th>' +
          '<th style="width:80px">Statut</th><th style="width:80px">Dernier controle</th><th>Observations</th>' +
          det.th(det.apres) + '</tr>' +
        items.map(function (r) {
          return '<tr><td>' + esc(r.marquage) + '</td>' + det.td(det.avant, r) + '<td>' + esc(r.lieu) + '</td>' +""")
rep("""            '<td>' + esc(r.raison) + '</td></tr>';
        }).join('') + '</table>';""","""            '<td>' + esc(r.raison) + '</td>' + det.td(det.apres, r) + '</tr>';
        }).join('') + '</table>';""")

# ---------- CSV ----------
rep("""  var entetes = ['Marquage', 'Numero de serie', 'Lot', 'Categorie', 'Fabricant', 'Modele', 'Lieu', 'Mise en service',
    'Fin de vie', 'Statut', 'Motif', 'Dernier controle', 'Resultat', 'Prochain controle',
    'Controle echu', 'Prix unitaire'];""","""  var entetes = ['Marquage', 'Numero de serie', 'Couleur', 'Taille ou longueur', 'Lot', 'Categorie', 'Fabricant', 'Modele', 'Lieu', 'Mise en service',
    'Fin de vie', 'Statut', 'Motif', 'Dernier controle', 'Resultat', 'Prochain controle',
    'Controle echu', 'Prix unitaire', 'Commentaire'];""")
rep("""    return [r.marquage, r.serie, r.lot, r.categorie, r.fabricant, r.modele, r.lieu, r.miseEnService,
      r.finDeVie, r.statut, r.raison, r.dernierControle, r.resultatControle, r.prochainControle,
      r.echu, r.prix];""","""    return [r.marquage, r.serie, r.couleur, r.taille, r.lot, r.categorie, r.fabricant, r.modele, r.lieu, r.miseEnService,
      r.finDeVie, r.statut, r.raison, r.dernierControle, r.resultatControle, r.prochainControle,
      r.echu, r.prix, r.commentaire];""")

# ---------- Excel ----------
rep(""".concat(['Lot', 'Cat\\u00e9gorie', 'Fabricant',""",""".concat(['Couleur', 'Taille ou longueur', 'Lot', 'Cat\\u00e9gorie', 'Fabricant',""")
rep("""'Sortie du parc', 'Prix unitaire']),""","""'Sortie du parc', 'Prix unitaire', 'Commentaire']),""")
rep("""      return [m.numero_marquage || ''].concat(avecSerie ? [m.numero_serie || ''] : []).concat([
        lot.designation || '', cat.nom || '',""","""      return [m.numero_marquage || ''].concat(avecSerie ? [m.numero_serie || ''] : []).concat([
        m.couleur || '', m.taille || '', lot.designation || '', cat.nom || '',""")
rep("""Number(lot.prix_unitaire) || '']);""","""Number(lot.prix_unitaire) || '', m.commentaire || '']);""")

# ---------- fiche du lot ----------
rep("""      var nCols = 5 + (avecRep ? 1 : 0);""","""      var det = colonnesDetail(items, function (m, c) { return c === 'serie' ? m.numero_serie : m[c]; }, decoupeOuverte(cat));
      var nCols = 5 + (avecRep ? 1 : 0) + det.n;""")
rep("""      return '<table><tr><th style="width:90px">Marquage</th><th>Lieu</th>' +
        '<th style="width:90px">Mise en service</th><th style="width:90px">Statut</th>' +
        '<th style="width:90px">Prochain controle</th>' +
        (avecRep ? '<th style="width:80px">R\\u00e9parations</th>' : '') + '</tr>' +
      (items.map(function (m) {
        return '<tr><td>' + esc(m.numero_marquage || '#' + m.id) + '</td>' +
          '<td>' + esc(lieuMap[m.lieu_stockage] || '-') + '</td>' +""","""      return '<table><tr><th style="width:90px">Marquage</th>' + det.th(det.avant) + '<th>Lieu</th>' +
        '<th style="width:90px">Mise en service</th><th style="width:90px">Statut</th>' +
        '<th style="width:90px">Prochain controle</th>' +
        (avecRep ? '<th style="width:80px">R\\u00e9parations</th>' : '') + det.th(det.apres) + '</tr>' +
      (items.map(function (m) {
        return '<tr><td>' + esc(m.numero_marquage || '#' + m.id) + '</td>' + det.td(det.avant, m) +
          '<td>' + esc(lieuMap[m.lieu_stockage] || '-') + '</td>' +""")
rep("""          (avecRep ? '<td>' + (repParMat[m.id] || 0) + '</td>' : '') + '</tr>';
      }).join('')""","""          (avecRep ? '<td>' + (repParMat[m.id] || 0) + '</td>' : '') + det.td(det.apres, m) + '</tr>';
      }).join('')""")

# ---------- fiche de vie d'un exemplaire (registre) : commentaire ----------
rep("""      ligneInfo('Lieu de stockage', x.lieu.nom) +
""","""      ligneInfo('Lieu de stockage', x.lieu.nom) +
      /* commentaire de l'exemplaire (2026.5.25) : couleur et taille y figuraient deja ;
         il porte aussi la trace des scissions et decoupes. */
      (aColonne('materiels', 'commentaire') && x.m.commentaire ? ligneInfo('Commentaire', x.m.commentaire) : '') +
""")
open(p,'w',encoding='utf-8').write(s)

# ---------- aide + version ----------
h=open('/home/claude/v2/widget_pilotage.html',encoding='utf-8').read()
m=re.search(r"non\s+un\s+objet\.</p>", h); assert m, "ancre aide"
h=h[:m.end()]+"""
          <p>Dans la <b>fiche du lot</b> et l'<b>inventaire imprimable</b>, le tableau des
             exemplaires ajoute de lui-même les colonnes <b>n° de série</b>, <b>couleur</b>,
             <b>taille</b> (ou <b>longueur</b> pour les cordes et les sangles) et
             <b>commentaire</b> dès qu'au moins un exemplaire du lot les renseigne ; un lot qui n'en
             a aucun garde son tableau habituel. La fiche de vie d'un exemplaire, et donc le registre,
             reprend aussi son commentaire.</p>"""+h[m.end():]
open('/home/claude/v2/widget_pilotage.html','w',encoding='utf-8').write(h)
s=open(p,encoding='utf-8').read()
a="var VERSION_EPILOG = '2026.5.24';"
assert s.count(a)==1; s=s.replace(a,"var VERSION_EPILOG = '2026.5.25';")
open(p,'w',encoding='utf-8').write(s)
print("ecrit")
