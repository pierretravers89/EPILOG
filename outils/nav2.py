import re
ICO = {
 'apercu': '<rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect>',
 'materiel': '<path d="M21 8l-9-5-9 5 9 5 9-5z"></path><path d="M3 8v8l9 5 9-5V8"></path>',
 'prets': '<path d="M7 7h11l-3-3"></path><path d="M17 17H6l3 3"></path>',
 'controles': '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"></path><path d="M9 12l2 2 4-4"></path>',
 'budget': '<rect x="2" y="6" width="20" height="13" rx="2"></rect><path d="M2 10h20"></path>',
 'listes': '<path d="M8 6h13M8 12h13M8 18h13"></path><path d="M3 6h.01M3 12h.01M3 18h.01"></path>',
 'replier': '<path d="M15 18l-6-6 6-6"></path>',
}
def svg(k, w=18, cls=''): return '<svg%s width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % (' class="%s"' % cls if cls else '', w, w, ICO[k])

lat = '''<aside id="navLaterale" aria-label="Navigation">
    <button type="button" id="nlReplier" class="nl-replier" aria-expanded="true" aria-controls="navLaterale" title="Réduire le menu">%s<span class="nl-lib">Réduire le menu</span></button>
    <button type="button" class="nl-item" data-nav="apercu" title="Vue d'ensemble">%s<span class="nl-lib">Vue d'ensemble</span></button>
    <button type="button" class="nl-item" data-nav="materiel" title="Matériel">%s<span class="nl-lib">Matériel</span></button>
    <button type="button" class="nl-item" data-nav="prets" title="Prêts">%s<span class="nl-lib">Prêts</span><span class="nl-compte" data-compte="prets"></span></button>
    <div class="nl-groupe">%s<span class="nl-lib">Suivi des EPI</span></div>
    <button type="button" class="nl-item nl-court" data-nav="controles" title="Suivi des EPI">%s<span class="nl-lib">Suivi des EPI</span></button>
    <button type="button" class="nl-sous" data-nav="controles:controles">Contrôles<span class="nl-alerte" data-miroir="epiCompteCtrl"></span></button>
    <button type="button" class="nl-sous" data-nav="controles:incidents">Incidents<span class="nl-alerte" data-miroir="epiCompteInc"></span></button>
    <button type="button" class="nl-sous" data-nav="controles:reparations">Réparations<span class="nl-alerte" data-miroir="epiCompteRep"></span></button>
    <button type="button" class="nl-sous" data-nav="controles:entretiens" hidden>Entretien</button>
    <button type="button" class="nl-item" data-nav="budget" title="Achats et budget">%s<span class="nl-lib">Achats et budget</span></button>
    <div class="nl-separateur"></div>
    <div class="nl-titre">Listes du club</div>
    <button type="button" class="nl-item nl-court" data-nav="refs" title="Listes du club">%s<span class="nl-lib">Listes du club</span></button>
    <button type="button" class="nl-sous" data-nav="refs:categories">Catégories<span class="nl-compte" data-miroir="refsCompteCategories"></span></button>
    <button type="button" class="nl-sous" data-nav="refs:lieux">Lieux de stockage<span class="nl-compte" data-miroir="refsCompteLieux"></span></button>
    <button type="button" class="nl-sous" data-nav="refs:fournisseurs">Fournisseurs<span class="nl-compte" data-miroir="refsCompteFournisseurs"></span></button>
    <button type="button" class="nl-sous" data-nav="refs:adherents">Adhérents<span class="nl-compte" data-miroir="refsCompteAdherents"></span></button>
  </aside>''' % (svg('replier', 18, 'nl-chevron'), svg('apercu'), svg('materiel'), svg('prets'), svg('controles'), svg('controles'), svg('budget'), svg('listes'))

css = r'''
  /* =====================================================================
     NAVIGATION, livraison 2 (2026.5.18)
     ===================================================================== */
  /* -- menu lateral retractable (ordinateur) : icones seules, infobulles -- */
  #navLaterale .nl-court { display: none; }
  @media (min-width: 1000px) {
    #navLaterale { transition: flex-basis 0.15s ease; }
    #navLaterale .nl-replier {
      padding: 8px 12px; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #5B6B82;
    }
    #navLaterale.replie { flex-basis: 64px; padding-left: 8px; padding-right: 8px; }
    #navLaterale.replie .nl-lib, #navLaterale.replie .nl-sous, #navLaterale.replie .nl-groupe,
    #navLaterale.replie .nl-titre, #navLaterale.replie .nl-separateur { display: none !important; }
    #navLaterale.replie .nl-court { display: flex; }
    #navLaterale.replie button { justify-content: center; padding-left: 0; padding-right: 0; position: relative; }
    #navLaterale.replie .nl-chevron { transform: rotate(180deg); }
    /* compteur de prets : pastille en coin de l'icone */
    #navLaterale.replie .nl-compte[data-compte] { position: absolute; top: 2px; right: 6px; margin: 0; font-size: 10px; padding: 0 5px; }
  }

  /* -- actions rares d'un lot : derriere \"...\" sur telephone uniquement.
        Ailleurs, le conteneur est transparent (display: contents) et le
        bouton \"...\" absent : rendu identique a avant. -- */
  .btn-plus-actions { display: none; }
  .actions-rares { display: contents; }
  @media (max-width: 640px) {
    .btn-plus-actions { display: inline-flex; align-items: center; justify-content: center; min-width: 48px; font-size: 18px; letter-spacing: 0.1em; }
    .actions-rares { display: none; }
    .rares-ouverts > .actions-rares { display: flex; flex-wrap: wrap; gap: 6px; flex-basis: 100%; }
    .rares-ouverts > .actions-rares > button { flex: 1 1 auto; }

    /* -- sous-rubriques (Suivi des EPI, Listes du club) en pastilles -- */
    #epi-so, #refs-so { border-bottom: none; gap: 6px; padding: 2px 0 6px; }
    #epi-so .sous-onglet, #refs-so .sous-onglet {
      border: 1px solid var(--ice-border, #c5cfde); border-radius: 18px; margin: 0;
      padding: 8px 14px; background: var(--white, #fff); color: var(--navy, #1B3668); font-size: 14px;
    }
    #epi-so .sous-onglet.actif, #refs-so .sous-onglet.actif {
      background: var(--navy, #1B3668); border-color: var(--navy, #1B3668); color: #fff;
    }
    #epi-so .sous-onglet.actif .so-compte, #refs-so .sous-onglet.actif .so-compte { color: #FFD5D7; }
  }
'''

p='/home/claude/v2/widget_pilotage.html'; h=open(p,encoding='utf-8').read()
i=h.index('<aside id="navLaterale"'); j=h.index('</aside>', i)+len('</aside>')
h=h[:i]+lat+h[j:]
k=h.rindex('</style>'); h=h[:k]+css.replace('\\"','"')+h[k:]
open(p,'w',encoding='utf-8').write(h)

p='/home/claude/v2/widget_pilotage.js'; s=open(p,encoding='utf-8').read()
def rep(a,b):
    global s
    assert s.count(a)==1, a[:70]; s=s.replace(a,b)
# actions rares derriere "..."
rep("""            '<button class="secondary btn-fiche" data-type="lot" data-id="' + k + '">Fiche du lot</button>' +
            '<button class="secondary btn-registre" data-id="' + k + '" title="Toutes les fiches de vie du lot en un PDF">Registre (PDF)</button>' +""",
"""            '<button class="secondary btn-fiche" data-type="lot" data-id="' + k + '">Fiche du lot</button>' +
            /* (2026.5.18) telephone : actions rares derriere \"...\" ; ailleurs le
               bouton est masque et le conteneur transparent (display: contents) */
            '<button type="button" class="secondary btn-plus-actions" aria-label="Autres actions du lot" aria-expanded="false">\\u22ef</button>' +
            '<span class="actions-rares">' +
            '<button class="secondary btn-registre" data-id="' + k + '" title="Toutes les fiches de vie du lot en un PDF">Registre (PDF)</button>' +""")
rep("""            btnEditer('lot', k, 'Éditer le lot') +
            btnSupprimer('lot', k)
            : '<button class="secondary" id="btnRattacher">Rattacher a un lot</button>') +""","""            btnEditer('lot', k, 'Éditer le lot') +
            btnSupprimer('lot', k) +
            '</span>'
            : '<button class="secondary" id="btnRattacher">Rattacher a un lot</button>') +""")
rep("""  document.querySelectorAll('#materiel-list .btn-registre').forEach(function (b) {""","""  document.querySelectorAll('#materiel-list .btn-plus-actions').forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation();
      var ouvert = b.parentNode.classList.toggle('rares-ouverts');
      b.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
    };
  });
  document.querySelectorAll('#materiel-list .btn-registre').forEach(function (b) {""")
# menu retractable
rep("""document.querySelectorAll('#pane-plus [data-plus]').forEach(function (b) {""","""/* Menu lateral retractable (2026.5.18) : icones seules + infobulles.
   Le choix est memorise dans ce navigateur (localStorage, protege : s'il est
   indisponible, le menu reste simplement deplie). */
function appliquerMenuReplie(replie) {
  var nl = document.getElementById('navLaterale');
  var bt = document.getElementById('nlReplier');
  if (!nl || !bt) return;
  nl.classList.toggle('replie', replie);
  bt.setAttribute('aria-expanded', replie ? 'false' : 'true');
  bt.title = replie ? 'D\\u00e9plier le menu' : 'R\\u00e9duire le menu';
  var lib = bt.querySelector('.nl-lib');
  if (lib) lib.textContent = replie ? 'D\\u00e9plier le menu' : 'R\\u00e9duire le menu';
}
(function () {
  var replie = false;
  try { replie = localStorage.getItem('epilog.menuReplie') === '1'; } catch (e) { /* stockage indisponible */ }
  appliquerMenuReplie(replie);
  var bt = document.getElementById('nlReplier');
  if (bt) bt.addEventListener('click', function () {
    var r = !document.getElementById('navLaterale').classList.contains('replie');
    appliquerMenuReplie(r);
    try { localStorage.setItem('epilog.menuReplie', r ? '1' : '0'); } catch (e) { /* sans effet */ }
  });
})();
document.querySelectorAll('#pane-plus [data-plus]').forEach(function (b) {""")
open(p,'w',encoding='utf-8').write(s)
print("ecrit")
