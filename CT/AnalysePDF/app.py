import os
import json
import io
import time
import requests
import PyPDF2
from flask import Flask, render_template, request, jsonify, Response, stream_with_context

app = Flask(__name__)

# Configuration - API key should be stored in environment variables in production
MODEL_ID = "neuralmagic/Llama-3.1-Nemotron-70B-Instruct-HF-FP8-dynamic"
API_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJpYXQiOjE3NDM3NTU1MjAsImV4cCI6MTc0Mzc1OTEyMCwicm9sZXMiOlsiUk9MRV9VU0VSIiwiUk9MRV9DUkVBVE9SIl0sInVzZXJuYW1lIjoibWF0aXNzZS5waWVycm90QGNsb3VkLXRlbXBsZS5jb20ifQ.MsklADrZUZolPzx4gUc4UvJEUuOqc0Nqthgwg_hhT6hqcEmG_UmmlyUD3OfTD2XAyGoU48TTNc2OXyzYJtAkB7Kkw518zoVKYNY-0Nz0aKQY2XGpAdByoLCHow1-49mMMPklY5jcVdP1XqP4HDxsz41t_xTFkV-3gX4mNpvD_BMk8jaWLtb6pXODyWQ8EMB3mua7Rqv3QpYt_zz1Xpe7zZHix0THMsYMyTkf63J2eaiabJzZm5uaC7QCZWNuXCwgDO9_1Diuf5oYO-nG1ipVOx8Ce_hrshhN5gyaqCeER8_gQlpIHHlFdKDEVFmLBAfsU01oxp1sfl29ui35je-f4Q"
API_URL = "https://ai.dragonflygroup.fr/api/v1/chat/completions"

# Prompt for PDF analysis
PDF_SYSTEM_PROMPT = "📌 Prompt : Analyse des Traces d'Accès Physique\n\n🟢 Contexte\nNous avons besoin d'une analyse approfondie des fichiers PDF contenant des traces d'accès physique à un système sécurisé. L'objectif est d'identifier toute activité suspecte ou anormale pouvant indiquer une tentative d'intrusion, une défaillance du système ou une manipulation frauduleuse des accès.\n\n🔵 Rôle\nTu es un expert en cybersécurité spécialisé dans l'analyse des journaux d'accès physique. Avec plus de 20 ans d'expérience dans la détection d'anomalies et les audits de sécurité, tu maîtrises l'analyse des logs, la détection des schémas frauduleux et l'investigation des événements de sécurité. Tu appliques une méthodologie rigoureuse et exploites des techniques avancées de corrélation de données pour identifier les accès inhabituels ou malveillants.\n\n🟠 Action\nAnalyser chaque fichier PDF fourni et extraire les données pertinentes relatives aux accès physiques.\nIdentifier et signaler les accès anormaux, en se basant sur les critères suivants :\n- Accès à des horaires inhabituels (ex. : en dehors des heures de bureau).\n- Tentatives répétées d'accès avec un badge non autorisé (bruteforce).\n- Échecs de connexion récurrents ou taux d'échec anormalement élevé.\n- Pour chaque accès refusé, vérifier et noter si un accès autorisé est détecté juste après et le noter.\n- Changement non autorisé dans la configuration du système d'accès.\n- Toute autre activité sortant du cadre normal d'utilisation.\n\nFournir un rapport structuré avec :\n- La liste des accès suspects détectés.\n- Les références précises des traces associées (ex. : date, heure, ID utilisateur, type d'accès).\n- Une analyse succincte expliquant pourquoi chaque trace est considérée comme suspecte.\n- Proposer des recommandations en cas de détection d'anomalies critiques (ex. : alerte à remonter, action corrective à envisager).\n\n🟡 Format\nLa réponse devra être présentée en bloc de texte markdown sous la forme suivante :\n\n📂 **Rapport d'Analyse des Traces d'Accès Physique**\n- **Fichier analysé** : [Nom du fichier]\n- **Nombre total d'événements** : [Nombre]\n- **Nombre d'anomalies détectées** : [Nombre]\n\n🔍 **Détails des accès suspects**\n| Référence | Date & Heure | ID Utilisateur | Type d'Accès | Motif de suspicion |\n|-----------|-------------|---------------|--------------|---------------------|\n| #001 | 2025-03-01 02:30 | Badge_12345 | Accès Refusé | Tentative en dehors des heures normales |\n| #002 | 2025-03-02 18:45 | Badge_67890 | Échec connexion | Bruteforce détecté (5 tentatives échouées) |\n| #003 | 2025-03-03 09:10 | Admin_4321 | Changement config | Modification suspecte des permissions |\n| #004 | 2025-03-04 14:20 | Badge_54321 | Accès Refusé suivi d'Accès Autorisé | Possible utilisation frauduleuse après échec initial |\n\n📢 **Recommandations**\n🚨 **#002** → Vérifier l'origine des tentatives de bruteforce et bloquer le badge concerné.\n🔧 **#003** → Contrôler les logs système pour identifier si la modification était légitime.\n🔎 **#004** → Enquêter sur la séquence d'accès refusé/autorisé pour déterminer s'il s'agit d'une compromission de badge.\n\n🟣 **Audience cible**\nCe prompt est destiné aux analystes de sécurité, administrateurs IT et responsables de la sûreté physique ayant besoin d'un diagnostic précis des accès suspects. Il s'adresse à des professionnels maîtrisant la gestion des contrôles d'accès et la cybersécurité physique, mais ne nécessitant pas de compétences avancées en analyse de logs bruts."


# File size limits
MAX_PDF_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_TEXT_SIZE = 100000  # Maximum characters to send to the API

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/analyze-pdf', methods=['POST'])
def analyze_pdf():
    """Endpoint to analyze PDF files and return a response"""
    # Check if a file was uploaded
    if 'pdf' not in request.files:
        return jsonify({'error': 'No file was uploaded'}), 400
    
    # Get custom instructions or use default
    instruction = request.form.get('instruction', PDF_SYSTEM_PROMPT)
    
    pdf_file = request.files['pdf']
    
    # Validate file
    if pdf_file.filename == '':
        return jsonify({'error': 'Invalid filename'}), 400
    
    if not pdf_file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'File must be a PDF'}), 400
    
    # Check file size
    pdf_content = pdf_file.read()
    if len(pdf_content) > MAX_PDF_SIZE:
        return jsonify({'error': f'File is too large (max: {MAX_PDF_SIZE/1024/1024} MB)'}), 400
    
    # Extract text from PDF
    pdf_text = extract_text_from_pdf(pdf_content)
    
    if not pdf_text.strip():
        return jsonify({'error': 'Could not extract text from this PDF or PDF is empty'}), 400
    
    # Format prompt according to our React component
    formatted_text = f"Document content: {pdf_text}\n\nUser question: {instruction}"
    
    # Call API and return response
    response = call_api(formatted_text)
    
    return jsonify(response)

@app.route('/api/stream-analyze-pdf', methods=['POST'])
def stream_analyze_pdf():
    """Endpoint to analyze PDF with streaming response"""
    # Check if a file was uploaded
    if 'pdf' not in request.files:
        return jsonify({'error': 'No file was uploaded'}), 400
    
    # Get custom instructions or use default
    instruction = request.form.get('instruction', PDF_SYSTEM_PROMPT)
    
    pdf_file = request.files['pdf']
    
    # Validate file
    if pdf_file.filename == '':
        return jsonify({'error': 'Invalid filename'}), 400
    
    if not pdf_file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'File must be a PDF'}), 400
    
    # Check file size
    pdf_content = pdf_file.read()
    if len(pdf_content) > MAX_PDF_SIZE:
        return jsonify({'error': f'File is too large (max: {MAX_PDF_SIZE/1024/1024} MB)'}), 400
    
    # Extract text from PDF
    pdf_text = extract_text_from_pdf(pdf_content)
    
    if not pdf_text.strip():
        return jsonify({'error': 'Could not extract text from this PDF or PDF is empty'}), 400
    
    # Format prompt
    formatted_text = f"Document content: {pdf_text}\n\nUser question: {instruction}"
    
    # Stream the response
    return Response(
        stream_with_context(stream_api_response(formatted_text)),
        content_type='text/event-stream'
    )

def extract_text_from_pdf(pdf_content):
    """Extract text from a PDF file"""
    pdf_text = ""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            extracted_text = page.extract_text()
            if extracted_text:
                pdf_text += extracted_text + "\n"
        
        # Limit text size to avoid too large requests
        if len(pdf_text) > MAX_TEXT_SIZE:
            print(f"PDF text truncated from {len(pdf_text)} to {MAX_TEXT_SIZE} characters")
            pdf_text = pdf_text[:MAX_TEXT_SIZE] + "... [content truncated due to size]"
    except Exception as e:
        print(f"Error extracting text: {str(e)}")
        return ""
    return pdf_text

def call_api(text):
    """Call the Dragonfly AI API for text analysis with streaming support"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Request body following API format
    payload = {
        "model": MODEL_ID,
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
        "promptSystem": PDF_SYSTEM_PROMPT,
        "stream": True  # Always use streaming for consistency
    }
    
    print(f"Sending API request in streaming mode...")
    
    try:
        # Collect the complete response by aggregating stream chunks
        accumulated_text = ""
        
        with requests.post(API_URL, headers=headers, json=payload, stream=True, timeout=180) as response:
            if response.status_code != 200:
                error_msg = f"API Error: {response.status_code} - {response.text}"
                print(error_msg)
                return {"error": error_msg}
            
            buffer = ""
            
            # Process streaming response
            for chunk in response.iter_content(chunk_size=1024):
                if not chunk:
                    continue
                    
                chunk_text = chunk.decode('utf-8')
                buffer += chunk_text
                
                # Process complete messages
                while '\n\n' in buffer:
                    message, buffer = buffer.split('\n\n', 1)
                    
                    # Skip empty messages
                    if not message.strip():
                        continue
                        
                    # Handle SSE format (prefix)
                    if message.startswith('data:'):
                        data = message[5:].strip()
                        
                        # Skip [DONE] message
                        if data == '[DONE]':
                            continue
                            
                        try:
                            # Parse JSON from chunk
                            chunk_data = json.loads(data)
                            
                            # Extract content from the chunk
                            content = ""
                            if 'choices' in chunk_data and chunk_data['choices'][0]:
                                if 'delta' in chunk_data['choices'][0] and chunk_data['choices'][0]['delta'].get('content'):
                                    # Stream format
                                    content = chunk_data['choices'][0]['delta']['content']
                                elif 'message' in chunk_data['choices'][0] and chunk_data['choices'][0]['message'].get('content'):
                                    # Regular format
                                    content = chunk_data['choices'][0]['message']['content']
                                
                                if content:
                                    accumulated_text += content
                                    print(f"Content extracted: {content[:30]}..." if len(content) > 30 else f"Content: {content}")
                            
                        except json.JSONDecodeError as e:
                            print(f"Warning: Invalid JSON in chunk: {e}")
                    else:
                        print(f"Warning: Non-SSE message received: {message[:50]}...")
        
        # Return the complete text as a simplifies response
        if accumulated_text:
            return {
                "choices": [{
                    "message": {
                        "content": accumulated_text
                    }
                }]
            }
        
        # Fallback in case no content was collected
        return {
            "choices": [{
                "message": {
                    "content": "Aucune réponse valide n'a été reçue de l'API. Veuillez réessayer."
                }
            }]
        }
        
    except Exception as e:
        error_msg = f"Error: {str(e)}"
        print(error_msg)
        return {"error": error_msg}

def stream_api_response(text):
    """Generate a streaming response for the API"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Same payload as call_api
    payload = {
        "model": MODEL_ID,
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
        "promptSystem": PDF_SYSTEM_PROMPT,
        "stream": True
    }
    
    print(f"Sending streaming API request...")
    
    try:
        # Stream the response
        with requests.post(API_URL, headers=headers, json=payload, stream=True, timeout=300) as response:
            if response.status_code != 200:
                error_msg = f"API Error: {response.status_code} - {response.text}"
                print(error_msg)
                yield f"{json.dumps({'content': error_msg})}\n\n"
                return
            
            # Process each chunk of the response
            buffer = ""
            for chunk in response.iter_content(chunk_size=1024):
                if chunk:
                    buffer += chunk.decode('utf-8')
                    
                    # Process complete SSE messages
                    while '\n\n' in buffer:
                        message, buffer = buffer.split('\n\n', 1)
                        
                        # Skip empty messages
                        if not message.strip():
                            continue
                            
                        # Handle SSE format
                        if message.startswith('data:'):
                            data = message[5:].strip()
                            
                            # Handle end of stream
                            if data == '[DONE]':
                                yield "[DONE]\n\n"
                                break
                                
                            # Parse JSON data
                            try:
                                # Parse the original JSON
                                chunk_data = json.loads(data)
                                
                                # Extract just the content from the chunk
                                content = ""
                                if 'choices' in chunk_data and chunk_data['choices'][0]:
                                    if 'delta' in chunk_data['choices'][0] and chunk_data['choices'][0]['delta'].get('content'):
                                        # Stream format
                                        content = chunk_data['choices'][0]['delta']['content']
                                    elif 'message' in chunk_data['choices'][0] and chunk_data['choices'][0]['message'].get('content'):
                                        # Regular format
                                        content = chunk_data['choices'][0]['message']['content']
                                
                                if content:
                                    # Create a simplified response with just the content
                                    simplified_data = {"content": content}
                                    # Send the simplified data with proper SSE format
                                    yield f"{json.dumps(simplified_data)}\n\n"
                                    print(f"Streaming content: {content[:30]}{'...' if len(content) > 30 else ''}")
                                else:
                                    # For debugging purposes, see what came through but had no content
                                    print(f"Received chunk with no extractable content")
                                
                            except json.JSONDecodeError as e:
                                print(f"Error decoding JSON: {e}")
                                print(f"Problematic {data[:100]}{'...' if len(data) > 100 else ''}")
                                # Skip invalid JSON
                                continue
                        else:
                            # For any non-SSE formatted data, ignore it
                            print(f"Non-SSE message received (ignoring): {message[:50]}...")
            
    except Exception as e:
        error_msg = f"Streaming Error: {str(e)}"
        print(error_msg)
        yield f"{json.dumps({'error': error_msg})}\n\n"

if __name__ == '__main__':
    app.run(debug=True)
