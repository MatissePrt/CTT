import React, { useState, useRef, useEffect } from 'react';

const ChatComponent = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [systemPrompt, setSystemPrompt] = useState(
    "Vous êtes un assistant IA intelligent, utile et amical nommé DragonFly AI. Vous répondez aux questions de façon concise et précise en français."
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('https://ai.dragonflygroup.fr/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer YOUR_API_KEY',  // Remplacer par votre clé API
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'neuralmagic/Llama-3.1-Nemotron-70B-Instruct-HF-FP8-dynamic',
          messages: [
            ...messages.map(msg => ({
              role: msg.role,
              content: [{ type: 'text', text: msg.content }]
            })),
            { role: 'user', content: [{ type: 'text', text: input }] }
          ],
          promptSystem: systemPrompt,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Initialiser un nouveau message de l'assistant
      const assistantMessageId = Date.now();
      setMessages((prev) => [
        ...prev, 
        { id: assistantMessageId, role: 'assistant', content: '' }
      ]);

      // Gérer la réponse en streaming
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let fullContent = '';
      let ongoingRead = true;
      
      while (ongoingRead) {
        const { value, done } = await reader.read();
        if (done) {
          ongoingRead = false;
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.substring(5).trim();
            if (data === '[DONE]') continue;
            
            try {
              const parsedData = JSON.parse(data);
              
              if (parsedData.choices && parsedData.choices[0].delta?.content) {
                const newContent = parsedData.choices[0].delta.content;
                fullContent += newContent;
                
                // Mettre à jour le message de l'assistant
                setMessages((prev) => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: fullContent } 
                    : msg
                ));
              }
            } catch (e) {
              console.error("Error parsing stream data:", e);
            }
          }
        }
      }
      
      // S'assurer que le message final est correctement formaté
      if (fullContent) {
        setMessages((prev) => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: fullContent, id: undefined } 
            : msg
        ));
      }

    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Désolé, une erreur s'est produite: ${error.message}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="fas fa-comment-alt"></i>
              <h3 className="font-semibold">DragonFly AI Chat</h3>
            </div>
            <div className="system-prompt-container">
              <button 
                onClick={() => document.getElementById('system-prompt-modal').classList.toggle('hidden')}
                className="btn btn-ghost"
              >
                <i className="fas fa-cog"></i>
              </button>
            </div>
          </div>
        </div>
        
        <div className="card-content p-0">
          <div className="messages-container p-4">
            {messages.length === 0 ? (
              <div className="welcome-message text-center p-4">
                <i className="fas fa-dragon text-primary text-4xl mb-4"></i>
                <h3 className="font-semibold mb-2">Bienvenue sur DragonFly AI Chat</h3>
                <p className="text-sm text-gray-500">
                  Comment puis-je vous aider aujourd'hui?
                </p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div 
                  key={index}
                  className={`message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}
                >
                  <div className="message-content">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={sendMessage} className="chat-input-container p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tapez votre message ici..."
                className="flex-1 p-2 border rounded"
                disabled={isLoading}
              />
              <button 
                type="submit" 
                className="btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <i className="fas fa-paper-plane"></i>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Modal pour le system prompt */}
      <div id="system-prompt-modal" className="modal hidden">
        <div className="modal-content">
          <div className="modal-header">
            <h3>Système Prompt</h3>
            <button 
              onClick={() => document.getElementById('system-prompt-modal').classList.add('hidden')}
              className="close-btn"
            >
              &times;
            </button>
          </div>
          <div className="modal-body">
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Entrez le prompt système ici..."
              rows={5}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="modal-footer">
            <button 
              onClick={() => document.getElementById('system-prompt-modal').classList.add('hidden')}
              className="btn"
            >
              Sauvegarder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatComponent;
