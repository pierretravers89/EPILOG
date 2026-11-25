# Dossier technique — Widget de gestion du matériel CAF Auxerre

> **Ce document est vivant.** Il est mis à jour à chaque évolution du code qui
> touche à l'architecture, au schéma de données, à un motif transversal, ou
> qui vaut la peine d'être tracée comme décision. Ce n'est pas une règle
> ponctuelle : c'est une hygiène de travail adoptée pour ce projet, tenue à
> chaque session sans qu'on ait besoin de la redemander. Une modification
> mineure et locale (un libellé, une couleur, un bouton isolé) n'a pas besoin
> d'entrée ici — ce dossier documente ce qui aiderait *vraiment* quelqu'un
> reprenant le code à froid.
>
> Public visé : un développeur (humain ou IA) qui n'a jamais touché à ce
> projet. Ce n'est pas un guide utilisateur — le club a `guide_complet_CAF_Auxerre.docx`
> pour ça — c'est un guide de code.

*Dernière mise à jour : 2026-09-26 — scission de lot (§7.46).*

---

## 1. Ce que c'est, en une minute

Un **widget personnalisé Grist** (deux fichiers, HTML + JS) qui donne à un
club de montagne une interface de gestion complète de son matériel EPI :
inventaire, prêts, contrôles réglementaires, incidents, achats, statistiques.
Il tourne entièrement dans le navigateur, à l'intérieur d'un panneau Grist,
et lit/écrit les données via l'API plugin de Grist (`grist.docApi`) — il n'y
a aucun serveur, aucune base de données, aucun backend séparé. Grist *est*
la base de données.

**Pourquoi ce choix d'architecture ?** Le club utilise Grist gratuitement
pour son tableur ; un widget personnalisé permet de construire une vraie
application par-dessus, sans coût d'hébergement, sans compte à créer pour
les membres (ils utilisent leurs comptes Grist existants), et avec la
sauvegarde/l'export déjà gérés par Grist. La contrepartie : on hérite des
contraintes de Grist (pas de contrainte d'unicité native, règles d'accès
un peu rudimentaires, API de widget en évolution).

---

## 2. Déploiement — pas un pipeline, un copier-coller

Il n'y a **pas de build**. Les deux fichiers sont collés à la main dans
l'éditeur de widget personnalisé de Grist (deux zones de texte séparées :
HTML et JS). Toute modification suit ce cycle :

1. Éditer `widget_pilotage.js` et/ou `widget_pilotage.html`.
2. Vérifier la syntaxe (`node -c widget_pilotage.js`).
3. Tester (voir §5).
4. Livrer les fichiers modifiés à l'utilisateur, qui les recolle dans Grist.
5. **Recharger la page Grist** — indispensable pour que le nouveau code
   s'exécute, et pour que certaines lectures (colonnes, choix de menus,
   voir §4.3) soient refaites à jour.

Il n'y a pas de versionnement automatique : chaque livraison remplace la
précédente en entier. C'est pour ça que la moindre régression doit être
détectée *avant* la livraison (§5), pas après.

---

## 3. Schéma de données

Dix tables métier + une table `CONFIG`. Le détail de chaque colonne, avec
description, est dans `schema_v3_CAF_Auxerre.xlsx` — ce dossier ne
reproduit que la structure et les relations.

```
CATEGORIES ──┐
LIEUX_STOCKAGE ──┤
FOURNISSEURS ──┼── référencées par →  LOTS ──── référencé par →  MATERIELS
ADHERENTS ──┤                          (achat →  ACHATS)              │
             │                                                        ├──→ CONTROLES
             └──────────────────────────────────────────────────────  ├──→ EMPRUNTS
                                                                        └──→ INCIDENTS
CONFIG (cle, valeur) — personnalisation par club, lue par le widget au chargement
DEMANDES — facultative, hors périmètre du widget (formulaire Grist natif)
```

**Un lot regroupe des exemplaires identiques** (même fabricant, même
modèle, achetés ensemble). **Un exemplaire (`MATERIELS`) est l'unité
tracée** : marquage, statut, historique. C'est la distinction structurante
de tout le projet — voir §7.1.

### Colonnes facultatives, détectées à l'exécution

Plusieurs colonnes (`couleur`, `taille`, `commentaire`, `origine_decoupe` sur
MATERIELS ; `photo`, `notice` sur LOTS ; `photo` sur INCIDENTS ; `facture`,
`note_financement` sur ACHATS ; `peut_etre_decoupe`, `maintenance_fabricant`
sur CATEGORIES) sont **volontairement absentes du schéma minimal**. Le widget les
détecte si elles existent et s'adapte ; si elles sont absentes, il n'affiche
simplement pas les champs correspondants — jamais d'erreur. C'est le motif
`aColonne` (§4.2). Ça permet à un club d'activer des fonctionnalités en
ajoutant une colonne dans Grist, sans toucher au code.

`origine_decoupe` (MATERIELS) est une **auto-référence** : elle pointe vers
un autre enregistrement de la même table MATERIELS, pas vers une table
distincte — voir §7.40.

---

## 4. Motifs transversaux — à connaître avant de toucher au code

Ces cinq motifs reviennent partout. Les comprendre avant de modifier quoi
que ce soit évite de dupliquer une logique qui existe déjà ailleurs.

### 4.1 `resolvedNames` — les vrais noms de table

```js
var resolvedNames = {
  categories: 'CATEGORIES', lieux: 'LIEUX_STOCKAGE', fournisseurs: 'FOURNISSEURS',
  adherents: 'ADHERENTS', achats: 'ACHATS', lots: 'LOTS', materiels: 'MATERIELS',
  controles: 'CONTROLES', emprunts: 'EMPRUNTS', incidents: 'INCIDENTS'
};
```

Le code interne utilise des clés courtes (`'lots'`, `'materiels'`...) ;
`resolvedNames[key]` donne le nom réel de la table Grist à utiliser dans
les actions d'écriture (`AddRecord`, `UpdateRecord`...). Toute écriture
passe par cette table de correspondance — jamais de nom de table en dur
dans une action.

### 4.2 `aColonne` — détecter une colonne facultative

```js
function aColonne(key, col) {
  return (colonnesConnues[key] || []).indexOf(col) !== -1;
}
```

`colonnesConnues` est peuplé au chargement (`load()`) à partir des colonnes
réellement renvoyées par `fetchTable` pour chaque table — Grist renvoie la
liste des colonnes même quand la table est vide. **Toute fonctionnalité
optionnelle (couleur, taille, pièces jointes, financement...) est gardée
par un test `aColonne(...)`.** Piège classique : dans la config `EDITABLE`
(§4.4), un champ optionnel doit porter une propriété `colonne:` explicite
pour être filtré par `champsEditables` — sans elle, le champ s'affiche même
si la colonne Grist n'existe pas, et l'enregistrement échoue.

### 4.3 `chargerChoixColonne` — lire les choix définis dans Grist

```js
async function chargerChoixColonne(tableKey, colId, defauts) {
  // lit _grist_Tables puis _grist_Tables_column (tables système Grist),
  // extrait widgetOptions.choices de la colonne visée, ou renvoie `defauts`
}
```

Pour les menus qui sont de purs vocabulaires (rôle d'un adhérent,
financement d'un achat), le widget lit les choix **réellement définis
dans Grist** plutôt que de les coder en dur — ainsi un club qui ajoute une
valeur dans Grist la voit apparaître dans le widget sans intervention.
Le chargement est **bloquant, une seule fois par ouverture de page** (voir
le garde `choixCharges`) : les premiers rendus (filtres, formulaires
ouverts au chargement) ont sinon capturé les valeurs par défaut avant que
la lecture asynchrone ne les remplace.

**Ce motif ne s'applique qu'aux menus-étiquettes.** Les menus qui pilotent
de la logique métier (type d'EPI, résultat de contrôle, suite d'un
incident) restent codés en dur à dessein — voir §7.6.

### 4.4 `EDITABLE` — la config des éditeurs génériques

```js
var EDITABLE = {
  lot: { key: 'lots', pane: 'materiel-editor', titre: 'Modifier le lot',
         lier: function (box, rowId) { /* branchements additionnels */ },
         fields: [ { id: 'designation', label: '...', type: 'text' }, ... ] },
  materiel: { ... }, adherent: { ... }, achat: { ... }, ...
};
```

Un seul couple de fonctions (`openEditor(entity, rowId)` /
`openCreator(entity)`) rend **tous** les formulaires d'édition et de
création à partir de cette config déclarative. `champsEditables(cfg)`
filtre les champs sur `aColonne` (§4.2). `cfg.lier(box, rowId)` permet
d'injecter des éléments additionnels après le rendu — c'est ce mécanisme
qui a servi à ajouter la section « Compléter ce lot » (exemplaires
supplémentaires, photo, notice) dans l'éditeur de lot, sans dupliquer de
formulaire. `rowId` vaut `null`/`undefined` en création : tout ce qui
suppose une ligne existante (comme « Compléter ce lot ») doit être gardé
par `if (rowId != null)`.

### 4.5 `appliquer` — le seul point d'écriture

```js
function appliquer(actions) {
  // refuse toute action dont un champ vaut `undefined` plutôt que
  // d'envoyer silencieusement {} à Grist ; sinon délègue à
  // grist.docApi.applyUserActions(actions)
}
```

Toute écriture dans Grist (création, mise à jour, suppression) passe par
cette fonction. `ajouterEtObtenirId(key, fields)` l'enveloppe pour créer
une ligne et récupérer son id (via `retValues`, avec repli sur un
`fetchTable` + max si Grist ne le renvoie pas).

---

## 5. Méthode de test

Il n'y a pas d'environnement Grist réel disponible en développement — les
tests utilisent **jsdom** pour charger le HTML/JS dans un DOM simulé, avec
un faux `grist.docApi` (tables en mémoire, `applyUserActions` qui capture
les actions au lieu de les exécuter). Le script de test est écrit à la
demande dans `/home/claude/t.js`, exécuté, puis **supprimé** — ce n'est pas
une suite de tests versionnée, mais une vérification ponctuelle avant
chaque livraison.

```js
const { JSDOM } = require('/home/claude/node_modules/jsdom');
// ... construire un DOM depuis le HTML, injecter grist.docApi factice,
// w.eval(js), déclencher des événements, lire le DOM résultant
```

**Limites connues de cette méthode**, à garder en tête :

- **Aucun rendu CSS/mise en page** : jsdom ne calcule ni layout ni style.
  Un bug purement visuel (espacement, débordement, alignement) **n'est pas
  détecté** par ce harnais — seule une capture d'écran de l'utilisateur le
  révèle. D'où la méthode « CAPTURE » : pour tout rendu visuel non encore
  confirmé en conditions réelles, ne pas le documenter comme acquis avant
  validation.
- **`FormData.append` exige un vrai `File`** (`new w.File([bytes], nom,
  {type})`) — un objet `{name: ...}` simulé échoue silencieusement.
- **`window.open`, `URL`, `getAccessToken`** et autres API navigateur
  doivent être stubbées manuellement selon le besoin du test.
- **L'upload réel de pièce jointe** (le POST vers `baseUrl/attachments`)
  ne peut être vérifié que dans sa mécanique (bon endpoint, bon jeton,
  bonne charge) — jamais son succès réel contre un vrai document Grist.

`npm install jsdom` est à refaire après toute réinitialisation de
l'environnement (`/home/claude` ne persiste pas entre les tâches).

---

## 6. Vue d'ensemble du fichier JS (sections, dans l'ordre)

Repérage rapide par les commentaires de bloc `/* ---- nom ---- */` dans
le fichier — utile pour localiser une fonctionnalité sans tout parcourir :

| Section | Contenu |
|---|---|
| Erreurs visibles | Capture des erreurs JS, bandeau d'alerte à l'écran |
| Utilitaires | Formatage dates/montants, normalisation de texte, `esc()` |
| Contrôle des types de colonnes | `aColonne`, détection du schéma |
| Statut dérivé | `deriverStatut` — jamais stocké, toujours recalculé (§7.2) |
| Lecture des tables | `load()` — le point d'entrée qui peuple `rawRows`/`refLists` |
| Éditeur générique | `EDITABLE`, `openEditor`, `openCreator`, `champsEditables` |
| Écritures Grist | `appliquer`, `ajouterEtObtenirId` |
| Création rapide | Le « + nouveau » inline dans les menus déroulants |
| Formulaire : nouveau lot | `creerLot` — le formulaire le plus complexe (lot + commande + exemplaires + pièces jointes) |
| Prêts | Bons d'emprunt, retours |
| Garde-fous de dates | Dates impossibles refusées à la création comme à la correction |
| Onboarding | États vides qui guident un club qui démarre |
| Contrôles EPI | Anticipation, historique, vue « jamais contrôlés » |
| Incidents | Déclaration, suivi, filtrage « en attente » |
| Suivi du remplissage | Alerte plan gratuit Grist (limite de lignes) |
| Statistiques | Bilan annuel, podium/dormance **par lot** (§7.4) |
| Photos de modèle | Pièces jointes sur les lots |
| Fiche exemplaire | `corpsFicheMateriel` — la fiche de vie imprimable |
| Exports | CSV, PDF (registre de lot, bon d'emprunt...) |
| Sélecteur de matériel filtré | Composant partagé pour choisir des exemplaires |
| Suppression | Panneau de confirmation avec impact affiché |
| Rattachement des orphelins | Récupération de lignes créées sans lien valide |
| Référentiels | Catégories, lieux, fournisseurs, adhérents (onglet Listes du club) |
| Commande isolée | Achat sans lot (formulaire autonome) |
| Diagnostic | État des colonnes détectées, comptage par table |
| Aide | Panneau d'aide embarqué, 18 sections |
| Réglages (CONFIG) | Personnalisation par club |
| Init | Câblage des écouteurs, premier `load()` |

---

## 7. Journal des décisions

Ce qui a été tenté, choisi, ou explicitement écarté — et pourquoi. Sans ce
journal, une bonne idée déjà pesée et rejetée risque d'être reproposée et
reconstruite pour rien.

### 7.1 Statut par lot vs par exemplaire

Les statistiques « le plus emprunté » / « dormant » ont d'abord été
calculées **par exemplaire**, puis reconstruites **par lot**. Raison :
un emprunteur choisit un *type* de matériel, pas un exemplaire précis —
seule l'agrégation par lot répond à la vraie question (« quel
investissement est rentable ? »). Voir `calculerStatistiques` :
`podiumLots`, `lotsDormants`.

### 7.2 Statut jamais stocké

Le statut d'un exemplaire (`en service`, `réformé`, `perdu`...) n'est
**jamais écrit en base** — `deriverStatut(m, ctx)` le recalcule à chaque
affichage à partir du motif de mise hors service, du dernier contrôle, de
la fin de vie théorique et des prêts en cours. Ça évite toute
désynchronisation entre une valeur stockée et la réalité qu'elle est
censée refléter.

### 7.3 Pas de champ « quantité » libre sur le lot

Rendre `quantite_achetee` éditable comme un simple champ chiffré
créerait un décalage entre ce nombre et les exemplaires réels (chacun
avec son historique). À la place : une action dédiée, **« Ajouter des
exemplaires »**, qui crée de vraies lignes `MATERIELS` et incrémente la
quantité en conséquence. Pour diminuer : supprimer les exemplaires en
trop (déjà possible), pas modifier un chiffre.

### 7.4 Détection de la convention de marquage

`ouvrirAjoutExemplaires` détecte si les exemplaires déjà présents dans le
lot suivent le préfixe de la catégorie ; si non (cas d'un lot importé en
reprise d'inventaire, marquages personnalisés), le formulaire bascule par
défaut en saisie manuelle. Un interrupteur laisse toujours le choix —
la détection ne fait que proposer un bon défaut, jamais n'impose.

### 7.5 Couleur/taille sur l'exemplaire, pas sur le lot

Deux exemplaires du même lot peuvent avoir des couleurs différentes (un
fabricant vend le même modèle en plusieurs coloris) — la couleur est donc
une propriété de l'exemplaire (`MATERIELS.couleur`), pas du lot. Le
formulaire de création de lot propose néanmoins une couleur/taille
*commune* optionnelle, pour l'usage fréquent où tout un lot partage la
même — modifiable ensuite par exemplaire.

### 7.6 Menus dynamiques : uniquement pour les étiquettes, jamais pour la logique

`chargerChoixColonne` (§4.3) a été appliqué à `role` et `financement` —
des vocabulaires purs, sans effet de bord. Il a été **délibérément écarté**
pour `type_epi` (pilote le calcul de fin de vie), `resultat` d'un contrôle
(pilote la sortie de service), et `suite` d'un incident (pilote la file
« en attente ») : rendre ces menus librement éditables dans Grist créerait
des valeurs que le code ne reconnaît pas, silencieusement sans effet.
Modifier ces menus-là exige un changement de code, pas seulement de
données.

### 7.7 Téléversement de pièces jointes : possible, avec une limite documentée

Après un premier essai infructueux (CORS sur le mauvais point d'accès),
la méthode qui fonctionne est documentée en annexe, en fin de dossier.
**Limite connue** : elle est fiable pour le Propriétaire du document ; un
Éditeur sous règles d'accès restrictives peut rencontrer un échec au
rattachement (limitation Grist en cours de correction côté éditeur amont,
pas de notre fait). L'échec est toujours **non bloquant** — la ligne
(incident, lot, achat) est créée même si sa pièce jointe échoue.

### 7.8 Documenter toute sortie d'inventaire, sans créer un motif dédié par cas

**Ce qui semblait au départ trois chemins en était en réalité neuf.** Le
premier passage (2026-07-26) couvrait la sortie manuelle
(`hors_service_motif`), la création d'un contrôle « Réformé » (`addControle`)
et la création d'un incident « Mise au rebut immédiate » (`addIncident`).
Un test en conditions réelles a montré qu'on pouvait réformer sans
commentaire via **« Modifier le contrôle »** — un chemin d'écriture distinct
(l'éditeur générique, pas la création) qui ne portait aucune des règles
ajoutées. Un audit systématique des écritures vers CONTROLES/INCIDENTS/
MATERIELS a alors révélé six autres chemins dans la même situation :
`EDITABLE.controle`/`EDITABLE.incident` (édition), `controleGroupe` (contrôle
groupé depuis Suivi EPI), les trois branches de `ficheEnvoyer` (actions
rapides depuis la fiche : contrôler, déclarer un incident, retour de prêt),
et surtout `actionsRetour` — qui réforme **automatiquement** un exemplaire
(`hors_service_motif: 'Perdu'`) quand un prêt revient marqué comme tel, en
écriture directe, sans jamais passer par un formulaire.

**Décision** : un champ `commentaire` (facultatif, sur MATERIELS) plutôt
qu'un nouveau motif dédié par type d'événement (« Rappel fabricant » comme
valeur distincte de `MOTIFS_HORS_SERVICE`, envisagé puis écarté). La même
règle — commentaire obligatoire dès que l'option de sortie/réforme est
choisie — a été posée aux **neuf** points d'entrée : les trois formulaires de
création, leurs deux éditeurs génériques, le contrôle groupé, les trois
actions rapides de la fiche, et les deux flux de retour de prêt (bulk avec
état partagé `retourGroupe`, bulk par ligne dans le tableau des « bons »).
`actionsRetour` accepte désormais un `commentairePerte` optionnel, gardé par
`aColonne('materiels', 'commentaire')` comme partout ailleurs.

**Leçon méthodologique** : une règle de validation ajoutée à un seul point
d'entrée (la création) ne protège pas les points d'entrée voisins (l'édition,
les actions groupées, les raccourcis) qui écrivent dans la même table par un
chemin de code différent. Avant de considérer une règle métier comme posée,
lister explicitement **tous** les chemins d'écriture vers la table concernée
(`grep resolvedNames.<table>`) plutôt que de supposer qu'un seul formulaire
suffit.

**Compromis assumé** : un motif dédié aurait permis un filtre/export propre
(« tout ce qui a été retiré sur tel rappel »). Le texte libre ne s'y prête
pas aussi bien — seule la recherche texte de Grist le permet. Jugé
suffisant à l'échelle d'un club ; à revisiter si le besoin de filtrage
précis se confirme à l'usage.

**Raffinement (même jour)** : dans le tableau des « bons » (retour par
ligne), le premier jet partageait un seul commentaire pour tout le bon —
mauvais si plusieurs exemplaires rendus ensemble ne partagent pas le même
sort. Corrigé : une ligne `<tr class="ret-detail">` masquée s'ouvre sous
*chaque* exemplaire dès que son état passe à Perdu ou Volé (ajouté comme
distinct de Perdu, cohérent avec `MOTIFS_HORS_SERVICE`), avec son propre
champ. La validation identifie individuellement l'exemplaire dont le
commentaire manque plutôt que de bloquer le lot en bloc. `actionsRetour`
distingue désormais `hors_service_motif` selon l'état exact (`Perdu` ou
`Vole`) au lieu de tout faire tomber sur `Perdu`. Le flux `retourGroupe`
(état unique partagé pour tout un lot coché) garde lui un commentaire
partagé — cohérent avec sa sémantique propre (« traiter le lot à
l'identique »), pas un oubli.

### 7.9 Audit systématique : les mêmes trous existaient sur la cohérence des dates

Après §7.8, Pierre a demandé un audit méthodique — pas juste attendre le
prochain signalement. Méthode : pour chaque règle de validation existante
(`erreurDates`/`erreurDatesEditeur`, unicité de marquage, unicité de
préfixe), lister *tous* les chemins d'écriture vers la table concernée et
vérifier lesquels l'appliquent réellement. L'unicité de marquage et de
préfixe se sont révélées saines partout. La cohérence des dates, non :
six chemins l'ignoraient, alors que la règle existait ailleurs pour la
même table.

| Chemin | Règle absente, présente ailleurs |
|---|---|
| `ajouterExemplaires` | Mise en service ≥ fabrication du lot (`EDITABLE.materiel`) |
| `controleGroupe` | Date de contrôle pas dans le futur (`addControle`) |
| `ficheEnvoyer('controler')` | Idem |
| `ficheEnvoyer('incident')` | Date d'incident pas dans le futur (`addIncident`) |
| `ficheEnvoyer('preter')` | Retour prévu ≥ emprunt (`addPret`, éditeur bon) |
| `creerAchat` | Réception ≥ commande (`creerLot` embarqué, `EDITABLE.achat`) |

Les six ont reçu exactement la règle qui existait déjà ailleurs (mêmes
messages d'erreur, via `erreurDates`), testés un par un (refus incohérent
+ acceptation cohérente).

**Généralisation de la leçon de §7.8** : deux familles de chemins
concentrent systématiquement ce risque — les **actions rapides depuis la
fiche** (`ficheEnvoyer`, qui dupliquent un formulaire principal sans
reprendre ses garde-fous un par un) et les **formulaires groupés/isolés**
(`controleGroupe`, `creerAchat`, `ajouterExemplaires`, qui existent à côté
d'un formulaire "de référence" et divergent silencieusement). Avant
d'ajouter une nouvelle règle de validation à l'avenir, vérifier
explicitement si un raccourci ou un formulaire alternatif écrit dans la
même colonne — c'est là qu'elle sera oubliée par défaut, pas dans le
formulaire principal qu'on a sous les yeux en la codant.

---

### 7.10 Idées explicitement écartées

À ne pas reproposer sans un besoin nouveau et documenté :

- **Notifications e-mail**, réservations en ligne, backend externe : hors
  périmètre d'un widget Grist statique.
- **Photos sur les contrôles** : jugé redondant avec la photo d'incident
  et la photo de lot.
- **Millésime dans le marquage** : débattu et écarté (le marquage doit
  rester stable dans le temps, indépendamment de l'année d'achat).
- **Gérer les règles d'accès (ACL) depuis le widget** : un widget n'a
  aucune autorité de sécurité propre — tout ce qu'il masque à l'écran
  reste contournable côté navigateur. Les vraies règles restent l'affaire
  de Grist ; voir `droits_acces_complet_CAF_Auxerre.pdf` pour la procédure
  manuelle documentée à la place.
- **Note « supprimer et refaire un lot » en cas d'erreur de quantité** :
  écartée au profit de l'action « Ajouter des exemplaires » (§7.3), plus
  sûre pour la traçabilité réglementaire d'un EPI déjà en usage.

---

### 7.11 Réformer un exemplaire en prêt ne doit pas laisser le prêt ouvert

Trouvé en réfléchissant aux trous d'*usage* plutôt qu'aux erreurs de
logique : rien ne reliait « réformer un exemplaire » et « ce même
exemplaire est actuellement en prêt ». Scénario réel qui l'a révélé —
quelqu'un revient de sortie et annonce directement *« la corde est
fichue, on l'a mise au rebut sur place »* : le réflexe est de déclarer
un incident, pas de faire d'abord un retour en bonne et due forme. Le
matériel finissait bien Réformé, mais son prêt restait indéfiniment
ouvert, passait « en retard », et polluait le suivi des mois durant.

**Prudence demandée par Pierre avant de construire** : un prêt peut
porter sur plusieurs exemplaires à la fois (un « bon »), rendus
partiellement. Réformer l'un ne doit jamais toucher au prêt d'un autre
exemplaire du même bon. Vérifié dans le modèle de données avant tout
codage : `EMPRUNTS` a **une ligne par exemplaire**, jamais une ligne par
bon — c'est déjà ce qui permet de rendre 2 objets sur 3 sans toucher au
3e. `pretOuvertDe(matId)` (nouveau helper) filtre strictement par
`e.materiel === matId`, jamais par `numero_emprunt`.

**Interface** : dès qu'un exemplaire en prêt est réformé (contrôle,
incident, sortie manuelle — création ou édition), une case à cocher —
cochée par défaut — propose de clôturer ce prêt dans le même geste :
*« Cet exemplaire est actuellement prêté à [Adhérent] depuis le [date]
— clôturer aussi ce prêt »*. Rien n'est automatique en silence ; la case
reste décochable.

**Huit points d'entrée traités**, avec deux mécanismes selon la
cardinalité :
- **Un seul exemplaire** (`EDITABLE.materiel`, `EDITABLE.controle`,
  `EDITABLE.incident`, `ficheEnvoyer('controler'/'incident')`) :
  `blocFermerPret(matId)` affiche le prêt exact trouvé.
- **Plusieurs exemplaires cochés en même temps** (`addControle`,
  `addIncident`, `controleGroupe`) : `blocFermerPretsMultiples(matIds)`
  liste ceux, parmi les cochés, qui sont en prêt — une seule case
  partagée, mais chaque prêt fermé est ciblé individuellement par son
  propre `materiel` id, jamais par lot.

**Un choix pour rester simple sans perdre en sûreté** : dans les
formulaires groupés, l'aperçu (qui est en prêt) se recalcule au choix du
résultat/de la suite — pas à chaque coche/décoche individuelle pour
`controleGroupe` et lors du choix de résultat pour les deux autres. Mais
l'action réellement appliquée, elle, est **toujours recalculée à neuf au
moment de la soumission**, à partir de la sélection cochée à cet
instant précis — jamais de ce qu'affichait un aperçu qui aurait pu
devenir périmé entre-temps. La justesse de l'écriture ne dépend donc
jamais de la fraîcheur de l'affichage.

Point d'extension réutilisé plutôt qu'inventé : `cfg.apres(rowId, fields)`
existait déjà dans `saveEditor` (prévu, jamais utilisé) — exactement le
bon endroit pour ajouter une action secondaire après l'écriture
principale.

---

### 7.12 Les messages d'erreur doivent apparaître là où on regarde, pas où le code les range

Signalé par Pierre : dans le tableau des « bons » (retour par ligne),
refuser un retour sans commentaire ne montrait **aucune** erreur visible
— la validation fonctionnait (rien n'était enregistré), mais le message
s'écrivait dans `#prFlash`, en haut de l'onglet Prêts, loin de la ligne
sur laquelle on travaillait après avoir défilé la page. Deuxième défaut
trouvé en corrigeant le premier : ce message utilisait `flash()`, une
fonction pensée pour les confirmations de succès — elle force la couleur
verte, donc même visible, une erreur s'y serait affichée comme si tout
allait bien.

**Corrigé** : un message d'erreur local (`<span class="form-msg">`),
posé juste à côté du bouton concerné plutôt que dans une zone commune
éloignée, toujours en rouge, avec le focus posé directement dans le champ
manquant. Fait pour `.btn-bon-coches` (le cas signalé) et `retourGroupe`
(même défaut trouvé par le même audit, avant qu'il ne soit lui aussi
signalé séparément).

**Principe pour la suite** : `flash(id, texte)` est réservé aux
confirmations de succès (couleur verte forcée, disparaît après 8s) —
jamais pour une erreur de validation. Pour une erreur, écrire dans un
message local, positionné physiquement près de l'action qui a échoué,
pas dans une zone partagée qui peut se trouver hors du champ de vision
au moment où l'utilisateur clique.

---

### 7.13 Un bouton qui ment sur ce qu'il va faire est pire qu'une erreur

Signalé par Pierre, mais une fausse piste au départ : il pensait avoir
trouvé un bug de validation (§7.12), en réalité il avait cliqué
« Éditer » par erreur. La vraie cause de sa confusion — plus
intéressante — c'était l'existant : deux boutons dans chaque bon, avec
un déséquilibre de poids visuel qui ne correspondait pas à l'intention.
`.btn-bon-tout` (« Tout rendre en bon état »), plein, vert, en haut du
bloc, donc *visuellement* le bouton principal ; `.btn-bon-coches`
(« Valider le retour des coches »), contour clair, en bas après le
tableau, donc secondaire. Sauf que dès qu'on personnalise une ligne
(un exemplaire Perdu, par exemple), c'est le second qui devient l'action
voulue — le bouton le plus visible propose alors de faire l'inverse de
ce qu'on vient de saisir.

**Décision : fusionner en un seul bouton adaptatif**, plutôt que
rééquilibrer le poids visuel de deux boutons distincts (option
envisagée, écartée : garder deux actions à interpréter n'aurait fait que
réduire le risque, pas l'éliminer). `bonEstVierge(bloc)` détecte l'état
« rien touché » (aucune case cochée, tous les états sur leur valeur par
défaut) ; le bouton affiche et fait alors le raccourci « Tout rendre en
bon état ». Dès qu'une case est cochée **ou** qu'un état change — même
sans rien cocher — le libellé devient « Valider la saisie » et le clic
respecte exactement ce qui a été réglé ligne par ligne, plus jamais le
raccourci en masse.

**Choix de positionnement** : le bouton fusionné vit en bas du bon,
là où vivait déjà `.btn-bon-coches` — pas en haut, où vivait l'ancien
raccourci. Raison : c'est aussi là que vit le message d'erreur local
posé en §7.12 (avec le focus automatique sur le champ manquant) ;
déplacer le bouton en haut aurait recréé exactement le problème qu'on
venait de corriger — un message d'erreur qui apparaît loin de l'endroit
où l'utilisateur regarde.

### 7.14 Un total qui rétrécit en silence cache un retour partiel

Signalé par Pierre juste après §7.13 : un bon partiellement rendu
n'était pas *explicitement* signalé comme tel. `pretsEnCours` (les
lignes EMPRUNTS encore ouvertes) alimente seul `renderBonsEnCours` — un
bon de 8 exemplaires dont 7 reviennent se contente d'afficher
« 1 exemplaire » la fois suivante, sans aucune trace que 7 sont déjà
rentrés. Pour le savoir, il fallait comparer à la main avec « Prêts
terminés ».

**Corrigé** : un total d'origine par bon (`totalParBon`, calculé sur
`emprunts` en entier — ouverts et rendus confondus — avant le filtrage
qui produit `pretsEnCours`) transite jusqu'à `blocBon`. Dès que ce total
dépasse le nombre de lignes encore ouvertes, un badge **« Partiel »**
(style `.info`, pas `.danger` — ce n'est pas un problème, juste une
information) apparaît à côté du badge « Retard » existant, et le
compteur passe de « 8 exemplaires » à « 1/8 exemplaire encore en
cours ». Le bon s'ouvre aussi automatiquement, comme pour un retard,
plutôt que de rester replié et de se faire oublier.

**Choix de formulation** : compteur volontairement court (« X/Y »)
plutôt qu'une phrase complète — le badge dit déjà « Partiel », le texte
n'a pas besoin de le redire.

**Portée délibérément limitée à « Prêts en cours »** : `blocBonTermine`
(la vue « Prêts terminés », repliée par défaut) n'a pas reçu le même
traitement. Son rôle est de journaliser ce qui a été rendu, pas de
signaler ce qui reste dehors — cette information appartient à la vue
« en cours », qui vient d'être corrigée.

### 7.15 Un seul point de correction pour quatre affichages incohérents

Pierre a repéré une incohérence de fond, en deux volets, après le
chantier sur la documentation obligatoire des sorties (§7.8-7.14) :
« perdu » et « volé » devaient être *visiblement* distincts, et
*toutes* les remarques écrites (commentaires de contrôle, descriptions
d'incident, circonstances de sortie) devaient apparaître sur la fiche
de l'exemplaire ou celle du lot — pas seulement être enregistrées.

**Constat, avant tout correctif** : `_raison` (calculée une seule fois
par `deriverStatut`, attachée à `m._statut`/`m._raison`) n'a que quatre
consommateurs dans tout le fichier — la fiche de vie imprimable (ligne
« Motif »), le tableau du lot, la fiche exemplaire in-app, et un export
CSV. Ce petit nombre a rendu la correction très concentrée : un seul
point de calcul à corriger répare les quatre affichages d'un coup,
plutôt que quatre correctifs séparés qui auraient pu diverger.

**Deux défauts distincts, trouvés en creusant** :

1. `STATUT_SELON_MOTIF` faisait correspondre `Vole` au mot affiché
   *« Perdu »*, et `Cede` à *« Reforme »* — une perte d'information
   silencieuse à l'affichage, alors que la distinction existe bien en
   base (`hors_service_motif`). Sans risque fonctionnel : tout ce qui
   exclut un exemplaire du parc actif (`HORS_STOCK`, les prédicats de
   prêt) vérifie déjà `_statut`, qui portait donc correctement la bonne
   information — seul le *mot* affiché à l'humain était faux. Corrigé :
   `STATUT_SELON_MOTIF` et `HORS_STOCK` distinguent désormais les
   quatre motifs.
2. Aucune des quatre branches de `deriverStatut` où un humain écrit un
   commentaire (sortie manuelle, contrôle réformé, incident rebut,
   contrôle « à surveiller ») ne l'incluait dans la `raison` retournée
   — `MATERIELS.commentaire`, en particulier, n'était lu **nulle part**
   dans tout le fichier avant ce correctif, alors qu'on l'avait rendu
   obligatoire deux sessions plus tôt (§7.8). Corrigé par un petit
   helper, `avecNote(base, note)`, appliqué aux quatre branches
   concernées (pas aux branches « prêté » ni « fin de vie », qui n'ont
   pas de commentaire associé).

**Effet de bord positif, gratuit** : `_raison` enrichie répare aussi
la visibilité du commentaire « à surveiller », qui n'existait déjà
qu'en creux dans le tableau de contrôles de la fiche imprimable —
désormais elle apparaît aussi sur la ligne « Motif », dès qu'un
exemplaire est sous ce statut.

**Deux correctifs annexes, pour rester cohérent** : la colonne
Observations, présente sur `tableauControles` (fiche imprimable)
depuis toujours, manquait sur l'écran in-app « Historique des
contrôles » — ajoutée. Et l'indice contextuel qui suggère quoi écrire
(déjà posé pour « Réforme » sur `addControle` et `EDITABLE.controle`)
a été étendu à « À surveiller », sur ces deux chemins **et** sur deux
qui n'avaient jamais eu cet indice du tout (`controleGroupe`,
`ficheEnvoyer('controler')`) — sans jamais rendre le commentaire
obligatoire dans ce cas, contrairement à la réforme.

### 7.16 `vertical-align: middle` sur un `<td>` devient trompeur dès qu'une cellule s'allonge

Complément direct de §7.15 : enrichir `_raison` (bonne chose) a un effet
de bord visuel que je n'avais pas anticipé. Dès qu'une ligne du tableau
du lot porte une raison longue (plusieurs lignes, ex. la description
d'un incident), la règle globale `td { vertical-align: middle; }`
centre **toutes** les cellules de cette ligne sur sa hauteur totale —
y compris celles qui n'ont qu'une ligne de texte (lieu, date, boutons
Éditer/Fiche de vie/Supprimer), qui se retrouvent visuellement décalées
vers le bas par rapport aux lignes voisines, plus courtes.

**Diagnostic fait sans rendu du widget complet** : l'environnement de
développement ne peut pas charger `grist-plugin-api.js` (domaine hors
liste blanche du réseau), donc pas de rendu du widget réel via
Playwright cette fois. Diagnostic confirmé par un **repro isolé** —
une page minimale reprenant le CSS exact et le texte exact de la
capture de Pierre — plus fiable ici qu'une supposition sur la seule
lecture du CSS, et qui montre la même règle CSS peu importe la page où
elle s'exécute.

**Corrigé** : passage de `vertical-align: middle` à `vertical-align: top`
sur la règle `td` globale. Sans risque ailleurs dans l'outil : pour une
cellule à une seule ligne, top et middle produisent exactement le même
rendu (la hauteur du contenu égale la hauteur de la ligne) — seule une
ligne à hauteur inégale, le cas qu'on corrige, était concernée.

**Correction incomplète — deuxième capture de Pierre.** Le correctif
ci-dessus ne touchait pas la cellule des boutons d'action (Éditer/Fiche
de vie/Supprimer), qui restait décalée vers le bas. Cause : ces
cellules portent `style="display:flex;gap:6px"` (9 occurrences dans le
fichier) pour aligner les boutons horizontalement — **`vertical-align`
ne s'applique pas à un élément `display:flex`**, c'est documenté (MDN :
« this property does not apply to elements that generate flex or grid
containers »), pas une question de spécificité CSS. Le premier
correctif était donc sans effet sur ces cellules précises, quelle que
soit sa justesse par ailleurs. Reconfirmé par le même type de repro
isolé, cette fois avec le balisage exact (`<td style="display:flex...">`)
recopié du code.

**Corrigé pour de bon** : les 9 occurrences de ce `style` en ligne
remplacées par une classe unique, `.td-actions` (`display:flex; gap:6px;
align-items:flex-start; flex-wrap:wrap;`) — `align-items:flex-start`
ancre les boutons en haut de la cellule flex, ce que `vertical-align`
n'aurait jamais pu faire ici. Un seul remplacement global (`old_str`
identique sur les 9 occurrences) plutôt que 9 corrections séparées.

**Leçon** : `vertical-align` et `display:flex` ne se mélangent jamais —
dès qu'une cellule de tableau passe en `display:flex` pour aligner son
contenu horizontalement, sa position verticale dans la ligne échappe à
`vertical-align` et doit être reprise par `align-items` sur ce même
conteneur flex.

**Troisième acte — un cas différent, la même famille.** Pierre a
demandé un traitement définitif plutôt qu'un troisième rustinage
isolé. Audit de tous les `flex-wrap: wrap` du fichier (14 occurrences) :
la plupart sont des listes qui doivent naturellement s'étaler
(`.stat-puces`, `.fiche-docs`, badges de statistiques) — aucun risque,
le wrap y est voulu. Un cas correspondait au même défaut que les
précédents : `.lot-head` (icône + titre + méta + `.lot-counts` — badges
et boutons), où `.lot-counts` ne passait à la ligne que si le titre du
lot était assez long pour manquer de place — un seuil fragile, fonction
de la longueur du nom **et** de la largeur d'écran. Un lot au nom court
restait sur une ligne, un lot au nom long basculait sur deux, sans
qu'aucun réglage explicite ne l'ait décidé. Une règle existait déjà
pour forcer `.lot-counts` sur sa propre ligne, mais seulement sous
`@media (max-width: 860px)` — laissant toute la zone au-dessus de ce
seuil livrée au hasard du contenu.

**Corrigé différemment du cas précédent, à dessein** : plutôt que de
forcer une seule ligne (`align-items:flex-start`, la solution du cas
précédent — sûre parce que les libellés de bouton sont fixes), ici
`flex-basis: 100%` sur `.lot-counts` force **toujours deux lignes** :
titre en haut, badges et actions en dessous, pour tous les lots, quelle
que soit la longueur du nom ou le nombre de badges d'alerte. Ce choix
tient compte d'une variabilité bien plus grande qu'un simple bouton :
un nom de lot et jusqu'à huit badges d'alerte possibles auraient rendu
le forçage sur une seule ligne fragile à son tour. La règle média
devenue redondante a été retirée plutôt que laissée à double emploi.
Vérifié à trois largeurs (1450px, 1000px, 750px) : les deux lignes
restent identiques en structure, seule la largeur du texte varie.

**Audité et jugé sans risque** : `.demande-actions`, structurellement
différent (déjà sur sa propre ligne, ne partage pas l'espace avec un
texte de longueur variable) — pas le même défaut, pas de correction
nécessaire.

### 7.17 Photo du lot agrandie (30→46 px) pour s'aligner sur la structure deux lignes

Après passage à la structure deux lignes (§7.16), la photo de 30×30 px
paraissait disproportionnée. Test visuel Playwright confirme que 46×46 px
s'intègre proprement et correspond à la hauteur naturelle des deux lignes
titre + méta. Changement CSS unique, sans impact fonctionnel.

### 7.18 Filtre lieu de stockage dans les prêts + avertissement multi-sites

**Contexte** : Pierre signale qu'un bon couvrant du matériel stocké à
plusieurs endroits oblige l'emprunteur à faire des allers-retours. Deux
améliorations dans la même livraison :

1. **Filtre lieu de stockage** ajouté au formulaire de nouveau prêt
   (uniquement le préfixe `pr` — pas les contrôles ni incidents qui n'ont
   pas besoin de ce filtre). Le select est peuplé dans `materielsFiltresCascade`
   au moment du filtrage, câblé via `brancherFiltres` (ajout de `'FiltreLieu'`
   dans le tableau des suffixes). L'entrée dans le test `actif` de
   `majListeSelectionnable` a été étendue pour inclure `lieuEl.value` —
   sans ça, choisir un lieu seul affichait le message « choisissez une
   catégorie » au lieu de la liste filtrée.

2. **Avertissement multi-sites non bloquant** dans `addPret` : si les
   exemplaires cochés viennent de plusieurs lieux distincts, le premier
   clic affiche un message d'alerte explicite (nommant les lieux concernés)
   et ne fait rien d'autre. Le second clic sur le même bouton confirme que
   l'emprunteur est conscient et enregistre. Implémenté via un drapeau
   `addPret._multiOk` remis à `false` après chaque validation réussie.
   Choix délibéré : non bloquant (un emprunteur peut très bien vouloir
   récupérer sur deux sites), mais impossible d'ignorer.

### 7.19 Le libellé d'un bouton qui se coupe en deux casse l'alignement d'une rangée

Troisième cause distincte du même symptôme visuel signalé par Pierre
(après §7.16 : `vertical-align` puis `align-items` puis `flex-basis`).
Celle-ci n'était pas verticale du tout : les boutons n'avaient pas de
`white-space: nowrap`, donc « Fiche de vie » se coupait sur deux lignes
quand la colonne se resserrait, rendant ce bouton plus haut que ses
voisins — d'où l'impression de désalignement, alors que les trois
boutons étaient bien ancrés en haut. Corrigé par `white-space: nowrap`
sur la règle `button` globale.

**Leçon opératoire** : un symptôme d'alignement peut avoir une cause
horizontale. Vérifier d'abord si un élément de la rangée a une hauteur
différente des autres (texte qui passe à la ligne) avant de chercher
une règle d'alignement vertical.

**Régression trouvée au passage** : le correctif photo de §7.17
(30→46 px) avait disparu du fichier livré — écrasé par une copie d'une
version antérieure du HTML lors d'une livraison ultérieure. Restauré.
Rappel de méthode : après toute copie de fichier complet, vérifier que
les correctifs récents sont toujours présents (`grep` ciblé), ne pas
supposer que le fichier source est à jour.

### 7.20 Le menu d'état remplace la case à cocher au retour de prêt

Proposition de Pierre : la case à cocher et le menu d'état étaient
redondants — choisir « Bon état » dans un menu *est* la déclaration de
retour, la case n'ajoutait rien. Supprimée ; le menu démarre désormais
sur « Non rendu » (valeur vide) et porte les `data-emp`/`data-mat`
qu'avait la case.

**Ce qui est préservé, vérifié par test** :
- **Retour partiel** : les lignes laissées sur « Non rendu » restent en
  cours — même résultat qu'une case non cochée.
- **Raccourci un clic** : `bonEstVierge(bloc)` teste maintenant
  « aucun état choisi » au lieu de « aucune case cochée + tous les états
  par défaut » — plus simple et plus juste.
- **Commentaire obligatoire Perdu/Volé** : inchangé, il se déclenchait
  déjà sur la valeur du menu.

**Non touché à dessein** : `ligneEnCours` (la vue à plat des prêts, hors
bons) garde ses cases à cocher — elle utilise `retourGroupe`, qui
applique **un seul état partagé** à toute la sélection. La case y a un
sens que le menu ne peut pas porter.

### 7.21 La vraie cause : un `<td>` en `display:flex` sort du calcul de mise en page du tableau

Quatrième et dernière cause du symptôme d'alignement (§7.16, §7.19).
Pierre a fourni une capture annotée montrant que ce qui ne s'alignait
pas, ce n'étaient pas les boutons entre eux, mais **les traits de
séparation horizontaux** : dans la colonne des actions, ils tombaient à
une hauteur différente de ceux des autres colonnes.

**Cause** : `display:flex` sur un `<td>` le retire du modèle de mise en
page du tableau. La cellule ne s'étire plus à la hauteur de sa rangée —
elle prend la hauteur de son contenu. Son `border-bottom` se dessine
donc à cette hauteur-là, décalée du trait des cellules voisines. Toutes
les corrections précédentes (`vertical-align`, puis `align-items`, puis
`white-space`) traitaient des symptômes réels mais distincts ; aucune ne
pouvait corriger celui-ci, qui découlait du choix de rendre le `<td>`
lui-même flex.

**Corrigé** : le `<td>` redevient une cellule de tableau normale, et le
`display:flex` est porté par un `<div>` **à l'intérieur**. Les 9
occurrences du JS enveloppent désormais leurs boutons dans ce div ; le
sélecteur CSS devient `.td-actions > div`. Vérifié par repro Playwright
avant/après : les séparateurs traversent la rangée d'un seul trait.

**Règle générale à retenir** : ne jamais mettre `display:flex` (ni
`grid`) sur un `<td>` ou un `<tr>`. Pour disposer le contenu d'une
cellule, toujours passer par un conteneur interne.

### 7.22 Badges actionnables et incidents clôturés

**Trois améliorations dans le même chantier, demandées après le renommage
des statuts (§7.21).**

**Badges cliquables.** Deux nouvelles classes CSS coexistent avec
`.badge-clic` (qui ouvre la fiche) sans la modifier :
- `.badge-action` : sur le badge « Examen requis », clic = ouvre la
  fiche exemplaire ET lance immédiatement l'action rapide « Contrôler »
  (formulaire pré-rempli).
- `.badge-goto-ctrl` : sur « Contrôle échu » et « Jamais contrôlé »,
  clic = bascule sur l'onglet Suivi EPI.

**Bouton « Contrôler » contextuel.** Affiché uniquement si
`m._statut === 'Examen requis'`, intercalé entre Éditer et Fiche de vie.
Même action que le badge cliquable — choix délibéré : deux points
d'entrée vers la même action, mais Éditer conservé tel quel (il modifie
l'exemplaire, pas le même geste).

**Deux listes d'incidents (comme prêts terminés).** La liste unique
filtrée par `vueIncidents` (variable de vue + cards cliquables) est
remplacée par deux sections permanentes :
- **« Incidents en attente »** : ceux qui nécessitent une action
  (ni suivis d'un contrôle, ni classés sans suite, ni mis au rebut).
- **« Incidents clôturés »** (repliés par défaut, `<details>`) : tous
  les autres — pour audit uniquement.

`incidentEnAttente` existait déjà dans le contexte de calcul (utilisé
par `deriverStatut`). `incClotures` est son complément dans `incidents`.
La variable `vueIncidents` et le câblage des cards cliquables associé
sont supprimés — devenus inutiles.

La colonne Suite affiche désormais un badge vert « Contrôle réalisé »
quand un contrôle postérieur à l'incident a été enregistré, visible dans
la liste clôturée et utile en cas d'audit.

### 7.23 `type_controle` — distinguer contrôle périodique et contrôle suite à incident

**Contexte.** Un contrôle annuel FFCAM et un contrôle déclenché par un
incident n'ont pas la même valeur probatoire en cas d'audit ou d'accident.
Les confondre dans le registre affaiblit la traçabilité.

**Colonne optionnelle, détectée à l'exécution.** `type_controle` suit le
motif `aColonne` : à créer manuellement dans la table `CONTROLES` de Grist.
Si elle est absente, aucun champ n'apparaît et aucune erreur n'est levée.
Si elle est présente, tout s'active automatiquement.

**Options dynamiques.** Chargées via `chargerChoixColonne` exactement comme
`role` (adhérents) et `financement` (achats) — si l'utilisateur renomme un
choix dans Grist, il se met à jour dans le widget sans toucher au code.
Valeurs par défaut : `Contrôle périodique`, `Contrôle suite à incident`,
`Contrôle avant mise en service`.

**Pré-sélection automatique.** Quand le contrôle est ouvert depuis un
contexte incident (`badge-action` « Examen requis », `btn-controler-rapide`,
`btn-realiser-ctrl`), `ficheAction` reçoit `TYPE_CONTROLE_DEFAUT[1]` en
4e paramètre et le sélectionne après rendu. Les autres chemins (Suivi EPI,
contrôle groupé) partent sur la première option (périodique), modifiable.

**Sauvegarde.** Les quatre chemins d'écriture sont couverts : `ficheEnvoyer`,
`addControle`, `controleGroupe`, et `EDITABLE.controle` (via le motif
`champsEditables` qui détecte la colonne).

**Affichage.** Colonne « Type » ajoutée à l'écran Historique des contrôles
(in-app) et au tableau des contrôles de la fiche de vie imprimable, dans les
deux cas conditionnée par `aColonne('controles','type_controle')`.

### 7.24 Raffinements UX de la session 2026-08-08

Plusieurs petits ajustements décidés lors de tests en conditions réelles,
regroupés ici car aucun ne méritait une entrée seule.

**Statuts renommés (§7.21 complété).** « En contrôle » → **« Examen
requis »** (immobilisation physique, examen nécessaire avant réutilisation) ;
« À contrôler » → **« Contrôle échu »** (rappel calendaire, non bloquant).
La distinction bloquant/informatif devient lisible d'un coup d'œil. Tous les
consumers mis à jour : `deriverStatut`, `STATUTS`, filtres, compteurs de lot,
aide, prédicats de prêt.

**`type_controle` dans l'éditeur de contrôle existant.** Ajout du champ
dans `EDITABLE.controle.fields` avec `colonne: 'type_controle'` — filtré
automatiquement par `champsEditables` si la colonne est absente. La valeur
existante est pré-remplie à l'ouverture. L'avertissement générique
(« modifier un contrôle réécrit la fiche de vie ») couvre ce champ sans
ajout spécifique.

**`renderControlesActions()` relancé après `load()`.** Le formulaire
« Nouveau contrôle » est construit par `renderControlesActions()` appelé
avant `load()` — donc `aColonne('controles','type_controle')` valait `false`
à ce moment, et le champ Type n'apparaissait jamais. Même cause que le bug
des filtres catégorie/lieu de l'onglet Matériel (§ précédent). Même
correctif : second appel dans le `.then()` de `load()`.

**Libellés des boutons Éditer contextualisés.** `btnEditer(entity, id)`
reçoit un 3e paramètre optionnel `libelle`. Chaque point d'appel passe
désormais le bon libellé : « Éditer le lot », « Éditer l'exemplaire »,
« Éditer le prêt », « Éditer le contrôle », « Éditer l'incident », « Éditer
l'achat », « Éditer l'exemplaire » (fiche individuelle). Le cas générique
`b.entity` (référentiels) conserve « Éditer » par défaut — contexte déjà
clair dans ces tableaux mono-entité.

**« Résultat du contrôle »** remplace « Résultat » dans les quatre
formulaires de saisie (ficheAction, addControle, controleGroupe,
EDITABLE.controle). Les en-têtes CSV et la fiche condensée conservent
« Résultat » pour la concision.

### 7.25 Photos sur les contrôles

Même motif que les photos d'incidents, répliqué à l'identique (colonne
optionnelle `photo` sur `CONTROLES`, détectée via `aColonne`) :

- **Saisie à la création** : uniquement sur le formulaire mono-exemplaire
  (`ficheAction` 'controler') — les formulaires groupés (`addControle`,
  `controleGroupe`) n'ont délibérément pas de champ photo, une seule photo
  n'ayant pas de sens pour plusieurs exemplaires traités ensemble. Upload
  via `televerserFichierSeul` avant la création, ID injecté directement
  dans `AddRecord` — même mécanique que la déclaration d'incident.
  Échec non bloquant : le contrôle est créé, une note apparaît via
  `afficherErreurGlobale` (persistante, survit au rafraîchissement du
  panneau qui suit immédiatement la création).
- **Ajout après coup** : bouton « Photo + » dans l'écran Historique des
  contrôles, sur toute ligne sans photo — couvre les contrôles créés en
  groupe. `urlsPhotosControles`, miroir exact de `urlsPhotosIncidents`.
- **Affichage** : vignette dans l'historique in-app, colonne Photo dans
  `tableauControles` (fiche individuelle et registre du lot), conditionnée
  par la présence effective d'au moins une photo (`avecPhoto`).

### 7.26 Regroupement de l'historique des contrôles par lot

**Constat de Pierre** : un contrôle groupé (formulaire « Suivi EPI ») crée
une ligne CONTROLES par exemplaire, toutes identiques sauf le matériel —
un contrôle annuel sur un lot de 12 produit 12 lignes indiscernables dans
l'historique.

**Détection, purement à l'affichage** : `regrouperControlesLot` regroupe
les entrées partageant exactement le même jour calendaire, contrôleur,
résultat, commentaire, type de contrôle **et lot**. Rien n'est stocké côté
Grist — c'est une déduction faite à chaque rendu. Un contrôle qui porte une
photo n'est **jamais** regroupé, même si sa signature correspondrait à
d'autres lignes : la photo doit rester visible individuellement, pas cachée
dans un repli.

**Affichage** : une ligne groupée montre « Lot — N exemplaires », avec un
repli cliquable listant les marquages (badges cliquables vers la fiche de
chaque exemplaire). Pas de bouton Éditer/Supprimer sur la ligne groupée —
gérer un contrôle précis se fait via la fiche de l'exemplaire, pour éviter
tout risque de modification ou suppression groupée accidentelle.

**Limite assumée** : c'est une heuristique, pas une donnée. Deux contrôles
réellement distincts qui partageraient par coïncidence exactement les mêmes
date/contrôleur/résultat/commentaire/type sur le même lot seraient
regroupés à tort — risque jugé négligeable en pratique.

### 7.27 Pertes et vols déplacés vers les statistiques AG

Les deux mini-cartes « Perdus/Volés en [année] », ajoutées sur la Vue
d'ensemble lors d'une session précédente, ont été retirées de là et
recalculées dans `calculerStatistiques()` — exposées comme un 5e bloc
(« Pertes et vols ») dans la section « Statistiques du club (bilan, AG) »,
aux côtés de la rotation, des lots dormants et des dépenses. Raison du
déplacement : ce sont des chiffres de bilan annuel, pas des indicateurs de
pilotage quotidien — ils n'avaient pas leur place sur l'écran d'accueil.
Le CSS `.card-half`/`.card-stack`, devenu orphelin, a été retiré.

**Bug corrigé au passage** : sur la Vue d'ensemble, la capture de Pierre
montrait ces deux cartes affichées en texte brut, sans aucune mise en
forme — signe que le HTML et le JS collés dans Grist n'étaient pas de la
même livraison (le CSS de la carte demi-format existait, mais peut-être pas
dans le fichier réellement en place). Le déplacement rend la question
caduque, mais le rappel reste valable : toujours coller les deux fichiers
ensemble.

### 7.28 Export d'un bon de prêt fermé (PDF + CSV)

**Distinct de `corpsFicheEmprunt`/`imprimerBon`**, qui génèrent un document
*vierge* à remplir au moment du prêt (cases à cocher). `corpsRecapBon`
génère au contraire un **récapitulatif de ce qui s'est réellement passé** :
matériel, date d'emprunt, date de retour, état constaté — à partir des
données déjà enregistrées. Réservé aux bons entièrement fermés, à la
demande de Pierre (scope volontairement réduit — un bon encore ouvert n'a
pas de résultat à récapituler).

Deux boutons dans l'en-tête de chaque bon fermé (« Prêts terminés »),
export PDF (`sortirDocument`/`enveloppeFiche`, comme les autres documents
imprimables) et CSV (`telechargerCsv`, motif générique déjà utilisé pour
l'export de l'inventaire et des statistiques). Les items du bon sont
retrouvés au clic via `bonsTerminesItems`, une table globale repeuplée à
chaque rendu de `blocBonTermine` — même motif que `bonsDeplies` (état de
repli des bons), déjà établi dans le code.

### 7.29 Le repli d'un contrôle groupé restait toujours ouvert

Régression dans l'implémentation de §7.26 : le `<div>` du détail portait à
la fois l'attribut `hidden` et un style en ligne `display:flex`. Un style
en ligne l'emporte toujours sur la règle par défaut du navigateur qui
masque `[hidden]` — celle-ci n'est qu'une règle d'origine UA, facilement
écrasée. Le repli s'affichait donc en permanence ouvert, chevron et tout.

**Corrigé** par une classe dédiée qui gère les deux états explicitement :

```css
.ctrl-grp-detail { display: none; }
.ctrl-grp-detail:not([hidden]) { display: flex; }
```

**Règle à retenir** : ne jamais combiner `hidden` et un `display` en style
inline sur le même élément. Si le contenu doit être flex/grid une fois
visible, le dire dans une classe avec la forme `:not([hidden])`, jamais en
style inline sur l'élément qui porte aussi `hidden`.

Au passage, « voir le détail » (colonne actions) est devenu un second
point d'entrée vers le même repli, avec la même classe `.ctrl-grp-toggle`
et le même `data-grp` — le chevron se synchronise sur les deux, quel que
soit celui cliqué.

### 7.30 Badges d'incident enrichis avec la décision du contrôle

Le badge « Contrôle réalisé » ne vérifiait que l'existence d'un contrôle
postérieur à l'incident (`i.suivi`), jamais son résultat — un exemplaire
réformé à l'issue du contrôle affichait le même badge vert qu'un
exemplaire déclaré conforme. Corrigé en réutilisant `ctx.dernierControle`
(la même donnée qui pilote `deriverStatut`) pour lire le résultat réel :

- Conforme → « Contrôlé — conforme » (vert)
- A surveiller → « Contrôlé — sous surveillance » (orange)
- Reforme → « Contrôlé — réformé » (rouge)

Les cas « Sans suite », « Mise au rebut immédiate » et « En attente de
contrôle » restent inchangés.

### 7.31 Titres de tableau sans repère visuel — trois endroits touchés

Pierre a repéré que les titres « Contrôles »/« Incidents »/« Prêts » de la
fiche exemplaire (`.fiche-hist h4`) se fondaient dans l'en-tête bleu foncé
du tableau juste en dessous — contrairement à `.section-titre` (utilisé au
niveau des onglets), qui porte un petit soulignement rouge distinctif.
Audit demandé par Pierre : le même défaut existait sur `.refs-bloc h3`
(Listes du club) et `.stat-bloc h4` (Statistiques AG) — trois règles CSS
quasi identiques, aucune avec le soulignement.

**Corrigé** en ajoutant le même repère visuel (`::after`, barre rouge
courte) aux trois. Piège évité sur `.refs-bloc h3` : cet élément est en
`display:flex` (titre + compteur + bouton sur une ligne) — un `::after`
ordinaire y serait devenu un élément flexible de plus, pas un soulignement
en dessous. Contournement : `position:relative` sur le h3,
`position:absolute` sur le `::after`, qui sort ainsi du flux flex.

**Bonus au passage** : le tableau « Pertes et vols » (§7.27) héritait par
erreur du style d'en-tête de la règle générale `table tr:first-child`
(fond bleu marine) sur sa première ligne de données, faute d'avoir un
vrai `<th>`. Classe `.tbl-sans-entete` ajoutée pour neutraliser ce cas.
Accent manquant corrigé (« Voles » → « Volés »), et une ligne « Valeur
estimée » ajoutée (prix unitaire du lot × nombre perdu/volé sur l'année),
affichée seulement si perdusAnnee+volesAnnee > 0.

### 7.32 Clôture d'incident : deux logiques de date qui ne disaient pas la même chose

Pierre a signalé un incident traité (contrôle conforme le jour même) resté
affiché « en attente » dans l'onglet Incidents. Cause : deux endroits du
code répondent à la même question — « ce contrôle traite-t-il cet
incident ? » — avec deux implémentations divergentes.

`ctx.incidentEnAttente` (pilote le statut affiché sur la fiche matériel)
normalisait déjà au **jour calendaire UTC**, précisément pour éviter
qu'un contrôle enregistré à minuit paraisse antérieur à un incident créé
plus tard le même jour. La variable `suivi` de l'onglet Incidents, elle,
comparait les `Date` **brutes**, composante horaire comprise — sans cette
normalisation, un incident et son contrôle du même jour pouvaient
échapper à la règle.

**Corrigé** en factorisant la comparaison dans un seul helper :

```js
function memeJourOuApres(a, b) {
  if (!a || !b) return false;
  var jA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  var jB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return jA >= jB;
}
```

**Règle à retenir** : dès que deux endroits du code répondent à la même
question métier, les faire passer par la même fonction — sinon l'un des
deux finit par diverger silencieusement.

### 7.33 Pièces jointes : le bouton ne disait jamais si une pièce existait déjà

Demande de Pierre : que le bouton d'ajout change d'apparence (« Modifier »
au lieu de « Ajouter ») et prévienne avant d'écraser une pièce déjà
présente. En creusant, un bug plus sérieux est apparu : `televerserPieceJointe`
n'a jamais écrasé une pièce — chaque upload **ajoute** un id à la liste de
la cellule (`['L', id1, id2...]`), l'historique est conservé côté Grist.
Mais l'affichage (`urlPieceJointe`) ne montrait que **le premier id
jamais ajouté** (`ids[0]`). Résultat : remplacer une photo réussissait
silencieusement, mais l'ancienne restait affichée indéfiniment — sans
avertissement, le bouton donnait l'impression de ne rien faire.

**Corrigé** en deux temps : affichage de la pièce la plus récente
(`ids[ids.length - 1]`) au lieu de la première ; et nouveau helper
`boutonPJ()` qui adapte libellé/titre selon qu'une pièce existe déjà, avec
`confirm()` avant tout remplacement (`data-pj-confirm` sur l'input,
lu par `surChoixPieceJointe`). Appliqué aux quatre pièces jointes du
projet : photo de contrôle, photo d'incident, facture d'achat, photo/notice
de lot.

### 7.34 Galerie multi-photos (contrôles, incidents) — jusqu'à 4, avec suppression

Suite logique de §7.33 : Pierre a demandé jusqu'à 4 photos par contrôle
et par incident (plusieurs angles/preuves ont un usage réel là où une
notice ou une facture n'ont structurellement qu'un seul document valide).
Contrairement à ce qu'on pouvait craindre, la donnée supportait déjà
plusieurs pièces jointes par cellule (c'est exactement ce que §7.33 vient
de corriger niveau affichage) — le vrai manque était la **suppression
individuelle**, qui n'existait nulle part dans le code.

Ajouté : `MAX_PHOTOS_PJ = 4` ; `retirerPieceJointe(cleTable, colonne,
ligneId, idASupprimer)` (réécrit la cellule sans l'id visé, garde les
autres) ; `remplirGaleriePhotos()` (affiche toutes les vignettes d'une
cellule, avec bouton croix individuel si `permettreSuppr`) ;
`surSuppressionPieceJointe()` (confirmation puis appel). Le bouton
d'ajout redevient un simple « Ajouter » (plus d'avertissement, on
n'écrase plus rien) tant que la limite n'est pas atteinte, remplacé par
un message « 4 photos max. » au-delà.

Réservé aux contrôles et incidents. Lots et achats restent en mode
« une seule pièce, remplacée avec avertissement » (§7.33) — cohérent avec
leur réalité : un lot n'a qu'un modèle, un achat qu'une facture.

### 7.35 Photos intégrées aux rapports imprimables

Les fiches de vie (individuelle et registre du lot) affichaient une seule
vignette de 80 px par contrôle/incident, réduite à néant par
l'impression — Pierre : « on est obligé de la télécharger ». Corrigé en
remplaçant la mini-colonne par une **ligne pleine largeur** insérée juste
sous la ligne de contrôle/incident concernée, avec toutes ses photos
alignées côte à côte et bien plus grandes (jusqu'à 150 px).

`urlsPieceJointe()` (toutes les URLs d'une colonne, pas seulement la
dernière) alimente des maps `id → [urls]` au lieu de `id → url`.
`ligneImpressionPhotos(nCols, urls)` génère la ligne `<tr colspan>`.
Au passage, le tableau incidents — dupliqué à l'identique dans la fiche
individuelle et le registre du lot — a été factorisé en
`tableauIncidents()`, pour que les deux ne puissent plus diverger.

### 7.36 Bouton d'ajout de photo déplacé des tableaux vers les éditeurs

Deux demandes convergentes de Pierre : libérer les tableaux Contrôles et
Incidents (barre d'actions surchargée), et permettre d'ajouter une photo
**dès la création** plutôt qu'après validation uniquement.

Le bouton a migré dans « Modifier le contrôle »/« Modifier l'incident »
(`ajouterBlocPhotos(box, cleTable, rowId)`, insérée juste avant
`.form-actions`, idempotente — reconstruite au besoin sans fermer
l'éditeur). Point technique résolu : après un ajout/suppression depuis ce
bloc, `load()` rafraîchit les listes mais ne touche jamais les panneaux
d'édition (construits hors de son cycle de rendu) — sans rebranchement
explicite, le bloc restait figé. `rafraichirBlocPhotosOuvert()`, appelée
en fin de `televerserPieceJointe()`/`retirerPieceJointe()`, reconstruit le
bloc s'il est ouvert sur la ligne concernée.

**Photo à la création** : `ajouterBlocPhotos()` gère aussi `rowId ==
null` — la ligne n'existe pas encore, impossible d'y rattacher une pièce
jointe (Grist exige un id existant). Le fichier est simplement
sélectionné (`#edPhotoCreation`, `multiple`, plafonné à `MAX_PHOTOS_PJ`) ;
`saveCreator()` le télé­verse et le rattache juste après la création de
la ligne, en un seul geste utilisateur. Fonctionne pour n'importe quelle
entité de `EDITABLE` disposant d'une colonne `photo` — n'active rien pour
les autres puisqu'elle cherche simplement `#edPhotoCreation` dans le
formulaire.

Vérification demandée par Pierre sur les incidents (« c'est déjà bon,
non ? ») : en fait non, même limitation qu'aux contrôles — corrigée en
même temps. Les lots, eux, étaient déjà corrects, mais via un mécanisme
différent et plus ancien : leur formulaire de création (`creerLot()`,
bespoke) intègre `lotPhotoFile`/`lotNoticeFile` depuis l'origine,
télé­versés avant même la création de la ligne du lot.

### 7.37 Mention « photo illustrative » sur la photo de modèle

Suggestion de Pierre : la photo d'un lot (un grigri bleu, par exemple)
est **générique au modèle**, pas à l'exemplaire réel (qui peut être
jaune, orange...) — contrairement aux photos de contrôle/incident, qui
documentent l'état réel au moment T. Ambiguïté à lever partout où cette
photo apparaît dans le contexte d'un exemplaire ou d'une liste
d'exemplaires précis.

Ajoutée en italique, discrète : fiche exemplaire à l'écran
(`afficherPhoto(..., illustratif)`, nouveau paramètre optionnel, pour ne
pas l'ajouter à la liste des lots elle-même où la photo est légitimement
représentative) ; fiche de vie PDF individuelle (formulation au
singulier : « cet exemplaire ») ; fiche du lot en PDF (formulation au
pluriel : « des exemplaires listés ci-dessous »).

**Correction en cours de route** : la fiche du lot avait d'abord été
exclue, jugée à tort purement « documentaire du modèle ». Or elle liste
en réalité les exemplaires physiques du lot (marquage, statut) juste sous
la photo — exactement le terrain de l'ambiguïté signalée. Repéré par
Pierre après livraison (« on ne voit pas la mention sur la fiche du
lot »), corrigé dans la foulée.

### 7.38 Badge « Examen requis » inerte dans la fiche exemplaire

Signalé par Pierre par capture d'écran : le badge cliquable dans l'en-tête
de la fiche exemplaire ne déclenchait rien. Ce badge existe à **deux
endroits** — dans le tableau Matériel (câblé par `load()`, qui régénère
la liste) et dans l'en-tête de la fiche exemplaire, construite à la
demande par `ouvrirFicheExemplaire()`, hors du cycle de `load()`. Le
branchement du clic n'existait qu'au premier endroit.

**Corrigé** en factorisant la logique dans `brancherBadgesAction(racine)`,
appelée à la fois par `load()` et par `ouvrirFicheExemplaire()`. Vérifié
par un test fonctionnel jsdom (pas seulement une relecture) : simulation
DOM, clic déclenché, navigation confirmée vers l'onglet Contrôles puis le
sous-onglet Incidents.

### 7.39 Formulaire de création d'un lot : Modèle remonté, menu dépliant retiré

Pierre : deux champs seulement (Modèle, Commentaire) derrière un
« Détails facultatifs » dépliant — surcoût de navigation pour si peu
d'éléments, et le Modèle n'a rien d'un détail secondaire pour
l'identification d'un matériel. Modèle remonté à côté de Fabricant
(toujours visible), Commentaire reste seul en dernière position — mais
visible directement lui aussi, le menu dépliant n'ayant plus de raison
d'être avec un seul champ dedans.

Audit demandé par Pierre sur les autres `<details>` du fichier : les
trois restants (statistiques du club, lots hors service, incidents
clôturés) sont légitimes — contenu chargé à la demande ou de longueur
variable, pas des formulaires à 1-2 champs planqués derrière un clic.
Aucune autre correction de ce type identifiée.

### 7.40 Découpe d'un exemplaire (cordes, sangles) : conception générale

Motivé par un cas réel — une corde endommagée localement, dont la partie
saine mérite d'être conservée plutôt que réformée en entier. Ouvre une
troisième issue à « Déclarer une réparation », à côté de « À prévoir » /
« Déjà effectuée » : **« Découpée »**.

Deux colonnes facultatives nouvelles (§3) : `CATEGORIES.peut_etre_decoupe`
(coche, ouvre l'option pour les exemplaires de cette catégorie) et
`MATERIELS.origine_decoupe` (auto-référence, alimente le badge de
filiation sur la fiche du nouveau morceau). Aucune nouvelle table — voir
§7.44.

L'exemplaire d'origine se réforme automatiquement (`hors_service_motif:
'Reforme'`), avec un commentaire généré qui résume toute l'opération. Un
morceau devenu exemplaire hérite du lot, de la couleur et du lieu de
l'origine (modifiables) ; un morceau mis au rebut ne laisse qu'une trace
dans ce commentaire, jamais une ligne `MATERIELS` à lui — inutile de
faire vivre un objet qui ne servira plus jamais. Voir `validerDecoupe`.

### 7.41 `decoupeOuverte()` n'imite pas l'exemption EPI de `reparationOuverte()`

`reparationOuverte(cat)` renvoie `true` pour toute catégorie Non-EPI,
même sans case cochée — la réparation d'un objet non réglementé n'a pas
besoin d'autorisation explicite. `decoupeOuverte(cat)` ne reprend **pas**
cette exemption : elle exige toujours `peut_etre_decoupe` coché, EPI ou
pas. Raison : la découpabilité est une question de nature physique de
l'objet (une corde se recoupe, une raquette à neige non), pas de statut
réglementaire — les deux questions n'ont rien à voir, malgré la
ressemblance de façade avec `reparationOuverte()`.

### 7.42 Sélecteur d'état à deux axes indépendants, pas un empilement de cas

`blocEtatRadios(prefix, decoupeInfo, toutFerme)` calcule d'abord si la
catégorie visible est réparable, puis si elle est découpable — deux
booléens indépendants, pas un statut unique à cinq valeurs. Ça a permis
d'ajouter `toutFerme` (§7.43) après coup sans toucher à la logique
réparable/découpable déjà en place : chaque nouvel axe reste une
question à part, jamais une refonte du calcul existant.

Le calcul d'éligibilité (`eligibiliteDecoupeVisible`, `toutFermeVisible`)
se fait sur les catégories **visibles** (filtrées), pas sur la sélection
cochée — l'avertissement doit apparaître avant même d'avoir coché quoi
que ce soit. Repli strict sur le comportement historique dès que le
visible mélange des catégories aux éligibilités différentes : mieux vaut
l'ancien comportement (radios classiques, avertissement à part) qu'un
affichage inventé pour un cas ambigu.

### 7.43 Masquer les radios plutôt que les laisser cliquables-mais-bloquées

Signalé par Pierre le 22/08 : quand aucune catégorie visible n'est ni
réparable ni découpable, les radios « À prévoir » / « Déjà effectuée »
restaient cliquables et révélaient des champs (Intervenant, inspection
de sécurité...) qui ne mèneraient jamais qu'au même blocage silencieux à
la sauvegarde (`categoriesFermeesReparation`, inchangée). Confusion sans
risque réel de donnée incorrecte — mais confusion quand même.

`toutFermeVisible()` détecte ce cas précis (aucune des deux portes
ouverte, pour toutes les catégories visibles) ; `blocEtatRadios` y
répond par une zone entièrement vide, sans radio ni label. Le panneau
d'avertissement existant (`panneauCategoriePourReparation`) reste seul à
l'écran — c'est la seule explication, elle ne disparaît jamais dans ce
cas précis (contrairement au cas décopable-seul, §7.40, où elle est
remplacée par un message propre à la découpe).

### 7.44 Pas de table d'historique dédiée pour la découpe

Contrairement à ce qui a été envisagé pour la cadence de contrôle
configurable (feuille de route, en réserve), la découpe ne crée aucune
table de traçabilité séparée. Le commentaire généré sur l'exemplaire
d'origine et le lien `origine_decoupe` sur chaque nouveau morceau
racontent déjà toute l'histoire, dans les deux sens (`li('Origine', ...)`
sur la fiche interactive ; `ligneInfo('Origine', ...)` sur la fiche
imprimable, avec la date reprise de `hors_service_date` de l'origine —
jamais dupliquée sur le nouveau morceau). Une troisième table aurait fait
double emploi.

### 7.45 Champ `taille` relabellisé « Longueur » selon la catégorie

`MATERIELS.taille` est un champ unique, réutilisé pour deux sens
différents selon la catégorie : une taille vestimentaire (S/M/L) pour un
baudrier ou un casque, une longueur en mètres pour une corde ou une
sangle issue d'une découpe. Plutôt qu'un second champ dupliqué, le
**libellé** s'adapte : `decoupeOuverte(cat) ? 'Longueur' : 'Taille'`,
appliqué de façon cohérente aux trois endroits qui affichent cette
donnée — tableau du lot (Matériel), fiche interactive, fiche imprimable.

Trouvé en creusant une demande de Pierre (la longueur d'un morceau
découpé n'apparaissait nulle part) : la fiche interactive n'affichait
`taille` pour **aucune** catégorie avant ce correctif, pas seulement les
cordes — un gap préexistant, corrigé au passage pour tout le monde.

### 7.46 Scission d'un lot — aucune nouvelle colonne, un mécanisme plus simple que la découpe

Motivé par une reprise d'inventaire réelle : des exemplaires achetés à
des moments différents, groupés à tort dans un même lot faute
d'information au moment de la saisie. `ouvrirFenetreScission(lotId)`
détache les exemplaires cochés vers un **nouveau lot** ou un **lot
existant de la même catégorie** (jamais une autre catégorie — le
sélecteur ne propose que ça, `refLists.lots.filter(l => l.categorie ===
lot.categorie)`).

**Contrairement à la découpe d'exemplaire (§7.40)**, les exemplaires ne
sont pas transformés : seule leur référence `lot` change. Vérifié avant
de commencer — CONTROLES, INCIDENTS, EMPRUNTS et REPARATIONS référencent
tous l'exemplaire (`materiel: matId`), jamais le lot. Déplacer un
exemplaire d'un lot à l'autre ne touche donc à aucune table d'historique,
sans logique particulière à écrire pour ça : c'est une propriété du
schéma, pas quelque chose que ce chantier a dû construire.

**Champs du nouveau lot, hérités vs vidés** : catégorie, fabricant et
modèle repris de l'origine (catégorie fixe, non modifiable — les deux
autres modifiables) ; date de fabrication, durée de vie et prix
unitaire laissés vides par défaut, jamais copiés — ce sont précisément
les champs propres à *un* achat, qu'on ne peut plus garantir identiques
pour un sous-groupe qu'on détache. Désignation toujours vide, à la main
(demande explicite de Pierre, aucune suggestion automatique). Tous les
champs, y compris ceux hérités, restent modifiables : ce sont des
valeurs de départ, pas des contraintes.

**Aucune nouvelle colonne Grist** — ni sur CATEGORIES ni sur MATERIELS
ni sur LOTS. Le mécanisme repose entièrement sur des colonnes déjà en
place.

**Traçabilité dans les deux sens, sans nouvelle table** : le nouveau lot
reçoit un commentaire généré (modifiable) expliquant son origine ; le
lot d'origine reçoit une note **ajoutée** à son commentaire existant
(jamais écrasée) signalant combien d'exemplaires en sont partis et
quand. Même choix que pour la découpe (§7.44) — pas de table
d'historique séparée, le commentaire suffit.

**Réutilise deux outils déjà existants plutôt que d'en inventer** :
`ajouterEtObtenirId()` pour créer le nouveau lot et récupérer son id
réel (déjà utilisée ailleurs pour la création rapide de catégorie/lieu/
fournisseur) ; `appliquer()` plutôt que `grist.docApi.applyUserActions`
en direct, pour bénéficier de sa garde contre les valeurs `undefined`
silencieuses.

### 7.47 Indications réglementaires sur la fiche de vie — inscription, pas mécanique

Confrontation de la fiche imprimable à l'article 2 de l'arrêté du
22/10/2009 (fiche de gestion des EPI mis à disposition de manière
réitérée). Trois écarts trouvés. Deux sont corrigés ici : la notice du
fabricant (déjà sur la fiche du lot, absente de celle de l'exemplaire)
et la périodicité des inspections avec la date de la prochaine
vérification. Le troisième (hygiène) fait l'objet du §7.48.

**Choix de Pierre : simple inscription.** La date imprimée est
`m._limiteControle`, déjà calculée par `controleEchu()` dans `load()` et
déjà affichée sur la fiche interactive. Aucune règle nouvelle, aucune
interaction avec le chantier « cadence configurable » (qui reste en
réserve). La périodicité est un libellé fixe (« 12 mois au plus ») :
quand la cadence deviendra configurable, c'est ce libellé qu'il faudra
dériver, rien d'autre. « Sans objet » pour un exemplaire `HORS_STOCK` :
une échéance future sur un objet réformé serait trompeuse sur un
document qu'on présente lors d'un contrôle.

### 7.48 Entretien : une déclaration, une table facultative, aucun effet

Décisions prises avec Pierre, dans l'ordre :

- **Une seule nature** (« entretenu »), pas trois (nettoyé / lavé /
  désinfecté). La « nature des mesures » demandée par l'arrêté est
  portée par la phrase d'en-tête de la section imprimée (« Nettoyage,
  lavage ou désinfection, réalisés selon la notice du fabricant ») et,
  au besoin, par le commentaire.
- **Table dédiée `ENTRETIENS`**, pas un `type_controle` « Nettoyage » :
  un contrôle décale l'échéance, un nettoyage ne doit jamais le faire.
- **Aucun effet sur le statut.** Un matériel souillé de façon
  préoccupante relève de l'incident, qui existe déjà.
- **Sous-onglet dans Contrôles, incidents et réparations** : l'onglet
  Matériel dit ce qu'*est* un objet, cet onglet ce qui lui *arrive*.
  Écartés : l'en-tête du lot (mélange inventaire et événement, ne couvre
  pas un nettoyage partiel), le retour de prêt (alourdit l'écran le plus
  utilisé, l'entretien n'est pas toujours lié à un prêt), un bouton sur
  la fiche exemplaire (usage rare, fiche déjà chargée). Nom de l'onglet
  inchangé.
- Préfixe de sélection `ent`, même éligibilité que le contrôle
  (`HORS_STOCK` exclu). `delete resolvedNames.entretiens` avant chaque
  `fetchOptionnel` : une table supprimée entre deux chargements ne reste
  pas « connue ».
- **Cascade** : supprimer un exemplaire ou un lot efface ses entretiens
  (`impactSuppression` / `actionsCascade`), et l'avertissement les
  compte. Les réparations ne sont **pas** cascadées aujourd'hui
  (comportement préexistant, noté dans la feuille de route).

### 7.49 Deux bugs de toast et le retour du harnais de tests

- `ficheEnvoyer` testait `act === 'pret'`, alors que le bouton envoie
  `'preter'` : prêt enregistré, toast jamais affiché.
- `addPret`, `addControle` et `addIncident` lisaient `mat.marquage`, colonne qui n'existe pas : le toast
  listait des marquages vides.

Les deux ont été reproduits par un test **avant** correction. Le harnais
(`tests/` : `mock_grist.js`, `donnees.py`, `harnais.py`, Playwright Python)
est désormais conservé avec le projet. Les données de test reprennent le
schéma réel du document du club, relu le 2026-10-07. Les suites des
sessions précédentes (découpe, scission, cas « tout fermé ») restent à
réécrire sur ce harnais.

### 7.50 Filtre de lieu en cascade et réparations dans la cascade de suppression

Signalé par Pierre comme un bug : « aucun matériel disponible » alors
que le lot affichait 4 disponibles. Données relues dans le document :
tous les baudriers au Coffre gymnase, filtre de lieu réglé sur le Local
du cadran. Erreur de réglage, mais rendue possible et muette par
l'outil : dans `materielsFiltresCascade`, le lieu était calculé **après**
les menus Catégorie et Lot, qui l'ignoraient.

- Le lieu est désormais calculé en premier ; catégories et lots sont
  construits sur `baseLieu`. Le menu des lieux reste construit sur tout
  le matériel éligible (on doit pouvoir en changer). Un lot choisi puis
  absent du lieu sort du menu : la sélection retombe sur « Tous ».
- `materielAilleurs[prefix]` compte, par lieu, ce qui correspondrait aux
  autres filtres hors du lieu choisi ; `majAilleurs()` l'affiche sous la
  liste. **Seulement si une catégorie, un lot ou une recherche est
  actif** : sans eux, « tout le reste est ailleurs » serait du bruit.
  Appelée aux deux sorties de `majListeSelectionnable` (sortie anticipée
  comprise, même leçon que le 22/08). Ne concerne que les formulaires
  qui ont un filtre de lieu (aujourd'hui le prêt).
- `impactSuppression` / `actionsCascade` / `avertissementCascade`
  incluent désormais `REPARATIONS` (relevé au §7.48).

### 7.51 Menus de lots groupés et catégorie déduite du lot

Remarque de Pierre : dans le menu Lot, des « lots qui sont des
catégories ». Vérifié dans ses données : ce sont de vrais lots, nommés
comme leur catégorie (« Baudriers »). Sa proposition (interdire le lot
tant qu'aucune catégorie n'est choisie) a été écartée d'un commun accord
au profit de :

- `optionsLotsGroupes(lots, selectedId, premiere)` : `optgroup` par
  catégorie (ordre de `refLists.categories`, puis « Sans catégorie »),
  libellé `designation (fabricant)`, échappé.
- `brancherFiltres` : la catégorie suit le lot choisi ; « Toutes » efface
  le lot (sinon le lot ramènerait sa catégorie et « Toutes » serait
  inatteignable). Conséquence assumée : pour passer à un lot d'une autre
  catégorie, on repasse par « Toutes ».

**Audit des emplacements avant modification** : six formulaires à filtres
(`pr`, `be`, `ct`, `in`, `rep`, `ent`), tous via `materielsFiltresCascade`
(seul appelant : `majListeSelectionnable`) et `brancherFiltres` ; aucun
pré-remplissage programmatique de ces filtres ailleurs dans le code.
Autres menus de lots : rattachement (`ratLot`) et champ `lot` de
l'éditeur d'exemplaire (`editorField`, cas `f.list === 'lots'`) →
groupement seul. Scission : cible déjà restreinte à la catégorie, inchangée.
`test_07_menus_lots.py` vérifie les huit emplacements.

### 7.52 Recherche, format des dates, filtre de lieu étendu

Trois des cinq améliorations proposées le 07/10, retenues par Pierre.

- **Recherche** : `correspond()` (dans `materielsFiltresCascade`) cherche
  dans marquage + désignation + fabricant + modèle, même cible que
  `passeFiltre` de l'onglet Matériel.
- **Dates** : `fmtDate` renvoie `jj/mm/aaaa` (composantes UTC). Audit :
  50 appels, tous d'affichage ; aucun code ne relit, compare ou trie une
  date formatée. Huit affichages directs en `toISOString().slice(0, 10)`
  passent par `fmtDate` (prochain contrôle dans `load`, Vue d'ensemble,
  fiche interactive, fiches imprimables, registre CSV, feuille de
  contrôle). Restent volontairement en ISO : valeurs des
  `<input type="date">` (`tsInput`, `auj`, dates par défaut), noms de
  fichiers, texte écrit dans les commentaires Grist (scission). Les CSV
  passent en jj/mm/aaaa, reconnu par un tableur français.
- **Lieu** : `PREFIXES_AVEC_LIEU = ['pr', 'be', 'ct', 'ent']`, gestes
  faits sur place. Le reste (cascade, `majAilleurs`, `brancherFiltres`)
  était déjà générique.

Non retenues pour l'instant : passe d'accents sur les libellés,
avertissement à la création d'un lot nommé comme sa catégorie (feuille
de route).

### 7.53 Passe d'accents : un outil à règles, et des invariants vérifiés

Environ 750 lignes contenaient des mots sans accent, dont certains sont
aussi des **valeurs** que le code compare ou écrit dans Grist. D'où un
script (`outils/accents.py`) plutôt qu'un rechercher-remplacer, avec des
règles affinées en quatre essais, chaque essai contrôlé avant application :

- seuls changent les textes entre balises et les attributs `title`,
  `placeholder`, `aria-label` ; un littéral commençant au milieu d'une
  balise n'est modifié qu'après son premier `>` ;
- jamais touchés : un mot seul en minuscules ou en majuscules (clé, nom
  de table), un sélecteur CSS, un `<option>` sans `value` (son texte est
  la valeur stockée), un élément de tableau de littéraux, une valeur sous
  une clé de données (`suite:`, `resultat:`…), un littéral comparé ou
  passé à `indexOf`/`match`/`startsWith`… (fenêtre de contexte de 60
  caractères : à 6, `suite: 'Reparation a prevoir'` était passé) ;
- valeurs protégées jusque dans les phrases : statuts, résultats, rôles,
  et toute valeur à plusieurs mots des listes de choix du code ;
  « Reparation du » et « Incident du », reconnus par `indexOf` sur
  `_raison` ;
- formes ambiguës présent / participe (« ne remplace pas » / « Lot créé »)
  accentuées seulement en fin de proposition ou après « Aucun… » ;
- dictionnaire complété avec un correcteur français (pyspellchecker),
  trié à la main (exclus : epi, email, media, select, cle…).

Fonctions exclues : documents imprimables (`corps*`, `tableau*`,
`ficheDeVieLot`…), exports, Diagnostic.

**Invariants vérifiés avant/après** : littéraux comparés, `id` /
`data-*` / `class` / `for` / `name`, sélecteurs, `value=`,
`getElementById`, tableaux de littéraux, clés d'objets, valeurs sous clé
de données, aucune écriture Grist modifiée. Tous identiques.

Limite : quelques mots ambigus en milieu de phrase restent sans accent
(« calcule », « isole » corrigés à la main là où ils se voyaient le plus).

### 7.54 Avertissement « lot nommé comme sa catégorie »

`brancherAlerteNomLot(champ, catIdFn, ancre)` + `normaliserNomLot`
(minuscules, sans accents, espaces réduits, `s`/`x` final retiré).
Branché aux trois endroits où un lot reçoit un nom : formulaire de
création, hook `lier` de l'éditeur de lot, scission (par
`addEventListener`, pour ne pas écraser `rafraichirEtatScission`).
Non bloquant : l'enregistrement passe. `test_09_nom_lot.py`.

### 7.55 Suppression de la recherche du bandeau

Pierre a tapé « PETZL » dans la case du bandeau : « Aucun exemplaire ».
C'était un raccourci vers un marquage, pas un moteur de recherche. Une
fusion (marquage sinon liste filtrée) a été envisagée puis abandonnée à
la demande de Pierre : deux recherches qui ne font pas la même chose
déroutent des bénévoles, et le seul avantage du bandeau (accès depuis
tous les onglets) coûte deux clics à remplacer.

Retirés : `marquagesCorrespondants`, `masquerSuggestions`,
`ouvrirDepuisSuggestion`, `majSuggestionsMarquage`, `sauterAuMarquage`,
`brancherRechercheMarquage` et son appel, le HTML du bandeau, les styles
`.header-recherche`, `.recherche-suggest`, `.suggest-*`, `.recherche-msg`.
Conservés car partagés : `normMarquage` (20 appels ailleurs),
`classeStatut`. `.header-actions` reprend le `margin-left: auto` qui
tenait les boutons Réglages / Aide à droite.

### 7.56 Prolongation de la durée de vie par réparation

Demande de Pierre (dégaines : on change la sangle, les mousquetons ne
vieillissent pas). Décisions :

- **Ancrage sur la pièce neuve** (`finDepuis(date_fabrication_piece,
  duree_vie_piece_mois)`, même règle FFCAM que le lot), pas « +120 mois sur
  l'ancienne date » : l'âge de la pièce en stock compte.
- **Stockage sur la réparation**, jamais sur l'exemplaire :
  `calculerProlongations()` retient, par exemplaire, la **dernière**
  réparation effectuée (date_effectuee, puis id) portant les deux champs.
  Une seule source de vérité ; supprimer la réparation rend la date du lot.
- `finDeVieExemplaire(m, ctx)` remplace `ctx.finDeVie[m.lot]` dans
  `deriverStatut`, la vétusté, l'inventaire ; `m._finDeVie` et
  `m._prolongation` alimentent les fiches (`texteProlongation`). Les lots
  comptent désormais **par exemplaire** (`nbVetuste`, `nbFinAnnee`,
  `nbProlonges`) : alertes, budget de renouvellement, en-tête.
- **Saisie** : `blocProlongation(prefix)` inséré dans `blocEtatChamps`,
  donc présent dans les cinq chemins qui enregistrent une réparation
  effectuée ; `champsExtraReparationDejaFaite` le lit,
  `appliquerProlongation(champs, extra, matId)` l'écrit **seulement** pour
  un exemplaire de catégorie cochée (groupe mixte). Cibles : `data-mats`
  posé par la fiche, sinon la sélection du formulaire groupé
  (`majProlongation` appelé par `majListeSelectionnable`).
- **Deux cas trouvés par les tests** : (1) une dégaine en fin de vie est
  réformée au calendrier, donc perdait le bouton de réparation — c'est
  pourtant LE cas d'usage. `deriverStatut` marque la réforme
  `calendaire` ; la fiche et le prédicat de sélection `rep` laissent alors
  la réparation ouverte si la catégorie est prolongeable. (2) Une telle
  dégaine envoyée en réparation restait « Réformé » et ne pouvait pas être
  close : une réparation en cours lève la réforme calendaire (statut « En
  réparation ») pour une catégorie prolongeable. Une réforme décidée
  (contrôle, rebut, motif) n'est jamais levée.
- Garde-fous : date de pièce future refusée (aperçu en rouge, aucune
  écriture), durée obligatoire. Coche de catégorie masquée et décochée
  sans maintenance. Colonnes facultatives vérifiées dans le document du
  club le 07/10 (créées par Pierre, bons types).

### 7.57 Leçon : un test qui simule le geste au lieu de le faire

2026.5.6 appelait `majProlongation` depuis `majListeSelectionnable` (rendu
de la liste). Or une coche manuelle ne passe que par `majResumeSelection`.
Le test fixait `SELECTION.rep` puis appelait `majListeSelectionnable` : il
empruntait le seul chemin qui marchait. Correctif : l'appel est dans
`majResumeSelection`, point de passage de **tout** changement de
sélection (et appelé aussi en fin de rendu). Règle pour les tests :
**reproduire le geste de l'utilisateur** (`page.check` sur la case),
jamais l'état qu'il est censé produire.

### 7.58 Commande depuis l'éditeur de lot

Audit (demande de Pierre) : « Modifier le lot » donnait désignation,
catégorie, fabricant, modèle, dates, durée, prix, commentaire, photo,
notice, ajout d'exemplaires, et le seul **choix** de la commande
d'origine. Manquaient : modifier la commande, la facture, créer une
commande après coup ; menu de commandes illisible. Quantité, préfixe,
marquages, couleur, taille, lieu, mise en service relèvent des
exemplaires (par construction ; une modification groupée serait un autre
chantier).

Réalisation sans dupliquer le formulaire de commande : `saveEditor` et
`saveCreator` acceptent un conteneur facultatif (`boxEl`), et
`saveCreator` une suite `apresCreation(newId)` (rattachement du lot).
`blocCommandeLot` / `formCommandeHtml` / `brancherBlocCommandeLot`
rendent les champs de `EDITABLE.achat` dans l'encadré. `libelleAchat` /
`optionsAchats` pour le menu. **Piège** : l'éditeur du lot reste ouvert
avec un menu « Commande d'origine » périmé ; l'enregistrer détachait la
commande créée. Correctif : après succès, `await load()` puis
`openEditor('lot', id)`. Non-régression : l'édition depuis Achats et
budget est testée.

### 7.59 Remplacer une pièce jointe

`televerserPieceJointe` concaténait toujours le nouveau fichier aux
existants : juste pour les galeries (photos de contrôles et d'incidents),
faux pour la photo du modèle, la notice et la facture, dont les boutons
annoncent un remplacement. Option explicite `remplacer: true` sur ces
trois `boutonPJ` → attribut `data-pj-remplacer` → `surChoixPieceJointe`
→ `televerserPieceJointe(..., remplacer)` qui ne garde que le nouvel id.
Le bouton de galerie (`ajouterBlocPhotos`) n'a pas l'option : il ajoute.
Les anciens fichiers restent dans le stockage de pièces jointes du
document jusqu'au nettoyage de Grist ; ils ne sont plus référencés.
`test_15_remplacer_pj.py`.

### 7.60 Régression de la passe d'accents : le groupe « Identité »

`ouvrirReglages` liste les groupes `['Identite', 'Apparence', 'Liens
utiles']` et filtre `(c.groupe || 'Identite') === g`. La passe d'accents
(§7.53) a laissé le premier (élément de tableau, protégé) et accentué le
second (la comparaison passait par une parenthèse, forme non reconnue) :
plus aucun champ sans groupe explicite ne s'affichait. Les invariants
du §7.53 ne l'ont pas vu pour la même raison (motif `'x' ===` sans
parenthèse). Correctifs : les deux en « Identité » ; `accents.py` reconnaît
`')... ===` ; recherche systématique des littéraux modifiés dont la forme
d'origine subsiste ailleurs (19 cas, un seul comparé). Leçon : aucun test
n'ouvrait le panneau de réglages ; `test_16_reglages_identite.py` le fait,
et échoue bien sur le code 2026.5.11.

### 7.61 CONFIG vide et colonne manualSort

`chargerConfig` choisit la colonne des valeurs comme « la première autre
colonne non entièrement numérique ». `fetchTable` renvoie aussi
`manualSort` (position, flottante). Table remplie : `manualSort` contient
des entiers, écartée. Table **vide** (archive sans données) : rien à
analyser, `manualSort` retenue ; `AddRecord {Cle, manualSort: "texte"}`
→ le moteur Python de Grist compare positions et texte → TypeError.
Correctif : exclusion de `manualSort` et `gristHelper_*`, préférence aux
noms `valeur/Valeur/value/Value`. Diagnostic fait par lecture du code et
de la copie de test (CONFIG vide, aucune règle d'accès), confirmé par
reproduction du message exact dans le faux Grist rendu fidèle.
Conséquence pratique : **le code du widget vit dans chaque document** ;
l'archive `.grist` doit être réexportée après avoir collé la nouvelle
version dans la copie « sans données ».

### 7.62 Portes de réparation, non-EPI, prolongation

Question de précaution de Pierre (« on peut déclarer des réparations même
sans la case ? »). Vérification par essais : pour un EPI fermé, rien ne
s'enregistrait (avertissement sur la fiche, case grisée en groupe,
contrôle refusé), mais les portes restaient visibles. Décisions (Pierre,
1-2-3 « oui ») :
1. Portes masquées si `!reparationOuverte(cat) && !decoupeOuverte(cat)` :
   bouton de fiche, prédicat `rep`, options « A reparer » / « Reparation
   a prevoir » retirées après rendu de `ficheAction` (filtre sur
   `o.value` : ces `<option>` n'ont pas d'attribut `value`, un sélecteur
   `[value=...]` les manquait — vu en test). Formulaires groupés de
   contrôle et d'incident : sélection potentiellement mixte, la garde
   existante à la validation reste la protection.
2. `reparationOuverte` : plus d'exemption non-EPI ; case visible pour
   toutes les natures ; textes adaptés. Données du club vérifiées : seule
   « Raquettes à neige » change.
3. `prolongationOuverte` exige `type_epi === 'Soumis a vieillissement'`
   et `reparationOuverte` ; l'éditeur masque et décoche la case sinon.
   `calculerProlongations` ne dépend pas de la catégorie : l'historique
   garde ses prolongations.
Clôture d'une réparation en cours : bouton inconditionnel, vérifié.

### 7.63 Numéros de série

Question de Pierre : comment apparier les numéros gravés aux exemplaires
d'un lot sans se tromper ? Réponse retenue : l'appariement se fait **objet
en main** (grille `ouvrirGrilleSeries`, une ligne par marquage club, tri
numérique), la saisie à la création n'étant qu'un raccourci
(`lotSeries`, `majApercuSeries` branché sur `majApercuMarquage`,
`erreurSeriesCreation` appelée avant toute écriture dans `creerLot`).
Doublons : `normSerie` (sans espaces, majuscules), comparaison limitée au
**même fabricant** (`fabricantDe`) — deux fabricants peuvent partager un
format. Doublon interne au lot : bloquant ; inter-lots : avertissement.
Recherche : `passeFiltre` et `correspond()` incluent `numero_serie`.
Non fait : saisie dans « + Ajouter des exemplaires » (passer par la
grille ensuite) ; colonne dans le tableau imprimé du lot.

### 7.64 Téléphone : tableaux en cartes, ordinateur intouché

Demande de Pierre : ne toucher qu'au mobile. Réalisation :
- Un bloc CSS `@media (max-width: 640px)` placé **en fin de feuille**
  (prime sur l'ancien défilement horizontal à 480 px) : tables, lignes et
  cellules en `display: block`, ligne d'en-tête masquée, étiquette en
  `::before { content: attr(data-label); float: left }` (le flottant garde
  d'un seul tenant une cellule à plusieurs éléments ; une première version
  en flex éclatait « Prêté à… » en colonne étroite).
- `etiqueterTableaux()` (JS générique, MutationObserver) pose sur chaque
  cellule `data-label` = titre de sa colonne (colspan géré), la classe
  `tr-entete` sur les lignes d'en-tête, `cellule-vide` sur les cases
  « - ». Aucune règle au-dessus de 640 px ne les utilise.
- **Preuve d'innocuité pour l'ordinateur** : captures de 11 écrans à
  1300 px avant tout changement, recapturées après, comparées au pixel
  (la bannière animée de la Vue d'ensemble, instable d'un passage à
  l'autre, est ignorée). Procédure à rejouer pour toute retouche mobile :
  `captures_ecrans.py <ref> 1300` avant, puis après, puis
  `compare_captures.py <ref> <apres>`.
- Piège évité : des `\"` laissés dans le CSS changeaient le sens des
  sélecteurs `[data-label=""]` ; corrigés avant livraison.
- Reste à vérifier par Pierre : le rendu réel dans Grist sur son
  téléphone (largeur disponible pour le widget).

### 7.65 Navigation : menu latéral et barre du bas

Maquette validée par Pierre (canevas Design « EPILOG – maquette de
navigation (étape 2) »), réalisée en trois livraisons ; celle-ci est la
première. Principe : **la navigation se pose par-dessus l'existant**.
`.tabs`, `#epi-so` et `#refs-so` restent dans la page (masqués là où le
menu les remplace) ; `naviguer('t:sous')` clique l'onglet puis le
sous-onglet ; `majNav()` (MutationObserver sur `class`/`hidden`) surligne
l'entrée active, recopie les compteurs (`data-miroir` → `epiCompte*`,
`refsCompte*`) et la visibilité d'Entretien. Seuils : menu latéral ≥ 1000
px, barre du bas ≤ 640 px, onglets d'origine entre les deux — ce qui règle
le cas d'un widget étroit dans Grist sans mécanisme de repli. Page
`#pane-plus` réservée au téléphone. Bug vu en test : `display: flex` des
boutons du menu écrasait l'attribut `hidden` (Entretien sans table) ;
règle `[hidden] { display: none !important }` dans les deux barres.
Vérifié : 800 px identique (référence prise avant modification).
**Outil de comparaison fiabilisé le 18/10** : le bandeau animé varie d'un
passage à l'autre même sans changement de code (mesuré en comparant
l'ancien code à sa propre référence) → ignoré sur tous les écrans ; écarts
d'anti-crénelage de 1 à 2 nuances sur 255 (vu : 238 contre 239 sur un
liseré de 3 px) → tolérés, l'écart maximal étant toujours affiché.
Contrôle de sensibilité : l'outil signale bien les 11 écrans ordinateur,
volontairement modifiés par le menu latéral.

### 7.66 Navigation, livraison 2

- Menu rétractable : classe `replie` sur `#navLaterale`
  (`appliquerMenuReplie`), libellés `.nl-lib` masqués, entrées `.nl-court`
  (Suivi des EPI, Listes du club) visibles seulement replié, `title` sur
  chaque bouton. Mémoire : `localStorage['epilog.menuReplie']`, protégé
  par try/catch (sans stockage, le menu reste déplié).
- « ⋯ » : `.btn-plus-actions` + `<span class="actions-rares">`, en
  `display: contents` hors téléphone (rendu identique), masqué/révélé sur
  téléphone (`rares-ouverts`), `stopPropagation` pour ne pas replier le
  lot.
- Vocabulaire : remplacements ciblés et vérifiés un à un
  (`outils/rubriques*.py`, tolérants aux retours à la ligne) ; accords
  revus (« les rubriques concernées », « la rubrique concernée »).
- Vérifications visuelles : 1300 px, seul le menu change (et le pied de
  page, descendu d'une entrée) ; 800 px, contenu identique après un
  décalage de 39 px (barre d'onglets passée sur une ligne), seules
  différences : la phrase reformulée de la rubrique Achats, et la fenêtre
  Réglages (position fixe, non concernée par le décalage).

### 7.67 Sauvegarde, import, export lisible

Décisions de Pierre : pièces jointes hors sauvegarde, import seulement
dans un document vide, export lisible en Excel ET en CSV.
- **Lisible** : `donneesLisibles()` = Résumé + Inventaire (calculé) +
  feuilles **génériques** (`feuilleGenerique` : toutes les colonnes
  connues de la table, libellés `LIBELLES_COLONNES`, références résolues
  par `REFERENCES_LISIBLES`, dates `fmtDate`, booléens Oui/Non, pièces
  jointes en « n fichiers ») — une colonne ajoutée demain apparaît sans
  code. Excel : `chargerSheetJS()` (script injecté au clic, délai 15 s),
  repli CSV via `telechargerCsv` (un fichier toutes les 400 ms).
- **Sauvegarde** : `construireSauvegarde()` relit chaque table par
  `fetchTable` (valeurs brutes), exclut `id`/`manualSort`/`gristHelper_*`,
  détecte les colonnes de pièces jointes par la forme des valeurs
  (`['L', ...]`), les vide et les liste ; réglages en paires clé/valeur.
  Format : `{format: 'epilog-sauvegarde', version_format: 1, epilog, date,
  club, tables, config, pieces_jointes_omises}`.
- **Import** : refus si une table de données contient des lignes ;
  `analyserImport` (aperçu) puis `actionsImport` : un `BulkAddRecord` par
  table **avec les numéros d'origine** (tables vides : numéros libres ⇒
  aucun recalcul de liens), colonnes absentes de la cible ignorées,
  réglages mis à jour par clé ; un seul `applyUserActions` (atomique dans
  Grist). **À valider en réel** : sauvegarde du document principal puis
  import dans la copie « sans données ».
- Leçon de méthode : des références de captures prises la veille faisaient
  apparaître des écarts sur toutes les dates (données de test relatives à
  « aujourd'hui ») ; comparer le même jour (noté dans
  `captures_ecrans.py`).

### 7.68 Export lisible dans la Vue d'ensemble

Distinction retenue avec Pierre : l'export lisible est un geste de
**compte rendu** (Vue d'ensemble, `#apercu-export`, à côté des
statistiques) ; sauvegarde et import sont des gestes d'**administration**
(Réglages, futurs candidats au rôle Responsable matériel). Déplacement
sans doublon ; messages de l'export dans `#exportParcMsg`
(`messageExport`), ceux de la sauvegarde restent dans `#sauvMsg`.

### 7.69 Remise à zéro

Discussion avec Pierre : une liste de cases (11 tables, dépendances
« entraîné par… ») a été proposée puis abandonnée à sa question — l'import
exige de toute façon un document entièrement vide, et le seul autre besoin
réel est de repartir en gardant les listes du club. Deux choix donc
(`tablesAEffacer('tout' | 'listes')`, enfants d'abord), réglages jamais
effacés. `exporterSauvegarde()` renvoie vrai/faux : `lancerRaz()` ne
propose la confirmation qu'après un téléchargement réussi. Confirmation
`trim().toUpperCase() === 'SUPPRIMER'`, comme `executerSuppression`
(vérifié dans le code avant de l'affirmer à Pierre). Un
`applyUserActions` unique (`BulkRemoveRecord` par table) : atomique.
La sous-rubrique est reconstruite à chaque ouverture pour que le bilan
soit à jour.

### 7.70 Fiches de vie PDF configurables, date de sortie du parc

- `exporterFichesDeVie(matIds, titre, fichier, progression)` : fiches
  concaténées avec saut de page, partagé par le registre d'un lot et la
  nouvelle fenêtre (`ouvrirConfigFichesPdf`, `selectionFichesPdf`). Pierre a
  préféré une fenêtre de configuration à la réutilisation des filtres de
  Matériel ; l'archivage avec suppression a été écarté (export seul).
- `dateSortieParc(m)` : `hors_service_date`, sinon dernier contrôle
  « Reforme », sinon fin de vie si réforme calendaire ; `null` si dans le
  parc ou date inconnue (ces exemplaires sont exclus du filtre « plus de
  3 ans » et comptés à part dans la fenêtre). `conservationEchue(m)` :
  sortie + 3 ans ≤ aujourd'hui.
- Export lisible : repli CSV supprimé (`exporterLisibleCsv` retiré), message
  d'erreur à la place.

### 7.71 L'aide et la version doivent suivre chaque livraison

Pierre a demandé si l'aide avait suivi les évolutions de menu. Audit :
elle était à jour sur la navigation (rubriques, menu de gauche, barre du
bas, `?style=singlePage`) mais muette sur le menu réductible, le « ⋯ » et
l'affichage téléphone ; et `VERSION_EPILOG` était restée à 2026.5.20
(introduite avec la sauvegarde, jamais remontée). `test_27` verrouille :
version = première entrée du CHANGELOG ; version portée par
`construireSauvegarde()` ; liste de fonctions que l'aide doit mentionner
(à **compléter à chaque nouvelle fonction visible**) ; sommaire = sections
(le raccourci `#aideNavReglages` est exclu : il n'a pas de section).
**Procédure de livraison** : version dans le code → CHANGELOG → aide →
test_27.

### 7.72 Détails des exemplaires dans les documents imprimés

Demande de Pierre : couleur, taille, commentaires absents de l'inventaire
imprimable, de la fiche du lot et du registre. État constaté avant
modification : l'inventaire n'avait que Marquage, Lieu, Statut, Dernier
contrôle, Observations (le motif du statut, pas le commentaire) ; la fiche
du lot Marquage, Lieu, Mise en service, Statut, Prochain contrôle,
Réparations ; la fiche de vie d'un exemplaire montrait déjà couleur et
taille, pas le commentaire.
- `colonnesDetail(items, acces, decoupable)` : colonnes **conditionnelles**
  (n° de série, couleur, taille/longueur avant les colonnes habituelles ;
  commentaire après), retenues si au moins un exemplaire du tableau a une
  valeur ; `acces(item, cle)` abstrait la différence entre lignes
  d'inventaire (déjà calculées) et lignes brutes de MATERIELS. Choix de la
  colonne conditionnelle plutôt que systématique : dix colonnes vides
  écraseraient les tableaux des lots sans détail.
- L'objet d'inventaire gagne `couleur`, `taille`, `commentaire`,
  `decoupable` (`decoupeOuverte(categorieDeMateriel(m))`), ce qui alimente
  aussi le CSV et l'Excel (colonnes ajoutées sans condition : un export est
  un tableau stable).
- Rendu vérifié à la largeur A4 (794 px, média print) : aucune colonne ne
  déborde, le commentaire est à largeur minimale 130 px.
- Les commentaires de MATERIELS contiennent aussi des mentions automatiques
  (scission, découpe) : elles apparaissent désormais dans les documents.

### 7.73 « Je n'ai pas la couleur ni la taille » : enquête sur données réelles

Signalement de Pierre après la 2026.5.25 : couleur et taille absentes de
l'inventaire imprimé, de la fiche du lot et du registre, alors qu'il voyait
« les commentaires ». Démarche :
1. Lecture (connecteur Grist, lecture seule) de `MATERIELS`, `LOTS`,
   `CATEGORIES` du document du club. Couleur/taille ne sont renseignées que
   pour les crashpads (Noir, 100x120), les dégaines (Orange / longueur 12 cm ;
   Noir / 30cm) et deux morceaux de corde découpés (taille 35 et 20, couleur
   `null`). Tous les autres exemplaires ont ces champs **vides**.
2. Reproduction dans le banc d'essai avec ce jeu (calqué dans
   `tests/donnees_reelles.py`) : le code 2026.5.25 produit bien Couleur et
   Taille dans l'inventaire, la fiche du lot, le registre et l'Excel, et
   « Longueur » pour les cordes. **Aucun défaut de code reproduit.**
3. Comparaison avec la 2026.5.24 : les commentaires s'y affichaient déjà,
   dans « Observations », pour les exemplaires sortis du parc. Voir des
   commentaires ne prouve donc pas qu'on exécute la dernière version.
Deux explications subsistent, qu'on ne peut pas départager sans information
de Pierre : (a) une ancienne copie du code tourne encore dans son document
(le code vit dans chaque document ; il faut recoller `widget_pilotage.js`
**et** `.html`) ; (b) le lot consulté n'a ni couleur ni taille, et les
colonnes conditionnelles (§7.72) n'apparaissent donc pas.
Correctifs : version affichée dans le pied de page
(`#creditsVersion`, renseigné au chargement depuis `VERSION_EPILOG`), et
déduplication du commentaire déjà présent dans « Observations ». Option
non retenue sans demande : afficher Couleur/Taille même sans valeur.

### 7.74 Structure du document : `SCHEMA`, marque, création automatique

Demande de Pierre : que le widget crée lui-même les tables manquantes
à la mise à jour. Risque principal : **ne pas allumer sans le dire des
modules que le club a laissés de côté**. D'où une **marque**
`structure_version` (dans CONFIG) et un champ `depuis` par élément :
création automatique seulement de ce qui est `depuis > marque` ; le reste
est proposé (Réglages) mais jamais imposé. Document sans marque avec
MATERIELS : marque supposée `STRUCTURE_BASE = 2026.5.26`. Document sans
aucune table de cœur : `sansStructure`, installation proposée, jamais
automatique.
- `SCHEMA` (tables dans l'ordre des références ; types `Ref:<cle>` résolus
  vers le **nom réel** de la table, qui peut différer en casse ; listes de
  choix tirées des constantes du code). La parité avec le document du club
  est testée (`schema_reel.json`, relevé le 20/10 d'après les classes Python
  de Grist) : une dérive fait échouer `test_30`.
- `analyserStructure()` (lecture seule : `docApi.listTables` + colonnes
  connues), `actionsCreation()` (`AddTable` puis `AddColumn` pour une
  colonne auto-référencée, `AddColumn` pour une colonne manquante),
  `assurerStructure()` (appelée dans `load()` après le chargement des
  tables ; renvoie vrai si la structure a changé, `load()` se relance),
  `memoriserStructure()` (écrit la marque, puis `chargerConfig()` : sans
  cette relecture la marque restait périmée, vu en test).
- Garde-fous : une seule tentative par chargement de page
  (`structureTentee`) ; **re-vérification juste avant d'écrire** (deux
  utilisateurs qui ouvrent le document en même temps ; Grist renomme une
  colonne en double en `photo_2` au lieu de refuser, fenêtre réduite mais
  pas nulle) ; échec (droits) → `erreurStructure`, bandeau, aucun blocage.
- **Essai réel (21/10)** : après collage du `.js` et du `.html`, Pierre
  rapporte que la livraison « fonctionne nickel ». Il n'a pas précisé si la
  colonne `MATERIELS.photo` a été créée par le widget lui-même : **à
  confirmer** pour tenir la création de structure par un widget pour
  vérifiée (la documentation est muette sur ce droit, qui dépend en outre
  des règles d'accès du document).
- Limite connue : les colonnes `Ref:` créées n'ont pas de colonne
  d'affichage (`visibleCol`) : dans les tables brutes de Grist elles
  montrent des numéros de ligne au lieu des marquages/noms. Sans effet sur
  EPILOG. Réglage manuel : « Colonne à afficher » dans Grist.
- Le banc d'essai (`mock_grist.js`) simule `listTables`, `AddTable`,
  `AddColumn` (renommage en `_2` si doublon) et le refus de droits
  (`D.__interdit_schema__`).

### 7.75 Photos individuelles des exemplaires

Réutilise la galerie des contrôles/incidents (`ajouterBlocPhotos`,
`remplirGaleriePhotos`, `urlsPieceJointe`), générique par table :
`LEGENDE_PHOTO_PJ.materiels`, bloc dans `EDITABLE.materiel.lier`,
galerie `#galerieMat-<id>` sur la fiche. **Réduction à l'envoi**
(`reduirePhoto`, uniquement pour `materiels.photo`) : `createImageBitmap`
(orientation EXIF appliquée) → canvas ≤ 1 600 px → JPEG 0,85 ; inchangée si
déjà petite (< 1,2 Mo et ≤ 1 600 px), si non décodable, ou si le résultat
n'est pas plus léger. Documents : `colonnesDetail(items, acces,
decoupable, photos, idDe)` gagne une colonne « Photo » (vignettes 56 px)
conditionnelle ; `exporterInventaireImprimable` devient asynchrone ;
`corpsFicheMateriel` ajoute la section « Photos de l'exemplaire » (230 px).
Les images des documents sont des URL Grist à jeton temporaire : à
imprimer ou enregistrer en PDF tout de suite (comme les photos actuelles).
Excel/CSV : nombre de photos seulement. La sauvegarde .json les liste
comme pièces jointes non incluses (mécanisme générique).
Test : le banc d'essai ne voit pas le contenu d'un fichier envoyé
(Chromium) ; la réduction est vérifiée en espionnant
`televerserFichierSeul` (nom, type, poids, dimensions).

### 7.76 Recherche des prêts par personne

Demande d'un testeur : filtrer les prêts par personne et pas seulement par
numéro de bon. État avant : `#filtreBon` ne comparait que `data-bon` et ne
touchait que `.bon:not(.bon-termine)`. Désormais :
- `normRecherche` (NFD sans diacritiques, minuscules) et
  `correspondRecherche(q, cible)` (tous les mots doivent se retrouver),
  partagés avec la recherche de l'onglet Matériel (`passeFiltre`).
- Chaque bon porte `data-recherche` = numéro + emprunteur + sortie +
  marquages, déjà normalisé (`rechercheDeBon`).
- Le champ est **au-dessus des deux listes** (et non dans la section « en
  cours », qui disparaît quand il n'y a plus de prêt en cours) ;
  `appliquerRechercheBons()` filtre bons en cours et terminés, met à jour le
  compteur, et se réapplique après chaque rendu (`rechercheBons` garde la
  saisie). Sans `numero_emprunt`, repli sur les lignes de tableau.
- `m._emprunteur` (prêt ouvert de l'exemplaire, via `ctx.pretOuvert` et
  `ctx.adhMap`) est ajouté à la cible de la recherche Matériel : un
  exemplaire **déjà rendu** n'apparaît plus sous le nom de l'emprunteur.
- Le code qui pose une valeur dans `#filtreBon` puis déclenche `input`
  (clic sur le badge d'un prêt depuis une fiche) reste valable.
- Piège évité : `type="search"` ne reçoit pas le style des champs du
  logiciel (champ étroit) → `type="text"`.

### 7.77 Import d'un inventaire existant

Orientation de Pierre : « le demandeur s'adapte, c'est toi qui dis de quels
champs on a besoin » ; modèle fondé sur la structure de l'export lisible
(déjà là : Catégories, Lots, Lieux, Inventaire, Contrôles) plutôt qu'un modèle
sur mesure ; rapport imprimable de ce qui reste à saisir. Constats sur son
export réel : liens par noms fiables (104 marquages uniques, lots/catégories/
lieux tous résolus) ; modèle absent pour 44 % des exemplaires, fabricant pour
20 %, n° de série pour 99 % → les champs recommandés **ne bloquent jamais** et
sont signalés **en bloc** ; une commande sans référence apparaissait « #8 ».
- Module `import_materiel` : `impLireClasseur` (CSV analysé à la main, UTF-8
  puis Windows-1252, séparateur détecté ; xlsx/ods/xls par SheetJS chargé à la
  demande), `impObjets` (en-têtes reconnus par alias normalisés), 
  `impConstruirePlanBrut` → **plan** (erreurs, avertissements agrégés par code et
  gravité, lignes prêtes à écrire avec leurs numéros, marquages générés), 
  `impExecuter` (**un** `applyUserActions`, `BulkAddRecord` avec numéros de ligne
  imposés = max + 1 : même technique que l'import de sauvegarde), 
  `impRapportHtml` (même plan pour l'aperçu et le rapport final), 
  `impTelechargerModele`.
- Règles : lot = catégorie + fabricant + modèle + **année** de fabrication ;
  année seule → 1er janvier (la fin de vie ne peut qu'être prudente) ; priorité
  feuille Lots > lignes ; marquage vide + Quantité → numéros `préfixe + 3
  chiffres` après le plus grand existant ; Statut : seuls Perdu/Volé/Réformé/Cédé
  comptent (les autres sont calculés) ; sortie sans cause → commentaire
  générique + avertissement ; contrôleur inconnu → créé (rôle « Controleur EPI
  habilite », celui que filtre la liste des contrôleurs).
- **Doublon de contrôle** : toute la ligne identique (exemplaire, date, résultat,
  contrôleur, type, commentaire). Premier critère (exemplaire + date +
  résultat) trop large : écartait un contrôle réel de l'export (deux contrôles
  du même jour dont l'un sans contrôleur) — repéré par le test d'acceptation.
- **Piège navigateur** : re-choisir le même fichier ne déclenche pas
  `change` ; le champ est vidé après lecture.
- **Limites** : l'import ne reprend ni commandes, ni fournisseurs, ni prêts,
  incidents, réparations, entretiens, adhérents, photos (le rapport le dit). Le
  modèle est généré avec la version gratuite de SheetJS : pas de couleurs ni de
  listes déroulantes (qu'un collage normal efface de toute façon : c'est
  l'import qui contrôle). **À vérifier en réel** : lecture d'un .xlsx par la
  bibliothèque chargée dans Grist ; premier import du fichier d'un utilisateur.

### 7.78 Page d'aide « Mettre à jour EPILOG »

Deux méthodes : remplacer le code dans le document (recommandée : tout est
conservé) ; document neuf + sauvegarde .json (coûts écrits en toutes lettres :
adresse, partage, pièces jointes, historique). **Réserve** : les libellés exacts
de l'interface de Grist (« Custom widget builder », options du widget, zones
HTML/JavaScript) sont décrits de façon générique, d'après les mots de Pierre ;
à confronter à l'écran réel et à corriger si besoin.

### 7.79 Modèle d'import : menus déroulants (ExcelJS)

Constat de Pierre : « les listes du dernier onglet ne communiquent pas avec les
autres et ne font donc pas de menu déroulant ». Exact : SheetJS (gratuit) n'écrit
ni validation de données ni styles. **Solution** : ExcelJS 4.4.0 (MIT, cdnjs, chargée
au clic) pour **fabriquer** le modèle (`impModeleExcelJS`) ; SheetJS conservé pour
**lire**. Repli `impModeleSheetJS` (ancien générateur) si ExcelJS ne charge pas.
- Les menus pointent vers des **noms définis** (`ListeCategories`, `ListeLieux`,
  `ListeLots`, `ListeNatures`, `ListeOuiNon`, `ListeResultats`, `ListeStatuts`,
  `ListeTypesControle`, `ListeMarquagesFichier`) qui désignent la feuille `Listes`
  (compatible Excel et LibreOffice, y compris pour référencer une autre feuille).
- **Union existant + décrit** : colonnes `Listes` = valeurs (déjà dans EPILOG)
  suivies de formules `IF('Catégories'!A2="","",'Catégories'!A2)` sur 40 lignes
  (100 pour les lots). Inconvénient assumé : des entrées vides en fin de menu.
- Style d'erreur : `stop` pour ce qui doit exister (catégorie, nature, Oui/Non,
  résultat) ; `information` pour ce qui peut être nouveau (lieu, lot, statut,
  type, exemplaire).
- **Limite** : un collage normal remplace la validation des cellules collées ;
  « Collage spécial → Valeurs » la conserve (écrit dans le mode d'emploi et l'aide).
  L'import reste le vrai contrôle.
- **Vérifications** : structure lue avec openpyxl (validations, noms définis,
  volet figé, couleurs, notes) ; **recalcul par LibreOffice** (liste des
  catégories = club + catégorie décrite dans l'autre feuille ; idem lieux) ;
  survie des menus à un réenregistrement. **Non vérifié ici** : l'affichage réel des
  menus dans Excel (non disponible) ; à constater par Pierre.
- Les feuilles « Mode d'emploi » et « Listes » sont ignorées sans bruit à l'import.

### 7.80 Import : démarrage depuis un tableur (erreurs, colonnes, dernier contrôle, modèle CSV)

Recadrage de Pierre : un import sert surtout **au démarrage** ; l'historique d'un
export EPILOG perdu n'est pas grave (la sauvegarde .json restaure fidèlement).
D'où deux ajustements écartés (réimport fidèle de l'historique) et trois
priorités pour des utilisateurs qui arrivent avec leur propre tableur.
- **Erreurs groupées** : `impGrouperErreurs` (clé = feuille + message), 
  `impLibelleLignes` (« ligne N » ou « N lignes (a, b, c… 8 premières) »).
  Le message d'une erreur doit donc rester **identique d'une ligne à l'autre**
  (il cite la valeur fautive, pas le numéro).
- **Colonnes non reconnues** : `P.ignorees.colonnes` affiché dans l'aperçu
  (`colsIgn`), quel que soit l'état ; les colonnes de `IMP_CALCULEES` (dont
  « Controle echu ») ne sont jamais signalées.
- **Dernier contrôle** : alias `dernierControle` / `resultatControle` ;
  `impDateControle` traite « jamais », « - » et vide comme absents ;
  `impResultat('jamais controle')` → null (l'**export écrit « jamais contrôlé »**
  dans Resultat : sans cette tolérance, le réimport aurait échoué sur chaque
  exemplaire jamais contrôlé). Contrôle implicite créé après la feuille
  Contrôles, sauf `marqAvecFeuille[km]` ; « Conforme » supposé + avertissement
  `controle_suppose` ; résultat sans date ignoré (`resultat_sans_date`).
- **Modèle CSV** : `INV_CSV` (titre, `calc`, accesseur) alimente
  `exporterInventaireCsv` **et** `impColonnesModeleCsv()` ; test d'alignement
  (liste figée du modèle, ordre = sous-suite de l'export, tout titre reconnu ou
  connu comme calculé). Fenêtre `impPopupModeleCsv` : div fixe, `role=dialog`,
  Échap et clic hors fenêtre ferment, focus sur le bouton de confirmation.
  `confirm()` évité : le cadre d'un widget Grist peut bloquer les fenêtres du
  navigateur (non vérifié, prudence). Ligne d'exemple `EXEMPLE - A SUPPRIMER`
  refusée par l'import (`/^exemple\b/` sur le marquage).
- `sortieParc` ajouté à l'objet d'inventaire (`dateSortieParc`).
- **Test** : un contrôle daté en dur finit par être échu (la date « aujourd'hui »
  avance) → les tests de calcul d'échéance utilisent une date relative.
- Écarté / à discuter : synonymes de titres (Marque, Type, Année…) ; assistant
  « catégories manquantes » (l'utilisateur choisit nature et durée de vie).

## 8. Limites et points en suspens

- **QR code pour les prêts** : la lecture caméra dans l'iframe d'un widget
  Grist n'a jamais été prouvée fonctionnelle. À tester sur un vrai
  téléphone avant toute décision — ne pas construire dessus sans validation
  préalable.
- **Prêt à un non-membre** : traité par un rôle `Adhérent` étendu plutôt
  qu'une structure séparée (voir §7 de la feuille de route) — décision
  volontairement légère.
- **Trame de contrôle attachée à la catégorie** : idée retenue, non
  construite (priorité basse) — voir `feuille_de_route.md`, entrée n° 12.
- **Facture d'achat : bouton resté dans la ligne du tableau.** Contrôles,
  incidents et lots ont vu leur bouton de pièce jointe migrer vers un
  éditeur (§7.36, et une session antérieure pour les lots) ; la facture
  d'achat, elle, garde son `boutonPJ` directement dans la ligne du
  tableau Achats/Budget (mode « remplacer avec avertissement », §7.33).
  Pas un défaut identifié comme gênant à ce jour — remarqué en passant,
  pas corrigé faute de demande. À corriger seulement si ce tableau devient
  à son tour surchargé.

---

## 9. Où trouver le reste

- **`feuille_de_route.md`** — l'état d'avancement fonctionnel, numéros
  stables, ce qui reste en réserve.
- **`_reprise_dev.md`** — note de reprise chronologique, plus détaillée
  et plus brute que ce dossier ; utile pour retrouver le fil exact d'une
  session, mais pas pensée pour un lecteur externe.
- **`schema_v3_CAF_Auxerre.xlsx`** — le détail colonne par colonne de
  chaque table, avec description.
- **`guide_complet_CAF_Auxerre.docx`** — le guide utilisateur (club),
  sans intérêt pour un développeur sinon pour comprendre l'usage attendu.

---

## Annexe — téléversement de pièces jointes (recette complète)

```js
async function televerserFichierSeul(file) {
  var jeton = await grist.docApi.getAccessToken({ readOnly: false });
  var fd = new FormData(); fd.append('upload', file, file.name);
  var rep = await fetch(jeton.baseUrl + '/attachments?auth=' + jeton.token, {
    method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest' }
  });
  var res = await rep.json();               // -> [id] ou id selon la version
  return Array.isArray(res) ? res[0] : res;
}
```

Puis rattachement à une cellule en **conservant l'existant** :

```js
var existants = idsPiecesJointes(ligne[colonne]);   // extrait les ids déjà présents
champ[colonne] = ['L'].concat(existants).concat([nouvelId]);
await appliquer([['UpdateRecord', resolvedNames[cleTable], ligneId, champ]]);
```

Ce point d'accès (`baseUrl` du jeton, pas l'URL directe du document) est
ce qui évite l'erreur CORS rencontrée au premier essai.

**Affichage : toujours la pièce la plus récente, jamais la première**
(cf. §7.33). `urlPieceJointe()` prend `ids[ids.length - 1]` — l'historique
complet reste dans la cellule, mais l'utilisateur voit toujours ce qu'il
vient d'ajouter. Pour les rapports imprimables, `urlsPieceJointe()`
renvoie le tableau complet des URLs (pas seulement la dernière).

**Suppression individuelle** (cf. §7.34), pour les cellules à plusieurs
pièces (galerie contrôles/incidents, max `MAX_PHOTOS_PJ`) :

```js
var reste = idsPiecesJointes(ligne[colonne]).filter(function (id) { return id !== idASupprimer; });
champ[colonne] = ['L'].concat(reste);
await appliquer([['UpdateRecord', resolvedNames[cleTable], ligneId, champ]]);
```

**Rattachement à la création** (cf. §7.36) : Grist exige un id de ligne
existant pour rattacher une pièce jointe, donc impossible de le faire
dans le même `AddRecord` que la ligne elle-même pour les entités passant
par le formulaire générique (`openCreator`/`saveCreator`). Le fichier est
choisi dans le formulaire (`#edPhotoCreation`), télé­versé et rattaché par
un `UpdateRecord` séparé juste après que `ajouterEtObtenirId()` a renvoyé
le nouvel id — un aller-retour supplémentaire, invisible pour
l'utilisateur (un seul clic sur « Ajouter »). Les lots échappent à cette
contrainte : leur formulaire de création est bespoke (`creerLot()`) et
télé­verse la pièce **avant** l'`AddRecord` du lot, dont le champ `photo`
contient directement l'id obtenu.

---

---

### 7.81 Inventaire imprimable : photo du modèle des lots (2026.5.32)

`load()` ajoute `lotId` à chaque objet d'inventaire. `exporterInventaireImprimable()` construit `photosLot` (`urlsPieceJointe('lots', …)`, dernière photo) et place un `<img class="photo-vign photo-lot">` flottant avant le `<h2>` de chaque lot, dans un `div` à `overflow:auto`. Aucune vignette si le lot n'a pas de photo ou si la colonne `LOTS.photo` n'existe pas. Test : `test_35`.

---

### 7.82 Rubrique « Import / export » (2026.5.33)

Nouvel onglet d'origine `data-t="donnees"` + volet `#pane-donnees`, entrée `data-nav="donnees"` dans le menu latéral et dans « Plus » (téléphone). `renderDonnees()` (appelée au clic sur l'onglet, y compris via `naviguer('donnees')`) reconstruit trois blocs : import d'inventaire (`impMonterPanneau`, panneau toujours ouvert, ex-`impBasculerPanneau`), exports de tout le parc (`exportParcXlsx/Csv/Inv/Fiches`), sauvegarde (`renderSauvegarde`, remise à zéro dans un `<details>` replié). Zone `#donneesRepli` = repli d'impression si la fenêtre est bloquée.

`load()` produit désormais deux listes : `inventaireVisible` (filtres de l'onglet Matériel) et `inventaireTout` (`versInventaire` appliquée à tout `matRows`). `exporterInventaireCsv(tout)` et `exporterInventaireImprimable(tout)` choisissent la liste ; `tout === true` = tout le parc. Anciens emplacements : Vue d'ensemble → `#lienDonnees`; Réglages › Sauvegarde → `#reglagesVersDonnees`; Matériel → `#btnImport` mène à la rubrique; liens `a.lien-import` des cartes « Premiers pas » (délégation de clic). Tests : `test_36` ; adaptés : 23-26, 33, 34 ; garde d'aide `test_27`.

---

### 7.83 Exemplaire unique (2026.5.34)

Aucune donnée nouvelle. Formulaire de création : case `#lotUnique` dans `#blocAuto` ; `majUnique()` met la quantité à 1, masque le conteneur de `#lotQuantite` par `style.display` (pas `hidden`, écrasé par le CSS des champs) et remplit l'aide `#lotUniqueAide` (vide et masquée si quantité > 1). Appelée à la saisie, au changement de la case, à l'affichage et à la réinitialisation du formulaire. Affichage : `htmlLot()` écrit « exemplaire unique » si `L.items.length === 1`, sinon « lot de N » ; fiche du lot : « 1 (exemplaire unique) ». Test : `test_37`.

---

### 7.84 Exemplaire retrouvé (2026.5.35)

Aucune donnée nouvelle : on enregistre le fait par un incident. `actionsRetrouve(m, dateTs, observation, champsMat)` renvoie, pour une écriture unique, `UpdateRecord MATERIELS` (`hors_service_motif: ''`, `hors_service_date: null`, `commentaire: ''` si non retouché) + `AddRecord INCIDENTS` (`suite: 'Controle a realiser'`, `gravite: 'Moderee'`, description de `descriptionRetrouve()`). L'incident non suivi d'un contrôle de même date ou postérieure produit « Examen requis » par la dérivation existante (`ctx.incidentEnAttente`).

Points d'entrée : bouton `data-act="retrouve"` de `ouvrirFicheExemplaire` (Perdu/Vole seulement), bouton `.btn-retrouve-rapide` du tableau du lot, formulaire et validation dans `ficheAction` / `ficheEnvoyer` (date ni future ni antérieure à `hors_service_date`). Éditeur d'exemplaire : `apres(rowId, fields, ancien)` appelle `actionsRetrouve` quand une sortie Perdu/Vole est vidée ; avis affiché par `lier()`. Réformé / Cédé : correction libre, sans incident. Test : `test_38`.

---

### 7.85 Licence EUPL 1.2 (2026.5.36)

Logiciel sous EUPL 1.2, documentation sous CC BY-SA 4.0. L'EUPL demande la mention « Licensed under the EUPL » juste après le copyright : en-têtes du JS et du HTML (avec `SPDX-License-Identifier: EUPL-1.2`). Mentions visibles : `piedEpilog()` (documents imprimés), bloc `.apropos-licence` de l'aide (repris par l'aide imprimée), sans image externe. `LICENSE` contient le texte officiel anglais de l'EUPL 1.2 (liste SPDX, paquet npm `spdx-license-list` 6.12.0), pour la détection par GitHub ; le texte français officiel est lié (article 13 : même valeur). Test : `test_39`.

