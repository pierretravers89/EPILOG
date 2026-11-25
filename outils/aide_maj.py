import re
p='/home/claude/v2/widget_pilotage.html'; h=open(p,encoding='utf-8').read()
i=h.index('<section class="aide-sec" id="sec-structure">'); j=h.index('</section>', i)+len('</section>')
h=h[:j]+"""

        <section class="aide-sec" id="sec-miseajour">
          <h3>Mettre à jour EPILOG</h3>
          <p>EPILOG est un « widget » dont le code <b>vit dans chaque document Grist</b>. Une nouvelle
             version, ce sont <b>deux fichiers</b> : <b>widget_pilotage.html</b> et
             <b>widget_pilotage.js</b>. Mettre à jour le code ne touche <b>jamais</b> à vos données (les
             tables Grist). Le numéro de la version qui tourne s'affiche dans le pied de page
             (« EPILOG v… ») : comparez-le à celui annoncé.</p>
          <p><b>Avant toute mise à jour</b>, téléchargez une sauvegarde (Réglages → Sauvegarder /
             importer des données) et <b>gardez les deux fichiers de l'ancienne version</b> : en cas de
             problème, il suffit de les recoller.</p>

          <h4>Méthode 1 — remplacer le code dans le document (recommandée)</h4>
          <ol>
            <li>Récupérez les deux fichiers de la nouvelle version.</li>
            <li>Dans Grist, ouvrez la page qui contient EPILOG, sélectionnez le widget et ouvrez ses
                options (panneau de droite) pour accéder à l'éditeur du widget, le
                « Custom widget builder » : une zone pour le <b>HTML</b>, une pour le <b>JavaScript</b>.</li>
            <li>Dans la zone HTML, tout sélectionner puis coller le contenu de <b>widget_pilotage.html</b> ;
                dans la zone JavaScript, faire de même avec <b>widget_pilotage.js</b>. Remplacez
                <b>les deux</b> : si un seul l'est, l'aide et le code ne se correspondent plus.</li>
            <li>Validez, puis rechargez la page du navigateur.</li>
            <li>Vérifiez le numéro de version dans le pied de page. S'il n'a pas changé, rechargez à
                nouveau, ou contrôlez que les deux zones ont bien été remplacées.</li>
          </ol>
          <p>Si la nouvelle version a besoin de tables ou de colonnes supplémentaires, EPILOG les crée
             lui-même au premier chargement et l'indique par un message (voir « Structure du
             document »). Tout est conservé : données, pièces jointes, partage, adresse du document,
             favoris, historique des versions de Grist.</p>

          <h4>Méthode 2 — repartir d'un document neuf, avec une sauvegarde</h4>
          <p>À réserver aux cas particuliers : changer de site Grist, repartir d'un document vide, ou
             lorsque la méthode 1 n'est pas possible.</p>
          <ol>
            <li>Dans l'ancien document : Réglages → Sauvegarder / importer des données → <b>télécharger
                la sauvegarde (.json)</b>. Conservez ce fichier.</li>
            <li>Créez un <b>nouveau document Grist vide</b>, ajoutez-y un widget personnalisé
                (« Custom widget builder ») avec le HTML et le JavaScript de la nouvelle version, comme
                dans la méthode 1, en lui donnant l'<b>accès complet au document</b>.</li>
            <li>Ouvrez EPILOG dans ce document : le bandeau <b>« Installer la structure d'EPILOG »</b>
                crée les tables vides.</li>
            <li>Réglages → Sauvegarder / importer des données → <b>Importer une sauvegarde</b> : choisissez
                le fichier .json, vérifiez l'aperçu, importez.</li>
          </ol>
          <div class="encadre"><b>Attention, cette méthode a un coût :</b>
            <ul style="margin:6px 0 0 18px">
              <li><b>L'adresse du document change.</b> Les favoris, le lien « ?style=singlePage » et
                  tous les liens déjà donnés aux bénévoles sont à refaire.</li>
              <li><b>Le partage est à refaire :</b> le nouveau document n'hérite pas des droits d'accès ;
                  réinvitez chaque personne avec le bon niveau.</li>
              <li><b>Les pièces jointes ne sont pas dans la sauvegarde</b> : photos, notices et factures
                  sont à rattacher à la main (le fichier .json les liste). Pour tout conserver, il vaut
                  mieux la méthode 1.</li>
              <li>L'historique des versions de Grist n'est pas repris.</li>
              <li>Gardez l'ancien document jusqu'à avoir tout vérifié dans le nouveau.</li>
            </ul>
          </div>
        </section>"""+h[j:]
mn=re.search(r'<button type="button" class="aide-nav-item" data-sec="structure">.*?</button>', h, flags=re.S)
assert mn, "nav structure"
h=h[:mn.end()]+"""
        <button type="button" class="aide-nav-item" data-sec="miseajour">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>
          <span class="aide-nav-label">Mettre à jour EPILOG</span></button>"""+h[mn.end():]
open(p,'w',encoding='utf-8').write(h)
print("ecrit")
