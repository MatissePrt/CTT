import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import PDFAnalyzer from './PDFAnalyzer';
import ChatComponent from './ChatComponent';
import './styles.css';

const App = () => {
  const [activeTab, setActiveTab] = useState('pdf'); // 'pdf' ou 'chat'

  return (
    <div className="app-container">
      <header className="app-header">
        <h1><i className="fas fa-dragon"></i> DragonFly AI</h1>
        <div className="tabs">
          <button 
            className={`tab-btn ${activeTab === 'pdf' ? 'active' : ''}`}
            onClick={() => setActiveTab('pdf')}
          >
            <i className="fas fa-file-pdf"></i> Analyse PDF
          </button>
          <button 
            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <i className="fas fa-comment"></i> Chat
          </button>
        </div>
      </header>
      
      <main className="app-content">
        {activeTab === 'pdf' ? <PDFAnalyzer /> : <ChatComponent />}
      </main>
      
      <footer className="app-footer">
        <p>&copy; 2025 DragonFly AI</p>
      </footer>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
