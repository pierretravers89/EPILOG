import re
ICO = {
 'apercu': '<rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect>',
 'accueil': '<path d="M3 11l9-7 9 7"></path><path d="M5 10v10h14V10"></path>',
 'materiel': '<path d="M21 8l-9-5-9 5 9 5 9-5z"></path><path d="M3 8v8l9 5 9-5V8"></path>',
 'prets': '<path d="M7 7h11l-3-3"></path><path d="M17 17H6l3 3"></path>',
 'controles': '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"></path><path d="M9 12l2 2 4-4"></path>',
 'budget': '<rect x="2" y="6" width="20" height="13" rx="2"></rect><path d="M2 10h20"></path>',
 'plus': '<circle cx="5" cy="12" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle>',
 'listes': '<path d="M8 6h13M8 12h13M8 18h13"></path><path d="M3 6h.01M3 12h.01M3 18h.01"></path>',
 'reglages': '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"></path>',
 'aide': '<circle cx="12" cy="12" r="9"></circle><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"></path><path d="M12 17h.01"></path>',
}
def svg(k, w=18): return '<svg width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % (w, w, ICO[k])

lat = '''<aside id="navLaterale" aria-label="Navigation">
    <button type="button" class="nl-item" data-nav="apercu">%s<span>Vue d'ensemble</span></button>
    <button type="button" class="nl-item" data-nav="materiel">%s<span>Matériel</span></button>
    <button type="button" class="nl-item" data-nav="prets">%s<span>Prêts</span><span class="nl-compte" data-compte="prets"></span></button>
    <div class="nl-groupe">%s<span>Suivi des EPI</span></div>
    <button type="button" class="nl-sous" data-nav="controles:controles">Contrôles<span class="nl-alerte" data-miroir="epiCompteCtrl"></span></button>
    <button type="button" class="nl-sous" data-nav="controles:incidents">Incidents<span class="nl-alerte" data-miroir="epiCompteInc"></span></button>
    <button type="button" class="nl-sous" data-nav="controles:reparations">Réparations<span class="nl-alerte" data-miroir="epiCompteRep"></span></button>
    <button type="button" class="nl-sous" data-nav="controles:entretiens" hidden>Entretien</button>
    <button type="button" class="nl-item" data-nav="budget">%s<span>Achats et budget</span></button>
    <div class="nl-separateur"></div>
    <div class="nl-titre">Listes du club</div>
    <button type="button" class="nl-sous" data-nav="refs:categories">Catégories<span class="nl-compte" data-miroir="refsCompteCategories"></span></button>
    <button type="button" class="nl-sous" data-nav="refs:lieux">Lieux de stockage<span class="nl-compte" data-miroir="refsCompteLieux"></span></button>
    <button type="button" class="nl-sous" data-nav="refs:fournisseurs">Fournisseurs<span class="nl-compte" data-miroir="refsCompteFournisseurs"></span></button>
    <button type="button" class="nl-sous" data-nav="refs:adherents">Adhérents<span class="nl-compte" data-miroir="refsCompteAdherents"></span></button>
  </aside>
  ''' % (svg('apercu'), svg('materiel'), svg('prets'), svg('controles'), svg('budget'))

bas = '''<nav id="navBas" aria-label="Navigation principale">
  <button type="button" data-nav="apercu">%s<span>Accueil</span></button>
  <button type="button" data-nav="materiel">%s<span>Matériel</span></button>
  <button type="button" data-nav="prets">%s<span>Prêts</span></button>
  <button type="button" data-nav="controles">%s<span>Suivi EPI</span></button>
  <button type="button" data-nav="plus">%s<span>Plus</span></button>
</nav>''' % (svg('accueil', 22), svg('materiel', 22), svg('prets', 22), svg('controles', 22), svg('plus', 22))

def lien(nav, ico, txt, extra=''):
    return '<button type="button" class="plus-lien" %s>%s<span>%s</span><span class="plus-fleche" aria-hidden="true">›</span></button>' % (nav, svg(ico, 20), txt)
plus = '''
  <div id="pane-plus" class="pane">
    <div class="plus-bloc">
      %s
      %s
    </div>
    <div class="plus-titre">Listes du club</div>
    <div class="plus-bloc">
      %s%s%s%s
    </div>
    <div class="plus-bloc">
      %s
      %s
    </div>
  </div>
''' % (lien('data-nav="budget"', 'budget', 'Achats et budget'),
       lien('data-nav="apercu"', 'apercu', "Vue d'ensemble et statistiques"),
       lien('data-nav="refs:categories"', 'listes', 'Catégories'), lien('data-nav="refs:lieux"', 'listes', 'Lieux de stockage'),
       lien('data-nav="refs:fournisseurs"', 'listes', 'Fournisseurs'), lien('data-nav="refs:adherents"', 'listes', 'Adhérents'),
       lien('data-plus="reglages"', 'reglages', 'Réglages du club'), lien('data-plus="aide"', 'aide', 'Aide'))

css = r'''
  /* =====================================================================
     NAVIGATION (2026.5.17) -- maquette validee par Pierre.
     - Ordinateur (>= 1000 px) : menu lateral ; les onglets et les barres de
       sous-onglets (Suivi des EPI, Listes du club) sont masques, mais restent
       dans la page : le menu les actionne (naviguer()), tout le code existant
       et les tests continuent de passer par eux.
     - Entre 641 et 999 px (tablette, panneau Grist etroit) : RIEN ne change,
       onglets d'origine (verifie au pixel pres).
     - Telephone (<= 640 px) : barre de 5 icones en bas, page \"Plus\".
     ===================================================================== */
  #navLaterale, #navBas { display: none; }
  .disposition { display: block; }

  @media (min-width: 1000px) {
    .tabs-bar { display: none; }
    #epi-so, #refs-so { display: none; }
    .disposition { display: flex; align-items: flex-start; }
    .disposition > .content { flex: 1 1 auto; min-width: 0; }
    #navLaterale {
      display: flex; flex-direction: column; gap: 2px; flex: 0 0 236px;
      position: sticky; top: 0; align-self: flex-start; max-height: 100vh; overflow-y: auto;
      background: var(--white, #fff); border-right: 1px solid var(--ice-border, #d6dde8);
      padding: 16px 10px 24px; box-sizing: border-box;
    }
    #navLaterale button {
      display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
      background: transparent; color: var(--navy, #1B3668); border: none; border-radius: 8px;
      text-transform: none; letter-spacing: 0; white-space: normal; cursor: pointer;
    }
    #navLaterale .nl-item { padding: 10px 12px; font-size: 15px; font-weight: 600; }
    #navLaterale .nl-sous { padding: 7px 12px 7px 40px; font-size: 14px; font-weight: 500; color: #3E4F6B; }
    #navLaterale button:hover { background: #EEF2F8; }
    #navLaterale button.nav-actif { background: var(--navy, #1B3668); color: #fff; }
    #navLaterale .nl-groupe { display: flex; align-items: center; gap: 10px; padding: 12px 12px 4px; font-size: 15px; font-weight: 600; color: var(--navy, #1B3668); }
    #navLaterale .nl-separateur { height: 1px; background: #E3E8F0; margin: 10px 4px; }
    #navLaterale .nl-titre { padding: 0 12px 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #5B6B82; }
    #navLaterale .nl-compte, #navLaterale .nl-alerte { margin-left: auto; font-size: 12px; font-weight: 700; }
    #navLaterale .nl-compte:empty, #navLaterale .nl-alerte:empty { display: none; }
    #navLaterale .nl-alerte { color: #B4232A; }
    #navLaterale button.nav-actif .nl-alerte, #navLaterale button.nav-actif .nl-compte { color: #fff; }
    #navLaterale .nl-compte[data-compte] { background: var(--red, #E30613); color: #fff; padding: 1px 7px; border-radius: 10px; }
  }

  @media (max-width: 640px) {
    .tabs-bar { display: none; }
    body { padding-bottom: 76px; }
    #navBas {
      display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
      background: var(--white, #fff); border-top: 1px solid var(--ice-border, #d6dde8);
      padding: 4px 2px calc(8px + env(safe-area-inset-bottom, 0px));
    }
    #navBas button {
      display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 56px;
      background: transparent; color: #5B6B82; border: none; border-radius: 0; padding: 6px 0;
      font-size: 11px; font-weight: 600; text-transform: none; letter-spacing: 0;
    }
    #navBas button.nav-actif { color: var(--navy, #1B3668); font-weight: 700; box-shadow: inset 0 -3px 0 var(--red, #E30613); }
    #pane-plus .plus-bloc { background: var(--white, #fff); border: 1px solid var(--ice-border, #d6dde8); border-radius: 12px; margin: 0 0 14px; overflow: hidden; }
    #pane-plus .plus-titre { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #5B6B82; margin: 4px 4px 6px; }
    #pane-plus .plus-lien {
      display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 12px 16px;
      background: transparent; color: var(--navy, #1B3668); border: none; border-bottom: 1px solid #E3E8F0;
      border-radius: 0; text-align: left; font-size: 16px; font-weight: 600; text-transform: none; letter-spacing: 0;
    }
    #pane-plus .plus-lien:last-child { border-bottom: none; }
    #pane-plus .plus-lien span:nth-child(2) { flex-grow: 1; }
    #pane-plus .plus-fleche { color: #5B6B82; font-size: 20px; }
  }
'''

p='/home/claude/v2/widget_pilotage.html'; h=open(p,encoding='utf-8').read()
assert h.count('<main class="content">')==1 and h.count('</main>')==1
h=h.replace('<main class="content">', '<div class="disposition">\n  ' + lat + '<main class="content">')
h=h.replace('</main>', plus + '</main>\n</div>\n' + bas)
i=h.rindex('</style>'); h=h[:i]+css.replace('\\"','"')+h[i:]
open(p,'w',encoding='utf-8').write(h)

js = r'''

/* ------------------------- navigation (2026.5.17) -------------------------
   Menu lateral (ordinateur) et barre du bas (telephone) : ils ACTIONNENT les
   onglets et sous-onglets d'origine, toujours presents dans la page. Aucun
   ecran n'est reecrit ; tout chemin existant (alertes, liens internes, tests)
   qui clique un onglet met aussi la navigation a jour (majNav, observateur). */
function naviguer(cible) {
  var p = String(cible).split(':'), t = p[0], sous = p[1];
  if (t === 'plus') {
    document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
    document.querySelectorAll('.pane').forEach(function (x) { x.classList.remove('active'); });
    var pp = document.getElementById('pane-plus');
    if (pp) pp.classList.add('active');
  } else {
    var tab = document.querySelector('.tab[data-t="' + t + '"]');
    if (tab) tab.click();
    if (sous) {
      var barre = t === 'controles' ? 'epi-so' : (t === 'refs' ? 'refs-so' : null);
      var so = barre ? document.querySelector('#' + barre + ' .sous-onglet[data-se="' + sous + '"]') : null;
      if (so && !so.hidden) so.click();
    }
  }
  majNav();
  window.scrollTo(0, 0);
}
function majNav() {
  var tabA = document.querySelector('.tab.active');
  var plusA = document.getElementById('pane-plus');
  var t = tabA ? tabA.dataset.t : (plusA && plusA.classList.contains('active') ? 'plus' : '');
  var soE = document.querySelector('#epi-so .sous-onglet.actif');
  var soR = document.querySelector('#refs-so .sous-onglet.actif');
  document.querySelectorAll('[data-nav]').forEach(function (b) {
    var p = b.dataset.nav.split(':');
    var actif = p[0] === t;
    if (actif && p[1] && b.closest('#navLaterale')) {
      var so = t === 'controles' ? soE : (t === 'refs' ? soR : null);
      actif = !!so && so.dataset.se === p[1];
    }
    if (b.closest('#pane-plus')) actif = false;
    if (b.classList.contains('nav-actif') !== actif) b.classList.toggle('nav-actif', actif);
    if (actif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  /* compteurs et visibilite recopies des sous-onglets d'origine */
  document.querySelectorAll('#navLaterale [data-miroir]').forEach(function (s) {
    var src = document.getElementById(s.dataset.miroir);
    var txt = src ? src.textContent.replace(/[()]/g, '').trim() : '';
    if (s.textContent !== txt) s.textContent = txt;
  });
  var soEnt = document.querySelector('#epi-so .sous-onglet[data-se="entretiens"]');
  var nlEnt = document.querySelector('#navLaterale [data-nav="controles:entretiens"]');
  if (soEnt && nlEnt && nlEnt.hidden !== soEnt.hidden) nlEnt.hidden = soEnt.hidden;
  var cp = document.querySelector('#navLaterale [data-compte="prets"]');
  if (cp) {
    var n = (rawRows.materiels || []).filter(function (m) { return m._statut === 'Prete'; }).length;
    var v = n ? String(n) : '';
    if (cp.textContent !== v) cp.textContent = v;
  }
}
document.querySelectorAll('[data-nav]').forEach(function (b) {
  b.addEventListener('click', function () { naviguer(b.dataset.nav); });
});
document.querySelectorAll('#pane-plus [data-plus]').forEach(function (b) {
  b.addEventListener('click', function () {
    if (b.dataset.plus === 'reglages') ouvrirReglages(); else ouvrirAide();
  });
});
new MutationObserver(function () {
  clearTimeout(window.__navTimeout);
  window.__navTimeout = setTimeout(majNav, 30);
}).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });
'''
p='/home/claude/v2/widget_pilotage.js'; s=open(p,encoding='utf-8').read()
a="renderControlesActions();\ngrist.onRecords(load);"
assert s.count(a)==1
s=s.replace(a, js.strip('\n') + "\n\n" + a)
open(p,'w',encoding='utf-8').write(s)
print("ecrit")
