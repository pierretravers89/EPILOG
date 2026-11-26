Première version publiée sur GitHub. Elle regroupe les nouveautés des versions 2026.5.36 à 2026.5.39.

**Installer ou mettre à jour** : faites d'abord une sauvegarde (rubrique « Import / export »), puis remplacez le contenu des deux zones du widget dans Grist par les deux fichiers joints ci-dessous (`widget_pilotage.html` et `widget_pilotage.js`). Pas-à-pas détaillé dans l'aide d'EPILOG : bouton « ? », puis « Mettre à jour EPILOG ». Vos données ne sont jamais touchées.

Une question, un souci ? Écrivez à pierre.travers@gmail.com.

---

### [2026.5.39] — 2026-11-26

### Une seule largeur pour toutes les fenêtres

- Toutes les fenêtres en surimpression ont désormais **la même largeur, 1 040 px** : éditeurs, formulaires de création, fiche, Réglages du club, Découper, Scinder et Aide. Il y en avait cinq jusqu'ici (680, 760, 880, 1 140 et 1 240 px), fixées à des moments différents.
- La hauteur suit le contenu, jusqu'à la taille de l'écran (l'Aide garde sa hauteur fixe, nécessaire à son menu). Sur téléphone, rien ne change : plein écran.
- Une seule variable de mise en forme (`--largeur-fenetre`) porte cette largeur.
- Test : `test_41_fenetres_edition.py` vérifie la même largeur pour toutes les fenêtres.


### [2026.5.38] — 2026-11-25

### Fenêtres d'édition et saisie protégée

- **Toute modification et toute création s'ouvre dans une fenêtre** par-dessus la liste, qui garde sa place : les 10 éditeurs (lot, exemplaire, prêt, contrôle, incident, catégorie, lieu, fournisseur, adhérent, commande), les 7 formulaires de création (lot, prêt, contrôle, incident, réparation, commande, entretien), « Ajouter des exemplaires », « Rattacher à un lot » et la fiche d'un exemplaire.
- Deux largeurs : **standard** (880 px) et **large** (1 240 px, formulaires à listes à cocher et fiche), jamais toute la largeur d'un grand écran ; défilement à l'intérieur de la fenêtre, boutons Enregistrer / Annuler fixés en bas ; **plein écran sur téléphone**.
- **En-tête** de chaque fenêtre : l'action en petites capitales rouges, puis ce sur quoi elle porte (« MODIFIER L'EXEMPLAIRE / CAS-002 — Casques Boreo », « NOUVEAU PRÊT / Bon n° 2026-015 »). Le document de secours affiché quand Grist bloque l'ouverture d'un onglet porte aussi un titre.
- **Saisie protégée** : sans saisie, un clic à côté ou Échap ferment ; après une saisie, ils ne ferment plus (la fenêtre tremble, un message rappelle « fermez avec Annuler ou ✕ »). Les boutons ✕, Annuler et Enregistrer ferment toujours. Même règle pour **Réglages du club**, **Découper un exemplaire** et **Scinder un lot**, qui fermaient jusqu'ici au moindre clic à côté en perdant la saisie.
- La page ne défile plus à l'ouverture d'un formulaire.
- Étape 2, à venir : les actions de la fiche (prêter, contrôler, incident…) en seconde fenêtre.
- Aide intégrée complétée. Test : `test_41_fenetres_edition.py` ; `test_09` adapté (le formulaire se ferme par Annuler) ; garde de l'aide (`test_27`) complétée.


### [2026.5.37] — 2026-11-25

### Aide : dépôt GitHub et mise à jour

- La page d'aide **« Mettre à jour EPILOG »** gagne une section **« Où trouver la dernière version »** : adresse du dépôt GitHub, page Releases et `CHANGELOG.md` pour savoir si une version plus récente existe, récupération des deux fichiers (pièces jointes des releases, ou boutons « Copy raw file » / « Download raw file » dans `src/`), signalements dans la page Issues (sans jamais y joindre de données du club).
- La rubrique **« À propos »** porte le lien du dépôt (« Code source et mises à jour »).
- Rappel : la licence affichée dans l'aide est l'EUPL 1.2 depuis la 2026.5.36 ; un widget qui affiche encore l'ancienne licence n'a simplement pas reçu le nouveau code.
- Test : `test_40_aide_github.py` ; garde de l'aide (`test_27`) complétée.


### [2026.5.36] — 2026-11-25

### Licence : EUPL 1.2 (logiciel) et CC BY-SA 4.0 (documentation)

- EPILOG passe de CC BY-NC-SA 4.0 à la **licence publique de l'Union européenne (EUPL) v1.2** : logiciel libre, copyleft (une version modifiée et diffusée, ou hébergée pour d'autres, reste sous EUPL avec son code), mentions d'auteur à conserver, texte français officiel de même valeur. Creative Commons déconseille ses licences pour le logiciel ; la clause « non commercial » excluait EPILOG du logiciel libre.
- **Documentation** sous **CC BY-SA 4.0** (`docs/LICENCE_DOCUMENTATION.md`).
- Code : en-têtes du JS et du HTML (copyright, « Licensed under the EUPL », `SPDX-License-Identifier: EUPL-1.2`), pied des documents imprimés, rubrique « À propos » (plus d'image chargée depuis creativecommons.org ; lien vers le texte officiel français).
- `LICENSE` = texte officiel de l'EUPL 1.2 (version anglaise, reconnue par GitHub). `CONDITIONS_UTILISATION.md` réécrit : conditions, nom EPILOG, usage commercial, responsabilité (article 8 : la licence n'exclut pas la responsabilité pour faute intentionnelle, dommages directs aux personnes physiques et responsabilité du fait des produits).
- README, CREDITS, charte graphique, feuille de route et guide Word mis à jour. Correction : README et CREDITS affirmaient « aucune dépendance, ni CDN » ; ils mentionnent désormais SheetJS (Apache 2.0) et ExcelJS (MIT), chargés depuis cdnjs pour l'import/export Excel.
- Les copies diffusées avant cette version restent sous CC BY-NC-SA 4.0.
- Test : `test_39_licence.py`.
