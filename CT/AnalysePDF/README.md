# DragonFly AI - Analyse des accès physiques

Application web Flask qui permet d'analyser des documents PDF contenant des journaux d'accès physique à l'aide de l'API DragonFly AI, en utilisant le modèle Llama 3.1 Nemotron 70B.

## Fonctionnalités

- Upload de fichiers PDF par glisser-déposer ou sélection de fichiers
- Extraction automatique du texte des PDF
- Analyse des journaux d'accès physique pour détecter les activités suspectes
- Interface avec mode clair/sombre
- Présentation des résultats dans un format structuré et facile à lire
- Gestion de la clé API directement depuis l'interface utilisateur

## Prérequis

- Python 3.8 ou supérieur
- Flask
- PyPDF2
- Clé API DragonFly

## Installation

1. Cloner le projet
2. Installer les dépendances:

```bash
pip install -r requirements.txt
```

## Configuration de la clé API

L'application nécessite une clé API DragonFly pour fonctionner. Vous pouvez configurer votre clé API de deux façons:

### Via l'interface utilisateur (recommandé)

1. Lancez l'application (voir section suivante)
2. Cliquez sur l'icône d'engrenage (⚙️) en haut à droite de l'interface
3. Dans la fenêtre de configuration qui s'ouvre, entrez votre clé API dans le champ prévu à cet effet
4. Cliquez sur "Sauvegarder la clé API"

Votre clé sera stockée de manière sécurisée dans votre session et utilisée pour toutes les requêtes ultérieures.

### Via le code source

Alternativement, vous pouvez modifier directement la variable `DEFAULT_API_KEY` dans le fichier `app.py`.

## Démarrage de l'application

```bash
python app.py
```

L'application sera accessible à l'adresse [http://localhost:5000](http://localhost:5000).

## Structure du projet

- `app.py` - Application Flask principale
- `templates/index.html` - Interface utilisateur HTML
- `static/js/main.js` - Logique JavaScript côté client
- `static/css/styles.css` - Styles CSS de l'application

## Architecture

L'application utilise l'architecture suivante:

1. **Frontend**: HTML/CSS/JavaScript pour l'interface utilisateur
2. **Backend**: Application Flask qui gère les requêtes
3. **Extraction de texte**: Utilisation de PyPDF2 pour l'extraction de texte des PDFs
4. **Communication avec l'API**: Envoi du texte extrait à l'API DragonFly via des requêtes HTTP
5. **Streaming**: Support du streaming pour afficher les réponses progressivement

## API DragonFly

L'application communique avec l'API DragonFly en utilisant le format suivant:

```json
{
  "model": "neuralmagic/Llama-3.1-Nemotron-70B-Instruct-HF-FP8-dynamic",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Document content: [contenu du PDF]\n\nUser question: [prompt d'analyse]"
        }
      ]
    }
  ],
  "promptSystem": "Vous êtes un expert en cybersécurité spécialisé dans l'analyse des journaux d'accès physique...",
  "stream": true
}
```

## Personnalisation

Vous pouvez personnaliser l'application en modifiant:

- Les styles dans `static/css/styles.css`
- Le comportement JavaScript dans `static/js/main.js`
- Le prompt système dans `app.py` (variable `PDF_SYSTEM_PROMPT`)
- Les limites de taille des fichiers dans `app.py` (variables `MAX_PDF_SIZE` et `MAX_TEXT_SIZE`)
