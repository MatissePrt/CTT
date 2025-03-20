# DragonFly AI PDF Analyzer

Application React qui permet d'analyser des documents PDF à l'aide de l'API DragonFly AI, spécifiquement avec le modèle Llama 3.1 Nemotron 70B.

## Fonctionnalités

- Upload de fichiers PDF par glisser-déposer ou sélection de fichiers
- Extraction de texte automatique des PDFs côté client
- Interface de chat pour interroger l'IA sur le contenu des documents
- Support du streaming pour obtenir des réponses progressives
- Interface responsive et mode sombre automatique

## Prérequis

- Node.js (v14 ou supérieur)
- npm ou yarn
- Clé API DragonFly (à configurer dans le code)

## Installation

1. Cloner le projet
2. Installer les dépendances:

```bash
cd dragonflyai-chat
npm install
```

3. Configurer votre clé API DragonFly:
   - Ouvrir le fichier `src/PDFAnalyzer.jsx`
   - Remplacer `YOUR_API_KEY` par votre clé API DragonFly

## Démarrage de l'application

```bash
npm start
```

L'application sera accessible à l'adresse [http://localhost:3000](http://localhost:3000).

## Structure du projet

- `src/PDFAnalyzer.jsx` - Composant principal pour l'analyse de PDF
- `src/index.js` - Point d'entrée de l'application
- `src/styles.css` - Styles CSS pour l'application

## Architecture

L'application utilise l'architecture suivante:

1. **Extraction de texte**: Utilise PDF.js pour extraire le texte des PDFs côté client
2. **Communication avec l'API**: Envoie le texte extrait et les questions à l'API DragonFly
3. **Interface utilisateur**: Affiche les fichiers chargés et les réponses de l'IA

## API DragonFly

L'application communique avec l'API DragonFly en utilisant le format suivant:

```javascript
// Exemple de requête
{
  "model": "neuralmagic/Llama-3.1-Nemotron-70B-Instruct-HF-FP8-dynamic",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Document content: [contenu du PDF]\n\nUser question: [question de l'utilisateur]"
        }
      ]
    }
  ],
  "promptSystem": "Vous êtes un assistant expert en analyse de documents PDF. Analysez les contenus fournis avec précision et répondez aux questions de l'utilisateur."
}
```

## Personnalisation

Vous pouvez personnaliser l'application en modifiant:

- Les styles dans `src/styles.css`
- Le modèle d'IA dans `src/PDFAnalyzer.jsx`
- Le système prompt dans `src/PDFAnalyzer.jsx`

## Notes de développement

Pour construire une version de production:

```bash
npm run build
```

Les fichiers de production seront générés dans le dossier `build`.
