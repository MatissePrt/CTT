# DragonFly AI - Analyse des accès physiques

Application web Flask qui permet d'analyser des documents PDF contenant des journaux d'accès physique à l'aide de l'API DragonFly AI, en utilisant le modèle Llama 3.1 Nemotron 70B.

## Fonctionnalités

- Upload de fichiers PDF par glisser-déposer ou sélection de fichiers
- Extraction automatique du texte des PDF
- Analyse des journaux d'accès physique pour détecter les activités suspectes
- Interface avec mode clair/sombre
- Support du streaming pour les réponses en temps réel
- Présentation des résultats dans un format structuré et facile à lire

## Prérequis

- Python 3.8 ou supérieur
- Flask
- PyPDF2
- Clé API DragonFly (configurée dans le code)

## Installation

1. Cloner le projet
2. Installer les dépendances:

```bash
pip install -r requirements.txt
```

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
