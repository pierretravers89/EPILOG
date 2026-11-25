# Crédits — EPILOG

**EPILOG** — Logiciel de gestion des EPI pour clubs alpins et de montagne
© 2026 Pierre Travers · Logiciel sous licence EUPL 1.2 · Documentation sous CC BY-SA 4.0

---

## Conception et développement

**Pierre Travers** — conception fonctionnelle, développement, documentation.
Contact : pierre.travers@gmail.com

L'outil a été conçu pour le **Club Alpin Français d'Auxerre**, affilié à la
FFCAM, puis rendu paramétrable pour tout club de montagne.

## Identité visuelle

Le logo — mousqueton à vis enserrant un épicéa, sur bouclier — a été **généré
par Google Gemini** à la demande de Pierre Travers, qui a également trouvé le
nom du logiciel.

Le SVG livré était directement pilotable par variables CSS. Cette qualité a été
conservée à l'intégration : la palette est déclarée une seule fois dans `:root`
(voir `widget_pilotage.html`, section « Palette du logo EPILOG »), et le logo se
repeint partout où il apparaît.

Le nom **EPILOG** joue sur deux sens : **EPI** (équipement de protection
individuelle) et **LOG** (journal, registre) — ce que fait exactement l'outil,
tenir le registre de vie des EPI. L'épicéa du logo prolonge le jeu de mot par
la sonorité.

## Plateforme

**Grist** (Grist Labs) — l'outil est un *custom widget* Grist. Les données
vivent dans le document Grist du club ; EPILOG n'en héberge aucune.

## Références réglementaires citées

Ces documents sont cités, jamais reproduits. Ils appartiennent à leurs auteurs.

- **FFCAM** — recommandations fédérales pour la gestion du matériel EPI
- **FFME** — page EPI
- **AFNOR** — norme **NF S 72-701** (version en vigueur : septembre 2024 ; la première édition date d'avril 2008)
- **Arrêté du 22 octobre 2009** — contenu de la fiche de gestion des EPI (article 2)

Les liens sont paramétrables par club dans les réglages : ils ne sont pas figés
dans le code, précisément parce qu'ils changent.

## Dépendances

**Aucune au fonctionnement courant.** Ni framework, ni compilation, ni gestionnaire de paquets :
le logiciel tient en deux fichiers — `widget_pilotage.html` et `widget_pilotage.js` — collés dans
le Custom Widget Builder de Grist.

Seuls l'import et l'export Excel chargent **à la demande**, depuis cdnjs, deux bibliothèques
publiques, non copiées dans le dépôt :

- **SheetJS** (`xlsx` 0.18.5) — Apache License 2.0 — lecture des classeurs et export Excel ;
- **ExcelJS** 4.4.0 — licence MIT — modèle d'import avec menus déroulants.

Ces licences sont compatibles avec l'EUPL. Sans réseau, tout le reste de l'outil fonctionne.

Ce choix est délibéré : un club doit pouvoir reprendre l'outil dans dix ans sans chaîne de
compilation ni dépendance obsolète.

---

## Contribuer

Les contributions (signalements, corrections, améliorations) sont les bienvenues sur le dépôt
GitHub. En proposant du code, vous acceptez qu'il soit diffusé sous **EUPL 1.2**, comme le reste
du logiciel ; une contribution à la documentation est diffusée sous **CC BY-SA 4.0**. Ce fichier
accueillera les contributeurs.
