# Feuille de route — fonctionnalités en réserve

**Widget de gestion d'inventaire — CAF Auxerre**

Fonctionnalités mises de côté, **retenues** parce qu'elles ont un intérêt réel *et* sont gérables par Grist (widget ou fonctions natives). Numéros **stables** : une idée réalisée garde son numéro (marqué ✅), une idée neuve reçoit le numéro suivant — jamais de renumérotation. Dis simplement « on lance le n° X ».

_Dernière mise à jour : 2026-08-13. **Tout livré sauf les n° 2 et 12** (en réserve). Branding EPILOG terminé (phases 1 à 4)._

_Ajouts ponctuels le 2026-08-17, le 2026-08-19 et le 2026-08-22 (section « En suspens technique » uniquement, trois idées en réserve — voir plus bas) ; le reste du document n'a pas été repris depuis le 13/08._

---

## 🌲 **BRANDING & LANGAGE**

**Statut :** ✅ **PHASE 1 LANCÉE & COMPLÉTÉE** (2026-08-12)

Le logiciel s'appelle **EPILOG** (jeu de mot : EPI + LOG = Journal).
- Licence : EUPL 1.2 pour le logiciel (libre, copyleft, mentions d'auteur obligatoires), CC BY-SA 4.0 pour la documentation — depuis 2026.5.36 ; avant : CC BY-NC-SA 4.0
- Logo : ✅ Créé par Gemini (variables CSS modifiables, mousqueton + épicéa + bouclier)
- Mentions obligatoires partout (en-tête, footer, config, aide, PDF, exports, etc.)

**Phase 1 (HAUTE) — COMPLÉTÉ (corrigé le 2026-08-13) :**
- ✅ Logo EPILOG **en remplacement** des piolets dans `.header-emblem`
- ✅ Ligne « EPILOG » discrète sous le filet rouge (titres du club inchangés)
- ✅ « EPILOG » inséré dans le **footer existant**, allégé pour faire place
- ✅ Bloc « Logiciel : EPILOG » en tête de l'« À propos » de l'aide
- ✅ Copyright header dans widget_pilotage.js
- ❌ Retiré : bouton + modale « À propos » du header (doublon), footer en double

**Phase 2 (MOYEN) — COMPLÉTÉ (2026-08-13) :**
- ✅ Logo **complet** en 250 px dans l'« À propos » de l'aide (encart élargi en 2 colonnes)
- ✅ Pied de page avec logo dans les **9 documents imprimables** (via `enveloppeFiche`)
- ✅ Logo + mise en page dans l'aide imprimée (correctif du carré noir)
- ✅ Footer allégé : « Grist » et la mention vétusté retirés
- ✅ **Bug corrigé** : `brancherApropos()` n'était pas appelé à l'init
- ✅ CREDITS.md, CONDITIONS_UTILISATION.md, BRANDING_GUIDELINES.md

**Phase 3 (MOYEN) — COMPLÉTÉ (2026-08-13) :**
- ✅ Traçabilité des exports par **préfixe `epilog-`** sur le nom de fichier
      (CSV *et* documents HTML), posé dans `telechargerCsv()` et `sortirDocument()`
- ⚠️ **Écarté volontairement** : lignes de métadonnées à l'intérieur des CSV —
      la 1ʳᵉ ligne porte les noms de colonnes, y insérer du texte casserait
      l'ouverture Excel/LibreOffice. Le nom de fichier remplit le même rôle sans risque.
- ✅ Guide `.docx` repassé au nom EPILOG (couverture + pied de licence)
      → renommé `guide_EPILOG_CAF_Auxerre.docx`

**Phase 4 (BASSE) — COMPLÉTÉ (2026-08-13) :**
- ✅ Palette du logo déclarée dans `:root` (11 variables), séparée de la charte club
- ❌ **Favicon — sans objet** : le widget est un fragment sans `<head>`, injecté
      dans une iframe Grist. L'onglet affiche l'icône de Grist.
- ❌ **package.json — sans objet** : aucune dépendance ni build, le livrable est
      2 fichiers collés dans Grist. Le manifeste n'aurait ni lecteur ni effet.

**Documents de référence :**
- `CREDITS.md` — attributions (logo Gemini, Grist, références réglementaires)
- `CONDITIONS_UTILISATION.md` — licence expliquée, dont les cas concrets d'usage commercial
- `BRANDING_GUIDELINES.md` — palette, déclinaisons du logo, où EPILOG apparaît
- `EPILOG_PHASE1_LIVRAISON.md` / `EPILOG_PHASE2_LIVRAISON.md` / `EPILOG_PHASE3_4_LIVRAISON.md`
- `epilog-logo.svg` — logo officiel de Gemini

**→ Branding terminé (phases 1 à 4).**

> 🔔 **Réserve sur le nom.** L'antériorité a été vérifiée le 2026-08-13 : le nom
> **EPILOG est très occupé** (Epilog Laser, marque FR de 2007, éditeur slovène de
> logiciel de traçabilité, paquets libres homonymes). **Décision : on garde
> EPILOG** — aucun risque tant que l'usage reste associatif, gratuit et non
> commercial. Mais le sujet doit être **rouvert avant** d'ouvrir un dépôt public,
> d'acheter un domaine, de diffuser hors CAF Auxerre ou d'envisager un usage
> commercial. Voir la section « Nom du logiciel » plus bas et
> `ANTERIORITE_NOM_EPILOG.md`.

---

## 🚀 **RÊVES & BRAINSTORMING FUTUR (Onglets inédits)**

**Status :** 💭 Dreaming mode (pas de prod, juste imagination)

On a imaginé 11 nouveaux onglets qui pourraient transformer EPILOG en **plateforme complète** :

1. 📊 **Analytics & Insights** — Tableau de bord matériel, heatmaps, prédictions
2. 🗓️ **Planification de Sorties** — Calendrier intelligent, check-list, réservations
3. 🤖 **Maintenance Prédictive** — "Docteur Matériel", fin de vie, coût repair vs replace
4. 👥 **Adhérents & Compétences** — Profils, score fiabilité, formations, restrictions
5. 📚 **Base de Connaissances** — Fiches + vidéos + certifications par matériel
6. 🌍 **Réseau CAF** — Marketplace inter-clubs, achats groupés, échange formateurs
7. 💚 **Impact Environnemental** — Bilan carbone, badges verts, recyclage
8. 🎮 **Gamification** — Leaderboards, défis, badges à débloquer
9. 💰 **Budget & ROI** — Coûts détaillés, forecast, optimisation achats
10. 🚨 **Audit & Compliance** — Historique immuable, responsabilité légale, alertes
11. 🤖 **IA & Recommandations** — Assistant intelligent, suggestions personnalisées

**Timeline imaginaire :**
- ✅ Maintenant (08/2026) : Widget prêts/contrôles/incidents + branding EPILOG
- Q4 2026 : Analytics + Planification
- Q1 2027 : Adhérents + Compétences + Base connaissances
- Q2 2027 : Maintenance + Budget
- Q3 2027 : Réseau CAF + Impact environnemental
- Q4 2027 : Gamification + IA

**Document complet :** `IDEES_FUTURES_FEATURES.md`

**→ À revisiter dans 12 mois si succès utilisateur**

---

## ⚠️ **DÉCISIONS MÉTIER EN SUSPENS (Priorité avant langage)**

**1. Contrôles suite à incident : doivent-ils repousser la date du prochain contrôle annuel ?**

**Contexte :** Quand un EPI est contrôlé suite à incident, la date du prochain contrôle s'éloigne. Or, les lots sont souvent contrôlés ensemble → fragmentation.

**3 options :**
1. **Statut quo** : Tout contrôle = +1 an (simple, mais fragmente)
2. **Distinction** : Seuls les contrôles de routine repoussent; incidents non (cohésion)
3. **Cas par cas** : L'utilisateur choisit à chaque fois (flexible, risque d'erreur)

**Documents pour arbitrage :**
- `AUDIT_LOGIQUE_CONTROLE.md` — Analyse détaillée
- `DECISION_REQUISE_CONTROLES_INCIDENTS.md` — Décision + implémentation

**Status :** 🔴 **EN ATTENTE DU RESPONSABLE MATÉRIEL CAF AUXERRE**

---

**Sessions récentes livrées :**
- N° A3 ✅ **Feedback au changement de statut** : flash temporaire avec marquages lors d'incidents/contrôles/prêts
- Feuille d'incident à imprimer (remis à l'emprunteur en cas d'incident)
- Badge "Examen requis" intelligent (distingue Incident vs Contrôle)
- Distinction visuelle des formulaires (dégradé bleu + liseré gauche)
- Espacements harmonisés (24px entre édition et synthèse, 14px entre accordéons)

**Candidats écartés (inutiles) :**
- N° 13 « Duplication de lot » — trop marginal
- N° 15 « Recherche avancée multi-critères » — trop marginal
- « Export calendrier (iCal) » — trop marginal

Le n° 8 (téléversement) est complet, étendu à une galerie multi-photos et au rattachement dès la création. Nombreuses améliorations d'usage livrées hors numérotation (voir bas de page)._

| N° | Fonctionnalité | Ce que ça apporte | Faisabilité Grist | Priorité | À trancher / dépend de |
|----|----------------|-------------------|-------------------|----------|------------------------|
| 1 ✅ | **Saut direct par marquage** — *livré.* — une case dans le bandeau où l'on tape (ou scanne plus tard) un marquage, qui ouvre la fiche de l'exemplaire. | Le geste le plus fréquent au retour : 4 clics (Matériel → recherche → lot → exemplaire) ramenés à 1. | Pur widget. Réutilise `normMarquage` (casse/espaces ignorés) + `ouvrirFicheExemplaire`. L'unicité déjà en place garantit zéro ambiguïté. | **Haute** | Emplacement : bandeau du haut (universel) ou tête de l'onglet Matériel. |
| 2 | **Prêt à un invité / non-membre** — autoriser un emprunteur hors liste ADHERENTS. | Les clubs prêtent à des participants d'essai, des invités d'une sortie inter-club. Aujourd'hui l'adhérent est obligatoire. | Pur widget : champ emprunteur acceptant un nom libre, ou une case « invité ». Le bon reste numéroté normalement. | Moyenne | Tracer l'invité en texte libre, ou créer une fiche ADHERENTS « invité » légère (nom + contact). |
| 3 ✅ | **Formulaire Grist « demande d'emprunt »** — *côté widget livré (boîte de demandes + matérialisation). Reste au club : créer la table DEMANDES + publier le formulaire + poser la règle d'accès, cf. classeur.* — un formulaire distribué aux adhérents qui remplit une boîte de demandes ; le responsable convertit chaque demande en bon. | Pré-enregistrer un besoin **à distance et à l'avance** (avant une sortie), déplace la saisie vers le membre. Utile pour un club actif à sorties organisées. | Grist Forms natif → table **DEMANDES** (jamais EMPRUNTS, pour garder les garde-fous) + vue « demandes en attente » dans le widget + bouton « créer le bon » pré-rempli. | Moyenne / future | Identité (réf adhérent vs texte libre vs membres connectés) ; matériel = **intention** par catégorie/quantité, pas des marquages ; règle d'accès : anonyme = ajout à DEMANDES seulement. Voir l'étude de faisabilité complète. |
| 4 ✅ | **Unicité des marquages garantie côté base** (« couche 3 ») — *recette livrée : `tuto_unicite_marquage_Grist.docx` (colonne `marquage_norm` + colonne `nb_identiques` + règle d'accès refusant `nb_identiques > 1`). Reste au club à l'appliquer, en même temps que les autres règles d'accès.* — colonne formule *Count* + règle d'accès Grist qui bloque *Count > 1*. | Filet de sécurité au niveau du document, au-delà du contrôle fait par le widget. Grist n'a pas d'unicité native ; c'est le contournement officiel. | 100 % natif Grist (colonne formule + règle d'accès). | À faire **quand tu poseras les règles d'accès** | Dépend de la mise en place des règles d'accès (tutoriel déjà livré). |
| 5 ✅ | **Onboarding / états vides guidés** — *livré.* — les écrans vides des onglets indiquent la première action (« commence par créer une catégorie, puis un lot… »). | Diffusion multi-club : un club qui démarre à froid, ou une reprise sans toi à côté, est guidé. | Pur widget (messages d'état vide contextuels). | Basse / phase multi-club | — |
| 6 ✅ | **Pièces jointes notice + facture (conformité registre EPI)** — *affichage widget livré (liens « Ouvrir » sur fiche exemplaire + lot déplié + mention dans la fiche de vie imprimable). Reste au club : créer les colonnes `notice` (LOTS) et `facture` (ACHATS), déposer les PDF dans Grist, cf. classeur.* — rattacher la notice du fabricant et la facture au matériel, comme l'exige le registre EPI (FFME et FFCAM). | Conformité : un registre en règle inclut fiches de vie **+ notices + factures**. C'est le billet d'entrée pour une promotion crédible face à un auditeur FFME. | Grist : colonne pièce jointe **notice sur LOTS** ; **facture sur ACHATS** (sa vraie place — une facture couvre souvent plusieurs lots), retrouvée depuis le lot via le lien. + petit ajout widget : lien « ouvrir la notice / la facture » sur la fiche du lot (PDF, donc lien et non vignette). | Moyenne / stratégique | Facture sur ACHATS (propre) vs sur LOTS (plus simple pour le club) — à trancher. Documenter les colonnes au classeur. |
| 7 ✅ | **Habillage fédération paramétrable** — *livré.* Panneau **« Réglages du club »** accessible via l'aide (« ? ») : identité, sous-titre/fédération, couleurs (avec sélecteur visuel + retour charte), et **liens utiles** (règles fédé + norme) affichés dans l'À propos et le bandeau. La mention « durée de vie <fédé> » du bandeau est **déduite du sous-titre** (pas de champ en plus). Enquête faite : règles métier identiques FFCAM/FFME/FSGT (norme NF S 72-701 + fabricant), donc habillage pur, zéro touche moteur.* (FFCAM / FFME / autre) — rendre configurables le nom, le logo et les libellés propres à une fédération. | Le moteur code la **norme EPI**, pas une fédération : les règles (fiches de vie, marquage, contrôle annuel, contrôleur habilité, mise au rebut) sont communes FFME/FFCAM/FSGT. Un habillage paramétrable ouvre l'outil à toutes ces fédérations avec un seul code. | Surtout du widget + CONFIG (déjà en place pour le nom du club) : étendre aux libellés/logo fédéraux. Le cœur métier ne change pas. | Moyenne / stratégique | Séparer ce qui est **habillage** (nom, logo, mentions) de ce qui est **règle** (largement commun). Vérifier les rares écarts de durées/normes entre fédérations. |
| 9 ✅ | **Anticipation des contrôles annuels** — *livré : carte « Contrôles à prévoir (60 j) » sur la Vue d'ensemble (cliquable → Suivi EPI, vue « à prévoir ») + vue dédiée dans le Suivi EPI, avec liste cochable. Fenêtre 60 j (constante `JOURS_AVANT_CONTROLE`), échéance = dernier contrôle (ou mise en service, ou fabrication) + 12 mois via `controleEchu`. Complète « En retard » et « Jamais contrôlés ».* — une carte « contrôles à prévoir » sur la Vue d'ensemble, signalant les exemplaires dont le contrôle annuel **approche** (avant l'échéance, pas au moment où c'est déjà dû). | Le contrôle annuel EPI est l'obligation qui structure l'année du responsable. Aujourd'hui on voit « à contrôler » quand c'est l'heure ; anticiper permet de **planifier la campagne** au lieu de la subir. Complète les alertes existantes (vétusté, prêts en retard). | Pur widget. Même logique que les alertes en place : pour chaque exemplaire, date du prochain contrôle = dernier contrôle + 12 mois (ou mise en service si jamais contrôlé) ; compter ceux qui arrivent à échéance dans une fenêtre. | **Haute** — obligation récurrente, cœur métier. | Fenêtre d'anticipation (30 j ? 60 j ?) ; point de départ pour un exemplaire jamais contrôlé (mise en service). |
| 10 ✅ | **Export PDF du registre d'un lot** — *livré : bouton « Registre (PDF) » sur chaque lot (onglet Matériel) → toutes les fiches de vie des exemplaires du lot en un document, une par page. Réutilise le mécanisme d'impression. Rendu à confirmer par capture. Variante « tout le parc » possible plus tard (lourde en pages) — écartée pour l'instant au profit du périmètre par lot.* — un seul document imprimable regroupant les fiches de vie de tous les exemplaires d'un lot (voire de tout le parc), pour un audit. | Le jour d'un audit FFME, poser **tout le registre d'un coup** plutôt qu'exemplaire par exemplaire. Prolonge directement l'export PDF de l'aide (même mécanisme). Utile pour la promotion fédérale. | Pur widget : réutilise `sortirDocument` + les fiches de vie existantes, concaténées avec sauts de page. Rendu visuel à valider par capture (comme l'export de l'aide). | Moyenne / stratégique. | Portée (un lot / tout le parc) ; un parc entier = beaucoup de pages → sans doute limiter à un lot ou une sélection. |
| 11 ✅ | **Rangement des lots entièrement hors service** — *livré : un lot dont **tous** les exemplaires sont réformés/perdus descend dans un volet repliable « Lots entièrement hors service » en bas de l'onglet Matériel. Un lot partiellement réformé reste actif (ses exemplaires grisés restent visibles — signal de vieillissement utile à la décision). Registre conservé, rien de supprimé. | Évite l'encombrement de la vue active au fil des années, sans masquer le vieillissement progressif d'un lot. | Pur widget (partition de la liste, volet `<details>`). | Livré. | — |
| 8 ✅ | **Téléversement des pièces depuis l'interface** — *COMPLET et étendu. Photo/notice de lot et facture d'achat : une seule pièce, remplacée avec avertissement (« Une photo est déjà associée... Voulez-vous vraiment la remplacer ? »), affichage toujours de la plus récente. Photo de contrôle et photo d'incident : galerie jusqu'à 4 photos, suppression individuelle (croix sur chaque vignette, confirmation), ajout possible dès le formulaire de création (pas seulement après validation) ou depuis l'éditeur en modification — le bouton a quitté les tableaux de synthèse, devenus trop chargés. Photos intégrées aux fiches de vie imprimables (individuelle + registre du lot), alignées côte à côte en pleine largeur. Fonctions `televerserFichierSeul`/`televerserPieceJointe`/`retirerPieceJointe`. Caveat propriétaire vs éditeur-ACL rappelé dans l'aide. | Verser une photo depuis l'appli, sans passer par les tables Grist — et documenter un contrôle ou un incident sous plusieurs angles quand c'est utile. | Fonctionne pour le PROPRIÉTAIRE ; limitation possible pour un éditeur non-propriétaire sous ACL (correctif Grist en cours). | **Livré et validé en réel.** | — |
| 12 | **Trame de contrôle attachée à la catégorie** — une pièce jointe `trame_controle` sur la table CATEGORIES (feuille d'inspection du fabricant, ou trame maison par type d'équipement). Bouton « + Trame de contrôle » sur chaque catégorie (Listes du club) ; lien « Trame de contrôle (baudrier) » affiché **au moment de contrôler** un exemplaire et sur sa fiche de vie, tiré de sa catégorie. Complète la notice du lot (on affiche les deux si présentes). | La bonne feuille d'inspection **sous les yeux** au moment du contrôle, sans re-coder une check-list par type. Rapproche du niveau ePPEcentre (procédure d'inspection structurée) sans en rigidifier le geste. | Pur widget : réutilise **exactement** le mécanisme de pièces jointes existant (`televerserPieceJointe`). Colonne `trame_controle` (Pièce jointe) à créer sur CATEGORIES dans Grist. | **Basse** — bonne idée à conserver, pas prioritaire. | Confirmé : au niveau **catégorie** (générique par type), pas lot ni exemplaire. Distinct d'une vraie check-list à cocher (chantier plus lourd, à séparer si un jour souhaité). |
| A3 ✅ | **Feedback au changement de statut** — *livré.* — chaque fois qu'une action change le statut d'un matériel (création incident, enregistrement contrôle, création prêt), un flash temporaire affiche le marquage et le nouveau statut. *Exemples :* « GRIGRI-003 en attente de controle » ; « CORD-042 — Controle realise (Conforme) » ; « BAUDRIER-001 pretee a Martin D. ». Messages disparaissent automatiquement après 3-4 sec. | Confirmation visuelle immédiate et traçable de chaque action — adieu les messages génériques. Clarté : on sait exactement quel matériel a été affecté et par quoi. | Pur widget : amélioration des flash existants dans `addIncident()`, `addControle()`, `addPret()`. Récupère les marquages depuis `rawRows.materiels`, assemble un message explicite, affiche via `flash()`. | **Livré et validé.** | — |

### Rôles et droits — cadré le 2026-10-07, **en attente de l'usage réel**

*Décision de Pierre : prématuré. Le besoin réel tranchera avant toute mise en œuvre.*

**Constat de départ.** Seuls les bénévoles ouvrent l'outil ; les emprunteurs ne
le voient jamais (au mieux la fiche d'emprunt imprimée). Deux notions à ne pas
confondre : *qui utilise l'outil* (comptes Grist, droits) et *qui apparaît dans
l'outil* (onglet Adhérents : emprunteurs, auteurs de contrôles, d'entretiens…).

**Répartition retenue (3 rôles, colonne `role` de ADHERENTS)**

| Rôle | Ce qu'il fait |
|---|---|
| Adhérent (+ la variante « Non adhérent – emprunt autorisé bureau ») | Emprunte. N'ouvre pas l'outil. |
| Bénévole | Tout, **sauf** suppressions et administration (réglages, diagnostic). Apparaît dans « Contrôleur » / « Réalisé par ». |
| Responsable matériel | Tout, y compris suppressions, réglages, diagnostic. |

- « Controleur EPI habilite » serait fondu dans Bénévole (tout bénévole contrôle).
  Aujourd'hui c'est la **seule valeur utilisée par le code** (filtre des listes de
  contrôleurs, comptage au Diagnostic) ; « Responsable materiel » n'est qu'une
  étiquette.
- L'onglet garde le nom **« Adhérents »** (choix de Pierre, plus lisible).
- Écartés : une habilitation « contrôleur » distincte (trop complexe pour un
  petit club), un rôle lecture seule (Grist le fait nativement), réserver achats,
  budget ou listes au responsable (Pierre : tout aux bénévoles sauf admin et
  suppressions).

**Idée retenue : pré-remplir « Contrôleur » / « Réalisé par »** avec la personne
connectée, en rapprochant l'email de son compte Grist de la colonne `email` des
Adhérents. Même besoin technique que les droits (savoir qui est connecté).

**Mise en œuvre — verdict d'après `skill_droits_roles_widget_grist.md` (fourni
par Pierre) : exploitable avec renforcement.**
- À reprendre : refus par défaut, une seule fonction de rôle, protection côté
  serveur, tests avec un compte non-responsable, aide honnête sur les limites.
- **Ne se transpose pas** : le modèle « chacun ne voit que sa ligne, une ligne
  Admin visible = admin ». ADHERENTS doit rester lisible en entier (liste des
  emprunteurs) : tout le monde y verrait la ligne du responsable et deviendrait
  responsable. Il faudra une table d'accès filtrée par personne, ou les
  attributs d'utilisateur des règles Grist.
- **Règles d'accès Grist à poser par Pierre** (le widget ne peut pas, le
  connecteur sait seulement les lire) : suppression de lignes réservée aux
  responsables (toutes tables) ; écriture de CONFIG réservée ; écriture de la
  colonne `role` de ADHERENTS réservée (sinon chacun peut se promouvoir).
- Limites acceptées : un bénévole peut modifier toute donnée ; toutes les
  données (noms, emails, licences) restent lisibles par tous les bénévoles.

**À vérifier avant tout code** (documentation Grist à jour, pas de mémoire) :
règles d'accès disponibles sur l'offre du club ; attributs d'utilisateur
(rattacher l'utilisateur connecté à une ligne par email) ; possibilité pour un
widget de connaître l'email de la personne connectée. Option : lire les règles
d'accès actuelles du document via le connecteur (lecture seule).

**Déclencheurs pour rouvrir le sujet** : une suppression malencontreuse, un
réglage modifié par erreur, l'arrivée de nouveaux bénévoles peu familiers de
l'outil, ou une demande du bureau.

### Inspection des voies en SNE (sites naturels d'escalade) — évaluée le 2026-10-19, **en attente d'un feu vert**

*Décision de Pierre : rien n'est lancé tant que le cadre FFME qui a suggéré l'idée ne l'a pas recontacté.*

**Verdict de l'évaluation rapide** : bonne base de départ, mais pas un simple changement de vocabulaire. Évaluation de *structure* seulement : la grille d'inspection officielle de la FFME n'a pas été trouvée.

- **Se transpose** : contrôle → inspection d'une voie, incident → signalement, réparation → rééquipement (relais, ancrages), entretien → purge / pied de voie, fiche de vie → historique de la voie, export Excel, sauvegarde, cartes téléphone, aide, tests, réglages, rôle de contrôleur → opérateur SNE.
- **Ne se transpose pas** : prêts et bons d'emprunt ; l'échéance annuelle par exemplaire (les comités travaillent par campagnes, p. ex. ~20 % des voies visitées par an) ; la hiérarchie (site, secteur, voie, points d'ancrage) ; le classement du site (« sportif » / « terrain d'aventure »).
- **Points durs** : (1) **hors-ligne** en falaise, Grist exigeant une connexion (à vérifier) ; (2) **volume** (plus de 1 880 voies pour un seul département ; EPILOG charge tout d'un coup : pagination et filtrage à créer) ; (3) **cahier des charges fédéral** à obtenir ; (4) **responsabilité** d'un outil qui consigne « voie conforme » ; (5) **organisation** (sites des comités, plusieurs clubs, droits d'accès, cf. « Rôles et droits »).
- **Options** : copie adaptée « EPILOG-SNE » (recommandée pour un pilote *au niveau de la voie*, un site) ; généralisation par « profils » (lourde : vocabulaire et statuts en dur) ; petit outil neuf. Ordre de grandeur du pilote : une dizaine de livraisons, fourchette large.
- **Questions à poser au cadre FFME avant tout** : la grille d'inspection officielle ; ce qui existe déjà à la fédération (éviter le doublon) ; qui saisirait ; l'échelle visée ; les conditions de connexion ; le cadre de validation et de responsabilité.
- **Sources consultées** : charte de l'équipeur FFME (ffme.fr, mars 2024) ; norme d'équipement des voies et sites d'escalade FFME (juin 2012) ; fiche « Opérateur SNE » (na.ffme.fr) ; page du comité départemental FFME de l'Ariège (helloasso.com).
- **Déclencheur pour rouvrir** : le cadre FFME recontacte Pierre. Proposer alors un mail de questions, puis une maquette sur canevas, comme pour la navigation, avant tout code.

## En suspens technique (hors liste tant que non prouvé)

- **QR code de prêt.** Le n° 1 en couvre déjà l'essentiel *sans matériel ni scan*. Le QR ne se justifierait qu'en accélérateur par-dessus, et il **dépend de la lecture caméra dans l'iframe Grist, non garantie** — à tester sur téléphone réel avant toute décision. Tant que ce n'est pas prouvé, il ne rejoint pas la liste actionnable.

- **Modules désactivables (Prêts / Achats et budget).** *Proposé par Pierre le 2026-08-17, pour mémoire — pas une priorité.* Idée : un réglage par module (radio dans Réglages → Fonctionnement, même famille que `mode_prochain_controle`) permettant à un club qui ne fait pas de prêts formalisés, ou qui suit son budget ailleurs, d'épurer son interface en masquant l'onglet et les points d'entrée correspondants. Cohérent avec le principe déjà en place des colonnes facultatives (dégradation gracieuse), étendu du niveau colonne au niveau module.
  **Vérifié le 2026-08-17, avant d'estimer :** les deux modules ne sont pas symétriques en coût.
  - **Prêts** : ~20 points de contact hors de son propre onglet (10× `pretOuvertDe(`, 10× cases « fermer le prêt » dans les formulaires de contrôle/incident/réparation — déjà conçues pour ne rien faire silencieusement si aucun prêt n'est ouvert). Masquer l'onglet + le bouton « Prêter » sur la fiche + la carte Vue d'ensemble couvrirait l'essentiel proprement. Effort de l'ordre d'une session focalisée.
  - **Achats et budget** : `prix_unitaire` n'est pas un champ de cet onglet mais un attribut du *lot*, affiché dans 26 endroits (fiche, éditeur de lot, calcul de la valeur du parc en Vue d'ensemble, fiches PDF). Le masquer proprement demande de retirer ce champ de chaque endroit individuellement, pas juste de cacher un onglet. Effort comparable à un chantier structurant (plusieurs sessions).
  - **Point non anticipé** : la section Vue d'ensemble « Statistiques du club (bilan, AG) » — qu'on aurait pu croire liée aux achats — est en réalité entièrement construite sur les données de *prêts* (rotation par catégorie, prêts sur 12 mois). Elle dépend donc du module Prêts, pas du module Achats — à ne pas mal ventiler si le chantier est repris.
  **Réserve à noter** : ce n'est pas qu'un coût de construction ponctuel — une fois en place, toute nouvelle fonctionnalité touchant Prêts ou Achats devrait ensuite se demander « et si le module est désactivé ? », en continu. Ni l'un ni l'autre n'est désactivé à Auxerre : ce développement prépare l'outil pour d'autres clubs, pas un besoin actuel du club. Pourrait se regrouper avec l'effort de généralisation ci-dessous plutôt que d'être traité isolément.
  **Si repris un jour** : commencer par Prêts seul (plus propre, plus rapide, permet de vérifier l'intérêt réel avant d'attaquer Achats).

- **Généralisation à d'autres sports (kayak, parapente...).** *Discuté avec Pierre le 2026-08-19, pour mémoire — pas une priorité.* Question posée : le logiciel pourrait-il servir à un club d'un autre type ? Évalué à cette date, sans rien construire :
  - **Ce qui fonctionne déjà sans toucher au code** : le modèle de données (lot/exemplaire/contrôle/prêt/incident/réparation) ne connaît pas l'escalade — un club de kayak pourrait créer des catégories « Kayaks », « Gilets de sauvetage » aujourd'hui même, avec le mécanisme de création de catégorie existant. C'est la partie la plus difficile à obtenir architecturalement, et elle est déjà bonne.
  - **Ce qui demande un toilettage de texte, borné mais réel** : l'aide mentionne explicitement « cordes, baudriers, mousquetons et casques » à trois endroits, le logo et le sous-titre par défaut sont marqués alpinisme, les références réglementaires (NF S 72-701, FFCAM, FFME) apparaissent 12 fois dans le code et l'aide. De l'ordre d'une journée de travail mécanique, pas une refonte.
  - **Le vrai point dur** : la cadence de contrôle annuel (`année + 1`) est câblée en dur à **quatre endroits du code** (`controleEchu()` et trois calculs d'échéance dérivés), pas un réglage. Fonctionne bien pour l'alpinisme (contrôle EPI annuel). Un club de parapente a des cadences hétérogènes selon le matériel (ex. révision de parachute de secours souvent semestrielle, pas annuelle) — le système « systématique/routine » déjà construit répond à *qui* décale l'échéance, pas *à quel rythme*. Rendre la cadence configurable par catégorie toucherait à une logique centrale (dérivation de statut, badges, aide contextuelle, l'ensemble des tests déjà écrits sur ce sujet) : le seul morceau qui mériterait vraiment le mot « chantier » plutôt que « toilettage ».
  **Si repris un jour** : un club dont le matériel suit une cadence annuelle homogène (kayak, probablement) n'a besoin que du toilettage de texte. Un club aux cadences hétérogènes (parapente) a besoin des deux : toilettage *et* cadence configurable par catégorie.
  **→ Ce second point a été entièrement spécifié depuis, voir l'entrée dédiée juste en dessous : « Cadence de contrôle configurable par catégorie et par lot ».**

- **Cadence de contrôle configurable par catégorie et par lot.** *Conception aboutie avec Pierre entre le 2026-08-19 et le 2026-08-22, pour mémoire — pas une priorité. Prête à lancer, non engagée à ce jour.* Né de la discussion sur la généralisation multi-sport ci-dessus, mais utile dès aujourd'hui pour Auxerre, indépendamment de tout autre sport — voir le point de vérification réglementaire ci-dessous.

  **Vérifié dans le texte de la norme** (NF S72-701, via l'extrait AFNOR, recherché le 2026-08-22) : *« Un contrôle complet doit être effectué au minimum tous les 12 mois. Selon l'intensité d'utilisation de l'EPI, la fréquence du contrôle peut être augmentée, au gré du responsable de la mise à disposition ou du propriétaire. »* Douze mois est donc un **plancher**, pas un rythme fixe — et la norme prévoit explicitement qu'on puisse resserrer selon l'usage. Rien dans la norme n'autorise en revanche un intervalle plus long, pour de l'escalade/alpinisme/spéléologie. Ça valide l'utilité de ce chantier même pour un club d'escalade pur (une corde très sollicitée par l'école d'escalade peut légitimement demander un contrôle plus fréquent qu'un lot qui dort dans l'armoire), pas seulement comme préparation à d'autres sports.

  **Conception retenue, au fil de la discussion :**
  1. Un réglage de club (Réglages → Fonctionnement, nouvelle clé `CONFIG`) fixe le plancher général — 12 mois par défaut, modifiable. *(Décidé le 2026-08-22 : réglable, pas fixé en dur.)*
  2. Une case sur chaque **catégorie** : « cette catégorie déroge au plancher » — révèle un champ en mois. Même motif d'interaction déjà éprouvé et en production que `maintenance_fabricant` → `reparations_acceptees` sur ce même éditeur : rien à inventer sur la forme.
  3. Un champ sur chaque **lot**, visible et modifiable **uniquement si sa catégorie a coché la dérogation** — permet d'affiner encore, lot par lot, selon l'intensité d'usage réelle (pas seulement le type d'objet). Contrairement au point précédent, ce motif-là est nouveau : la visibilité du champ dépend d'une donnée d'un *autre* formulaire (la catégorie choisie dans le lot), pas d'une case du formulaire courant.
  4. Résolution en cascade à chaque calcul d'échéance : **valeur du lot si présente → valeur de la catégorie si dérogatoire → plancher général**. Exactement le même motif que `duree_vie_mois` (lot) qui surcharge déjà `duree_vie_defaut_mois` (catégorie), avec pré-remplissage automatique à la création du lot — précédent vérifié dans le code, pas supposé.
  5. **Avertissement + case de confirmation obligatoire** (« j'ai compris que... ») quand une nouvelle valeur — catégorie ou lot — dépasse le **plancher réglementaire** (pas la valeur de la catégorie parente si le lot s'en écarte encore). *(Décidé le 2026-08-22.)* Redemandée à **chaque nouvelle exception enregistrée**, jamais acquise une fois pour toutes.
  6. **Message informatif** (pas bloquant, pas une case à cocher) affiché **sur le lot** — pas sur la catégorie, pas sur chaque exemplaire individuellement — **uniquement dans la fenêtre grise** entre la date que le plancher général aurait exigée et la date que la règle propre du lot exige réellement. Évite qu'un bénévole s'inquiète à tort en voyant « 13 mois depuis le dernier contrôle » sur un lot qui suit légitimement une règle à 18 mois. Exemple de formulation proposé par Pierre : *« Ce lot possède une périodicité de contrôle particulière : le contrôle devait se faire avant le JJ/MM/AAAA [plancher général] ; le contrôle réglementaire propre à ce lot ne sera exigé qu'avant le JJ/MM/AAAA [échéance réelle]. »*
  7. **Cas limite tranché** : décocher la dérogation d'une catégorie alors que des lots ont déjà leur propre valeur → **lister les lots concernés avec leurs valeurs actuelles et demander une confirmation explicite** avant de les faire retomber sur le plancher. Ni effacement silencieux (perdrait des réglages sans les montrer), ni blocage strict (obligerait à rouvrir un par un plusieurs formulaires de lot), ni simple masquage sans suppression (risquerait la réactivation silencieuse d'une ancienne valeur oubliée si la catégorie est recochée bien plus tard pour une tout autre raison).
  8. **Traçabilité** *(proposé par Pierre le 2026-08-22)* : chaque changement de cadence — catégorie ou lot — s'enregistre dans une nouvelle table facultative (date, ancienne valeur, nouvelle valeur), affichée sur le **registre du lot** via `tableHist()` (déjà écrite, déjà testée pour Réparations) — pas sur la fiche de chaque exemplaire individuellement, pour éviter de dupliquer le même événement autant de fois que le lot compte d'exemplaires. Plus simple que la table `REPARATIONS` : pas de machine à états (à prévoir/déjà faite/inspection), juste un historique d'événements.
     **Question non tranchée** : faut-il consigner *qui* a pris la décision ? Ce logiciel n'a pas de notion de session ou d'identité connectée — il faudrait redemander un nom au moment du changement, comme pour « Contrôleur » ou « Intervenant » ailleurs. Facultatif ou obligatoire : à décider au moment de lancer.

  **Ce que ça touche techniquement, évalué le 2026-08-22 :**
  - **Schéma** : `CATEGORIES.deroge_periodicite` (bool), `CATEGORIES.frequence_controle_mois`, `LOTS.frequence_controle_mois`, nouvelle table facultative pour l'historique des changements de cadence, `CONFIG` pour le plancher réglable.
  - **Éditeur de catégorie** : réutilise tel quel le motif case-à-cocher-révèle-champ déjà en production.
  - **Éditeur de lot** : véritablement nouveau (voir point 3 ci-dessus) — pas un copier-coller d'un motif existant.
  - **Quatre points de calcul** (`controleEchu()` + trois calculs d'échéance dérivés) à réécrire pour résoudre la cascade lot → catégorie → plancher, au lieu d'« année + 1 » en dur.
  - **Point de vigilance performance, vérifié dans le code** : `categorieDeMateriel()`, qui remonte déjà d'un exemplaire à sa catégorie, fait un scan linéaire (`.filter()` sur les lots puis les catégories), pas une recherche indexée. Correct pour un usage ponctuel (une carte, un badge) ; à reconstruire proprement en dictionnaire indexé par id si réutilisé dans les quatre boucles à fort volume, plutôt que de multiplier les scans linéaires sur tout le parc à chaque rafraîchissement.
  - **Aide à revoir** : l'infobulle « Prochain contrôle » (fiche exemplaire, ajoutée le 2026-08-19) affirme explicitement *« Un an après le dernier contrôle retenu »* — devient fausse dans sa formulation actuelle, pas seulement incomplète, dès que la cadence peut varier. Plusieurs autres endroits de l'aide embarquée mentionnent aussi ce rythme annuel comme une règle fixe, à revoir dans le même mouvement.
  - **Tests estimés** : de l'ordre de 20 à 25 assertions nouvelles (cascade de résolution dans ses différents cas, visibilité conditionnelle des deux formulaires, cas limite du décochage de catégorie, non-régression complète sur l'existant) — comparable en volume à chacun des chantiers de dérivation de statut menés cette session, pas plus lourd.

  **Effort global estimé** : comparable à la séparation du formulaire de réparation (menée sur plusieurs échanges) — pas un ajout d'une heure, mais rien d'hors de portée. La brique de traçabilité (point 8) n'alourdit pas énormément l'ensemble puisqu'elle réutilise un motif d'affichage déjà construit et testé.

  **Si repris un jour** : commencer par la conception ci-dessus telle quelle, les décisions de fond ayant déjà été prises — il ne reste que la question facultatif/obligatoire de l'auteur de la décision (point 8) à trancher au lancement.

- **Icônes sur les badges et menus déroulants.** *Discuté avec Pierre le 15/09, mis de côté — jugé gadget.* Idée venue d'une capture d'un menu Grist natif (coche verte, clé à molette, etc. à côté de chaque choix). Deux réalités très différentes derrière une même envie :
  - **Sur les badges** (pastilles colorées déjà en place) : techniquement facile, aucun obstacle — ce sont de simples `<span>` stylés. Le candidat le plus net serait le statut de matériel (sept statuts distincts, quatre couleurs seulement pour les distinguer), pas les badges déjà univoques comme « Conforme ».
  - **Sur les `<select>` natifs** (Résultat du contrôle, Suite à donner...) : un vrai mur technique, pas un choix d'EPILOG — un navigateur ne permet pas d'icône colorée dans une `<option>`. Le reproduire demanderait de remplacer chaque menu déroulant par un composant entièrement reconstruit à la main, pour chacun des nombreux menus du logiciel.
  **Statut** : écarté pour l'instant, pas retenu comme une évolution qui vaut l'effort. À ne pas reproposer sans raison nouvelle.

- **Catégorie « fourre-tout » pour du matériel non réidentifié.** *Discuté avec Pierre le 26/09, mis de côté.* Né de la scission de lot (§ ci-dessus) : une fois qu'on peut détacher des exemplaires vers un lot « Divers », faut-il aussi pouvoir créer une *catégorie* « Divers » qui accueillerait des natures d'objets différentes (une corde et un mousqueton dans le même panier) ? Deux besoins distincts identifiés en discutant, à ne pas confondre si le sujet revient :
  - **Origine d'achat perdue, nature connue** (une sangle dont on ne sait plus si elle vient du lot 2022 ou 2023) : déjà entièrement couvert par un lot « Divers » *à l'intérieur de la catégorie qui reste juste* — rien de plus à construire, c'est exactement l'usage prévu de la scission.
  - **Nature elle-même incertaine ou volontairement mélangée** (un vrai bric-à-brac) : demanderait une vraie nouvelle catégorie. Risque identifié : la catégorie pilote le statut réglementaire, la cadence de contrôle et l'éligibilité réparation/découpe pour *tout* ce qu'elle contient, sans distinction — un objet réellement soumis à contrôle qui s'y retrouverait par erreur sortirait silencieusement de tout suivi.
  **Si repris un jour** : classer une telle catégorie « EPI — soumis au vieillissement » (le plus prudent, jamais l'inverse), et la penser comme un sas temporaire — reidentifier chaque objet dès que possible pour le refaire glisser vers sa vraie catégorie, via la scission déjà construite, dans l'autre sens.

## Testé et écarté (ne pas reproposer sans raison nouvelle)

- **N° 8 — Téléverser les pièces jointes depuis l'interface (sans passer par la cellule Grist).** *Testé le 2026-07-26 — **entrée corrigée le 2026-08-22, la conclusion d'origine était fausse sur un point.***
  - ~~**Upload direct depuis le widget** : bloqué par CORS...~~ **Faux, corrigé.** L'essai du 26/07 a probablement tenté un appel direct à l'URL du document. Il existe une deuxième voie, non explorée à l'époque, qui **fonctionne et tourne en production dans EPILOG à onze endroits** (`televerserFichierSeul`, photos de contrôle/incident, facture d'achat, photo et notice de lot) : passer par `grist.docApi.getAccessToken()`, puis appeler `fetch()` sur le **`baseUrl` renvoyé par le jeton** — pas l'URL du document lui-même — pour `POST` le fichier sur `/attachments`. C'est précisément ce point d'accès différent qui évite le CORS. Recette complète et commentée : `DOSSIER_TECHNIQUE.md`, section « Annexe — téléversement de pièces jointes ».
  - **Formulaire Grist** : ce point-là reste vrai, rien à corriger. Le champ « pièce jointe » fonctionne bien en dépôt natif, mais **un formulaire ne fait qu'INSÉRER une ligne**, il ne peut pas viser une ligne existante pour la mettre à jour — impossible donc de rattacher une pièce à un enregistrement déjà créé par ce biais.
  - **Conclusion mise à jour** : le dépôt direct depuis le widget est possible et déjà en production — ce n'est plus une piste à écarter. La seule limite réelle restante est celle des formulaires Grist eux-mêmes (insertion seule), pertinente uniquement pour le cas d'un non-éditeur externe déposant une pièce sans jamais ouvrir le widget.

## Nom du logiciel — TRANCHÉ, avec une réserve à surveiller

**EPILOG** (EPI + LOG = journal/registre), nom et logo proposés par Gemini,
retenus par Pierre Travers le 2026-08-13. Voir `BRANDING_GUIDELINES.md`.

### Antériorité vérifiée le 2026-08-13 : le nom est très occupé

- **Epilog Laser** (Colorado, depuis 1988, site en français) — gravure laser
- **EPILOG** (Saint-Rémy, 79) — marque FR en vigueur, déposée 2007, expire 2027
- **Epilog d.o.o.** (Slovénie) — *logiciel de traçabilité logistique*, marque classe 9
- Libre : `EpiLog` sur PyPI, Snare Enterprise Epilog, plusieurs dépôts GitHub

Détail, analyse du risque et options : **`ANTERIORITE_NOM_EPILOG.md`**.

### Décision : OPTION A — on garde EPILOG, on ne change rien (2026-08-13)

Justifiée tant que l'usage reste **associatif, gratuit et non commercial** :
le droit des marques ne vise que l'usage « dans la vie des affaires ». Aucun
titulaire n'a d'intérêt à agir, et les activités concernées (gravure laser,
agencement de bureaux, transport) sont éloignées de la nôtre.

### 🔔 Déclencheurs — rouvrir le sujet AVANT d'agir, jamais après

Le coût d'un changement de nom reste faible aujourd'hui (branding centralisé,
logo indépendant du nom). Il devient réel dès qu'un tiers s'y attache. **Si
l'un de ces cas se présente, s'arrêter et trancher :**

| Déclencheur | Pourquoi |
|---|---|
| Ouvrir un **dépôt public** (GitHub/GitLab) | L'URL fige le nom ; renommer casse les liens et les forks |
| Acheter un **nom de domaine** | Les domaines évidents sont pris ; achat = engagement |
| Diffuser **hors CAF Auxerre** (autres clubs, FFCAM) | Référencement noyé : on cherche EPILOG, on trouve des graveuses laser |
| Envisager un **dépôt de marque** | Opposition probable en classe 9 (marque FR de 2007) |
| Tout usage **commercial**, même marginal | Fait sortir de l'abri du « hors vie des affaires » |

Options alors disponibles : **B** — garder EPILOG avec un qualificatif
(« EPILOG Montagne »), coût quelques chaînes de caractères ; **C** — changer de
nom, en vérifiant cette fois la disponibilité *avant* de s'y attacher.

### Points non vérifiés

- **Classes exactes** de la marque française EPILOG de 2007 — non confirmées.
  Si elle couvre la classe 9 ou 42, le constat se durcit.
- Bases officielles (INPI, EUIPO) non interrogées directement ; recherche
  documentaire uniquement, **pas un avis juridique**.
- Avant tout dépôt : recherche d'antériorité INPI (payante) et conseil en
  propriété industrielle.

- ~~**Réparations non effacées avec l'exemplaire supprimé.**~~ *Corrigé en 2026.5.1.*
- **Bouton « Déclarer un entretien » sur la fiche exemplaire.** *Écarté pour l'instant le 2026-10-07* : usage rare, la déclaration groupée couvre le cas courant. À rouvrir si les bénévoles le réclament.
- **Réponse FFME attendue sur l'entretien.** Question envoyée (ou à envoyer) à securite@ffme.fr sur la façon d'attendre la rubrique hygiène/désinfection pour un club. Si la réponse exige plus (fréquence minimale, nature distincte), ajuster le §7.48.
- ~~Libellés sans accents~~ et ~~avertissement lot nommé comme sa catégorie~~ : *livrés en 2026.5.4.*
- **Statuts affichés sans accents** (« En reparation », « Reforme », « Prete ») : ce sont des valeurs comparées par le code et stockées dans Grist. Les accentuer à l'affichage demanderait une fonction de libellé appliquée partout où un statut s'affiche. *Relevé le 2026-10-07.*
- ~~**« Remplacer » une pièce jointe l'ajoute en réalité.**~~ *Corrigé en 2026.5.11 (option `remplacer` de `boutonPJ`, galeries inchangées).* *Relevé le 2026-10-07.* `televerserPieceJointe` concatène le nouveau fichier aux existants ; les boutons « Modifier la photo / la notice » de l'éditeur de lot et « Remplacer la facture » d'Achats et budget gardent donc l'ancien fichier à côté du nouveau. Corrigé seulement dans le formulaire de commande de l'éditeur de lot (2026.5.10). À trancher avec Pierre : remplacement réel pour photo, notice et facture (les galeries de photos des contrôles et incidents, elles, ajoutent volontairement).
- **Sauvegarde : pièces jointes.** *Hors de la v1 (2026.5.20), décision de Pierre.* À ajouter si le besoin se confirme (fichier beaucoup plus lourd). En attendant : copie `.grist` complète de Grist.
- ~~**Import CSV / tableur du matériel**~~ — *livré en 2026.5.29 (première version)* : modèle Excel à télécharger, import .xlsx/.ods/.csv, rapport imprimable, contrôles et sorties repris (voir dossier §7.77). **Suites possibles, non engagées** : import des commandes/fournisseurs/adhérents ; modèle avec listes déroulantes et couleurs (bibliothèque payante ou autre) ; compléter un exemplaire existant (aujourd'hui : refus) ; **premier essai réel** avec le fichier du testeur.
- **Import : démarrage depuis un tableur** — *trois priorités + modèle CSV livrés en 2026.5.31* (erreurs regroupées, colonnes non reconnues dans l'aperçu, « Dernier contrôle » dans l'Inventaire, modèle CSV avec fenêtre d'avertissement ; voir dossier §7.80). **Reste à discuter** : (a) **synonymes de titres** (Marque, Type, Année, Emplacement, Observations…) avec l'association affichée dans l'aperçu, pour qui importe son propre fichier sans le modèle ; (b) **assistant « catégories manquantes »** : l'aperçu liste les catégories inconnues et fait choisir nature et durée de vie (jamais devinées : règles de sécurité) — le plus gros gain pour un CSV, dont les catégories doivent aujourd'hui préexister ; (c) **valider avec le fichier réel du testeur**.
- **Choix de présentation (onglets ou menu latéral) dans les réglages.** *Écarté pour l'instant le 2026-10-18* : deux interfaces à tester et à expliquer, l'ancienne ne fait rien de mieux, et le menu rétractable couvre le besoin de place. Si un bénévole le demande un jour : préférence **personnelle** (mémorisée dans son navigateur, comme le menu replié), jamais un réglage du club.
- **Page autonome hors de Grist (API REST).** *Écarté le 2026-10-18* : clé d'API exposée ou serveur intermédiaire à maintenir, identité des utilisateurs perdue. Le besoin réel (interface épurée) est couvert par `?style=singlePage`. **Piste gardée** : héberger le code du widget à une adresse web (widget « par URL ») pour que tous les clubs reçoivent les mises à jour sans recoller le code ni réexporter l'archive.
- ~~Navigation, livraison 2~~ *(faite en 2026.5.18, avec le menu rétractable).* **Livraison 3, facultative** : « Accueil » = priorités seules, statistiques déplacées dans « Plus ».
- **Tests des chantiers précédents à réécrire** sur le harnais `tests/` : découpe, cas « tout fermé », Longueur/Taille, scission.

## Livré hors feuille de route (améliorations issues de l'usage)

Nombreux raffinements décidés au fil des retours de Pierre, non numérotés :

- **Anticipation & lisibilité** : tableau « À traiter en priorité » cliquable ligne par ligne ; cartes Incidents cliquables (filtre « en attente ») ; chevron « › » sur les éléments cliquables.
- **Gestion des lots** : action « Ajouter des exemplaires à un lot » (détection auto de la convention de marquage + interrupteur manuel) ; barre du lot rangée à 4 boutons, actions de complétion regroupées dans « Modifier le lot → Compléter ce lot ».
- **Saisie & confort** : bouton « Annuler » sur les 5 formulaires de création + création inline (avec effacement des champs) ; email de contact cliquable dans l'À propos.
- **Identification** : champs **couleur** et **taille** par exemplaire (texte libre, facultatifs).
- **Statistiques** : « le plus emprunté » et « lots dormants » recalculés **par lot/modèle** (et non plus par exemplaire) — pour éclairer les décisions d'investissement.
- **Documentation** : guide complet A-à-Z, export PDF de l'aide embarquée, tuto unicité Grist, norme corrigée en **NF S 72-701**.
- **Traçabilité et cohérence des sorties** : commentaire obligatoire sur toute réforme/perte/vol ; Volé/Cédé distincts de Perdu/Réformé ; commentaire visible directement dans le tableau du lot et la fiche exemplaire ; retour partiel signalé (badge + compteur X/Y) ; cases à cocher retirées du retour de prêt (le menu déroulant suffit).
- **Interface et navigation** : alignement des tableaux corrigé définitivement (cause racine : `display:flex` sur `<td>`) ; photos des lots à 46 px ; badges « Examen requis », « Contrôle échu », « Prêté » cliquables (navigation directe) ; bouton « Contrôler » contextuel sur exemplaires en examen requis ; bouton « Réaliser le contrôle » dans la liste des incidents ; aide contextuelle dans le formulaire de contrôle quand un incident est en attente ; libellés des boutons Éditer contextualisés (« Éditer le lot », « Éditer l'exemplaire »…) ; libellé « Résultat du contrôle » explicite.
- **Statuts renommés** : « En contrôle » → **« Examen requis »**, « À contrôler » → **« Contrôle échu »** — distinction bloquant/rappel calendaire rendue lisible.
- **Incidents** : deux listes permanentes (en attente / clôturés) comme les prêts terminés ; badge vert « Contrôle réalisé » dans la liste clôturée ; encart contextuel dans l'éditeur d'incident en attente.
- **Filtres prêts** : filtre lieu de stockage dans le formulaire de nouveau prêt ; avertissement multi-sites non bloquant (deux clics pour confirmer).
- **Type de contrôle** : colonne optionnelle `type_controle` dans CONTROLES — options dynamiques depuis Grist, pré-sélection automatique « Contrôle suite à incident » depuis les chemins incidents, affichage dans l'historique in-app et la fiche imprimable, modifiable dans l'éditeur de contrôle existant.
- **Photos sur les contrôles** : colonne optionnelle `photo` dans CONTROLES — ajout à la création (formulaire mono-exemplaire) ou après coup (bouton « Photo + » dans l'historique), affichage en vignette et dans les fiches imprimables (individuelle et registre du lot).
- **Historique des contrôles regroupé par lot** : un contrôle fait en une fois sur plusieurs exemplaires d'un même lot s'affiche en une seule ligne dépliable, au lieu d'une ligne par exemplaire.
- **Pertes et vols** déplacés de la Vue d'ensemble vers les statistiques du club (bilan, AG) — chiffre annuel, pas de pilotage quotidien.
- **Export d'un bon de prêt fermé** : récapitulatif de ce qui s'est réellement passé (pas un bon vierge), en PDF et CSV, depuis la liste des prêts terminés.
- **Lisibilité des incidents traités** : le badge ne dit plus seulement qu'un contrôle a eu lieu, mais sa conclusion — « Contrôlé — conforme / sous surveillance / réformé ».
- **Titres de tableau harmonisés** : le même repère visuel (soulignement rouge court) partout où un titre précède un tableau — fiche exemplaire, Listes du club, Statistiques AG.
- **Onglet renommé** : « Suivi EPI » → **« Contrôles & incidents EPI »**, plus explicite pour qui découvre l'outil.
- **Clôture d'incident fiabilisée** : la comparaison de dates qui décide si un contrôle traite un incident est désormais unifiée (jour calendaire) entre le statut du matériel et l'onglet Incidents — un incident et son contrôle du même jour ne restent plus affichés « en attente » à tort.
- **Galerie multi-photos** (contrôles, incidents) : jusqu'à 4 photos par ligne, ajout dès la création, suppression individuelle, intégrées aux fiches de vie imprimables en pleine largeur (fini la vignette illisible qui obligeait à télécharger).
- **Photo de modèle identifiée comme illustrative** : sur la fiche exemplaire et les fiches de vie imprimables (individuelle et lot), une mention précise que la photo du lot représente le modèle générique, pas forcément la couleur/finition réelle de l'exemplaire.
- **Badge « Examen requis » réparé dans la fiche exemplaire** : il ne réagissait qu'au clic depuis le tableau Matériel, pas depuis l'en-tête de la fiche exemplaire elle-même.
- **Formulaire de création d'un lot allégé** : le champ Modèle, remonté à côté de Fabricant (visible directement, plus derrière un clic) ; Commentaire reste dernier mais visible aussi, le menu dépliant devenu inutile pour un seul champ a été retiré.

_Indicateurs statistiques proposés, en attente de ton avis : coût par prêt, rotation normalisée, usure inégale (sécurité), incidents par modèle, etc._

## Écartés — ne seront pas reproposés

Notifications e-mail · réservations en ligne · backend externe (Grist **est** le backend) · bouton « tout exporter » (le Download `.grist` le fait déjà) · table SORTIES séparée (le numéro de bon suffit).

---
_Ce fichier est un registre vivant : je le mets à jour quand le projet évolue, et je te le represente de temps en temps pour qu'on arbitre ce qu'on lance ensuite._
