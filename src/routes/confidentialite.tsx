import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — J.A.R.V.I.S" },
      {
        name: "description",
        content: "Comment Jarvis utilise et protège les informations nécessaires à son fonctionnement.",
      },
    ],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground sm:px-8">
      <article className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="text-sm text-primary transition-colors hover:text-foreground"
        >
          ← Retour à Jarvis
        </Link>

        <p className="mt-10 font-display text-xs uppercase tracking-[0.3em] text-primary">
          J.A.R.V.I.S · Informations sur les données
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-wide sm:text-4xl">
          Politique de confidentialité
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Dernière mise à jour : 11 octobre 2026
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-foreground/85">
          <section>
            <h2 className="font-display text-base font-semibold text-primary">Qui gère Jarvis ?</h2>
            <p className="mt-2">
              Jarvis est un assistant IA personnel édité par Thomas Orlans. Pour toute question
              relative à cette politique ou à vos données, écrivez à{" "}
              <a className="text-primary underline" href="mailto:totom.orlans@gmail.com">
                totom.orlans@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-primary">
              Données utilisées
            </h2>
            <p className="mt-2">
              Si vous vous connectez avec Google, Jarvis reçoit les informations de profil que
              Google fournit, notamment votre nom, votre adresse e-mail et, si disponible, votre
              photo. Jarvis utilise également le contenu de vos messages et réponses, le titre des
              conversations et leur date de mise à jour.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-primary">
              Utilisation et stockage
            </h2>
            <p className="mt-2">
              Vos conversations sont conservées dans le stockage local du navigateur utilisé. Si
              vous connectez Google, Jarvis synchronise aussi l’historique dans le dossier privé
              réservé aux données de l’application dans votre Google Drive. Jarvis ne lit pas vos
              autres fichiers Drive. L’application ne possède pas de base de données centrale pour
              les conversations.
            </p>
            <p className="mt-2">
              Vous pouvez supprimer une conversation depuis Jarvis ; la suppression est enregistrée
              dans l’historique local et synchronisée avec Google Drive lorsque la connexion et la
              synchronisation sont actives. Effacer les données du site dans votre navigateur
              supprime la copie locale. Vous pouvez retirer à tout moment l’accès de Jarvis depuis
              les paramètres de sécurité de votre compte Google.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-primary">
              Services externes
            </h2>
            <p className="mt-2">
              Pour produire une réponse, le message envoyé et le contexte utile de la conversation
              sont transmis au service d’IA configuré pour Jarvis. Le site utilise actuellement
              l’API Google Gemini. Google traite ces données selon ses propres conditions et règles
              de confidentialité. Netlify héberge le site et exécute ses fonctions serveur.
            </p>
            <p className="mt-2">
              Si la dictée vocale est activée et configurée, l’enregistrement du microphone est
              transmis au service de transcription configuré pour Jarvis. La synthèse vocale peut
              utiliser le service vocal configuré ; sinon, elle peut être fournie par le navigateur.
              Les services Google et vocaux ne reçoivent que les données nécessaires à la fonction
              que vous utilisez.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-primary">
              Conservation et contrôle
            </h2>
            <p className="mt-2">
              Les copies locales restent dans le navigateur jusqu’à leur suppression par vous ou
              jusqu’à l’effacement des données du site. Les conversations synchronisées restent
              dans votre dossier de données Jarvis sur Google Drive jusqu’à leur suppression. Les
              fournisseurs externes peuvent conserver les requêtes selon leurs propres politiques.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-primary">
              Contact et demandes
            </h2>
            <p className="mt-2">
              Pour demander l’accès, la rectification ou la suppression d’informations liées à
              Jarvis, contactez l’éditeur à l’adresse indiquée ci-dessus. Vous pouvez aussi gérer
              ou révoquer l’accès accordé à Jarvis depuis votre compte Google.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-primary/20 pt-5 text-xs text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-primary">
            jarvisai.be
          </Link>
        </div>
      </article>
    </main>
  );
}
