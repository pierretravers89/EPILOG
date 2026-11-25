/* Faux window.grist pour tester EPILOG hors de Grist.
   Donnees : window.__DONNEES_TEST__ = { TABLE: { colonnes: [...], lignes: [{id, ...}] } }
   Journal des ecritures : window.__ACTIONS__ ; documents imprimables : window.__DOCS__. */
(function () {
  var D = window.__DONNEES_TEST__;
  window.__ACTIONS__ = [];
  window.__DOCS__ = [];
  function table(nom) {
    if (!D[nom]) throw new Error('Table inconnue : ' + nom);
    return D[nom];
  }
  function colonnaire(t) {
    var out = { id: t.lignes.map(function (r) { return r.id; }) };
    t.colonnes.forEach(function (c) {
      out[c] = t.lignes.map(function (r) { return r[c] === undefined ? null : r[c]; });
    });
    return out;
  }
  function prochainId(t) {
    return t.lignes.reduce(function (m, r) { return Math.max(m, r.id); }, 0) + 1;
  }
  function verifierColonnes(t, nom, champs) {
    Object.keys(champs).forEach(function (k) {
      if (t.colonnes.indexOf(k) === -1) throw new Error('Colonne inconnue ' + nom + '.' + k);
      /* comme le vrai Grist : manualSort (position) n'accepte que des nombres */
      if (k === 'manualSort' && typeof champs[k] !== 'number') {
        throw new Error("[Sandbox] TypeError '<' not supported between instances of 'float' and 'str'");
      }
    });
  }
  window.grist = {
    ready: function () {},
    onRecords: function (cb) { setTimeout(cb, 0); },
    docApi: {
      /* comme Grist : identifiants des tables existantes (les cles __xxx__ de D sont des reglages de test) */
      listTables: async function () {
        return Object.keys(D).filter(function (k) { return k.indexOf('__') !== 0; }).sort();
      },
      fetchTable: async function (nom) {
        if (nom === '_grist_Tables' || nom === '_grist_Tables_column') throw new Error('meta absente');
        return colonnaire(table(nom));
      },
      getAccessToken: async function () {
        return { token: 'jeton', baseUrl: 'http://localhost/api/docs/test' };
      },
      applyUserActions: async function (actions) {
        /* tout ou rien, comme Grist : copie avant, restauration si erreur */
        var copie = JSON.stringify(D);
        try { return appliquerActions(actions); }
        catch (e) {
          var orig = JSON.parse(copie);
          Object.keys(D).forEach(function (k) { delete D[k]; });
          Object.keys(orig).forEach(function (k) { D[k] = orig[k]; });
          throw e;
        }
      }
    }
  };
  function appliquerActions(actions) {
        var retValues = [];
        actions.forEach(function (a) {
          window.__ACTIONS__.push(JSON.parse(JSON.stringify(a)));
          /* modifications de STRUCTURE (2026.5.27) : refusees si D.__interdit_schema__
             (utilisateur sans droit d'edition de la structure) */
          if (a[0] === 'AddTable' || a[0] === 'AddColumn') {
            if (D.__interdit_schema__) throw new Error('Permission refusee : modification de la structure interdite');
            if (a[0] === 'AddTable') {
              if (D[a[1]]) throw new Error('Table deja existante : ' + a[1]);
              D[a[1]] = { colonnes: a[2].map(function (c) { return c.id; }), lignes: [],
                          types: a[2].reduce(function (o, c) { o[c.id] = c.type; return o; }, {}) };
            } else {
              if (!D[a[1]]) throw new Error('Table inconnue : ' + a[1]);
              var cid = a[2];
              if (D[a[1]].colonnes.indexOf(cid) !== -1) cid = cid + '_2';   /* Grist renomme au lieu de refuser */
              D[a[1]].colonnes.push(cid);
              D[a[1]].types = D[a[1]].types || {}; D[a[1]].types[cid] = a[3] && a[3].type;
            }
            retValues.push(null);
            return;
          }
          /* echec provoque par un test : window.__ECHEC_SUR__ = 'NOM_TABLE' */
          if (window.__ECHEC_SUR__ && window.__ECHEC_SUR__ === a[1]) throw new Error('echec simule sur ' + a[1]);
          var t = table(a[1]);
          if (a[0] === 'AddRecord') {
            verifierColonnes(t, a[1], a[3]);
            /* comme Grist : numero de ligne impose s'il est fourni et libre */
            var id = (a[2] && !t.lignes.some(function (x) { return x.id === a[2]; })) ? a[2] : prochainId(t);
            t.lignes.push(Object.assign({ id: id }, a[3]));
            retValues.push(id);
          } else if (a[0] === 'BulkAddRecord') {
            verifierColonnes(t, a[1], a[3]);
            var ids = a[2].map(function (rid) {
              if (rid && t.lignes.some(function (x) { return x.id === rid; })) throw new Error('Ligne deja existante ' + a[1] + '#' + rid);
              return rid || null;
            });
            ids.forEach(function (rid, i) {
              var nid = rid || prochainId(t), r = { id: nid };
              Object.keys(a[3]).forEach(function (k) { r[k] = a[3][k][i]; });
              t.lignes.push(r);
            });
            retValues.push(null);
          } else if (a[0] === 'UpdateRecord') {
            verifierColonnes(t, a[1], a[3]);
            var r = t.lignes.filter(function (x) { return x.id === a[2]; })[0];
            if (!r) throw new Error('Ligne absente ' + a[1] + '#' + a[2]);
            Object.assign(r, a[3]);
            retValues.push(null);
          } else if (a[0] === 'BulkUpdateRecord') {
            a[2].forEach(function (rid, i) {
              var r2 = t.lignes.filter(function (x) { return x.id === rid; })[0];
              Object.keys(a[3]).forEach(function (k) { r2[k] = a[3][k][i]; });
            });
            retValues.push(null);
          } else if (a[0] === 'RemoveRecord') {
            t.lignes = t.lignes.filter(function (x) { return x.id !== a[2]; });
            retValues.push(null);
          } else if (a[0] === 'BulkRemoveRecord') {
            t.lignes = t.lignes.filter(function (x) { return a[2].indexOf(x.id) === -1; });
            retValues.push(null);
          } else {
            throw new Error('Action non simulee : ' + a[0]);
          }
        });
        return { retValues: retValues };
  }
  /* capture des documents imprimables (fiche de vie, registre...) */
  window.open = function () {
    var buf = '';
    return { document: { open: function () {}, write: function (h) { buf += h; },
      close: function () { window.__DOCS__.push(buf); } } };
  };
})();
