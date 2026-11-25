<div align="center">

<img src="assets/epilog-logo.png" alt="Logo EPILOG" width="150">

# EPILOG

**Gestion des EPI et du matériel de montagne**

Widget [Grist](https://www.getgrist.com/) pour les clubs alpins et de montagne :
inventaire, prêts, contrôles réglementaires, incidents, achats.

[![Licence : EUPL 1.2](https://img.shields.io/badge/Licence-EUPL%201.2-1B3668)](LICENSE)
[![Documentation : CC BY-SA 4.0](https://img.shields.io/badge/Documentation-CC%20BY--SA%204.0-1B3668)](docs/LICENCE_DOCUMENTATION.md)
![Sans compilation](https://img.shields.io/badge/compilation-aucune-047857)
![Deux fichiers](https://img.shields.io/badge/installation-copier--coller-0EA5E9)

</div>

---

## Pourquoi

Un club de montagne doit **prouver** que son matériel de sécurité est suivi.
Cordes, baudriers, mousquetons et casques sont des équipements de protection
individuelle (EPI) : la fédération impose d'en tracer chaque exemplaire — mise
en service, contrôles, incidents, fin de vie.

> Un tableur dit ce qu'on possède. Ici, chaque objet a une **fiche de vie** :
> c'est elle qu'on présente en cas de contrôle fédéral ou d'accident.

EPILOG est né au Club Alpin Français d'Auxerre, puis rendu paramétrable pour
tout club de montagne, quelle que soit sa fédération.

## Ce que ça fait

- **Inventaire** par lot et par exemplaire, avec marquage automatique et
  contrôle des doublons
- **Prêts** par bon numéroté : sortie groupée, retour partiel, bon imprimable,
  fiche vierge pour les jours sans réseau
- **Contrôles EPI** annuels, avec anticipation à 60 jours et feuille de saisie
  imprimable
- **Incidents** avec photos, et création automatique au retour d'un matériel
  dégradé
- **Réparations** en formulaire dédié, seule ou groupée par lot : remise en
  service immédiate possible si une inspection de sécurité l'accompagne
- **Fiches de vie et registres** imprimables — le document que la fédération
  attend
- **Statuts déduits**, jamais saisis : un matériel réformé ne peut pas
  réapparaître comme disponible
- **Achats et budget**, avec factures rattachées
- **Aide embarquée** complète, et guide utilisateur imprimable

## Installation

Deux fichiers à copier-coller dans le *Custom Widget Builder* de Grist. Aucune
compilation, aucun serveur. Seuls l'import et l'export Excel chargent à la demande deux
bibliothèques publiques depuis cdnjs (SheetJS, ExcelJS).

**→ [docs/INSTALLATION.md](docs/INSTALLATION.md)**

## Personnalisation

Chaque club adapte le titre, son nom, sa fédération, ses couleurs et ses liens
réglementaires depuis un panneau intégré — sans toucher au code. Ces réglages
vivent dans une table `CONFIG` du document Grist.

Le nom et le logo EPILOG, eux, ne sont pas paramétrables : ce sont les mentions
d'origine que la licence demande de conserver.

## Documentation

| Document | Pour qui |
|---|---|
| [docs/INSTALLATION.md](docs/INSTALLATION.md) | celui qui installe |
| [docs/guide_EPILOG_CAF_Auxerre.docx](docs/) | le bénévole qui utilise |
| Aide embarquée (bouton **?**) | le bénévole, en situation |
| [docs/DOSSIER_TECHNIQUE.md](docs/DOSSIER_TECHNIQUE.md) | qui reprend le code |
| [docs/feuille_de_route.md](docs/feuille_de_route.md) | qui envisage la suite (idées en réserve, non prioritaires) |
| [docs/BRANDING_GUIDELINES.md](docs/BRANDING_GUIDELINES.md) | qui touche au visuel |
| [docs/LICENCE_DOCUMENTATION.md](docs/LICENCE_DOCUMENTATION.md) | qui réutilise la documentation |
| [tests/README.md](tests/README.md) | qui modifie le code et veut vérifier qu'il n'a rien cassé |
| [CHANGELOG.md](CHANGELOG.md) | tout le monde : ce qui change à chaque version |

## Licence

**Logiciel : EUPL 1.2** (licence publique de l'Union européenne) — [texte dans le dépôt](LICENSE),
[texte officiel en français](https://interoperable-europe.ec.europa.eu/sites/default/files/custom-page/attachment/eupl_v1.2_fr.pdf)
(toutes les versions linguistiques ont la même valeur).
**Documentation : CC BY-SA 4.0** — [détail](docs/LICENCE_DOCUMENTATION.md).

EPILOG est un logiciel libre : vous pouvez l'utiliser, le copier, le modifier et le
redistribuer. Deux conditions : **conserver les mentions d'auteur**, et **diffuser toute
version modifiée sous la même licence, avec son code** (y compris si vous l'hébergez pour
d'autres).

Les mentions d'origine sont déjà dans l'outil (bandeau du bas, rubrique « À propos »,
pied des documents imprimés) : **les laisser en place suffit**. Une version modifiée et
rediffusée doit porter **un autre nom** et indiquer qu'elle est basée sur EPILOG.

Détail, cas concrets et responsabilité : **[CONDITIONS_UTILISATION.md](CONDITIONS_UTILISATION.md)**

## Contribuer

Un problème, une idée ? Ouvrez un **signalement** (onglet *Issues* du dépôt) : deux modèles
vous guident. Ne joignez jamais de données réelles de votre club, ce dépôt est public.
Les propositions de code sont diffusées sous EUPL 1.2 ([CREDITS.md](CREDITS.md)).

## Vos données

EPILOG lit et écrit dans **votre** document Grist. Rien n'est transmis ailleurs :
ni télémétrie, ni compte, ni serveur tiers (les bibliothèques Excel chargées depuis cdnjs ne
reçoivent aucune donnée). La licence porte sur le logiciel, jamais sur vos données.

## Absence de garantie

Fourni **« en l'état », sans garantie** (articles 7 et 8 de l'EUPL). EPILOG aide à *tracer* le suivi des EPI, il
ne le *remplace pas* : la responsabilité du contrôle du matériel de sécurité et
de sa conformité incombe au club et à son responsable qualifié. Un registre bien
tenu ne rend pas un baudrier sûr.

## Crédits

Conception et développement : **Pierre Travers**, pour le Club Alpin Français
d'Auxerre. Logo généré par Google Gemini. Détail : [CREDITS.md](CREDITS.md)

---

<div align="center">
<sub>EPILOG — EPI + LOG (journal) · © 2026 Pierre Travers · EUPL 1.2</sub>
</div>
