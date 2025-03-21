import React from 'react';
import ReactDOM from 'react-dom/client';
import PDFAnalyzer from './PDFAnalyzer';
import './styles.css';

const App = () => {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1><i className="fas fa-dragon"></i> DragonFly AI PDF Analyzer</h1>
      </header>
      
      <main className="app-content">
        <PDFAnalyzer />
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
