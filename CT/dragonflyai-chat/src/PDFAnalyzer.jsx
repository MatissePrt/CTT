import React, { useState, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';

// Initialize PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js`;

const Card = ({ className, children }) => (
  <div className={`card ${className || ''}`}>{children}</div>
);

const CardHeader = ({ children }) => (
  <div className="card-header border-b">{children}</div>
);

const CardContent = ({ className, children }) => (
  <div className={`card-content ${className || ''}`}>{children}</div>
);

const Button = ({ variant = 'primary', className, children, ...props }) => (
  <button className={`btn ${variant === 'ghost' ? 'btn-ghost' : ''} ${className || ''}`} {...props}>
    {children}
  </button>
);

const Switch = () => (
  <div className="switch-container">
    <input type="checkbox" className="switch-input" />
    <div className="switch-label"></div>
  </div>
);

// Icons
const FileText = ({ className }) => <i className={`fas fa-file-text ${className || ''}`}></i>;
const Upload = ({ className }) => <i className={`fas fa-upload ${className || ''}`}></i>;

const PDFAnalyzer = () => {
  const [files, setFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState("neuralmagic/Llama-3.1-Nemotron-70B-Instruct-HF-FP8-dynamic");
  const fileInputRef = useRef(null);

  const handleFilesSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    const pdfFiles = selectedFiles.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== selectedFiles.length) {
      alert('Please select only PDF files');
    }
    setFiles(prev => [...prev, ...pdfFiles]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const pdfFiles = droppedFiles.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== droppedFiles.length) {
      alert('Please drop only PDF files');
    }
    setFiles(prev => [...prev, ...pdfFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const extractPDFContent = async (file) => {
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
  };

  const analyzeContent = async (content, userPrompt) => {
    try {
      const response = await fetch('https://ai.dragonflygroup.fr/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer YOUR_API_KEY', // Remplacez par votre clé API
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: 'user',
              content: [
                { 
                  type: 'text', 
                  text: `Document content: ${content}

User question: ${userPrompt}`
                }
              ]
            }
          ],
          promptSystem: "Vous êtes un assistant expert en analyse de documents PDF. Analysez les contenus fournis avec précision et répondez aux questions de l'utilisateur."
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Traiter la réponse selon sa structure
      if (data.choices && data.choices[0]) {
        return data.choices[0].message.content;
      } else if (data.response && data.response.choices && data.response.choices[0]) {
        return data.response.choices[0].message.content;
      } else {
        throw new Error('Unexpected API response format');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || files.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);
    
    try {
      // Extract content from all PDFs
      const contents = await Promise.all(
        files.map(file => extractPDFContent(file))
      );
      
      // Combine contents and analyze
      const combinedContent = contents.join('\n\n=== Next Document ===\n\n');
      const analysis = await analyzeContent(combinedContent, prompt);
      
      setMessages(prev => [...prev, { role: 'assistant', content: analysis }]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: `Sorry, I encountered an error: ${error.message}` 
        }
      ]);
    } finally {
      setIsProcessing(false);
      setPrompt('');
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto min-h-[600px]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">PDF Analysis</h3>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="p-2 rounded border"
            >
              <option value="neuralmagic/Llama-3.1-Nemotron-70B-Instruct-HF-FP8-dynamic">
                DragonFly - Llama 3.1 Nemotron 70B
              </option>
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid-cols-5 gap-4 p-4 h-[calc(100%-4rem)]">
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
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
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
            <Button type="submit" disabled={isProcessing || !files.length}>
              Send
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};

export default PDFAnalyzer;
