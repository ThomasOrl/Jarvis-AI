# J.A.R.V.I.S.

Interface d'assistant holographique : React 19 + TypeScript, TanStack Start, Tailwind CSS.

## Démarrer

Il faut Node.js 20 ou plus récent.

```bash
npm install
npm run dev
```

Puis ouvrez http://localhost:8080

## Configuration

Le fichier `.env` est déjà rempli avec votre clé Google Gemini (gratuite) :

```
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_API_KEY=votre clé
AI_MODEL=gemini-3.6-flash
```

Important : après toute modification du `.env`, arrêtez le serveur (Ctrl+C) et relancez `npm run dev`.

Pour changer de fournisseur (Groq, OpenRouter, Ollama, OpenAI), voir `.env.example`.

## Historique et compte Google

Sans connexion, les conversations restent dans le stockage local du navigateur. Une fois connecté, J.A.R.V.I.S les synchronise dans son espace privé de données sur Google Drive (`appDataFolder`). Le jeton Google reste dans la mémoire de l'onglet : il faut se reconnecter après avoir rechargé ou fermé la page.

Pour activer cette fonction :

1. Dans Google Cloud Console, activez l'API Google Drive et configurez l'écran de consentement OAuth.
2. Créez un identifiant OAuth de type **Application Web** et ajoutez les origines autorisées, par exemple `http://localhost:8080` et l'URL de production.
3. Ajoutez `VITE_GOOGLE_CLIENT_ID=...` au `.env` local et aux variables d'environnement du déploiement. Le modèle est dans `.env.example`.

Au premier branchement d'un compte sans archive Drive existante, l'historique local du navigateur est importé dans son espace Google privé.

## Voix

- La lecture à voix haute fonctionne d'office avec la voix du navigateur (gratuite) — bouton haut-parleur.
- Pour une voix de synthèse plus réaliste et pour la dictée au micro, ajoutez `VOICE_API_KEY` dans `.env` (service payant).

## Structure

```
src/routes/index.tsx              page d'accueil
src/routes/api/chat.ts            conversation (flux de texte)
src/routes/api/speech.ts          synthèse vocale (optionnelle)
src/routes/api/transcribe.ts      dictée (optionnelle)
src/components/jarvis/            réacteur, chat, widgets
src/hooks/use-voice.ts            lecture à voix haute
src/hooks/use-dictation.ts        enregistrement micro
src/lib/ai-config.ts              lecture du .env
src/styles.css                    thème et animations
```

## Scripts

| Commande          | Rôle                       |
| ----------------- | -------------------------- |
| `npm run dev`     | serveur de développement   |
| `npm run build`   | version de production      |
| `npm run preview` | prévisualiser la build     |
| `npm run lint`    | vérification du code       |
