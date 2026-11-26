# Consignes de travail — EPILOG

Widget personnalisé Grist (HTML + JS, sans compilation) pour la gestion des EPI et du matériel
des clubs de montagne. Mainteneur : Pierre Travers. Échanges en français, au tutoiement.

## Façon de travailler

- **Claude propose, Pierre valide.** Pour toute évolution non triviale : évaluer, proposer
  (maquette si l'interface change), attendre l'accord avant de coder.
- **Grist réel** : lecture seule. Prévenir avant toute écriture, même sur une copie de test.
- Interfaces simples ; preuves (tests, captures) plutôt qu'affirmations.

## Organisation du dépôt

- `src/` : `widget_pilotage.html` et `widget_pilotage.js`, à coller dans le Custom Widget Builder.
- `tests/` : suites Playwright avec un faux Grist (voir `tests/README.md`, dont l'installation
  des bibliothèques dans `vendor/`, ignoré par git).
- `docs/` : installation, guide, `DOSSIER_TECHNIQUE.md` (une section 7.x par version),
  `feuille_de_route.md`.
- `outils/` : correctifs déjà appliqués, gardés pour la traçabilité.
- `CHANGELOG.md` : une entrée par version, la plus récente en tête.

## Routine de livraison (chaque version validée)

1. Tests d'abord : une suite `tests/test_NN_<sujet>.py` pour la nouveauté ; **toutes** les suites
   vertes (« 0 échec(s) ») avant de livrer.
2. Version : `VERSION_EPILOG` dans `src/widget_pilotage.js` = première entrée de `CHANGELOG.md`
   (millésime `2026.5.N`), contrôlé par `test_27`. Toute fonction visible nouvelle est décrite dans
   l'aide intégrée et ajoutée à la garde de `test_27`.
3. Documentation : `CHANGELOG.md`, section du `DOSSIER_TECHNIQUE.md`, `feuille_de_route.md` si
   besoin, aide intégrée.
4. Livrer à Pierre les deux fichiers de `src/` (il les colle dans Grist).
5. Commit sur `main` (titre = titre de l'entrée du CHANGELOG, ex. « 2026.5.35 — Exemplaire
   retrouvé »), puis `git push`.
6. Version marquante (fonction visible, action demandée aux clubs) : préparer une **release**
   `v2026.5.N` avec les deux fichiers de `src/` et l'entrée du CHANGELOG. Si la session ne peut pas
   la créer, donner à Pierre le texte et les étapes (Releases → Create a new release).
   Les notes vont dans la description de la release (et l'historique dans `CHANGELOG.md`) :
   jamais de fichier de notes déposé dans le dépôt. Releases non créables depuis ces sessions
   (GitHub répond 403) : c'est Pierre qui publie.

Une branche unique, `main`. Signalements des utilisateurs : onglet *Issues*, à consulter en début
de session quand il y en a.

## Ce qui ne va jamais dans ce dépôt public

- Aucune donnée réelle d'un club (noms, e-mails, licences d'adhérents, documents `.grist`).
  Les données de test sont fictives ou anonymisées.
- Aucun identifiant de document Grist, aucune note de travail interne : `REPRISE_CONVERSATION.md`
  (passation entre sessions) reste hors du dépôt et est livré à Pierre comme fichier.

## Licence

Code sous **EUPL 1.2**, documentation sous **CC BY-SA 4.0**. Tout fichier de code nouveau porte en
tête : `© <année> Pierre Travers`, puis `Licensed under the EUPL v1.2` et
`SPDX-License-Identifier: EUPL-1.2`. `test_39` vérifie les mentions visibles.

## Pièges connus

- Espace de travail effacé entre sessions : repartir d'un clone de ce dépôt.
- Dates des données de test : toujours relatives à aujourd'hui (`ts()`), jamais figées.
- `[hidden]` est écrasé par le CSS des champs : masquer avec `style.display`.
- Un lot dont tous les exemplaires sont hors parc est rangé dans un volet replié : ses boutons
  sont présents mais invisibles tant qu'on ne le déplie pas.
