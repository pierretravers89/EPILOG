# Installer EPILOG

EPILOG est un **widget personnalisé Grist**. Il n'y a rien à installer sur un
serveur, rien à compiler : on colle deux fichiers dans Grist et c'est en place.

Comptez une demi-heure la première fois, structure des tables comprise.

---

## Ce qu'il vous faut

- Un compte [Grist](https://www.getgrist.com/) — le **plan gratuit suffit** pour
  un club de taille normale
- Un document Grist, avec les tables décrites plus bas
- Un accès **éditeur** au document

---

## 1. Le document Grist

EPILOG lit et écrit dans les tables de **votre** document. Il n'en crée aucune :
elles doivent exister avant.

### Tables indispensables

| Table | Contenu |
|---|---|
| `LOTS` | les lots — articles identiques achetés ensemble |
| `MATERIELS` | les exemplaires physiques, un par objet |
| `CATEGORIES` | baudrier, corde, casque… avec durée de vie et préfixe |
| `EMPRUNTS` | les prêts, regroupés par bon |
| `CONTROLES` | les contrôles EPI |
| `INCIDENTS` | chocs, chutes, dommages |
| `ADHERENTS` | les emprunteurs |
| `LIEUX_STOCKAGE` | où dort le matériel |
| `FOURNISSEURS` | chez qui on achète |
| `ACHATS` | les commandes |

### Tables facultatives

| Table | Sans elle |
|---|---|
| `CONFIG` | pas de personnalisation : le panneau de réglages vous le signale |
| `DEMANDES_EMPRUNT` | pas de formulaire de demande en ligne |
| `REPARATIONS` | pas de suivi des réparations comme fait distinct des incidents — le logiciel fonctionne normalement, juste sans ce module |
| `ENTRETIENS` | pas de sous-onglet Entretien ni de section Entretien sur les fiches de vie. Colonnes : `materiel` (Référence → `MATERIELS`), `date_entretien` (Date), `auteur` (Référence → `ADHERENTS`), `commentaire` (Texte) |

> **Colonnes de type Référence.** Le lot d'un exemplaire, la catégorie d'un lot,
> l'adhérent d'un emprunt doivent être de type **Référence**, pas Texte. Le
> diagnostic intégré signale celles à convertir — c'est la cause n° 1 des
> comportements bizarres à la première installation.

### Colonnes facultatives

Certaines finesses reposent sur des colonnes à créer une fois pour toutes.
En leur absence l'outil fonctionne : on saisit à la main ce qu'il aurait rempli,
ou le champ correspondant n'apparaît simplement pas dans les formulaires.

| Colonne | Table | Type | Apporte |
|---|---|---|---|
| `prefixe` | `CATEGORIES` | Texte | marquage automatique (BAU-001, BAU-002…) |
| `maintenance_fabricant` | `CATEGORIES` | Case à cocher | autorise « À réparer » sur les EPI de cette catégorie |
| `reparations_acceptees` | `CATEGORIES` | Texte multiligne | note affichée au moment de choisir « À réparer » |
| `couleur`, `taille`, `commentaire` | `MATERIELS` | Texte | reconnaître un exemplaire dans la liste |
| `hors_service_motif`, `hors_service_date` | `MATERIELS` | Choix, Date | trace la sortie définitive (réforme, perte, vol, cession) |
| `statut` | `MATERIELS` | Texte | colonne de confort en lecture (filtres/tri) — recalculée et écrite par le widget, jamais saisie à la main |
| `photo` | `LOTS` | Pièce jointe | photo du modèle |
| `notice` | `LOTS` | Pièce jointe | notice du fabricant au registre |
| `quantite_achetee` | `LOTS` | Nombre | quantité d'origine, distincte du nombre actuellement en stock |
| `facture` | `ACHATS` | Pièce jointe | facture au registre |
| `note_financement` | `ACHATS` | Texte | précision libre sur le financement |
| `photo` | `CONTROLES`, `INCIDENTS` | Pièce jointe | jusqu'à 4 photos par fiche |
| `type_controle` | `CONTROLES` | Choix | distingue routine, suite d'incident, avant mise en service — nécessaire au réglage « seuls les contrôles de routine décalent l'échéance » (Réglages → Fonctionnement) |
| `suite` | `INCIDENTS` | Choix | qualifie la suite à donner (contrôle à réaliser, réparation à prévoir, mise au rebut, sans suite) |
| `numero_emprunt` | `EMPRUNTS` | Texte | numéro de bon personnalisé, sinon généré automatiquement |
| `role` | `ADHERENTS` | Choix | filtre les listes « Contrôleur » et « Intervenant » aux seuls adhérents marqués « Contrôleur EPI habilité » — sans cette colonne, tous les adhérents apparaissent dans ces listes |
| `intervenant_qui` | `REPARATIONS` | Référence → `ADHERENTS` | nomme la personne qui a réparé, quand l'intervenant est le club lui-même |

> **Le texte compte, pas la position.** Pour la colonne `role`, c'est le texte
> exact du choix — « Contrôleur EPI habilité » — qui déclenche le filtrage, pas
> sa place dans la liste des choix Grist (l'ordre n'est pas garanti). Un
> renommage de ce choix désactive le filtrage sans erreur visible : le widget
> se replie silencieusement sur la liste complète des adhérents.

---

## 2. Poser le widget

1. Dans votre document Grist, ajoutez une nouvelle vue : **Add New → Add Page**
2. Choisissez la table `MATERIELS`, puis le type **Custom**
3. Dans le panneau de droite : **Custom URL → Custom Widget Builder**
4. Collez le contenu de [`src/widget_pilotage.html`](../src/widget_pilotage.html)
   dans l'onglet **HTML**
5. Collez le contenu de [`src/widget_pilotage.js`](../src/widget_pilotage.js)
   dans l'onglet **JavaScript**
6. Dans **Access level**, choisissez **Full document access** — EPILOG lit
   plusieurs tables et écrit prêts, contrôles et incidents

Le widget s'affiche. S'il reste vide, ouvrez l'aide (bouton **?**) puis la
rubrique **Diagnostic** : elle dit ce qui manque.

> **En cas de mise à jour.** Videz **entièrement** le champ avant de coller la
> nouvelle version. Un reliquat de l'ancienne est la cause la plus fréquente
> d'un affichage qui ne change pas.

---

## 3. Personnaliser pour votre club

Ouvrez l'aide (**?**), tout en bas du sommaire : **Réglages du club**.

Vous y modifiez le titre affiché, le nom du club, la fédération, l'année, le
contact, les deux couleurs du thème, et deux liens vers les règles de votre
fédération. Les changements s'appliquent aussitôt et se rangent dans la table
`CONFIG`.

Le panneau est volontairement placé dans l'aide plutôt que dans le bandeau :
cela évite les modifications par mégarde.

**Où trouver vos liens réglementaires**

- **FFCAM** — « Recommandation fédérale pour la gestion du matériel EPI »,
  souvent hébergée sur le site de votre comité ou d'un club
- **FFME** — la page `ffme.fr/epi`
- **Commune aux deux** — la norme **NF S 72-701** (AFNOR)

---

## 4. Premiers pas

L'onglet **Vue d'ensemble** vous guide tant que le parc est vide. L'ordre le
plus simple :

1. **Listes du club** — créez vos catégories (avec leur durée de vie et leur
   préfixe), vos lieux de stockage, vos adhérents
2. **Matériel** — créez un premier lot ; cochez **Reprise d'inventaire** si le
   matériel existe déjà et porte ses propres marquages
3. **Contrôles** — enregistrez le dernier contrôle connu de chaque exemplaire,
   pour que les échéances partent juste

---

## Sauvegarde

Tout vit dans votre document Grist. La sauvegarde passe par le téléchargement du
fichier **`.grist`** — le registre complet, réimportable tel quel.

**Jamais par un export CSV réimporté** : il perdrait les liens entre les tables.

---

## Ça ne marche pas ?

**Le diagnostic d'abord.** Aide (**?**) → *Diagnostic* → *Lancer un diagnostic*.
Il vérifie les tables et colonnes présentes, repère les références restées en
Texte, les marquages en doublon, et indique la personnalisation appliquée.

| Symptôme | Cause fréquente |
|---|---|
| Widget vide | Access level insuffisant, ou tables manquantes |
| Compteur à zéro | colonne de référence restée en Texte |
| Rien ne change après mise à jour | ancienne version pas entièrement effacée |
| Pièce jointe impossible à ajouter | colonne absente, ou droits en lecture seule |
| Alerte vétusté à zéro au printemps | **normal** — elle se déclenche 90 jours avant le 31 décembre |
