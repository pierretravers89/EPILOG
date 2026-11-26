# Journal des versions

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
EPILOG suit un versionnement par **millésime** : l'outil vit au rythme des
saisons d'un club, pas des sprints.

---

## [2026.5.39] — 2026-11-26

### Une seule largeur pour toutes les fenêtres

- Toutes les fenêtres en surimpression ont désormais **la même largeur, 1 040 px** : éditeurs, formulaires de création, fiche, Réglages du club, Découper, Scinder et Aide. Il y en avait cinq jusqu'ici (680, 760, 880, 1 140 et 1 240 px), fixées à des moments différents.
- La hauteur suit le contenu, jusqu'à la taille de l'écran (l'Aide garde sa hauteur fixe, nécessaire à son menu). Sur téléphone, rien ne change : plein écran.
- Une seule variable de mise en forme (`--largeur-fenetre`) porte cette largeur.
- Test : `test_41_fenetres_edition.py` vérifie la même largeur pour toutes les fenêtres.

---

## [2026.5.38] — 2026-11-25

### Fenêtres d'édition et saisie protégée

- **Toute modification et toute création s'ouvre dans une fenêtre** par-dessus la liste, qui garde sa place : les 10 éditeurs (lot, exemplaire, prêt, contrôle, incident, catégorie, lieu, fournisseur, adhérent, commande), les 7 formulaires de création (lot, prêt, contrôle, incident, réparation, commande, entretien), « Ajouter des exemplaires », « Rattacher à un lot » et la fiche d'un exemplaire.
- Deux largeurs : **standard** (880 px) et **large** (1 240 px, formulaires à listes à cocher et fiche), jamais toute la largeur d'un grand écran ; défilement à l'intérieur de la fenêtre, boutons Enregistrer / Annuler fixés en bas ; **plein écran sur téléphone**.
- **En-tête** de chaque fenêtre : l'action en petites capitales rouges, puis ce sur quoi elle porte (« MODIFIER L'EXEMPLAIRE / CAS-002 — Casques Boreo », « NOUVEAU PRÊT / Bon n° 2026-015 »). Le document de secours affiché quand Grist bloque l'ouverture d'un onglet porte aussi un titre.
- **Saisie protégée** : sans saisie, un clic à côté ou Échap ferment ; après une saisie, ils ne ferment plus (la fenêtre tremble, un message rappelle « fermez avec Annuler ou ✕ »). Les boutons ✕, Annuler et Enregistrer ferment toujours. Même règle pour **Réglages du club**, **Découper un exemplaire** et **Scinder un lot**, qui fermaient jusqu'ici au moindre clic à côté en perdant la saisie.
- La page ne défile plus à l'ouverture d'un formulaire.
- Étape 2, à venir : les actions de la fiche (prêter, contrôler, incident…) en seconde fenêtre.
- Aide intégrée complétée. Test : `test_41_fenetres_edition.py` ; `test_09` adapté (le formulaire se ferme par Annuler) ; garde de l'aide (`test_27`) complétée.

---

## [2026.5.37] — 2026-11-25

### Aide : dépôt GitHub et mise à jour

- La page d'aide **« Mettre à jour EPILOG »** gagne une section **« Où trouver la dernière version »** : adresse du dépôt GitHub, page Releases et `CHANGELOG.md` pour savoir si une version plus récente existe, récupération des deux fichiers (pièces jointes des releases, ou boutons « Copy raw file » / « Download raw file » dans `src/`), signalements dans la page Issues (sans jamais y joindre de données du club).
- La rubrique **« À propos »** porte le lien du dépôt (« Code source et mises à jour »).
- Rappel : la licence affichée dans l'aide est l'EUPL 1.2 depuis la 2026.5.36 ; un widget qui affiche encore l'ancienne licence n'a simplement pas reçu le nouveau code.
- Test : `test_40_aide_github.py` ; garde de l'aide (`test_27`) complétée.

---

## [2026.5.36] — 2026-11-25

### Licence : EUPL 1.2 (logiciel) et CC BY-SA 4.0 (documentation)

- EPILOG passe de CC BY-NC-SA 4.0 à la **licence publique de l'Union européenne (EUPL) v1.2** : logiciel libre, copyleft (une version modifiée et diffusée, ou hébergée pour d'autres, reste sous EUPL avec son code), mentions d'auteur à conserver, texte français officiel de même valeur. Creative Commons déconseille ses licences pour le logiciel ; la clause « non commercial » excluait EPILOG du logiciel libre.
- **Documentation** sous **CC BY-SA 4.0** (`docs/LICENCE_DOCUMENTATION.md`).
- Code : en-têtes du JS et du HTML (copyright, « Licensed under the EUPL », `SPDX-License-Identifier: EUPL-1.2`), pied des documents imprimés, rubrique « À propos » (plus d'image chargée depuis creativecommons.org ; lien vers le texte officiel français).
- `LICENSE` = texte officiel de l'EUPL 1.2 (version anglaise, reconnue par GitHub). `CONDITIONS_UTILISATION.md` réécrit : conditions, nom EPILOG, usage commercial, responsabilité (article 8 : la licence n'exclut pas la responsabilité pour faute intentionnelle, dommages directs aux personnes physiques et responsabilité du fait des produits).
- README, CREDITS, charte graphique, feuille de route et guide Word mis à jour. Correction : README et CREDITS affirmaient « aucune dépendance, ni CDN » ; ils mentionnent désormais SheetJS (Apache 2.0) et ExcelJS (MIT), chargés depuis cdnjs pour l'import/export Excel.
- Les copies diffusées avant cette version restent sous CC BY-NC-SA 4.0.
- Test : `test_39_licence.py`.

---

## [2026.5.35] — 2026-11-25

### Exemplaire retrouvé

- Un exemplaire **Perdu** ou **Volé** peut être déclaré **retrouvé** : bouton « Déclarer retrouvé » sur sa fiche, et « Retrouvé » dans le tableau du lot. Une fenêtre demande la date et une observation facultative ; un rappel discret « prévenir l'assurance ou la police » s'affiche pour un vol.
- Effet, en une seule écriture : la sortie d'inventaire est levée et un **incident « Contrôle à réaliser »** est créé (« Retrouvé le … — déclaré perdu le … : <commentaire de perte>. <observation> »). L'exemplaire passe en **Examen requis** et ne redevient disponible qu'après un contrôle, possible le jour même. L'épisode reste dans la fiche de vie et le registre.
- Le commentaire de perte est recopié dans l'incident puis vidé sur l'exemplaire.
- **Faille corrigée** : vider « Sortie d'inventaire » dans « Éditer l'exemplaire » remettait un EPI perdu ou volé directement « En service », sans contrôle et sans trace. Ce chemin produit maintenant la même écriture (avis affiché dans l'éditeur). Corriger une erreur de saisie sur « Réformé » ou « Cédé » reste libre.
- Contrôles : date de retour ni future, ni antérieure à la perte. Aucune mise à jour de structure.
- Aide intégrée complétée. Test : `test_38_exemplaire_retrouve.py` ; garde de l'aide (`test_27`) complétée.

---

## [2026.5.34] — 2026-11-22

### Exemplaire unique

- À la création d'un lot, une case **Exemplaire unique** met la quantité à 1 et masque le champ. Une aide d'une phrase explique que le lot ne contiendra qu'un exemplaire et qu'on pourra en ajouter plus tard.
- Quantité saisie à 1 sans la case : une aide discrète le signale et propose la case.
- Un lot qui ne compte qu'un exemplaire s'affiche **« exemplaire unique »** au lieu de « lot de 1 » dans la liste du Matériel, et « 1 (exemplaire unique) » sur la fiche du lot.
- Rien de stocké de nouveau : l'affichage se déduit du nombre réel d'exemplaires, donc il reste juste si l'on ajoute ou scinde des exemplaires plus tard. Aucune mise à jour de structure.
- Aide intégrée complétée. Test : `test_37_exemplaire_unique.py` ; garde de l'aide (`test_27`) complétée.

---

## [2026.5.33] — 2026-11-15

### Rubrique unique « Import / export »

- Nouvelle rubrique **Import / export** (menu latéral, onglet d'origine, et « Plus » sur téléphone), organisée par intention : **1. Reprendre un inventaire** (modèles Excel et CSV, import), **2. Exporter tout le parc** (classeur Excel, inventaire CSV, inventaire imprimable, fiches de vie PDF), **3. Sauvegarder et restaurer** (sauvegarde .json, import d'une sauvegarde, remise à zéro **repliée** en bas).
- Chaque action n'existe plus qu'à un seul endroit : la Vue d'ensemble n'a plus qu'un lien « Exporter / importer des données → », l'onglet Réglages › Sauvegarde un lien d'ouverture, le bouton « Importer un inventaire… » de l'onglet Matériel mène à la rubrique.
- Les exports de la rubrique portent sur **tout le parc**, sans tenir compte des filtres de l'onglet Matériel ; dans cet onglet, « Exporter la liste » et « Imprimer la liste » (ex-« Exporter (CSV) » et « Inventaire imprimable ») suivent les filtres affichés.
- Inchangés, car liés à leur écran : registre d'un lot, bon de prêt, contrôles, achats, statistiques.
- La carte « Premiers pas » (parc vide) propose « Importez-le » pour les clubs qui ont déjà un tableur.
- Aide intégrée réécrite (sauvegarde/export, import, mise à jour). Tests : `test_36_rubrique_import_export.py` ; tests 23 à 26, 33 et 34 adaptés ; garde de l'aide (`test_27`) complétée.

---

## [2026.5.32] — 2026-11-15

### Inventaire imprimable : photo du modèle de chaque lot

- La photo du modèle de chaque lot apparaît en vignette à côté du titre du lot dans l'inventaire imprimable (elle n'y figurait pas jusqu'ici ; la fiche du lot et les fiches de vie la montraient déjà).
- Lots sans photo : rien de changé. Colonne « Photo » par exemplaire : inchangée (seulement si un exemplaire du lot a sa propre photo).
- Test : `test_35_photo_lot_inventaire.py`.

---

## [2026.5.31] — 2026-11-10

### Import : erreurs regroupées, colonnes non reconnues, dernier contrôle, modèle CSV

Priorités recadrées par Pierre : l'import sert surtout au **démarrage**, pour
basculer un parc depuis un tableur.

- **Erreurs identiques regroupées** (aperçu et rapport) : « catégorie
  "Harnais" inconnue — 80 lignes (2, 3, 4…) » au lieu de 80 messages ; titre
  « 2 erreurs à corriger (81 lignes concernées) ».
- **Colonnes non reconnues visibles dans l'aperçu**, avant de confirmer (elles
  n'étaient signalées que dans le rapport : une colonne « Marque » à la place de
  « Fabricant » était ignorée en silence). Avertissement, pas erreur.
- **« Dernier contrôle » (+ « Résultat du dernier contrôle ») dans la feuille
  Inventaire** (modèle Excel et import) : un contrôle par exemplaire, sans
  contrôleur, mention « Repris de l'inventaire d'origine », **« Conforme »
  supposé** si le résultat manque (signalé dans le rapport). La feuille
  Contrôles, si elle décrit l'exemplaire, fait foi. Les mots « jamais » et
  « jamais contrôlé » (écrits par l'export) valent « pas de contrôle ».
- **Modèle CSV à télécharger**, aux **mêmes colonnes que l'export CSV** moins
  les colonnes calculées, plus « Quantite », avec une **ligne d'exemple**
  refusée par l'import tant qu'elle n'est pas supprimée. Une **fenêtre dans la
  page** (et non `confirm()`) rappelle les limites avant le téléchargement :
  catégories déjà existantes (celles du club listées), pas de menus, Excel
  abîme les CSV, format des dates, ce qui n'est pas repris.
- **Export CSV** : nouvelle colonne **« Sortie du parc »** ; **une seule liste de
  colonnes** (`INV_CSV`) pour l'export et le modèle, avec un test d'alignement.
- **Aller-retour vérifié** : l'export CSV réimporté dans un document ayant les
  mêmes catégories et lieux redonne **104/104 exemplaires sans aucun écart, dates
  de sortie comprises**, et recrée le dernier contrôle de chacun.
- Aide : paragraphes « Modèle CSV », « Dernier contrôle », erreurs regroupées.
- 35 suites, 657 vérifications (nouveau : `test_34_import_ameliorations`).

---

## [2026.5.30] — 2026-11-10

### Modèle d'import : de vrais menus déroulants reliés entre les feuilles

- **Les listes de la feuille « Listes » alimentent désormais des menus
  déroulants** dans les autres feuilles (signalé par Pierre, capture à
  l'appui : les listes ne communiquaient pas). Menus : Catégorie (strict),
  Lot, Lieu, Statut (saisie libre acceptée), Nature réglementaire, Oui/Non,
  Résultat et Type de contrôle, Exemplaire ; contrôles de saisie : durée et
  quantité entières, prix positif.
- **Les menus Catégorie, Lieu et Lot regroupent l'existant et le décrit** :
  valeurs déjà dans EPILOG + formules qui lisent les feuilles Catégories,
  Lieux de stockage et Lots du classeur. Une catégorie décrite dans la feuille
  Catégories apparaît donc aussitôt dans le menu de l'Inventaire (vérifié par
  recalcul dans LibreOffice).
- **Titres de colonnes colorés selon l'importance** (bleu foncé obligatoire,
  orange obligatoire pour les EPI soumis au vieillissement, bleu moyen
  recommandé, bleu clair facultatif), **notes d'aide** sur les titres, ligne de
  titres figée, légende dans le mode d'emploi.
- **Deux bibliothèques, deux rôles** : ExcelJS (MIT, cdnjs, chargée au clic)
  **fabrique** le modèle ; SheetJS continue de **lire** xlsx, xls, ods. Si
  ExcelJS ne se charge pas, le modèle sans menus est produit, avec un message.
- Les feuilles du modèle (« Mode d'emploi », « Listes ») ne sont plus
  signalées comme « ignorées » dans le rapport. Aide : paragraphe sur les menus
  et le collage spécial. 34 suites, 614 vérifications.

---

## [2026.5.29] — 2026-11-09

### Import d'un inventaire existant (bascule depuis un tableur)

- **Rubrique Matériel → « Importer un inventaire… »**. Un **modèle Excel à
  télécharger** (Mode d'emploi, Inventaire, Catégories, Lots, Lieux de
  stockage, Contrôles, Listes) reprend **les feuilles et les noms de colonnes
  de l'export lisible** : un export complet d'EPILOG est lui-même importable
  (les feuilles d'historique sont ignorées et nommées). La feuille « Listes »
  contient les catégories et les lieux **du club**. Idée de Pierre.
- **Lecture** de .xlsx, .xls, .ods et .csv (UTF-8 ou Windows-1252, séparateur
  détecté ; le CSV se lit sans bibliothèque). Colonnes lues **par leur nom**
  (accents, casse et « * » sans importance), pas par position.
- **Champs imposés par EPILOG** : *obligatoires* — Catégorie, Marquage (sauf
  si une **Quantité** est indiquée : EPILOG numérote lui-même avec le préfixe
  de la catégorie), Date de fabrication (ou l'année seule) pour le matériel
  soumis au vieillissement ; *fortement recommandés* (signalés en bloc, jamais
  bloquants) — Fabricant, Modèle, Lieu, N° de série ; *facultatifs* — le reste.
- **Lots déduits** : même catégorie + fabricant + modèle + année de
  fabrication ; colonne « Lot » pour forcer un regroupement, feuille « Lots »
  pour en préciser les valeurs, rattachement à un lot existant de même
  catégorie. **Nouvelles catégories** décrites dans la feuille Catégories ;
  lieux créés d'après leur nom ; **contrôles** repris (contrôleurs créés avec le
  rôle « Contrôleur EPI habilité ») ; **sorties du parc** reprises (Statut
  Perdu / Volé / Réformé / Cédé + date).
- **Garde-fous** : aperçu chiffré avant toute écriture, erreurs **localisées
  (feuille et numéro de ligne)** avec suggestion (« Casque » → « Casques »),
  **strict** (une erreur bloque tout), marquages en double refusés (dans le
  fichier et dans le document), **écriture d'un bloc** (tout ou rien),
  l'import **ajoute seulement**, sauvegarde suggérée si le document n'est pas
  vide. Re-choisir le même fichier corrigé fonctionne.
- **Rapport imprimable (PDF)**, consultable **avant** de confirmer : à traiter
  en priorité (sécurité), **liste à étiqueter** (plages « CAS001 à CAS012 »),
  données à compléter, créé automatiquement, non repris (photos, notices,
  factures, commandes, historique), éléments du fichier ignorés.
- **Export** : la feuille/le CSV Inventaire gagne **« Date de fabrication »** et
  **« Durée de vie (mois) »** (valeurs du lot) ; une commande sans référence
  s'affiche « Commande sans référence (#8) » au lieu de « #8 ».

### Aide

- **Nouvelle page « Mettre à jour EPILOG »** (demande de Pierre) : méthode 1
  (remplacer le code dans le document, recommandée) et méthode 2 (document
  neuf + sauvegarde .json), avec **tous** les coûts de la seconde : adresse
  qui change, partage à refaire, pièces jointes non reprises, historique perdu.
  Section « Importer un inventaire existant ».
- 34 suites, 594 vérifications (nouveau : `test_33_import_inventaire`, dont
  l'**acceptation** : l'export réel anonymisé du club, importé dans un document
  vide, redonne 104 exemplaires, 11 lots, 9 catégories, 2 lieux, 49 contrôles).

---

## [2026.5.28] — 2026-10-21

### Retrouver un prêt par personne

- **Onglet Prêts : un champ « Rechercher un prêt »** au-dessus des deux
  listes. Il cherche dans le **numéro de bon, la personne, la sortie ou
  l'activité et le marquage des exemplaires**, dans les prêts **en cours et
  terminés** (avant : numéro de bon seulement, prêts en cours seulement).
  Demande d'un testeur.
- **Recherche tolérante** : sans accents ni majuscules (« helene » trouve
  « Hélène Dupré »), plusieurs mots se cumulent (« guillaume falaise »),
  un compteur indique combien de bons correspondent.
- **La saisie est conservée** quand l'écran se rafraîchit (retour d'un
  exemplaire, etc.). Le champ reste disponible même s'il n'y a plus de prêt
  en cours. Documents sans numéro de bon : le champ filtre les lignes du
  tableau.
- **Onglet Matériel** : le champ Rechercher retrouve aussi un exemplaire
  par le **nom de la personne qui l'a emprunté en ce moment**
  (« qui a ce casque ? »), avec la même tolérance aux accents et aux
  plusieurs mots.
- Aide : paragraphe « Retrouver un prêt ». 33 suites, 529 vérifications
  (nouveau : `test_32_recherche_prets`).

---

## [2026.5.27] — 2026-10-21

### Photos individuelles des exemplaires

- **Jusqu'à 4 photos par exemplaire**, dans « Éditer l'exemplaire » (même
  bloc que les contrôles et les incidents : ajout, suppression à l'unité ;
  sur téléphone, l'appareil photo s'ouvre directement). **Réduites
  automatiquement à l'envoi** (1 600 px de côté, JPEG) : une photo de
  5,8 Mo pèse environ 1 Mo ; les petites photos partent telles quelles.
- **Affichage** : galerie sur la fiche de l'exemplaire ; section « Photos
  de l'exemplaire » dans la fiche de vie, donc dans le registre et les
  fiches de vie en PDF ; **colonne de vignettes** dans la fiche du lot et
  l'inventaire imprimable (seulement si au moins un exemplaire a une
  photo) ; **nombre de photos** dans la feuille Inventaire de l'Excel et
  dans le CSV (un classeur ne porte pas les images).
- Nouvelle colonne **`MATERIELS.photo`** (Pièces jointes), **créée
  automatiquement** par le système ci-dessous.

### Structure du document : vérifiée et complétée par le widget

- **À chaque mise à jour, EPILOG compare la structure du document à celle
  qu'il attend** (`SCHEMA` : 14 tables, leurs colonnes, la version qui a
  introduit chacune) et **crée lui-même les éléments nouveaux** (aujourd'hui :
  `MATERIELS.photo`). Il n'ajoute que : rien d'existant n'est modifié ni
  supprimé.
- **Marque `structure_version` dans CONFIG** : ce qui est antérieur à la
  marque n'est **jamais** recréé sans demande (un club peut avoir
  volontairement renoncé à un module facultatif). Un document sans marque
  est supposé à l'état 2026.5.26.
- **Document vide** : bandeau « Installer la structure d'EPILOG » (14 tables
  vides, dans l'ordre des références ; confirmation demandée).
- **Réglages → Fonctionnement → Structure du document** : état, éléments
  manquants, bouton « Créer les éléments manquants » ; bouton « Créer la
  table CONFIG » si elle manque. Le Diagnostic donne le même état.
- **Droits insuffisants** (modifier la structure d'un document peut être
  réservé) : bandeau explicite, l'outil continue de fonctionner, **une seule
  tentative par chargement**, un propriétaire n'a qu'à ouvrir EPILOG une fois.
- Aide : nouvelle section « Structure du document », paragraphe sur les
  photos. Tests : `test_30_structure` (dont parité du SCHEMA avec la
  structure réelle du document du club), `test_31_photos_exemplaires` ;
  banc d'essai étendu (création de tables et colonnes, refus de droits).
  32 suites, 503 vérifications.

---

## [2026.5.26] — 2026-10-20

### Version visible, commentaire non répété

- **Le numéro de version s'affiche dans le pied de page** (« EPILOG
  v2026.5.26 »), sur chaque écran. Le code d'EPILOG vit dans chaque
  document Grist : une ancienne copie peut subsister après une mise à jour
  sans qu'on le voie. Constat de Pierre : couleur et taille n'apparaissaient
  pas dans ses exports alors que le code livré les produit bien sur ses
  données réelles (vérifié, voir dossier technique §7.73).
- **Inventaire imprimable** : un commentaire déjà repris dans la colonne
  « Observations » (exemplaire sorti du parc : « Perdu le … — Perdu dans le
  ravin. ») n'est plus répété dans la colonne « Commentaire ».
- Nouveau test sur un jeu de données **calqué sur le document réel** du club
  (`donnees_reelles.py`) : dégaines orange et noires, crashpads, morceaux de
  corde découpés à couleur vide. 30 suites, 442 vérifications.

---

## [2026.5.25] — 2026-10-20

### Détails des exemplaires dans les documents imprimés

- **Inventaire imprimable** et **fiche du lot** : le tableau des
  exemplaires ajoute de lui-même les colonnes **n° de série**, **couleur**,
  **taille** (ou **longueur** pour les catégories découpables : cordes,
  sangles) et **commentaire**, **seulement si au moins un exemplaire du
  lot les renseigne**. Un lot sans détail garde son tableau habituel, sans
  colonne vide. Le commentaire, texte libre, a une largeur minimale.
- **Registre / fiche de vie d'un exemplaire** : ajout de la ligne
  **Commentaire** (la couleur et la taille y figuraient déjà). Le
  commentaire garde aussi la trace des scissions et des découpes.
- **Export CSV de l'inventaire et feuille Inventaire de l'Excel** :
  colonnes **Couleur**, **Taille ou longueur** et **Commentaire** ajoutées,
  pour que l'export et le document imprimé disent la même chose.
- Valeurs échappées (un commentaire contenant du HTML s'affiche tel quel).
- Aide : une phrase dans la section sur la fiche de vie.
- 29 suites, 430 vérifications (nouveau : `test_28_details_exemplaires`).

---

## [2026.5.24] — 2026-10-20

### Aide à jour, version corrigée

- **L'aide intégrée** décrit enfin : le **menu de gauche réductible en
  icônes** (infobulles, choix mémorisé), et l'affichage **sur téléphone**
  (tableaux en cartes, champs vides masqués, sous-rubriques en boutons
  arrondis, bouton « ⋯ » des actions rares d'un lot). Constat de Pierre :
  l'aide n'avait pas suivi les dernières évolutions de menu.
- **Numéro de version corrigé** : la constante restée à 2026.5.20 pendant
  trois livraisons apparaissait dans la feuille « Résumé » de l'export
  Excel et dans les sauvegardes `.json`. Elle est maintenant la 2026.5.24.
- **Garde-fou** (`test_27_aide_et_version`) : la version du logiciel doit
  être celle de la première entrée du CHANGELOG, la sauvegarde `.json`
  doit la porter, l'aide doit mentionner les fonctions récentes, et son
  sommaire doit correspondre à ses sections.
- 28 suites, 411 vérifications.

---

## [2026.5.23] — 2026-10-19

### Fiches de vie en PDF, export Excel seul

- **Vue d'ensemble → « Fiches de vie (PDF)… »** : une fenêtre de
  configuration (catégories cochables avec « Toutes », lieu de stockage,
  exemplaires **en circulation / sortis du parc / sortis depuis plus de
  3 ans** — conservation réglementaire échue, arrêté du 22/10/2009 art. 3 —
  / tous), compteur de fiches, confirmation au-delà de 50 fiches. Une
  fiche par page, à imprimer ou « Enregistrer en PDF ». Export seul, aucune
  suppression (décision de Pierre).
- **Date de sortie du parc** déduite (date de sortie saisie, sinon date
  du contrôle de réforme, sinon 31/12 de l'année de fin de vie), affichée
  sur la fiche de vie imprimée (avec « conservation de 3 ans échue ») et
  dans l'Excel.
- **Export CSV global retiré** (14 fichiers, inutilisable) : l'export
  lisible est l'Excel seul ; si la bibliothèque ne se charge pas, message
  clair, sans fichiers en rafale. Les exports CSV d'un seul fichier
  (inventaire, registre des contrôles, achats) restent.
- Le registre PDF d'un lot utilise la même fonction (`exporterFichesDeVie`).
- 27 suites, 394 vérifications.

---

## [2026.5.22] — 2026-10-19

### Remise à zéro (Réglages → Sauvegarder / importer des données)

- Sous-rubrique **renommée « Sauvegarder / importer des données »**.
- **Remettre à zéro**, deux choix seulement (décision de Pierre, après
  avoir écarté une liste de cases plus fine, sans usage réel) :
  **Tout effacer** (matériel, historique, commandes, listes du club ;
  indispensable avant un import) ou **Garder les listes du club**
  (catégories, lieux, fournisseurs, adhérents conservés). Les **réglages
  du club sont toujours conservés**.
- Bilan en chiffres de ce qui sera effacé, **sauvegarde .json téléchargée
  d'office avant** (si elle échoue, on s'arrête), puis confirmation
  habituelle « Tapez SUPPRIMER » (casse indifférente).
- Effacement **d'un bloc** : en cas d'erreur, rien n'est effacé. Le message
  final rappelle la sauvegarde et l'historique des versions de Grist.
- 26 suites, 378 vérifications (nouveau : `test_25_remise_a_zero`).

---

## [2026.5.21] — 2026-10-19

### L'export lisible rejoint la Vue d'ensemble

- **« Exporter tout le parc »** (Classeur Excel, Fichiers CSV) est
  désormais dans la **Vue d'ensemble**, juste au-dessus des statistiques
  du club : c'est un geste de compte rendu (bureau, AG, financeurs).
  Demande de Pierre.
- **Réglages → Sauvegarde** garde la sauvegarde `.json` et l'import
  (gestes d'administration), avec un renvoi vers la Vue d'ensemble.
  Déplacé, pas dupliqué. Aide mise à jour. 359 vérifications.

---

## [2026.5.20] — 2026-10-19

### Sauvegarde, transfert et export lisible (Réglages → Sauvegarde)

- **Export lisible**, au choix **classeur Excel (.xlsx)** ou **fichiers
  CSV** (un par thème) : Résumé, Inventaire (statut, fin de vie,
  prolongation, prochain contrôle, n° de série), Lots, Commandes,
  Contrôles, Prêts, Incidents, Réparations, Entretien, Catégories, Lieux,
  Fournisseurs, Adhérents (et Demandes si la table existe). Noms à la
  place des numéros internes, dates jj/mm/aaaa, colonnes futures incluses
  d'office. Excel s'appuie sur la bibliothèque SheetJS (0.18.5, cdnjs),
  chargée seulement au clic ; si elle ne se charge pas, les CSV sont
  produits à la place, avec un message.
- **Sauvegarde (.json)** : toutes les tables, valeurs brutes, numéros de
  ligne conservés, réglages inclus. Pièces jointes **non incluses** et
  listées dans le fichier.
- **Import d'une sauvegarde** : **uniquement dans un document vide** ;
  aperçu avant écriture (lignes par table, tables et colonnes absentes du
  document) ; écriture **d'un bloc** (en cas d'erreur, rien n'est écrit).
  Les numéros de ligne d'origine sont réutilisés : tous les liens (lot,
  exemplaire, adhérent, découpe…) restent justes. Les statuts sont
  recalculés au rechargement.
- Le bouton « Enregistrer » des réglages est masqué dans cette
  sous-rubrique (ses boutons agissent tout de suite). Nouvelle section
  d'aide « Sauvegarder et exporter » (21 sections).
- Tests : faux Grist rendu fidèle (numéros de ligne imposés, ajout par
  lots, tout ou rien) ; 25 suites, 357 vérifications.

---

## [2026.5.19] — 2026-10-18

### Aide

- **Ouvrir EPILOG sans l'interface de Grist** : ajouter `?style=singlePage`
  à l'adresse de la page (avant un éventuel `#`). Grist masque alors sa
  barre d'outils, le menu des pages et le panneau de conception ; la page
  reste modifiable et soumise aux droits de chacun. Essayé et validé par
  Pierre. Confort d'affichage, pas une protection.

---

## [2026.5.18] — 2026-10-18

### Navigation, livraison 2

- **Menu de gauche rétractable** (demande de Pierre) : bouton « Réduire
  le menu » en tête ; replié, il ne garde que les icônes (64 px), avec une
  infobulle sur chacune, et deux icônes pour Suivi des EPI et Listes du
  club. Le choix est mémorisé dans le navigateur. Menu replié, la barre
  de sous-rubriques réapparaît en tête de la rubrique (Incidents,
  Réparations… restent accessibles ; trou repéré sur la capture).
- **Téléphone** : sous-rubriques (Suivi des EPI, Listes du club) en
  **pastilles** ; actions rares d'un lot (Registre, Scinder, Éditer,
  Supprimer) derrière un bouton **« ⋯ »**, « Fiche du lot » restant
  visible. Sur ordinateur et tablette, tous les boutons restent affichés.
- **Vocabulaire unifié** : « Contrôles, incidents et réparations »
  devient **« Suivi des EPI »** partout, y compris sur l'onglet des écrans
  intermédiaires (qui tient désormais sur une ligne à 800 px). L'aide et
  les messages parlent de **rubriques** et **sous-rubriques** ; « onglet »
  ne subsiste que pour les vrais onglets (écran intermédiaire, navigateur).
- 23 suites, 319 vérifications (nouveau : `test_22_navigation_2`).

---

## [2026.5.17] — 2026-10-18

### Nouvelle navigation (étape 2, livraison 1 — d'après la maquette validée)

- **Ordinateur (écran d'au moins 1 000 px)** : un **menu à gauche**
  remplace les onglets et les sous-onglets. Rubriques : Vue d'ensemble,
  Matériel, Prêts (compteur), **Suivi des EPI** (Contrôles avec alerte
  « n en retard », Incidents, Réparations, Entretien), Achats et budget,
  puis **Listes du club** (Catégories, Lieux, Fournisseurs, Adhérents,
  avec leurs compteurs). L'entrée active est surlignée, et suit aussi les
  passages faits par d'autres chemins (alertes, liens internes).
- **Téléphone (640 px ou moins)** : **barre de 5 icônes en bas** —
  Accueil, Matériel, Prêts, Suivi EPI, Plus — et page **« Plus »**
  (Achats et budget, Vue d'ensemble, Listes du club, Réglages, Aide).
- **Écran intermédiaire** (tablette, panneau Grist étroit) : onglets
  d'origine, **inchangé au pixel près** (11 écrans comparés).
- Aucun écran réécrit : la navigation actionne les onglets d'origine,
  toujours présents dans la page.
- Aide : la présentation des rubriques décrit les trois modes.
- 22 suites, 301 vérifications (nouveau : `test_21_navigation`).

---

## [2026.5.16] — 2026-10-08

### Affichage sur téléphone (l'ordinateur ne change pas)

- **Tableaux en cartes** sous 640 px de large : chaque ligne (exemplaire,
  prêt, contrôle, historique de fiche…) devient une carte, le titre de
  colonne rappelé devant chaque valeur (« Lieu : Local club »). Fin du
  défilement horizontal illisible.
- **Champs vides masqués** dans les cartes (« Couleur : - »).
- **Boutons** qui passent à la ligne en pleine largeur ; **sous-onglets**
  qui défilent du doigt comme les onglets ; **onglets collants** en haut
  de l'écran.
- **Ordinateur strictement inchangé** : 11 écrans comparés au pixel près
  avant et après (`tests/captures_ecrans.py`, `tests/compare_captures.py`).
- 21 suites, 284 vérifications (nouveau : `test_20_mobile`).

---

## [2026.5.15] — 2026-10-08

### Numéros de série du fabricant

- Nouvelle colonne facultative **`MATERIELS.numero_serie`** (Texte).
- **Saisie objet en main** : « Éditer le lot → Saisir les numéros de
  série », une ligne par marquage du club ; on peut enregistrer en cours
  de route et reprendre plus tard.
- **Saisie à la création du lot** (optionnelle) : un numéro par ligne,
  dans l'ordre des marquages, avec **aperçu de la correspondance**
  (« CAS101 ← 21A0345 »). Refus avant toute écriture s'il y a plus de
  numéros que d'exemplaires ou un doublon dans la liste.
- **Doublons** : même numéro deux fois dans le lot → refus ; numéro déjà
  porté par un exemplaire du même fabricant dans un autre lot →
  avertissement (« faute de frappe ? »), non bloquant.
- Affiché sur la fiche de l'exemplaire et la fiche de vie imprimée
  (identification), modifiable dans « Éditer l'exemplaire », retrouvé par
  les **recherches** (onglet Matériel et formulaires : utile pour un
  rappel fabricant), présent dans l'**export CSV** de l'inventaire.
- Aide (création de lot) complétée. 20 suites, 272 vérifications.

---

## [2026.5.14] — 2026-10-08

### Réparation : des règles plus claires

- **Plus de porte vers une réparation impossible.** Pour une catégorie
  fermée à la réparation (et non découpable), le bouton « Déclarer une
  réparation » de la fiche, les options « À réparer » (contrôle) et
  « Réparation à prévoir » (incident) disparaissent, avec une ligne qui
  explique pourquoi ; ces exemplaires ne figurent plus dans le formulaire
  groupé. Avant : visibles, puis bloqués par un avertissement. Les cordes
  découpables gardent l'accès (découpe).
- **Le matériel non-EPI suit la même règle** que les EPI : réparable
  seulement si la case est cochée (elle s'affiche désormais pour toutes
  les natures). Fin de la « réparation libre ». Au CAF d'Auxerre :
  **seules les Raquettes à neige** sont concernées — cocher la case si
  elles se réparent.
- **« Une réparation peut prolonger la durée de vie »** n'est proposée que
  pour un EPI **soumis au vieillissement** ; repasser une catégorie en
  « non soumis » ou « non-EPI » la décoche. Les prolongations déjà
  enregistrées restent dans l'historique.
- Une réparation **déjà en cours** reste toujours clôturable, quelle que
  soit la catégorie. Diagnostic mis à jour.
- 19 suites, 253 vérifications.

---

## [2026.5.13] — 2026-10-08

### Corrigé — premier enregistrement des Réglages dans un document neuf

- **« Erreur : [Sandbox] TypeError '<' not supported between instances
  of 'float' and 'str' »** en enregistrant les Réglages d'un document dont
  la table CONFIG est vide (copie « sans données », archive pour un autre
  club). Cause : la colonne cachée `manualSort` de Grist (ordre des
  lignes, numérique), vide, était prise pour la colonne des valeurs ;
  Grist refusait d'y écrire du texte. Les colonnes techniques de Grist
  sont désormais écartées, et les noms usuels (`Valeur`, `valeur`…) sont
  préférés.
- **Valeurs par défaut neutres** : « Mon club », « Mon club · Fédération »
  au lieu du CAF d'Auxerre, pour qu'un club qui installe l'outil voie des
  champs à remplir. L'auteur et le contact restent ceux du créateur de
  l'outil (crédits, licence).
- Le faux Grist des tests refuse désormais, comme le vrai, du texte dans
  `manualSort`. Tests : table CONFIG vide (premier enregistrement, puis
  mise à jour sans doublon) et table remplie. 18 suites, 239
  vérifications.

---

## [2026.5.12] — 2026-10-07

### Corrigé — régression de la 2026.5.4

- **Le groupe « Identité » des Réglages avait disparu** : titre et
  sous-titre du bandeau, nom du club, année, contact, auteur,
  description. Signalé par Pierre (« je ne retrouve pas le réglage du
  bandeau »). Cause : la passe d'accents avait accentué « Identité » dans
  le filtre du panneau mais pas dans la liste des groupes, qui ne se
  correspondaient plus. Les Liens utiles et l'Apparence n'étaient pas
  touchés.
- Recherche systématique des autres mots accentués d'un côté et pas de
  l'autre : 19 cas examinés, un seul était comparé par le code (celui-ci).
- Outil d'accents durci : une comparaison à travers une parenthese
  (`(x || 'mot') === y`) est désormais reconnue.
- Nouveau test du parcours complet : ouvrir les Réglages, changer le
  titre, enregistrer, vérifier le bandeau. 17 suites, 230 vérifications.

---

## [2026.5.11] — 2026-10-07

### Corrigé

- **« Remplacer » une pièce jointe remplace vraiment** : « Modifier la
  photo » et « Modifier la notice » (éditeur de lot), « Remplacer la
  facture » (Achats et budget). Avant, le nouveau fichier s'ajoutait à
  côté de l'ancien, qui restait stocké.
- Les **galeries de photos** des contrôles et des incidents continuent
  d'**ajouter** (plusieurs photos par contrôle ou incident), vérifié.
- Les fichiers déjà doublés par le passé ne sont pas nettoyés
  automatiquement : remplacer une fois la pièce jointe concernée suffit.
- 16 suites, 221 vérifications.

---

## [2026.5.10] — 2026-10-07

### Facture dans le formulaire de commande (Éditer le lot)

- **Champ « Facture » directement dans le formulaire** « Modifier la
  commande » et « Créer la commande de ce lot » (signalé par Pierre : le
  bouton séparé, hors du formulaire, ne se trouvait pas). Le bouton séparé
  est retiré ; le résumé indique « Facture : jointe / aucune ».
- **Remplacement réel** : choisir une nouvelle facture remplace
  l'ancienne (après confirmation), au lieu de s'y ajouter.
- Si l'envoi du fichier échoue, la commande reste enregistrée et un
  message le dit clairement.
- Test d'envoi réel avec serveur Grist simulé. 15 suites, 215
  vérifications.

---

## [2026.5.9] — 2026-10-07

### La commande d'un lot accessible depuis « Éditer le lot »

- **Encadré « Commande »** dans l'éditeur de lot : résumé (référence,
  fournisseur, dates, montant, financement), **« Modifier la commande »**
  (mêmes champs et contrôles que dans Achats et budget) et **facture**
  (ajouter / remplacer). Avant, la commande ne se modifiait que dans
  Achats et budget, sans que rien ne le dise.
- **Lot saisi sans commande** : « + Créer la commande de ce lot », montant
  proposé = prix unitaire × exemplaires, commande rattachée
  automatiquement.
- **Commande partagée** : « Cette commande concerne aussi : … — la
  modifier ici la modifie pour ces lots aussi. »
- **Menu « Commande d'origine » lisible** : « référence — fournisseur —
  date » ; une commande sans référence n'apparaît plus vide.
- Piège évité (vu en test) : après création, l'éditeur du lot se rouvre
  sur des données fraîches ; sinon « Enregistrer » sur le lot aurait
  détaché la commande.
- Aide (Achats et budget) complétée. 14 suites, 206 vérifications.

---

## [2026.5.8] — 2026-10-07

### Ordre des boutons (onglet Matériel)

- Du geste le plus courant au plus rare, le plus risqué en dernier :
  **« Éditer » est partout l'avant-dernier bouton, « Supprimer » le
  dernier** (demande de Pierre : éditer est un geste exceptionnel).
  - Lot : Fiche du lot · Registre (PDF) · Scinder le lot · Éditer le lot ·
    Supprimer.
  - Ligne d'exemplaire : (Contrôler / Réparer si besoin) · Fiche de vie ·
    Éditer l'exemplaire · Supprimer.
  - Fiche d'un exemplaire : Prêter · Contrôler · Déclarer une réparation ·
    Déclarer un incident · Fiche de vie à imprimer · Éditer l'exemplaire ·
    Supprimer.
- Aucun bouton ajouté ni retiré. 13 suites, 193 vérifications.

---

## [2026.5.7] — 2026-10-07

### Corrigé

- **Le bloc « Prolonger la durée de vie » n'apparaissait pas** dans le
  formulaire groupé de réparation quand on cochait les exemplaires à la
  main (signalé par Pierre, capture à l'appui). Il n'était recalculé
  qu'au rendu de la liste, pas à chaque changement de sélection. Il l'est
  désormais à chaque coche, retrait d'étiquette, « Vider » ou « Tout
  cocher », dans tous les formulaires groupés.
- Le test passait parce qu'il remplissait la sélection par programme : il
  coche désormais à la main, comme un utilisateur (casque seul → bloc
  masqué, dégaine cochée → bloc visible).

---

## [2026.5.6] — 2026-10-07

### Prolonger la durée de vie par une réparation

- **Nouvelle coche de catégorie** « Une réparation peut prolonger la
  durée de vie », juste sous « Maintenance prévue par le fabricant », avec
  son aide. Masquée et décochée tant que la maintenance n'est pas cochée.
- **Dans les formulaires de réparation** (les cinq chemins : déclaration
  depuis la fiche ou en groupe, clôture, incident, contrôle), un bloc
  facultatif : date de fabrication de la pièce neuve et durée de vie
  (pré-remplie avec celle de la catégorie), avec aperçu de la nouvelle fin
  de vie avant d'enregistrer. Visible seulement pour les exemplaires d'une
  catégorie cochée ; en groupe, seuls ceux-là sont prolongés.
- **La nouvelle fin de vie part de la pièce neuve**, pas de l'ancienne
  date : sangle fabriquée en 04/2025 → 31/12/2035, même posée en 2026.
- **Fin de vie par exemplaire** partout : statut (réforme calendaire),
  vétusté, alertes de la Vue d'ensemble, budget de renouvellement,
  inventaire. L'en-tête du lot signale « n prolongé(s) par réparation ».
- **Traçabilité** : la fiche de vie indique « prolongée le … par
  remplacement de : … (pièce fabriquée le …, 120 mois ; initialement
  31/12/…) ». Supprimer la réparation rend l'ancienne date.
- **Dégaine arrivée en fin de vie** : elle garde le bouton « Déclarer une
  réparation (prolonger) », et une réparation en cours la fait apparaître
  « En réparation » plutôt que « Réformé ». Après réparation, contrôle
  obligatoire comme toujours. Une réforme *décidée* (contrôle, perte, vol)
  reste définitive.
- Colonnes facultatives : `CATEGORIES.prolongation_par_reparation`
  (Booléen), `REPARATIONS.date_fabrication_piece` (Date),
  `REPARATIONS.duree_vie_piece_mois` (Entier). Diagnostic et aide à jour.

### Tests

- 12 suites, 186 vérifications.

---

## [2026.5.5] — 2026-10-07

### Retiré

- **La case « Aller à un marquage… » du bandeau est supprimée.** Elle ne
  cherchait que dans les marquages et doublonnait la recherche de
  l'onglet Matériel, qui trouve marquage, lot, modèle et fabricant. On y
  tapait « Petzl » et elle répondait « Aucun exemplaire ». Pour aller à
  un exemplaire : onglet Matériel, « Rechercher », puis clic sur
  l'exemplaire. L'aide est mise à jour.

### Tests

- 10 suites, 152 vérifications.

---

## [2026.5.4] — 2026-10-07

### Interface accentuée

- **Passe d'accents sur tous les libellés de l'interface** (environ 470
  textes) : titres, boutons, champs, aides, messages. « Filtrer par
  categorie », « Materiel a preter » deviennent « Filtrer par catégorie »,
  « Matériel à prêter ».
- **Rien de ce que le logiciel compare ou enregistre ne change** : statuts
  (« En reparation », « Reforme »…), résultats de contrôle, rôles, suites
  d'incident, valeurs des listes de choix, identifiants, clés et
  sélecteurs restent identiques, vérifié automatiquement. Les données
  déjà saisies dans Grist ne sont pas touchées.
- Restent volontairement sans accents : les documents imprimables, les
  exports CSV et le Diagnostic.
- Outil réutilisable : `outils/accents.py`.

### Lot nommé comme sa catégorie

- **Avertissement non bloquant** quand le nom d'un lot est celui de sa
  catégorie (« Baudriers » dans Baudriers), insensible à la casse, aux
  accents et au pluriel : à la création d'un lot, en éditant un lot et au
  moment d'une scission. Il disparaît dès que le nom se distingue.

### Tests

- 10 suites, 148 vérifications. Les tests ne dépendent plus des accents
  du texte affiché.

---

## [2026.5.3] — 2026-10-07

### Améliorations

- **Recherche élargie** dans tous les formulaires à cocher : marquage,
  nom du lot, **modèle** et **fabricant**, comme dans l'onglet Matériel.
  L'invite annonçait « marquage ou modèle », mais le modèle n'était pas
  cherché.
- **Dates affichées en jj/mm/aaaa partout** : fiches, historiques,
  listes, documents imprimables et exports CSV. Elles mêlaient
  « 2024-10-07 » et « 31/12/2033 ». Les champs de saisie de date, les
  noms de fichiers et les commentaires déjà enregistrés ne changent pas.
- **Filtre de lieu** ajouté aux formulaires de contrôle, d'entretien et
  d'ajout de matériel à un bon (il existait pour le prêt), avec les menus
  restreints et la ligne « disponible ailleurs ». Pas de filtre de lieu
  pour les incidents et réparations, déclarés après coup.

### Tests

- 9 suites, 136 vérifications (ajout : recherche, dates, lieux sur les
  six formulaires).

---

## [2026.5.2] — 2026-10-07

### Menus de lots

- **Lots rangés sous leur catégorie** (intertitres non cliquables), avec
  le fabricant entre parenthèses : un lot nommé comme sa catégorie
  (« Baudriers ») ne se confond plus avec elle.
- **Choisir un lot règle la catégorie toute seule** ; revenir à
  « Toutes » efface aussi le lot. Pour passer à un lot d'une autre
  catégorie, on repasse par « Toutes » ou on choisit la catégorie.
- Appliqué partout où l'on choisit un lot : les six formulaires à filtres
  (prêt, édition d'un bon, contrôle, incident, réparation, entretien),
  le rattachement des exemplaires orphelins et le champ Lot de l'éditeur
  d'exemplaire (ces deux derniers : groupement seul, sans menu
  catégorie). La scission, déjà limitée à la catégorie du lot, ne change pas.

### Tests

- 8 suites, 104 vérifications (ajout : menus de lots sur les huit
  emplacements).

---

## [2026.5.1] — 2026-10-07

### Corrigé

- **Formulaire de prêt : le filtre « Lieu de stockage » restreint
  désormais les menus Catégorie et Lot.** Avant, ils proposaient un lot
  entièrement rangé ailleurs, et la liste répondait « Aucun matériel
  disponible » sans explication. Le menu des lieux reste complet.
- **Ligne d'explication sous la liste** quand une recherche précise
  (catégorie, lot ou texte) trouve du matériel dans un autre lieu :
  « 4 autres exemplaires disponibles ailleurs : Coffre gymnase (4)… ».
- **Supprimer un exemplaire ou un lot efface aussi ses réparations**,
  comme ses contrôles, prêts, incidents et entretiens ; l'avertissement
  les compte. Elles devenaient orphelines.

### Tests

- 7 suites, 64 vérifications (ajout : filtre de lieu, cascade des
  réparations).

---

## [2026.5] — 2026-10-07

### Fiche de vie : indications de l'arrêté du 22 octobre 2009

- **Notice fabricant** sur la fiche de vie de l'exemplaire (« Jointe au
  registre » / « Non jointe »), comme sur celle du lot. Ligne absente si
  la colonne `notice` n'existe pas.
- **Périodicité des contrôles** (« 12 mois au plus ») et **date du
  prochain contrôle** sur la fiche de l'exemplaire. « Sans objet » pour
  un exemplaire sorti du parc, mention « premier contrôle » pour un
  exemplaire jamais contrôlé, « en retard » si l'échéance est passée.
- Fiche du lot : périodicité et colonne **Prochain contrôle** dans le
  tableau des exemplaires.
- Simple inscription : la date est celle que l'outil calculait déjà,
  aucune règle de calcul ne change.

### Entretien du matériel

- **Sous-onglet « Entretien »** dans Contrôles, incidents et réparations :
  déclaration groupée (filtrer, cocher, valider une fois) avec date,
  auteur et commentaire facultatif. Une bulle d'aide précise ce que
  recouvre le mot.
- Une seule nature déclarée (« entretenu ») : nettoyage, lavage ou
  désinfection selon la notice du fabricant, précisé au besoin en
  commentaire.
- **Aucun effet** sur le statut ni sur l'échéance de contrôle : un
  entretien ne remplace pas un contrôle.
- Historique sur la fiche interactive, section « Entretien » sur les
  fiches de vie de l'exemplaire et du lot, suppression d'une ligne avec
  confirmation, effacement des entretiens avec l'exemplaire supprimé,
  signalement dans le Diagnostic.
- Table facultative **`ENTRETIENS`** : `materiel` (Référence →
  MATERIELS), `date_entretien` (Date), `auteur` (Référence → ADHERENTS),
  `commentaire` (Texte). Sans elle, rien n'apparaît.
- Aide embarquée : nouvelle section « Déclarer un entretien » (20 sections).

### Corrigé

- **Toast « Prêt créé »** jamais affiché après un prêt depuis la fiche
  d'un exemplaire (le code testait `'pret'` au lieu de `'preter'`).
- **Marquages absents** des toasts de prêt groupé, de contrôle et
  d'incident (« 2 contrôle(s) : , ») : lecture de `marquage` au lieu de
  `numero_marquage`, à trois endroits.

### Tests

- Harnais de test reconstruit et sauvegardé avec le projet (`tests/`) :
  faux Grist, données alignées sur le schéma réel, 5 suites, 51
  vérifications.

---

## [2026.4] — 2026-09-26

### Scinder un lot

- **Bouton « Scinder le lot »**, sur l'en-tête de chaque lot : détache les
  exemplaires cochés vers un **nouveau lot** ou un **lot existant de la
  même catégorie** — utile quand une reprise d'inventaire révèle que des
  articles achetés à des moments différents ont été groupés à tort.
- **Historique de contrôle, de prêt et de réparation intact par
  construction** : ces tables référencent l'exemplaire, jamais le lot —
  aucune trace ne se perd en changeant l'appartenance d'un exemplaire.
- **Champs du nouveau lot** : catégorie, fabricant et modèle repris de
  l'origine (modifiables) ; date de fabrication, durée de vie et prix
  volontairement vides — précisément les champs propres à un achat
  précis, qu'on ne peut plus garantir pour un sous-groupe détaché.
  Désignation toujours à saisir soi-même, jamais suggérée.
- **Traçabilité dans les deux sens** : le nouveau lot reçoit un
  commentaire expliquant son origine ; le lot d'origine reçoit une note
  ajoutée (jamais écrasée) sur ce qui en est parti et quand.
- Aucune nouvelle colonne Grist requise.

---

## [2026.3] — 2026-09-15

### Découpe d'un exemplaire — cordes, sangles, cordelettes

- **Troisième issue à « Déclarer une réparation »**, à côté de « À prévoir »
  et « Déjà effectuée » : « Découpée ». Une catégorie marquée « peut être
  découpé » (Listes du club) la propose, seule ou aux côtés des deux autres
  selon qu'elle admet aussi une réparation classique.
- **Fenêtre dédiée**, ouverte automatiquement dès l'exemplaire sélectionné :
  nombre de morceaux, sort de chacun (nouvel exemplaire ou mis au rebut),
  longueur, couleur et lieu de stockage hérités de l'origine (modifiables).
- **Marquage filiatif** jamais retapé à la main (`COR-004` → `COR-004-A`,
  `COR-004-B`...), et lien de filiation visible sur la fiche du nouveau
  morceau comme sur les deux fiches de vie (interactive et imprimable).
- **L'exemplaire d'origine se réforme automatiquement**, avec un
  commentaire généré qui résume toute l'opération. Un morceau mis au rebut
  ne laisse qu'une trace dans ce commentaire, jamais un enregistrement à
  lui.
- Écran vide (plus aucun radio) quand ni la réparation ni la découpe ne
  sont ouvertes pour ce qui est visible — évite de laisser cliquer des
  choix qui n'auraient mené qu'à un blocage silencieux à la sauvegarde.
- Champ **Taille relabellisé « Longueur »** pour les catégories
  découpables, sur les trois endroits qui l'affichent (tableau du lot,
  fiche interactive, fiche imprimable) — même champ réutilisé, pas de
  doublon.

---

## [2026.2] — 2026-08-17

### Réparations — refonte complète

- **Formulaire dédié**, séparé du formulaire d'incident : plus de gravité,
  plus de suite à donner, plus de photo — le mot « incident » n'y apparaît
  plus. Même traçabilité qu'avant en arrière-plan.
- **Déclaration groupée**, directement dans le sous-onglet Réparations
  (fini la redirection vers Incidents) : filtre par catégorie ou par lot,
  sélection multiple, traçabilité individuelle par exemplaire.
- **Sélecteur « À prévoir / Déjà effectuée »**, en tête de formulaire :
  si la réparation est déjà faite au moment de la déclaration, plus besoin
  de repasser par l'étape intermédiaire.
- **Case « inspection de sécurité réalisée »**, mise en valeur visuellement
  (encadré qui change de couleur) : cochée, l'exemplaire repasse
  directement en service — la réparation vaut aussi contrôle, à condition
  de le dire explicitement. Décochée par défaut : c'est une attestation,
  pas une supposition favorable.
- **Fenêtre de clôture** (« Déclarer la réparation effectuée ») alignée sur
  les mêmes capacités que la déclaration : champ « qui » et inspection de
  sécurité désormais disponibles là aussi.
- **Sélection préventive** : dans la déclaration groupée, les exemplaires
  dont la catégorie est fermée à la réparation sont grisés et non
  cochables d'emblée, avec l'avertissement affiché dès le filtre — plus
  besoin de cocher puis décocher après coup.
- Nouvelle table facultative `REPARATIONS`, colonne facultative
  `intervenant_qui`.

### Habilitations

- Les listes **Contrôleur** et **Intervenant** (contrôle, réparation) se
  limitent désormais aux adhérents marqués **« Contrôleur EPI habilité »**
  — une liste plus pertinente, pas un système de droits. Repli automatique
  sur la liste complète si personne n'est encore marqué.
- Colonne facultative `role` sur `ADHERENTS`, éditable dans le formulaire
  d'adhérent existant.

### Échéance du prochain contrôle

- **Réglage de club** (Réglages → Fonctionnement) : « systématique »
  (chaque contrôle décale la date, comportement d'origine) ou « routine »
  (seuls les contrôles de routine la décalent — évite qu'un contrôle isolé
  suite à incident ou réparation ne fragmente le calendrier d'un lot
  contrôlé ensemble). Répond au point resté ouvert dans la version 2026.1.

### Navigation et interface

- Onglet renommé : « Contrôles & incidents EPI » → **« Contrôles,
  incidents et réparations »**.
- Correction : depuis la Vue d'ensemble, cliquer un élément « À traiter en
  priorité » (contrôle en retard, jamais contrôlé, incident en attente)
  ouvrait toujours le sous-onglet Contrôles, quel que soit l'élément
  cliqué — atterrit désormais au bon endroit dans tous les cas.

---

## [2026.1] — 2026-08-13

Première version publiable. L'outil tourne au Club Alpin Français d'Auxerre
depuis le printemps 2026.

### Identité

- Nom **EPILOG** (EPI + LOG, le journal) et logo — mousqueton à vis entourant
  un épicéa, sur bouclier
- Licence **CC BY-NC-SA 4.0**, mentions d'origine intégrées à l'interface, aux
  documents imprimés et aux fichiers exportés
- Palette du logo pilotable par variables CSS, distincte de la charte du club

### Inventaire

- Structure **lot / exemplaire** : le lot porte ce qui est commun, l'exemplaire
  ce qui lui est propre
- Marquage automatique par préfixe de catégorie, numérotation continue
- Refus des marquages en doublon (casse et espaces ignorés)
- Mode **reprise d'inventaire** pour du matériel déjà marqué
- Champs couleur et taille pour reconnaître un exemplaire dans une liste
- Rangement des lots hors service

### Prêts

- Bons **numérotés au millésime**, regroupant plusieurs exemplaires
- Retour d'un bon entier en un clic, ou exemplaire par exemplaire
- **Retour partiel** : le bon reste ouvert avec son compteur
- Modification d'un bon après coup, ajout de matériel oublié
- Bon d'emprunt imprimable, et **fiche vierge** pour les jours sans réseau
- Formulaire de demande d'emprunt facultatif, validé par le responsable

### Contrôles et incidents

- Contrôle groupé, traçabilité individuelle
- **Anticipation à 60 jours** de la campagne annuelle
- Jusqu'à **4 photos** par contrôle et par incident
- Incident créé automatiquement au retour d'un matériel dégradé
- Un incident peut couvrir plusieurs exemplaires
- Feuilles de contrôle et de déclaration d'incident imprimables, vierges
- Historiques repliés par année

### Documents

- **Fiche de vie** par exemplaire et **registre** par lot, imprimables
- Notice du fabricant et facture rattachées au registre
- Inventaire, registre des contrôles, export des commandes
- Tous les fichiers exportés préfixés `epilog-`

### Confort

- Statuts **déduits des faits**, jamais saisis
- Cartes-filtres en tête d'onglet
- Recherche d'un marquage depuis le bandeau, avec saut direct à la fiche
- Confirmations flottantes après chaque action
- Refus des dates impossibles
- Aide embarquée avec diagnostic intégré

### Personnalisation

- Titre, nom du club, fédération, année, contact, couleurs et liens
  réglementaires — sans toucher au code
- Réglages rangés dans une table `CONFIG` du document

---

## Points ouverts

**Prêt à un invité.** L'emprunteur doit figurer dans `ADHERENTS` ; certains clubs
prêtent à des participants d'essai.

**Trame de contrôle par catégorie.** Attacher la feuille d'inspection du
fabricant à la catégorie, pour l'avoir sous les yeux au moment de contrôler.

**Modules désactivables.** Un club qui ne fait pas de prêts formalisés, ou
qui suit son budget ailleurs, pourrait vouloir masquer ces onglets. Évalué
le 17/08 (voir `feuille_de_route.md`) : faisable, pas prioritaire, coût
asymétrique entre les deux modules — Prêts est contenu, Achats et budget
déborde largement de son propre onglet (le prix unitaire est un attribut
du lot, affiché à sept endroits différents).
