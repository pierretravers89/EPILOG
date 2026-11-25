"""2026.5.24 : l'aide integree suit les evolutions, et la version affichee
(Excel, sauvegarde .json) est celle du CHANGELOG. Cet oubli (version restee
a 2026.5.20 pendant trois livraisons, aide muette sur le menu replie et le
telephone) ne doit pas se reproduire."""
import sys, os, re; from harnais import ouvrir, Resultats, SRC; from donnees import construire
from outils_page import *
R = Resultats()
ICI = os.path.dirname(os.path.abspath(__file__))
candidats = [os.path.join(os.path.dirname(os.path.abspath(SRC)), "CHANGELOG.md"), os.path.join(ICI, "..", "CHANGELOG.md")]
chemin = next((c for c in candidats if os.path.exists(c)), None)
D, ids_mat, ids_lot = construire()
with ouvrir(D) as page:
    v = page.evaluate("VERSION_EPILOG")
    if chemin:
        tete = re.search(r"^## \[([0-9.]+)\]", open(chemin, encoding="utf-8").read(), flags=re.M).group(1)
        R.verifier(v == tete, "version du logiciel (%s) = premiere entree du CHANGELOG (%s)" % (v, tete))
    else:
        print("  (CHANGELOG introuvable : comparaison ignoree)")
    R.verifier(page.inner_text("#creditsVersion") == "v" + v, "le pied de page affiche la version (%s)" % page.inner_text("#creditsVersion"))
    s = page.evaluate("construireSauvegarde().then(x => x.epilog)")
    R.verifier(s == v, "la sauvegarde .json porte la version courante (%s)" % s)
    # espaces et retours a la ligne du HTML ramenes a un seul espace : une phrase coupee en fin de ligne reste trouvable
    aide = re.sub(r"\s+", " ", sa(page.evaluate("document.querySelector('.aide-modale').textContent")))
    for libelle, motif in [("menu replie en icones", "reduire le menu"), ("bouton des actions rares du telephone", "⋯"),
                           ("tableaux en cartes sur telephone", "tableaux s'affichent en cartes"),
                           ("barre du bas", "barre en bas de l'ecran"), ("?style=singlePage", "singlepage"),
                           ("remise a zero", "remettre a zero"), ("fiches de vie PDF", "fiches de vie (pdf)"),
                           ("numeros de serie", "numeros de serie"), ("prolongation par reparation", "prolonger la duree de vie"),
                           ("commande dans Editer le lot", "modifier la commande"), ("filtre de lieu", "filtre lieu de stockage"),
                           ("rubrique Import / export", "rubrique import / export"), ("exemplaire unique", "exemplaire unique"), ("exemplaire retrouve", "declarer retrouve"), ("regroupement des exports", "reprendre un inventaire, 2."), ("liste filtree du Materiel", "exporter la liste"),
                           ("colonnes de detail des documents imprimes", "ajoute de lui-meme les colonnes"),
                           ("photos d'un exemplaire", "photos d'un exemplaire"),
                           ("structure : creation automatique", "cree lui-meme les elements nouveaux"),
                           ("structure : document vide", "installer la structure d'epilog"),
                           ("recherche d'un pret par personne", "retrouver un pret"),
                           ("import d'un inventaire existant", "importer un inventaire existant"),
                           ("rapport d'import", "rapport a imprimer"),
                           ("menus deroulants du modele", "menus deroulants (categorie, lieu, lot, statut"),
                           ("modele CSV", "modele csv."), ("erreurs regroupees dans l'apercu", "regroupe les erreurs identiques"),
                           ("dernier controle dans l'Inventaire", "mettez-la dans la colonne"),
                           ("mise a jour : remplacer le code", "remplacer le code dans le document"),
                           ("mise a jour : document neuf et son cout", "l'adresse du document change"),
                           ("mise a jour : pieces jointes non reprises", "les pieces jointes ne sont pas dans la sauvegarde")]:
        R.verifier(motif in aide, "l'aide mentionne : %s" % libelle)
    # (le raccourci vers les Reglages, #aideNavReglages, n'a volontairement pas de section)
    nav = set(page.evaluate("Array.from(document.querySelectorAll('.aide-nav-item[data-sec]')).map(b => b.dataset.sec)"))
    secs = set(page.evaluate("Array.from(document.querySelectorAll('.aide-sec')).map(s => s.id.replace('sec-', ''))"))
    R.verifier(nav == secs, "sommaire de l'aide et sections coherents (%d / %d) %s" % (len(nav), len(secs), sorted(nav ^ secs)))
    R.verifier("controles, incidents et reparations" not in aide, "ancien nom de rubrique absent de l'aide")
    R.verifier(not page.erreurs, "aucune erreur JS %s" % page.erreurs)
sys.exit(R.bilan())
