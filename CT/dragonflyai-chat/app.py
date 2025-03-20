import os
import json
import io
import time
import requests
import PyPDF2
from flask import Flask, render_template, request, jsonify, Response, stream_with_context

app = Flask(__name__)

# Configuration - Replace with your actual API key
API_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJpYXQiOjE3NDI1MDY5OTMsImV4cCI6MTc0MjUxMDU5Mywicm9sZXMiOlsiUk9MRV9VU0VSIiwiUk9MRV9DUkVBVE9SIl0sInVzZXJuYW1lIjoibWF0aXNzZS5waWVycm90QGNsb3VkLXRlbXBsZS5jb20ifQ.qwdpAEXPpIdCHD9LWA76JUVuKDBDG07UhDomk0mb-SLzYW7_Ia_MLu5VkS4NSfMaka1hzert5_GRq10vdnAT6rBrflWZcuORqZYASaGwx6NnpkKZmAElyJ3W_aPY2dGFiJLJyNWWrzRoEcxHXydrBf7PFUAR9_CSzTzxCqsnZRjr-fmeuaxECkjYfqcjR_CkYSJ40qCvgQfAOeiznQXMCYux_wRKJAm0ewm0HorEEnX4GH6S8bFjyuLxceaMHCHEYkzWTjyrIHeCr8IEzY4hQDk4tjDQGgI8dSrt8ELzRtacdTgdYC1c5LLFJfYUslDWxg3SZzyLE17qTj6gan7Xng"  # Remplacez par votre clé API DragonFly
API_URL = "https://ai.dragonflygroup.fr/api/v1/chat/completions"

# System prompt pour l'analyse PDF
PDF_SYSTEM_PROMPT = "Vous êtes un assistant expert en analyse de documents PDF. Analysez les contenus fournis avec précision et répondez aux questions de l'utilisateur."

# Prompt par défaut pour l'analyse de PDF
DEFAULT_PROMPT = "Analyse ce document PDF et donne-moi un résumé détaillé avec les points clés."

# Limite de taille pour les fichiers PDF (10 MB)
MAX_PDF_SIZE = 10 * 1024 * 1024

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/analyze-pdf', methods=['POST'])
def analyze_pdf():
    # Vérifier si un fichier a été envoyé
    if 'pdf' not in request.files:
        return jsonify({'error': 'Aucun fichier n\'a été envoyé'}), 400
    
    # Récupérer l'instruction personnalisée (ou utiliser celle par défaut)
    instruction = request.form.get('instruction', DEFAULT_PROMPT)
    
    pdf_file = request.files['pdf']
    
    # Vérifier si le fichier est valide
    if pdf_file.filename == '':
        return jsonify({'error': 'Nom de fichier invalide'}), 400
    
    # Vérifier l'extension du fichier
    if not pdf_file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'Le fichier doit être au format PDF'}), 400
    
    # Vérifier la taille du fichier
    pdf_content = pdf_file.read()
    if len(pdf_content) > MAX_PDF_SIZE:
        return jsonify({'error': f'Le fichier est trop volumineux (max: {MAX_PDF_SIZE/1024/1024} MB)'}), 400
    
    # Extraire le texte du PDF - nécessaire pour l'API
    pdf_text = extract_text_from_pdf(pdf_content)
    
    if not pdf_text.strip():
        return jsonify({'error': 'Impossible d\'extraire du texte de ce PDF ou PDF vide'}), 400
    
    # Formater le texte selon l'exemple du code React fourni
    formatted_text = f"Document content: {pdf_text}\n\nUser question: {instruction}"
    
    # Appeler l'API
    response = call_api(formatted_text)
    
    return jsonify(response)

@app.route('/api/stream-analyze-pdf', methods=['POST'])
def stream_analyze_pdf():
    """Endpoint pour analyser un PDF avec streaming des résultats."""
    # Vérifier si un fichier a été envoyé
    if 'pdf' not in request.files:
        return jsonify({'error': 'Aucun fichier n\'a été envoyé'}), 400
    
    # Récupérer l'instruction personnalisée (ou utiliser celle par défaut)
    instruction = request.form.get('instruction', DEFAULT_PROMPT)
    
    pdf_file = request.files['pdf']
    
    # Vérifier si le fichier est valide
    if pdf_file.filename == '':
        return jsonify({'error': 'Nom de fichier invalide'}), 400
    
    # Vérifier l'extension du fichier
    if not pdf_file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'Le fichier doit être au format PDF'}), 400
    
    # Vérifier la taille du fichier
    pdf_content = pdf_file.read()
    if len(pdf_content) > MAX_PDF_SIZE:
        return jsonify({'error': f'Le fichier est trop volumineux (max: {MAX_PDF_SIZE/1024/1024} MB)'}), 400
    
    # Extraire le texte du PDF
    pdf_text = extract_text_from_pdf(pdf_content)
    
    if not pdf_text.strip():
        return jsonify({'error': 'Impossible d\'extraire du texte de ce PDF ou PDF vide'}), 400
    
    # Formater le texte
    formatted_text = f"Document content: {pdf_text}\n\nUser question: {instruction}"
    
    # Stream la réponse
    return Response(
        stream_with_context(stream_api_response(formatted_text)),
        content_type='text/event-stream'
    )

def extract_text_from_pdf(pdf_content):
    """Extrait le texte d'un fichier PDF."""
    pdf_text = ""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            extracted_text = page.extract_text()
            if extracted_text:
                pdf_text += extracted_text + "\n"
        
        # Limiter la taille du texte pour éviter des requêtes trop volumineuses
        max_chars = 100000
        if len(pdf_text) > max_chars:
            print(f"PDF text truncated from {len(pdf_text)} to {max_chars} characters")
            pdf_text = pdf_text[:max_chars] + "... [contenu tronqué en raison de la taille]"
    except Exception as e:
        print(f"Erreur lors de l'extraction du texte: {str(e)}")
        return ""
    return pdf_text

# Route removed

def call_api(text):
    """Appelle l'API DragonFly pour analyser le texte."""
    # Préparer la requête API selon l'exemple React fourni
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Structure basée sur l'exemple curl
    payload = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": text
                    }
                ]
            }
        ],
        "model": "neuralmagic/Llama-3.1-Nemotron-70B-Instruct-HF-FP8-dynamic",
        "promptSystem": PDF_SYSTEM_PROMPT
    }
    
    print(f"Sending API request...")
    
    try:
        response = requests.post(API_URL, headers=headers, json=payload, timeout=120)
        
        if response.status_code != 200:
            print(f"API Error: {response.status_code} - {response.text}")
            return {"error": f"API Error: {response.status_code} - {response.text}"}
        
        # Log la réponse pour débogage
        response_json = response.json()
        print(f"API Response received")
        
        # Traiter la réponse selon la structure attendue dans l'exemple React
        if "response" in response_json and "choices" in response_json["response"]:
            content = response_json["response"]["choices"][0]["message"]["content"]
            return {
                "choices": [
                    {
                        "message": {
                            "content": content
                        }
                    }
                ]
            }
        elif "choices" in response_json and len(response_json["choices"]) > 0:
            # Format standard OpenAI
            return response_json
        else:
            # Retourner la réponse telle quelle si elle ne correspond pas à la structure attendue
            return response_json
    except Exception as e:
        error_msg = f"Error: {str(e)}"
        print(error_msg)
        return {"error": error_msg}

@app.route('/api/chat', methods=['POST'])
def chat():
    """Endpoint pour le chat avec l'IA DragonFly avec streaming."""
    data = request.json
    
    if not data or 'messages' not in data:
        return jsonify({'error': 'Format de requête invalide. Messages attendus.'}), 400
    
    # Extraire le dernier message de l'utilisateur
    user_message = data['messages'][-1]['content']
    
    # Système de prompt pour le chat général
    chat_system_prompt = "You are a helpful assistant that speaks like a pirate."
    
    # Stream la réponse
    return Response(
        stream_with_context(stream_chat_api_response(user_message, chat_system_prompt)),
        content_type='text/event-stream'
    )

def stream_chat_api_response(message, system_prompt):
    """Génère un stream pour la réponse de l'API DragonFly pour le chat."""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Structure basée sur l'exemple curl fourni
    payload = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": message
                    }
                ]
            }
        ],
        "model": "neuralmagic/Llama-3.1-Nemotron-70B-Instruct-HF-FP8-dynamic",
        "promptSystem": system_prompt,
        "stream": True
    }
    
    print(f"Sending chat streaming API request...")
    
    try:
        # Utiliser l'option stream de requests pour obtenir les données au fur et à mesure
        with requests.post(API_URL, headers=headers, json=payload, stream=True, timeout=300) as response:
            if response.status_code != 200:
                error_msg = f"API Error: {response.status_code} - {response.text}"
                print(error_msg)
                yield f"{json.dumps({'error': error_msg})}\n\n"
                return
            
            # Traiter chaque chunk de la réponse
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data:'):
                        data = line[5:].strip()
                        if data == '[DONE]':
                            yield f"[DONE]\n\n"
                            break
                        
                        try:
                            json_data = json.loads(data)
                            # Formatage pour correspondre au format SSE
                            yield f"{json.dumps(json_data)}\n\n"
                        except json.JSONDecodeError:
                            print(f"Error decoding JSON: {data}")
                            continue
                        
                # Pause pour simuler une réponse progressive si les chunks arrivent trop vite
                time.sleep(0.05)
            
    except Exception as e:
        error_msg = f"Streaming Error: {str(e)}"
        print(error_msg)
        yield f"{json.dumps({'error': error_msg})}\n\n"

def stream_api_response(text):
    """Génère un stream pour la réponse de l'API DragonFly pour l'analyse PDF."""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Structure basée sur l'exemple curl avec streaming
    payload = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": text
                    }
                ]
            }
        ],
        "model": "neuralmagic/Llama-3.1-Nemotron-70B-Instruct-HF-FP8-dynamic",
        "promptSystem": PDF_SYSTEM_PROMPT,
        "stream": True
    }
    
    print(f"Sending streaming API request...")
    
    try:
        # Utiliser l'option stream de requests pour obtenir les données au fur et à mesure
        with requests.post(API_URL, headers=headers, json=payload, stream=True, timeout=300) as response:
            if response.status_code != 200:
                error_msg = f"API Error: {response.status_code} - {response.text}"
                print(error_msg)
                yield f"{json.dumps({'error': error_msg})}\n\n"
                return
            
            # Traiter chaque chunk de la réponse
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data:'):
                        data = line[5:].strip()
                        if data == '[DONE]':
                            yield f"[DONE]\n\n"
                            break
                        
                        try:
                            json_data = json.loads(data)
                            # Formatage pour correspondre au format SSE
                            yield f"{json.dumps(json_data)}\n\n"
                        except json.JSONDecodeError:
                            print(f"Error decoding JSON: {data}")
                            continue
                        
                # Pause pour simuler une réponse progressive si les chunks arrivent trop vite
                time.sleep(0.05)
            
    except Exception as e:
        error_msg = f"Streaming Error: {str(e)}"
        print(error_msg)
        yield f"{json.dumps({'error': error_msg})}\n\n"

if __name__ == '__main__':
    app.run(debug=True)
