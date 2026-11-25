# Guide de marque — EPILOG

Ce document sert à deux choses : garder le branding cohérent si l'outil évolue,
et savoir quoi faire si un autre club reprend le logiciel.

---

## Le nom

**EPILOG** — en capitales, sans accent, sans espace.

Le jeu de mot tient sur deux sens : **EPI** (équipement de protection
individuelle) et **LOG** (journal, registre). Dans l'interface, `LOG` est mis en
couleur pour rendre la lecture visible :

```html
EPI<span>LOG</span>
```

Formes acceptées :

| Contexte | Forme |
|---|---|
| Nom seul | **EPILOG** |
| Avec description | EPILOG — Logiciel de gestion des EPI pour clubs alpins et de montagne |
| Avec licence | EPILOG · Licence EUPL 1.2 · © 2026 Pierre Travers |

À éviter : *Epilog*, *EpiLog*, *ÉPILOG*, *EPI-LOG*, *Épilogue*.

## Le logo

Deux déclinaisons, et le choix se fait par la **taille disponible**, pas par
préférence.

### Version complète

Fond arrondi, bouclier, mousqueton, montagne, épicéa, texte et baseline.
Lisible **à partir d'environ 150 px**. Employée dans l'encart « À propos » de
l'aide (250 px) et dans le PDF de l'aide (190 px).

### Pictogramme seul

Mousqueton et épicéa uniquement, recadré par `viewBox="140 100 300 390"` — sans
fond, ni bouclier, ni texte. Employé dans l'en-tête du widget (30 px), en tête
du PDF de l'aide (44 px) et au pied des documents imprimés (22 px).

**Sous 150 px, toujours le pictogramme.** La version complète réduite donne un
pavé sombre illisible — c'est précisément ce qui rendait le logo invisible dans
les premières versions.

## Palette

Déclarée une seule fois dans `:root` (`widget_pilotage.html`, section « Palette
du logo EPILOG ») :

| Variable | Valeur | Rôle |
|---|---|---|
| `--logo-bg` | `#0F172A` | fond arrondi |
| `--logo-shield` | `#1E293B` | bouclier |
| `--logo-shield-stroke` | `#334155` | liseré du bouclier |
| `--carabiner-color` | `#0EA5E9` | corps du mousqueton |
| `--carabiner-gate` | `#E2E8F0` | doigt |
| `--carabiner-lock` | `#F97316` | bague de verrouillage |
| `--spruce-trunk` | `#78350F` | tronc |
| `--spruce-dark` | `#047857` | épicéa, étage bas |
| `--spruce-mid` | `#10B981` | épicéa, étage médian |
| `--spruce-light` | `#34D399` | épicéa, étage haut |
| `--spruce-top` | `#6EE7B7` | épicéa, cime |

Changer une ligne repeint le logo partout dans l'interface.

**Ne pas confondre avec la charte du club** (`--navy`, `--red`), que le panneau
de réglages laisse personnaliser librement. Les deux palettes sont séparées
volontairement : un club adapte ses couleurs, pas l'identité du logiciel.

## Les documents imprimés font exception

Fiches, registres et PDF s'ouvrent dans une **fenêtre autonome** qui ne reçoit
pas la feuille de style du widget. Leurs couleurs sont donc écrites **en dur**,
dans `CSS_FICHE` et `enveloppeAidePrint()` (`widget_pilotage.js`).

**Toute modification de la palette doit être répercutée à ces deux endroits.**
C'est exactement l'oubli qui avait produit un carré noir dans le PDF de l'aide :
sans règle de couleur, un SVG retombe sur `fill: black`, et le rectangle de fond
recouvre tout le dessin.

Le test `test_print_aide.js` vérifie que chaque classe `lc-*` présente dans le
SVG a bien une règle correspondante dans le CSS d'impression. **Le lancer après
toute retouche du logo.**

Deux règles indispensables sur les documents imprimés :

- `print-color-adjust: exact` — sans elle, le navigateur supprime les aplats
  sombres et le logo sort blanc sur blanc.
- `page-break-inside: avoid` sur l'encart, pour qu'il ne soit pas coupé entre
  deux pages.

## Où EPILOG apparaît

| Emplacement | Forme | Paramétrable |
|---|---|---|
| En-tête du widget | pictogramme + ligne « EPILOG » | non |
| Bandeau du bas | « EPILOG » | non |
| Aide, « À propos » | logo complet + rubrique Logiciel | non |
| Documents imprimés | pictogramme + mention en pied | non |
| PDF de l'aide | pictogramme en titre + logo complet | non |
| Nom des fichiers exportés | préfixe `epilog-` | non |
| En-tête du fichier source | bloc de copyright | non |
| Guide `.docx` | couverture et pied de licence | non |
| Titre et sous-titre de l'en-tête | *(club)* | **oui** |
| Couleurs `--navy` / `--red` | *(club)* | **oui** |
| Liens réglementaires | *(club)* | **oui** |

La ligne de partage : **ce qui identifie le club est paramétrable, ce qui
identifie le logiciel ne l'est pas.**

## Ton

L'interface s'adresse à un bénévole de club, pas à un informaticien. Phrases
courtes, vocabulaire du terrain (marquage, lot, exemplaire, fiche de vie), pas
de jargon technique ni d'anglicismes.

Le branding reste **discret** : le nom apparaît une fois par zone, jamais dans
les messages de confirmation ni les notifications. « Prêt enregistré », pas
« EPILOG : prêt enregistré ».

## Ce qui n'existe pas, et pourquoi

- **Favicon** — le widget est un fragment HTML injecté dans une iframe Grist,
  sans `<head>`. L'onglet du navigateur affiche l'icône de Grist. Rien à faire.
- **`package.json`** — aucune dépendance, aucune chaîne de compilation. Le
  livrable est deux fichiers collés dans Grist. Un manifeste npm n'aurait ni
  lecteur ni effet.
- **Nom de domaine** — à prévoir seulement le jour où un dépôt public s'ouvre.

Ces trois points figuraient dans la checklist initiale. Ils ont été écartés
après examen du code, non par oubli.
