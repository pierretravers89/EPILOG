import re
p='/home/claude/v2/widget_pilotage.js'; s=open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n, (s.count(a), a[:100]); s=s.replace(a,b)
def rep_re(pat, fn, n=1):
    global s
    s2, k = re.subn(pat, fn, s, flags=re.S)
    assert k==n, (k, pat[:80]); s=s2

# 1. legende de la galerie
rep_re(r"(var LEGENDE_PHOTO_PJ = \{[^}]*?)\s*\};", lambda m: m.group(1) + r", materiels: 'Photo de l\u2019exemplaire' };")
# 2. editeur d'exemplaire : bloc photos
rep("""    lier: function (box, rowId) {
      var sel = box.querySelector('[data-f="hors_service_motif"]');""","""    lier: function (box, rowId) {
      /* photos individuelles de l'exemplaire (2026.5.27) : meme bloc que les controles et incidents
         (jusqu'a MAX_PHOTOS_PJ, ajout et suppression a l'unite) ; sans effet si la colonne n'existe pas */
      ajouterBlocPhotos(box, 'materiels', rowId);
      var sel = box.querySelector('[data-f="hors_service_motif"]');""")
# 3. reduction a l'envoi
rep("""async function televerserPieceJointe(cleTable, colonne, ligneId, file, remplacer) {
  var nouvelId = await televerserFichierSeul(file);""","""/* Reduit une photo de telephone (3 a 6 Mo) avant l'envoi : cote maxi COTE_MAX_PHOTO px, JPEG.
   Un inventaire imprime de 80 exemplaires avec photo chargerait sinon des centaines de Mo. Les
   photos deja petites, les formats que le navigateur ne sait pas decoder et toute erreur laissent
   le fichier tel quel : on ne perd jamais l'envoi. L'orientation EXIF est appliquee a la lecture. */
var COTE_MAX_PHOTO = 1600;
async function reduirePhoto(file) {
  try {
    if (!file || !/^image\\//.test(file.type) || typeof createImageBitmap !== 'function') return file;
    var bmp = await createImageBitmap(file);
    var ratio = Math.min(1, COTE_MAX_PHOTO / Math.max(bmp.width, bmp.height));
    if (ratio === 1 && file.size < 1200000) { if (bmp.close) bmp.close(); return file; }
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * ratio)); c.height = Math.max(1, Math.round(bmp.height * ratio));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    var blob = await new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', 0.85); });
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], String(file.name || 'photo').replace(/\\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (e) { return file; }
}

async function televerserPieceJointe(cleTable, colonne, ligneId, file, remplacer) {
  if (cleTable === 'materiels' && colonne === 'photo') file = await reduirePhoto(file);
  var nouvelId = await televerserFichierSeul(file);""")
# 4. objet d'inventaire : id et nombre de photos
rep("""      couleur: m.couleur || '', taille: m.taille || '', commentaire: m.commentaire || '',
      decoupable: decoupeOuverte(categorieDeMateriel(m))""","""      couleur: m.couleur || '', taille: m.taille || '', commentaire: m.commentaire || '',
      id: m.id, nbPhotos: aColonne('materiels', 'photo') ? (idsPiecesJointes(m.photo).length || '') : '',
      decoupable: decoupeOuverte(categorieDeMateriel(m))""")
# 5. CSV et Excel : nombre de photos
rep("""'Controle echu', 'Prix unitaire', 'Commentaire'];""","""'Controle echu', 'Prix unitaire', 'Commentaire', 'Photos'];""")
rep("""      r.echu, r.prix, r.commentaire];""","""      r.echu, r.prix, r.commentaire, r.nbPhotos];""")
rep("""'Sortie du parc', 'Prix unitaire', 'Commentaire']),""","""'Sortie du parc', 'Prix unitaire', 'Commentaire', 'Photos']),""")
rep("""Number(lot.prix_unitaire) || '', m.commentaire || '']);""","""Number(lot.prix_unitaire) || '', m.commentaire || '',
        aColonne('materiels', 'photo') ? (idsPiecesJointes(m.photo).length || '') : '']);""")
# 6. colonnesDetail : colonne de vignettes
rep_re(r"function colonnesDetail\(items, acces, decoupable\) \{.*?\n\}\n(?=\n(?:async )?function exporterInventaireImprimable)", lambda m: r"""function colonnesDetail(items, acces, decoupable, photos, idDe) {
  var defs = [
    { cle: 'serie', label: 'N\u00b0 de s\u00e9rie', fin: false },
    { cle: 'couleur', label: 'Couleur', fin: false },
    { cle: 'taille', label: decoupable ? 'Longueur' : 'Taille', fin: false },
    { cle: 'commentaire', label: 'Commentaire', fin: true }
  ];
  /* vignettes des photos individuelles (2026.5.27) : `photos` = { idExemplaire: [urls] }, colonne
     ajoutee, en premier, seulement si au moins un exemplaire du tableau a une photo */
  var avecPhotos = !!photos && items.some(function (it) { return (photos[idDe(it)] || []).length; });
  if (avecPhotos) defs.unshift({ cle: 'photo', label: 'Photo', fin: false });
  var det = defs.filter(function (d) {
    if (d.cle === 'photo') return true;
    return items.some(function (it) { return String(acces(it, d.cle) || '').trim() !== ''; });
  });
  return {
    avant: det.filter(function (d) { return !d.fin; }),
    apres: det.filter(function (d) { return d.fin; }),
    /* le commentaire est un texte libre : largeur minimale, sinon il s'ecrase en colonne etroite */
    th: function (liste) {
      return liste.map(function (d) { return '<th' + (d.fin ? ' style="min-width:130px"' : '') + '>' + esc(d.label) + '</th>'; }).join('');
    },
    td: function (liste, it) {
      return liste.map(function (d) {
        if (d.cle === 'photo') {
          return '<td>' + (photos[idDe(it)] || []).map(function (u) {
            return '<img class="photo-vign" src="' + esc(u) + '" alt="">';
          }).join('') + '</td>';
        }
        return '<td>' + esc(String(acces(it, d.cle) || '')) + '</td>';
      }).join('');
    },
    n: det.length
  };
}
""")
# 7. inventaire imprimable : asynchrone, photos
rep("""function exporterInventaireImprimable() {
  if (!inventaireVisible.length) { flash('lotFlash', 'Aucun exemplaire a exporter.'); return; }
  var now = new Date();""","""async function exporterInventaireImprimable() {
  if (!inventaireVisible.length) { flash('lotFlash', 'Aucun exemplaire a exporter.'); return; }
  /* photos individuelles (2026.5.27) : URLs des exemplaires visibles qui en ont */
  var photosMat = {};
  if (aColonne('materiels', 'photo')) {
    var brutes = {};
    rawRows.materiels.forEach(function (m) { brutes[m.id] = m; });
    for (var ip = 0; ip < inventaireVisible.length; ip++) {
      var rr = inventaireVisible[ip], mm = brutes[rr.id];
      if (!mm || !idsPiecesJointes(mm.photo).length) continue;
      var us = await urlsPieceJointe('materiels', mm, 'photo');
      if (us.length) photosMat[rr.id] = us;
    }
  }
  var now = new Date();""")
rep("""        return r[c];
      }, p.decoupable);""","""        return r[c];
      }, p.decoupable, photosMat, function (r) { return r.id; });""")
# 8. fiche du lot
rep("""  var marquageMap = mapById(items, 'numero_marquage');
  var fin = finDeVieLot(lot);""","""  var marquageMap = mapById(items, 'numero_marquage');
  var fin = finDeVieLot(lot);
  /* photos individuelles des exemplaires (2026.5.27) : colonne de vignettes si au moins un exemplaire en a */
  var photosMat = {};
  if (aColonne('materiels', 'photo')) {
    for (var ip = 0; ip < items.length; ip++) {
      if (!idsPiecesJointes(items[ip].photo).length) continue;
      var us = await urlsPieceJointe('materiels', items[ip], 'photo');
      if (us.length) photosMat[items[ip].id] = us;
    }
  }""")
rep("""      var det = colonnesDetail(items, function (m, c) { return c === 'serie' ? m.numero_serie : m[c]; }, decoupeOuverte(cat));""",
"""      var det = colonnesDetail(items, function (m, c) { return c === 'serie' ? m.numero_serie : m[c]; }, decoupeOuverte(cat),
        photosMat, function (m) { return m.id; });""")
# 9. fiche de vie d'un exemplaire (et registre, fiches PDF)
rep("""  var photosCtrl = await urlsPhotosControles(x.controles);""","""  var photosCtrl = await urlsPhotosControles(x.controles);
  var photosMat = await urlsPieceJointe('materiels', x.m, 'photo');   /* 2026.5.27 : photos de CET exemplaire */""")
rep("""    '<h2>Cycle de vie</h2><div class="grid">' +""","""    (photosMat.length
      ? '<h2>Photos de l\\u2019exemplaire</h2><div class="photo-doc">' + photosMat.map(function (u) {
          return '<img class="photo-mat" src="' + esc(u) + '" alt="Photo de l\\u2019exemplaire">';
        }).join('') + '</div>'
      : '') +
    '<h2>Cycle de vie</h2><div class="grid">' +""")
rep("""'.photo-doc { margin: 10px 0 14px; }""","""'.photo-doc { margin: 10px 0 14px; } .photo-mat { max-width: 230px; max-height: 190px; object-fit: contain; border: 1px solid #ccd6e8; border-radius: 4px; background: #fff; margin: 0 8px 8px 0; } .photo-vign { max-width: 56px; max-height: 56px; object-fit: cover; border: 1px solid #ccd6e8; border-radius: 3px; margin: 0 2px 2px 0; }""")
# 10. fiche interactive : galerie
rep("""      '<div class="form-actions" id="ficheBoutons">' + boutons.join('') + '</div>' +""","""      (aColonne('materiels', 'photo') ? '<div class="galerie-pj" id="galerieMat-' + m.id + '" hidden style="margin:8px 0"></div>' : '') +
      '<div class="form-actions" id="ficheBoutons">' + boutons.join('') + '</div>' +""")
rep("""  remplirGaleriePhotos('incidents', x.incidents.slice(0, 5), 'ficheInc-', 'Photo de l\\'incident', false);
""","""  remplirGaleriePhotos('incidents', x.incidents.slice(0, 5), 'ficheInc-', 'Photo de l\\'incident', false);
  remplirGaleriePhotos('materiels', [x.m], 'galerieMat-', 'Photo de l\\u2019exemplaire', false);
""")
open(p,'w',encoding='utf-8').write(s)

# ---------- aide ----------
h=open('/home/claude/v2/widget_pilotage.html',encoding='utf-8').read()
m=re.search(r"dès\s+qu'au\s+moins\s+un\s+exemplaire\s+du\s+lot\s+les\s+renseigne.*?reprend\s+aussi\s+son\s+commentaire\.</p>", h, flags=re.S)
assert m, "ancre aide photos"
h=h[:m.end()]+"""
          <p><b>Photos d'un exemplaire.</b> « Éditer l'exemplaire » permet d'ajouter jusqu'à quatre
             photos (sur téléphone, l'appareil photo s'ouvre directement) et de les supprimer une à
             une ; elles sont réduites automatiquement à l'envoi pour rester légères. On les retrouve
             sur la fiche de l'exemplaire, dans sa fiche de vie (donc dans le registre et les fiches de
             vie en PDF), et en vignettes dans la fiche du lot et l'inventaire imprimable. Dans
             l'Excel et le CSV, seul le nombre de photos figure. Comme pour les autres photos, les
             images se chargent depuis Grist à l'ouverture du document : imprimez ou enregistrez en
             PDF tout de suite, sans conserver le fichier HTML.</p>"""+h[m.end():]
i=h.index('<section class="aide-sec" id="sec-sauvegarde">'); j=h.index('</section>', i)+len('</section>')
h=h[:j]+"""

        <section class="aide-sec" id="sec-structure">
          <h3>Mise à jour et structure du document</h3>
          <p>Le code d'EPILOG se met à jour en recollant <b>les deux fichiers</b> (le .js et le .html)
             dans Grist. À chaque mise à jour, EPILOG compare la <b>structure du document</b> (ses
             tables et leurs colonnes) à celle qu'il attend, et <b>crée lui-même les éléments
             nouveaux</b> : par exemple la colonne « photo » des exemplaires. Rien d'existant n'est
             jamais modifié ni supprimé : il ne fait qu'ajouter.</p>
          <p>Les modules facultatifs plus anciens (Réparations, Entretien, Demandes) que vous n'avez pas
             créés restent absents. <b>Réglages → Fonctionnement → Structure du document</b> les liste
             et permet de les créer d'un clic ; le Diagnostic donne le même état.</p>
          <p>Dans un <b>document vide</b>, un bandeau propose « Installer la structure d'EPILOG » : les
             tables sont créées vides, il ne reste qu'à renseigner les listes du club.</p>
          <div class="encadre">Créer des tables demande le droit de <b>modifier la structure</b> du
             document. Sans ce droit, un bandeau l'indique, l'outil continue de fonctionner, et un
             propriétaire du document n'a qu'à ouvrir EPILOG une fois pour compléter la structure.</div>
        </section>"""+h[j:]
mn=re.search(r'<button type="button" class="aide-nav-item" data-sec="sauvegarde">.*?</button>', h, flags=re.S)
assert mn, "nav sauvegarde"
h=h[:mn.end()]+"""
        <button type="button" class="aide-nav-item" data-sec="structure">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/></svg>
          <span class="aide-nav-label">Structure du document</span></button>"""+h[mn.end():]
open('/home/claude/v2/widget_pilotage.html','w',encoding='utf-8').write(h)
print("ecrit")
