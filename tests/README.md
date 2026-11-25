# Tests EPILOG

Harnais Playwright (Python) qui charge le widget hors de Grist, avec un faux `window.grist`
(`mock_grist.js`) et des données en mémoire (`donnees.py` ; `donnees_reelles.py` et
`export_reel_anonymise.xlsx` reprennent la structure d'un document réel, données anonymisées).

## Installer

    pip install playwright openpyxl && playwright install chromium

Trois suites (export Excel, import d'inventaire) servent localement les bibliothèques que le
widget charge depuis cdnjs. Les placer une fois dans `vendor/` à la racine du dépôt
(dossier ignoré par git) :

    mkdir -p vendor/exceljs && cd vendor
    npm pack xlsx@0.18.5 && tar xzf xlsx-0.18.5.tgz
    cd exceljs && npm pack exceljs@4.4.0 && tar xzf exceljs-4.4.0.tgz

LibreOffice (`soffice`) est utilisé par quelques vérifications de formules du modèle d'import.

## Lancer

Depuis le dossier `tests/` :

    python3 test_00_chargement.py                                   # une suite
    for t in test_*.py; do echo "$t: $(python3 $t | tail -1)"; done  # toutes

Chaque suite se termine par « N vérifications réussies, 0 échec(s) ». Variables facultatives :
`EPILOG_SRC` (dossier du widget, par défaut `../src`) et `EPILOG_VENDOR` (par défaut `../vendor`).

## Règles

- Aucun identifiant codé en dur dans les assertions : passer par les dictionnaires renvoyés
  par `construire()`.
- Modifier les données avant le chargement ; dates relatives à aujourd'hui (`ts()`), jamais figées.
- Ouvrir une fiche via `ouvrirFicheExemplaire`, jamais via « Fiche de vie » (document imprimable).
- Toute fonction visible nouvelle est ajoutée à la garde de l'aide (`test_27`).
