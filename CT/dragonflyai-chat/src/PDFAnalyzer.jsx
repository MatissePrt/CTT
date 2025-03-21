import React, { useState, useRef, useEffect } from 'react';
import * as pdfjs from 'pdfjs-dist';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js`;

// Simple UI components (can be replaced with actual UI library components)
const Card = ({ className, children }) => (
  <div className={`card ${className || ''}`}>{children}</div>
);

const CardHeader = ({ className, children }) => (
  <div className={`card-header border-b ${className || ''}`}>{children}</div>
);

const CardContent = ({ className, children }) => (
  <div className={`card-content ${className || ''}`}>{children}</div>
);

const Button = ({ variant = 'primary', className, children, size, ...props }) => (
  <button className={`btn ${variant === 'ghost' ? 'btn-ghost' : ''} ${size === 'sm' ? 'btn-sm' : ''} ${className || ''}`} {...props}>
    {children}
  </button>
);

// Icons (using Font Awesome classes instead of Lucide components)
const FileText = ({ className }) => <i className={`fas fa-file-text ${className || ''}`}></i>;
const Upload = ({ className }) => <i className={`fas fa-upload ${className || ''}`}></i>;

// Main PDFAnalyzer component
const PDFAnalyzer = () => {
  // State for files, messages, and processing status
  const [files, setFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  
  // Default model - Llama 3.1 Nemotron 70B
  const MODEL = "neuralmagic/Llama-3.1-Nemotron-70B-Instruct-HF-FP8-dynamic";

  // API Key - in a real app, this should be handled more securely

  // System prompt for PDF analysis
  const SYSTEM_PROMPT = "📌 Prompt : Analyse des Traces d'Accès Physique\n\n🟢 Contexte\nNous avons besoin d'une analyse approfondie des fichiers PDF contenant des traces d'accès physique à un système sécurisé. L'objectif est d'identifier toute activité suspecte ou anormale pouvant indiquer une tentative d'intrusion, une défaillance du système ou une manipulation frauduleuse des accès.\n\n🔵 Rôle\nTu es un expert en cybersécurité spécialisé dans l'analyse des journaux d'accès physique. Avec plus de 20 ans d'expérience dans la détection d'anomalies et les audits de sécurité, tu maîtrises l'analyse des logs, la détection des schémas frauduleux et l'investigation des événements de sécurité. Tu appliques une méthodologie rigoureuse et exploites des techniques avancées de corrélation de données pour identifier les accès inhabituels ou malveillants.\n\n🟠 Action\nAnalyser chaque fichier PDF fourni et extraire les données pertinentes relatives aux accès physiques.\nIdentifier et signaler les accès anormaux, en se basant sur les critères suivants :\n- Accès à des horaires inhabituels (ex. : en dehors des heures de bureau).\n- Tentatives répétées d'accès avec un badge non autorisé (bruteforce).\n- Échecs de connexion récurrents ou taux d'échec anormalement élevé.\n- Pour chaque accès refusé, vérifier et noter si un accès autorisé est détecté juste après et le noter.\n- Changement non autorisé dans la configuration du système d'accès.\n- Toute autre activité sortant du cadre normal d'utilisation.\n\nFournir un rapport structuré avec :\n- La liste des accès suspects détectés.\n- Les références précises des traces associées (ex. : date, heure, ID utilisateur, type d'accès).\n- Une analyse succincte expliquant pourquoi chaque trace est considérée comme suspecte.\n- Proposer des recommandations en cas de détection d'anomalies critiques (ex. : alerte à remonter, action corrective à envisager).\n\n🟡 Format\nLa réponse devra être présentée en bloc de texte markdown sous la forme suivante :\n\n📂 **Rapport d'Analyse des Traces d'Accès Physique**\n- **Fichier analysé** : [Nom du fichier]\n- **Nombre total d'événements** : [Nombre]\n- **Nombre d'anomalies détectées** : [Nombre]\n\n🔍 **Détails des accès suspects**\n| Référence | Date & Heure | ID Utilisateur | Type d'Accès | Motif de suspicion |\n|-----------|-------------|---------------|--------------|---------------------|\n| #001 | 2025-03-01 02:30 | Badge_12345 | Accès Refusé | Tentative en dehors des heures normales |\n| #002 | 2025-03-02 18:45 | Badge_67890 | Échec connexion | Bruteforce détecté (5 tentatives échouées) |\n| #003 | 2025-03-03 09:10 | Admin_4321 | Changement config | Modification suspecte des permissions |\n| #004 | 2025-03-04 14:20 | Badge_54321 | Accès Refusé suivi d'Accès Autorisé | Possible utilisation frauduleuse après échec initial |\n\n📢 **Recommandations**\n🚨 **#002** → Vérifier l'origine des tentatives de bruteforce et bloquer le badge concerné.\n🔧 **#003** → Contrôler les logs système pour identifier si la modification était légitime.\n🔎 **#004** → Enquêter sur la séquence d'accès refusé/autorisé pour déterminer s'il s'agit d'une compromission de badge.\n\n🟣 **Audience cible**\nCe prompt est destiné aux analystes de sécurité, administrateurs IT et responsables de la sûreté physique ayant besoin d'un diagnostic précis des accès suspects. Il s'adresse à des professionnels maîtrisant la gestion des contrôles d'accès et la cybersécurité physique, mais ne nécessitant pas de compétences avancées en analyse de logs bruts."


  // File selection handler
  const handleFilesSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    const pdfFiles = selectedFiles.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== selectedFiles.length) {
      alert('Please select only PDF files');
    }
    
    setFiles(prev => [...prev, ...pdfFiles]);
  };

  // Drag and drop handler
  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const pdfFiles = droppedFiles.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== droppedFiles.length) {
      alert('Please drop only PDF files');
    }
    
    setFiles(prev => [...prev, ...pdfFiles]);
  };

  // Remove file handler
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Extract text from PDF
  const extractPDFContent = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument(arrayBuffer).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map(item => 'str' in item ? item.str : '')
          .join(' ');
        fullText += pageText + '\n';
      }
      
      return fullText;
    } catch (error) {
      console.error("Error extracting PDF content:", error);
      throw new Error(`Failed to extract content from ${file.name}: ${error.message}`);
    }
  };

  // Analyze content using the API
  const analyzeContent = async (content, userPrompt) => {
    try {
      // Format request body according to the API example
      const requestBody = {
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { 
                type: 'text', 
                text: `Document content: ${content}\n\nUser question: ${userPrompt}`
              }
            ]
          }
        ],
        promptSystem: SYSTEM_PROMPT,
        stream: true // IMPORTANT: Set to true for streaming responses
      };
      
      console.log('Sending streaming request to Dragonfly AI API...');
      
      // Make API request with streaming enabled
      const response = await fetch('https://ai.dragonflygroup.fr/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error: ${response.status}`, errorText);
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      // Initialize accumulatedContent for streaming
      let accumulatedContent = '';
      
      // Get reader from response body
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let done = false;
      let buffer = '';
      
      // Process streaming chunks
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        
        if (done) break;
        
        // Decode the current chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Split by lines and process each complete SSE message
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep the last incomplete part in buffer
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line === '[DONE]') continue;
          
          // Check if line has SSE format (starts with "data:")
          let data = line;
          if (line.startsWith('data:')) {
            data = line.substring(5).trim();
          }
          
          try {
            // Skip empty data to avoid JSON parse errors
            if (!data || data.trim() === '') {
              console.log('Empty data chunk received, skipping');
              continue;
            }
            
            console.log('Parsing chunk:', data);
            const parsed = JSON.parse(data);
            console.log('Successfully parsed JSON');
            
            // Handle simplified content-only format from our backend
            if (parsed.content) {
              console.log('Content chunk received:', parsed.content.substring(0, 50) + (parsed.content.length > 50 ? '...' : ''));
              accumulatedContent += parsed.content;
              continue;
            }
            
            // Fall back to standard format if simplified format not found
            if (parsed.choices && parsed.choices[0]) {
              let content = '';
              
              // Handle different response formats
              if (parsed.choices[0].delta && parsed.choices[0].delta.content) {
                content = parsed.choices[0].delta.content;
              } else if (parsed.choices[0].message && parsed.choices[0].message.content) {
                content = parsed.choices[0].message.content;
              }
              
              if (content) {
                console.log('Content chunk received from standard format:', content.substring(0, 50) + (content.length > 50 ? '...' : ''));
                accumulatedContent += content;
              }
            }
          } catch (jsonError) {
            console.error('Error parsing JSON from stream:', jsonError);
            console.error('Problematic data:', data);
            // Continue to next line on parsing error
          }
        }
      }
      
      return accumulatedContent || "No content received from streaming response";
      
    } catch (error) {
      console.error('Analysis error:', error);
      throw new Error(`Failed to analyze content: ${error.message}`);
    }
  };

  // Form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || files.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);
    
    // Add loading message
    const loadingId = Date.now();
    setMessages(prev => [...prev, { 
      id: loadingId,
      role: 'assistant', 
      content: 'Analyzing PDFs...',
      isLoading: true 
    }]);
    
    try {
      console.log(`Processing ${files.length} PDF files...`);
      
      // Extract text from all PDFs
      setIsLoading(true);
      const contents = await Promise.all(
        files.map(file => extractPDFContent(file))
      );
      
      // Log extracted content size for debugging
      const totalContentSize = contents.reduce((sum, content) => sum + content.length, 0);
      console.log(`Total extracted content size: ${totalContentSize} characters`);
      
      // Combine contents
      const combinedContent = contents.join('\n\n=== Next Document ===\n\n');
      
      // Get analysis from API (streaming)
      console.log('Sending request to API...');
      const analysis = await analyzeContent(combinedContent, prompt);
      console.log('Received full response from streaming API');
      
      // Update with final content
      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingId 
            ? { ...msg, content: analysis, isLoading: false } 
            : msg
        )
      );
    } catch (error) {
      console.error("Analysis error:", error);
      
      // Show error message
      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingId 
            ? { 
                ...msg, 
                content: `Error: ${error.message}`, 
                isLoading: false,
                isError: true 
              } 
            : msg
        )
      );
    } finally {
      setIsProcessing(false);
      setIsLoading(false);
      setPrompt('');
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto min-h-[600px]">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">PDF Analysis</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">DragonFly AI - Llama 3.1 Nemotron 70B</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-5 gap-4 p-4 h-[calc(100%-4rem)]">
        {/* File Upload Sidebar */}
        <div className="col-span-2 border-r pr-4">
          <div
            className="border-2 border-dashed rounded-lg p-4 text-center mb-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFilesSelect}
              accept=".pdf"
              multiple
              className="hidden"
            />
            <Upload className="h-8 w-8 mx-auto text-gray-400" />
            <Button 
              variant="ghost" 
              className="mt-2"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload PDFs
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              or drag and drop files here
            </p>
          </div>

          {/* File List */}
          <div className="space-y-2">
            {files.map((file, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-primary/10 rounded">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm truncate">{file.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => removeFile(index)}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Interface */}
        <div className="col-span-3 flex flex-col h-full">
          <div className="flex-1 overflow-y-auto mb-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-800'
                  } ${message.isError ? 'border-red-500 border' : ''}`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.isLoading && (
                    <div className="typing-indicator mt-2">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask about your PDFs..."
              className="flex-1 p-2 rounded-md border"
              disabled={isProcessing}
            />
            <Button 
              type="submit" 
              disabled={isProcessing || !files.length}
              className={isLoading ? 'btn-loading' : ''}
            >
              {isLoading ? 'Analyzing...' : 'Send'}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};

export default PDFAnalyzer;
