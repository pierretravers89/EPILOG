"""Compare deux dossiers de captures (captures_ecrans.py) au pixel pres.
Usage : python3 compare_captures.py <reference> <apres>
Le bandeau du haut (decor anime : il varie d'un passage a l'autre MEME
sans changement de code, constate le 18/10 en comparant l'ancien code a sa
propre reference) est ignore sur tous les ecrans, sur toute la largeur et
sur la hauteur du bandeau mesuree dans la page."""
import sys, os
from PIL import Image, ImageChops
ref, apres = sys.argv[1], sys.argv[2]
HAUT_BANDEAU = int(sys.argv[3]) if len(sys.argv) > 3 else 240   # >= hauteur du bandeau aux largeurs testees
# Tolerance : ecarts de rendu (anti-crenelage) de 1 ou 2 nuances sur 255,
# invisibles a l'oeil et variables d'un passage a l'autre (constate le 18/10 :
# 238 contre 239 sur un liseré). Au-dela, l'ecran est signale comme modifie.
TOLERANCE = 2
modifies = []
for f in sorted(os.listdir(ref)):
    a = Image.open(os.path.join(ref, f)).convert('RGB'); b = Image.open(os.path.join(apres, f)).convert('RGB')
    if a.size != b.size: modifies.append((f, 'taille %s -> %s' % (a.size, b.size))); continue
    d = ImageChops.difference(a, b)
    d.paste((0, 0, 0), (0, 0, a.width, HAUT_BANDEAU))
    ecart = max(v for bande in d.getextrema() for v in bande)
    if ecart > TOLERANCE:
        modifies.append((f, d.point(lambda v: 255 if v > TOLERANCE else 0).getbbox(), 'ecart max %d/255' % ecart))
print("Ecrans modifies :", modifies or "aucun (%d ecrans identiques au pixel pres)" % len(os.listdir(ref)))
sys.exit(1 if modifies else 0)
