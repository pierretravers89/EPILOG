"""Passe d'accents sur les libelles d'interface d'EPILOG (2026.5.4).
Usage : python3 accents.py fichier.js [--appliquer]
Regles : voir docstring des fonctions ; seuls les textes visibles changent."""
import re, sys

MOTS = {  # minuscule -> forme accentuee ; la casse d'origine est reproduite
 'categorie':'catégorie','categories':'catégories','materiel':'matériel','materiels':'matériels',
 'preter':'prêter','pret':'prêt','prets':'prêts','controle':'contrôle','controles':'contrôles',
 'controler':'contrôler','controleur':'contrôleur','controleurs':'contrôleurs',
 'reparation':'réparation','reparations':'réparations','decocher':'décocher','prevue':'prévue',
 'prevu':'prévu','adherent':'adhérent','adherents':'adhérents','activite':'activité',
 'activites':'activités','editer':'éditer','deja':'déjà','duree':'durée','annee':'année',
 'annees':'années','selectionne':'sélectionné','selectionnes':'sélectionnés','reference':'référence',
 'cree':'créé','creee':'créée','creer':'créer','numero':'numéro','numeros':'numéros',
 'periodicite':'périodicité','theorique':'théorique','illimitee':'illimitée',
 'enregistre':'enregistré','enregistree':'enregistrée','enregistres':'enregistrés',
 'declare':'déclaré','declaree':'déclarée','declarer':'déclarer','declaration':'déclaration',
 'supprime':'supprimé','supprimee':'supprimée','resultat':'résultat','resultats':'résultats',
 'detail':'détail','details':'détails','etat':'état','equipement':'équipement',
 'equipements':'équipements','generer':'générer','genere':'généré','telecharger':'télécharger',
 'emprunte':'emprunté','retourne':'retourné','realise':'réalisé','realisee':'réalisée',
 'deplacer':'déplacer','modele':'modèle','modeles':'modèles','precedent':'précédent',
 'derniere':'dernière','dernieres':'dernières','premiere':'première','prochaine':'prochaine',
 'echeance':'échéance','echeances':'échéances','echu':'échu','echus':'échus','lies':'liés',
 'lie':'lié','liee':'liée','verifier':'vérifier','verification':'vérification','verifie':'vérifié',
 'operation':'opération','operations':'opérations','reussi':'réussi','echec':'échec',
 'impossible':'impossible','necessaire':'nécessaire','obligatoire':'obligatoire',
 'deconseille':'déconseillé','securite':'sécurité','entite':'entité','remplace':'remplacé',
 'remplacee':'remplacée','retire':'retiré','retiree':'retirée','detache':'détaché',
 'detaches':'détachés','scinde':'scindé','fabrique':'fabriqué','achete':'acheté','achetee':'achetée',
 'achetes':'achetés','recu':'reçu','recue':'reçue','reception':'réception','depense':'dépense',
 'depenses':'dépenses','fermee':'fermée','ferme':'fermé','ouverte':'ouverte','cloture':'clôturé',
 'cloturee':'clôturée','cloturer':'clôturer','resolu':'résolu','grave':'grave','apres':'après',
 'tres':'très','etre':'être','cote':'côté',
 'precisez':'précisez','etape':'étape','etapes':'étapes','creez':'créez','associee':'associée',
 'associe':'associé','rattaches':'rattachés','rattache':'rattaché','isole':'isolé','meme':'même',
 'decale':'décale','decaler':'décaler','decision':'décision','constatee':'constatée',
 'constate':'constaté','disparaitra':'disparaîtra','defaut':'défaut','delai':'délai',
 'differente':'différente','different':'différent','donnees':'données','donnee':'donnée',
 'evenement':'événement','evenements':'événements','modifie':'modifié','modifiee':'modifiée',
 'ajoute':'ajouté','ajoutee':'ajoutée','ajoutes':'ajoutés','categorisee':'catégorisée',
 'reforme':'réformé','reformes':'réformés','emprunteur':'emprunteur','entree':'entrée',
 'entrees':'entrées','termines':'terminés','terminees':'terminées','rentres':'rentrés','prete':'prêté','pretes':'prêtés','depasse':'dépassé','depassee':'dépassée',
}
# Complement genere avec un dictionnaire francais (pyspellchecker), trie a la main
# le 07/10 : mots qui n'existent qu'avec accent ; exclus : epi, email, media,
# select, cle (nom de colonne), resume, prete, decide, degrade, arete, reassort.
MOTS.update({"rejetee": "rejetée", "usee": "usée", "effectuee": "effectuée", "vetuste": "vétuste", "prevoir": "prévoir", "priorite": "priorité", "portees": "portées", "retablir": "rétablir", "localisee": "localisée", "realiser": "réaliser", "clotures": "clôtures", "editant": "éditant", "creent": "créent", "designation": "désignation", "decoule": "découle", "reecrit": "réécrit", "apparaitra": "apparaîtra", "decrivez": "décrivez", "prefixe": "préfixe", "reglementaire": "réglementaire", "decrit": "décrit", "pieces": "pièces", "telephone": "téléphone", "role": "rôle", "preceder": "précéder", "indefinie": "indéfinie", "ecriture": "écriture", "annulee": "annulée", "generes": "générés", "quantite": "quantité", "reels": "réels", "deduit": "déduit", "numerotation": "numérotation", "repete": "répète", "piece": "pièce", "pretee": "prêtée", "numerotes": "numérotés", "disparait": "disparaît", "creees": "créées", "ignoree": "ignorée", "marquee": "marquée", "traitee": "traitée", "ete": "été", "reparer": "réparer", "dedie": "dédié", "tracabilite": "traçabilité", "eventuel": "éventuel", "liberer": "libérer", "limitee": "limitée", "etes": "êtes", "precise": "précise", "periode": "période", "estimee": "estimée", "trouvee": "trouvée", "obsolete": "obsolète", "selection": "sélection", "egalement": "également", "budgetaire": "budgétaire", "retabli": "rétabli", "elements": "éléments", "plutot": "plutôt", "element": "élément", "refere": "réfère", "definitive": "définitive", "definitivement": "définitivement", "heriteront": "hériteront", "aussitot": "aussitôt", "verifiez": "vérifiez", "federation": "fédération", "credits": "crédits", "hexadecimal": "hexadécimal", "regles": "règles", "complete": "complète", "decalent": "décalent", "schema": "schéma", "regler": "régler", "reglages": "réglages", "identite": "identité", "immediatement": "immédiatement", "preserves": "préservés", "reglage": "réglage", "reel": "réel", "reformera": "réformera"})

# Formes ambigues present / participe passe ("ne remplace pas" vs "remplace") :
# retirees du dictionnaire, accentuees seulement en fin de proposition ou apres
# "Aucun ..." (voir accentuer_texte).
AMBIGUS = ['termine','rentre','touche','remplace', 'retire', 'supprime', 'modifie', 'ajoute', 'cree', 'declare', 'enregistre', 'emprunte', 'retourne', 'realise', 'ferme', 'detache', 'prete', 'reforme', 'associe', 'rattache', 'constate', 'verifie', 'genere', 'lie', 'achete', 'scinde', 'fabrique', 'selectionne', 'depasse', 'cloture', 'echu', 'isole', 'decale']
PARTICIPES = {'remplace':'remplacé','retire':'retiré','supprime':'supprimé','modifie':'modifié',
 'ajoute':'ajouté','cree':'créé','declare':'déclaré','enregistre':'enregistré','emprunte':'emprunté',
 'retourne':'retourné','realise':'réalisé','ferme':'fermé','detache':'détaché','associe':'associé',
 'rattache':'rattaché','constate':'constaté','verifie':'vérifié','genere':'généré','achete':'acheté',
 'scinde':'scindé','selectionne':'sélectionné','depasse':'dépassé','cloture':'clôturé','echu':'échu',
 'isole':'isolé','lie':'lié','termine':'terminé','rentre':'rentré','touche':'touché'}
PARTICIPES.update({"affiche": "affiché", "applique": "appliqué", "archive": "archivé", "archives": "archivés", "calcule": "calculé", "classe": "classé", "coches": "cochés", "concerne": "concerné", "concernes": "concernés", "conserve": "conservé", "efface": "effacé", "effaces": "effacés", "empruntes": "empruntés", "exporte": "exporté", "imprimes": "imprimés", "indique": "indiqué", "laisse": "laissé", "supprimes": "supprimés", "trouve": "trouvé", "utilise": "utilisé", "tapes": "tapés"})
for _m in AMBIGUS: MOTS.pop(_m, None)
# "decale" (present) : accent sur le e seulement, pas de participe
MOTS['decale'] = 'décale'

# expressions avec la preposition "a" (impossible a traiter mot a mot)
PHRASES = [('a la ','à la '),("a l\\'","à l\\'"),('a ce ','à ce '),('a cet ','à cet '),
           ('a cette ','à cette '),('a ces ','à ces '),('a partir','à partir'),('a nouveau','à nouveau'),
           ('a realiser','à réaliser'),('a rapporter','à rapporter'),('a remplir','à remplir'),
           ('a preter','à prêter'),('a remettre','à remettre'),('Cree de nouveaux','Crée de nouveaux'),('a controler','à contrôler'),('a remettre a l','à remettre à l'),
           ('a rattacher','à rattacher'),('a imprimer','à imprimer'),('a jour','à jour'),
           ('a cocher','à cocher'),('a entretenir','à entretenir'),('a jointe','à jointe')]
# valeurs comparees par le code : jamais modifiees, meme au milieu d'un texte
PROTEGES = ['En reparation','A reparer','A surveiller','Examen requis','Reforme','Prete','Vole',
            'Cede','Perdu','En service','Conforme','Soumis a vieillissement',
            'Non soumis a vieillissement','Controle periodique','Controle complet',
            'Controleur EPI habilite','Bon etat','Degrade','Hors service','Selon controle',
            'Reparation du','Incident du']   # reconnus par indexOf sur _raison (l. ~7058, 7246)
# fonctions exclues : documents imprimables, exports, diagnostic
EXCLUES = re.compile(r'^(corpsFicheMateriel|ficheDeVieLot|tableau[A-Z]\w*|ligneInfo|enveloppeFiche|'
                     r'sortirDocument|exporter\w*|telechargerCsv|lancerDiagnostic|imprimer\w*|'
                     r'bonEmprunt\w*|ficheEmpruntVierge\w*|feuille\w*|registre\w*|contexteMateriel|'
                     r'corps\w*|ficheVierge\w*|archive\w*)$')
# cle d'objet dont la valeur est ecrite dans Grist ou comparee : jamais touchee
CLES_DONNEES = re.compile(r'\b(resultat|etat_retour|motif|hors_service_motif|type_controle|gravite|suite|'
                          r'role|type_epi|statut|_statut|financement|nature|valeur|cle|key|pane|flash|id)\s*:\s*$')

def casse(src, dst):
    if src.isupper(): return dst.upper()
    if src[0].isupper(): return dst[0].upper() + dst[1:]
    return dst

def accentuer_texte(t):
    if not re.search(r'[A-Za-z]', t): return t
    masques = []
    def masquer(m):
        masques.append(m.group(0)); return '\x00%d\x00' % (len(masques) - 1)
    for p in sorted(PROTEGES, key=len, reverse=True):
        t = re.sub(r'(?<![A-Za-z])' + re.escape(p) + r'(?![A-Za-z])', masquer, t)
    for a, b in sorted(PHRASES, key=lambda x: -len(x[0])):
        t = re.sub(r'(?<![A-Za-z])' + re.escape(a), lambda m: casse(m.group(0), b), t, flags=re.I)
    # participe : fin de proposition, ou apres "Aucun(e) <nom> [<nom>]"
    def participe(m):
        w = m.group('v'); return m.group('a') + casse(w, PARTICIPES[w.lower()])
    alt = '|'.join(PARTICIPES)
    t = re.sub(r'(?P<a>)(?<![A-Za-z])(?P<v>' + alt + r')(?=\s*(?:[:.,;)!]|\(s\)|$))', participe, t, flags=re.I)
    t = re.sub(r'(?P<a>\b[Aa]ucune?\s+\w+(?:\s+\w+)?\s+)(?P<v>' + alt + r')(?![A-Za-z])', participe, t)
    def mot(m):
        w = m.group(0); r = MOTS.get(w.lower())
        return casse(w, r) if r else w
    t = re.sub(r"(?<![A-Za-z_\\])[A-Za-z]+(?![A-Za-z_])", mot, t)
    return re.sub('\x00(\\d+)\x00', lambda m: masques[int(m.group(1))], t)

def accentuer_litteral(s):
    """s = contenu d'un litteral JS. Textes entre balises + title/placeholder."""
    if ' ' not in s and '<' not in s and '>' not in s:
        # mot seul : cle probable s'il est en minuscules ou TOUT EN MAJUSCULES (nom de
        # table) ; un mot Capitalise est un libelle ("Adherent", "Controleur")
        if not re.fullmatch(r'[A-Z][a-z]+', s.strip(' :')): return s
    if re.search(r'(^|[\s,(])[#.][a-zA-Z][\w-]*', s) and '<' not in s: return s   # selecteur CSS
    if re.fullmatch(r'[\w\-\s.#:\[\]="]+', s) and ('=' in s or '_' in s): return s
    # litteral commence au milieu d'une balise (' data-act="x">Texte') : la partie
    # avant le premier '>' est du contenu de balise -> seuls title/placeholder
    prefixe = ''
    i_sup, i_inf = s.find('>'), s.find('<')
    if i_sup != -1 and (i_inf == -1 or i_sup < i_inf):
        prefixe, s = s[:i_sup + 1], s[i_sup + 1:]
        prefixe = re.sub(r'((?:title|placeholder|aria-label)=\\?")([^"\\]*)',
                         lambda x: x.group(1) + accentuer_texte(x.group(2)), prefixe)
    elif i_sup == -1 and i_inf == -1 and '="' in s:
        return s                              # fragment d'attribut pur
    morceaux = re.split(r'(<[^>]*>?)', s)
    out = []
    for k, m in enumerate(morceaux):
        if k > 0 and re.match(r'<option(?![^>]*value=)', morceaux[k-1] or ''):
            out.append(m); continue          # <option> sans value : le texte EST la valeur stockee
        if m.startswith('<'):
            m = re.sub(r'((?:title|placeholder|aria-label)=\\?")([^"\\]*)',
                       lambda x: x.group(1) + accentuer_texte(x.group(2)), m)
            out.append(m)
        else:
            # texte apres une ouverture de balise incomplete ('<td class="'...) : on ne touche pas
            out.append(accentuer_texte(m) if not re.search(r'(class|id|data-[\w-]+|style|href|src|value|for|name|type)=\\?"?$', ''.join(out)) else m)
    return prefixe + ''.join(out)

def proteger_valeurs_de_choix(code):
    """Ajoute a PROTEGES toute valeur de liste de choix du code ([ 'a', 'b' ]) et toute
    valeur ecrite sous une cle de donnees : elles ne seront jamais modifiees, meme
    citees au milieu d'une phrase d'aide."""
    for tab in re.findall(r"\[\s*'[^\]]*\]", code):
        for v in re.findall(r"'([^']{3,60})'", tab):
            # valeur de choix = plusieurs mots ; un mot seul en minuscules est une cle
            if ' ' in v.strip() and not v.startswith('<'): PROTEGES.append(v)
    for v in re.findall(r"\b(?:resultat|etat_retour|motif|hors_service_motif|type_controle|gravite|suite|role|"
                        r"type_epi|statut|financement)\s*:\s*'([^']{3,60})'", code):
        if ' ' in v.strip(): PROTEGES.append(v)

def traiter(code):
    proteger_valeurs_de_choix(code)
    res, i, n, fonction, chgts = [], 0, len(code), '', []
    ligne = 1
    while i < n:
        c = code[i]
        if code.startswith('/*', i):
            j = code.index('*/', i) + 2; res.append(code[i:j]); ligne += code[i:j].count('\n'); i = j; continue
        if code.startswith('//', i) and (i == 0 or code[i-1] != ':'):
            j = code.find('\n', i); j = n if j < 0 else j; res.append(code[i:j]); i = j; continue
        if c == '\n':
            ligne += 1
            m = re.match(r'(?:async )?function (\w+)', code[i+1:i+80])
            if m: fonction = m.group(1)
            res.append(c); i += 1; continue
        if c == '"' or c == '`':
            j = i + 1
            while code[j] != c:
                j += 2 if code[j] == '\\' else 1
            res.append(code[i:j+1]); ligne += code[i:j+1].count('\n'); i = j + 1; continue
        if c == '/' and re.search(r'[(=,:!&|?;{}\[]\s*$', ''.join(res[-3:])):   # regex litterale
            j = i + 1
            while code[j] != '/' or code[j-1] == '\\': j += 1
            res.append(code[i:j+1]); i = j + 1; continue
        if c == "'":
            j = i + 1
            while code[j] != "'":
                j += 2 if code[j] == '\\' else 1
            lit = code[i+1:j]
            avant = ''.join(res[-60:]).rstrip()
            apres = code[j+1:j+8].lstrip()
            # (2026.5.12) comparaison a travers une parenthese : (x || 'Identite') === g
            apres_long = code[j+1:j+40]
            compare = (re.match(r"\s*\)+\s*(===|!==|==)", apres_long) or avant.endswith(('===', '!==', '==', 'case', 'indexOf(', 'match(', 'startsWith(',
                                       'includes(', 'endsWith(', 'split(', 'replace(')) or apres.startswith(('===', '!==', ':'))
                       or CLES_DONNEES.search(avant)
                       # element d'un tableau de litteraux : valeurs de choix probables
                       or (re.search(r"(\[|',)\s*$", avant) and re.match(r'\s*[,\]]', apres)))
            nouveau = lit
            if not compare and not EXCLUES.match(fonction) and lit.strip() not in PROTEGES:
                nouveau = accentuer_litteral(lit)
            if nouveau != lit: chgts.append((ligne, fonction, lit, nouveau))
            res.append("'" + nouveau + "'"); i = j + 1; continue
        res.append(c); i += 1
    return ''.join(res), chgts

if __name__ == '__main__':
    src = open(sys.argv[1], encoding='utf-8').read()
    out, chgts = traiter(src)
    print('%d litteraux modifies' % len(chgts))
    if '--echantillon' in sys.argv:
        import random; random.seed(1)
        for l, f, a, b in random.sample(chgts, min(40, len(chgts))):
            print('%5d %-24s %s\n%30s-> %s' % (l, f[:24], a[:110], '', b[:110]))
    if '--appliquer' in sys.argv:
        open(sys.argv[1], 'w', encoding='utf-8').write(out); print('applique')
