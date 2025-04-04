// DOM Elements
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const analyzeBtn = document.getElementById('analyze-btn');
const resultContainer = document.getElementById('result-container');
const loader = document.getElementById('loader');
const resultContent = document.getElementById('result-content');
const closeAnalysisBtn = document.getElementById('close-analysis-btn');
const selectedFilesContainer = document.getElementById('selected-files');
const fileListContainer = document.getElementById('file-list');
const progressContainer = document.getElementById('progress-container');
const progressDetail = document.getElementById('progress-detail');
const resultTabs = document.getElementById('result-tabs');
const themeToggle = document.getElementById('theme-toggle-checkbox');

// Settings Modal Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal-overlay');
const closeModalBtn = document.querySelector('.modal-close-btn');
const apiKeyInput = document.getElementById('api-key-input');
const toggleApiKeyVisibilityBtn = document.getElementById('toggle-api-key-visibility');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const currentApiKeyStatus = document.getElementById('current-api-key-status');

// State
let selectedFiles = [];
let analysisResults = {};
let activeTabId = null;


// Theme toggle
function toggleTheme() {
    if (themeToggle.checked) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    }
}

// Prevent default behaviors for drag events
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight drop area
function highlight() {
    dropArea.classList.add('drag-active');
}

// Unhighlight drop area
function unhighlight() {
    dropArea.classList.remove('drag-active');
}

// Handle dropped files
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        handleFiles(files);
    }
}

// Handle files from input
function handleFileInput(e) {
    const files = e.target.files;
    
    if (files.length > 0) {
        handleFiles(files);
    }
}

// Process selected files
function handleFiles(files) {
    Array.from(files).forEach(file => {
        // Check if it's a PDF
        if (file.type !== 'application/pdf') {
            alert(`Le fichier "${file.name}" n'est pas au format PDF et sera ignoré.`);
            return;
        }
        
        // Check file size (limit to 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB in bytes
        if (file.size > maxSize) {
            alert(`Le fichier "${file.name}" est trop volumineux (maximum: 10 MB) et sera ignoré.`);
            return;
        }
        
        // Avoid duplicates
        if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
        }
    });
    
    // Update UI with selected files
    updateFileList();
    
    // Enable the analyze button if there are files
    analyzeBtn.disabled = selectedFiles.length === 0;
}

// Update the file list UI
function updateFileList() {
    if (selectedFiles.length === 0) {
        selectedFilesContainer.classList.add('hidden');
        return;
    }
    
    // Show the container
    selectedFilesContainer.classList.remove('hidden');
    
    // Clear the list
    fileListContainer.innerHTML = '';
    
    // Add each file to the list
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileSize = formatFileSize(file.size);
        
        fileItem.innerHTML = `
            <div class="file-icon"><i class="fas fa-file-pdf"></i></div>
            <div class="file-name">${file.name}</div>
            <div class="file-size">${fileSize}</div>
            <button class="file-action" data-index="${index}" title="Supprimer"><i class="fas fa-times"></i></button>
        `;
        
        fileListContainer.appendChild(fileItem);
        
        // Add event listener for the remove button
        fileItem.querySelector('.file-action').addEventListener('click', () => removeFile(index));
    });
}

// Format file size for display - simplifié
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

// Remove a file from the list
function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
    
    // Update analyze button state
    analyzeBtn.disabled = selectedFiles.length === 0;
}

// Handle analyze button click - optimisé
async function handleAnalyze() {
    if (selectedFiles.length === 0) return;
    
    // Réinitialiser les résultats
    analysisResults = {};
    
    // Préparer l'UI pour l'analyse
    progressContainer.classList.remove('hidden');
    resetProgress();
    setProgressStage('upload', 'active');
    closeAnalysisBtn.classList.remove('hidden');
    
    // Traiter chaque fichier
    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileIndex = i + 1;
        const totalFiles = selectedFiles.length;
        
        // Mise à jour de la progression
        progressDetail.textContent = `Traitement de ${file.name} (${fileIndex}/${totalFiles})`;
        
        // Préparer les données
        const formData = new FormData();
        formData.append('pdf', file);
        
        try {
            // Phase d'upload
            setProgressDetail(`Envoi de ${file.name}...`);
            
            // Phase d'extraction (simulation visuelle)
            setTimeout(() => {
                setProgressStage('extract', 'active');
                setProgressStage('upload', 'complete');
                setProgressDetail(`Extraction du texte de ${file.name}...`);
            }, 300);
            
            // Petite pause pour simulation visuelle de l'extraction 
            await new Promise(resolve => setTimeout(resolve, 600));
            
            // Phase d'analyse
            setProgressStage('analyze', 'active');
            setProgressStage('extract', 'complete');
            setProgressDetail(`Analyse de ${file.name} par l'IA...`);
            
            // Utiliser l'API appropriée selon la taille du fichier
            if (useStreaming(file)) {
                await handleStreamingAnalysis(file, formData, i);
            } else {
                await handleStandardAnalysis(file, formData, i);
            }
            
        } catch (error) {
            console.error('Erreur:', error);
            setProgressStage('analyze', 'error');
            setProgressDetail(`Erreur: ${error.message}`);
            
            // Afficher quand même les résultats partiels si disponibles
            if (Object.keys(analysisResults).length > 0) {
                displayResults();
            }
            
            break;
        }
    }
}

// Décider si on utilise le streaming pour ce fichier
function useStreaming(file) {
    // Pour les fichiers plus volumineux, le streaming est préférable
    return file.size > 500 * 1024; // Plus de 500KB
}

// Traitement avec l'API standard
async function handleStandardAnalysis(file, formData, fileIndex) {
    // Send the request
    const response = await fetch('/api/analyze-pdf', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Store the result
    analysisResults[file.name] = data;
    
    setProgressStage('analyze', 'complete');
    
    // If this is the last file, show completion
    if (fileIndex === selectedFiles.length - 1) {
        setProgressStage('complete', 'complete');
        setProgressDetail('Analyse complète!');
        displayResults();
    }
}

// Traitement avec l'API streaming
async function handleStreamingAnalysis(file, formData, fileIndex) {
    // Préparer l'affichage des résultats pour le streaming
    setProgressDetail(`Analyse de ${file.name} par l'IA (streaming)...`);
    
    if (selectedFiles.length > 1) {
        // Setup des onglets pour multiple fichiers
        resultTabs.classList.remove('hidden');
        resultTabs.innerHTML = '';
        
        // Créer un onglet pour chaque fichier
        selectedFiles.forEach((f, idx) => {
            const tab = document.createElement('div');
            tab.className = 'tab' + (idx === fileIndex ? ' active' : '');
            tab.dataset.file = f.name;
            tab.textContent = f.name;
            
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                displaySingleResult(f.name);
            });
            
            resultTabs.appendChild(tab);
        });
    } else {
        resultTabs.classList.add('hidden');
    }
    
    // Préparer le conteneur pour le streaming
    resultContent.innerHTML = '<div class="streaming-content"></div><div class="typing-indicator"><span></span><span></span><span></span></div>';
    const streamingContent = resultContent.querySelector('.streaming-content');
    const typingIndicator = resultContent.querySelector('.typing-indicator');
    
    // Initialiser les résultats pour ce fichier
    analysisResults[file.name] = {
        choices: [{
            message: {
                content: ''
            }
        }]
    };
    
    // Lancer la requête streaming
    const response = await fetch('/api/stream-analyze-pdf', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
        const { value, done } = await reader.read();
        
        if (done) {
            // Enlever l'indicateur de frappe
            typingIndicator.remove();
            
            // Compléter l'analyse
            setProgressStage('analyze', 'complete');
            
            if (fileIndex === selectedFiles.length - 1) {
                setProgressStage('complete', 'complete');
                setProgressDetail('Analyse complète!');
            }
            
            break;
        }
        
        // Décoder la portion reçue
        buffer += decoder.decode(value, { stream: true });
        
        // Traiter toutes les lignes complètes
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
            if (line === '[DONE]') continue;
            
            try {
                const data = JSON.parse(line);
                
                // Si le message contient du contenu, l'ajouter au résultat
                if (data.choices && data.choices[0] && 
                    (data.choices[0].delta?.content || data.choices[0].message?.content)) {
                    
                    const content = data.choices[0].delta?.content || data.choices[0].message?.content || '';
                    
                    // Ajouter au contenu total
                    analysisResults[file.name].choices[0].message.content += content;
                    
                    // Formatter et afficher le contenu
                    streamingContent.innerHTML = formatMarkdown(analysisResults[file.name].choices[0].message.content);
                    
                    // Scroller vers le bas pour voir les nouveaux contenus
                    resultContent.scrollTop = resultContent.scrollHeight;
                }
            } catch (e) {
                console.error('Erreur lors du parsing JSON:', e, line);
            }
        }
    }
}

// Reset progress UI
function resetProgress() {
    document.querySelectorAll('.progress-stage').forEach(stage => {
        stage.classList.remove('active', 'complete', 'error');
    });
    document.querySelectorAll('.progress-line').forEach(line => {
        line.classList.remove('active', 'complete');
    });
    progressDetail.textContent = 'Préparation des fichiers...';
}

// Set progress stage status
function setProgressStage(stageName, status) {
    const stage = document.querySelector(`.progress-stage[data-stage="${stageName}"]`);
    if (!stage) return;
    
    // Remove any existing status
    stage.classList.remove('active', 'complete', 'error');
    
    // Add the new status
    stage.classList.add(status);
    
    // Update lines before this stage if it's active or complete
    if (status === 'active' || status === 'complete') {
        const stageIndex = Array.from(document.querySelectorAll('.progress-stage')).indexOf(stage);
        
        if (stageIndex > 0) {
            const lines = document.querySelectorAll('.progress-line');
            for (let i = 0; i < stageIndex; i++) {
                lines[i].classList.add('complete');
            }
        }
    }
}

// Update progress detail
function setProgressDetail(text) {
    progressDetail.textContent = text;
}

// Display results
function displayResults() {
    // Check how many results we have
    const fileNames = Object.keys(analysisResults);
    
    if (fileNames.length === 0) {
        resultContent.innerHTML = '<div class="error-message">Aucun résultat disponible.</div>';
        return;
    }
    
    // If there's only one result, show it directly
    if (fileNames.length === 1) {
        resultTabs.classList.add('hidden');
        displaySingleResult(fileNames[0]);
        return;
    }
    
    // For multiple results, set up tabs
    resultTabs.classList.remove('hidden');
    resultTabs.innerHTML = '';
    
    // Create a tab for each file
    fileNames.forEach((fileName, index) => {
        const tab = document.createElement('div');
        tab.className = 'tab' + (index === 0 ? ' active' : '');
        tab.dataset.file = fileName;
        tab.textContent = fileName;
        
        tab.addEventListener('click', () => {
            // Deactivate all tabs
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            
            // Activate this tab
            tab.classList.add('active');
            
            // Display the content
            displaySingleResult(fileName);
        });
        
        resultTabs.appendChild(tab);
    });
    
    // Display the first result by default
    displaySingleResult(fileNames[0]);
}

// Display a single result - amélioré
function displaySingleResult(fileName) {
    const result = analysisResults[fileName];
    
    if (!result) {
        resultContent.innerHTML = '<div class="error-message">Résultat introuvable.</div>';
        return;
    }
    
    loader.classList.add('hidden');
    
    if (result.error) {
        resultContent.innerHTML = `<div class="error-message">Erreur: ${result.error}</div>`;
        return;
    }
    
    // Format and display the content
    if (result.choices && result.choices[0] && result.choices[0].message) {
        const content = result.choices[0].message.content;
        resultContent.innerHTML = formatMarkdown(content);
        
        // Mettre en évidence les éléments importants
        highlightResults();
    } else {
        // Display raw JSON if format is unexpected
        resultContent.innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
        console.error('Format de réponse inattendu:', result);
    }
}

// Mettre en évidence des éléments critiques dans l'analyse
function highlightResults() {
    // Mettre en évidence les références
    const refPattern = /#\d{3}/g;
    let elements = resultContent.querySelectorAll('td, p, li');
    
    elements.forEach(el => {
        if (el.innerHTML.match(refPattern)) {
            el.innerHTML = el.innerHTML.replace(refPattern, match => 
                `<span class="highlight">${match}</span>`);
        }
        
        // Mettre en évidence les mots clés d'alerte
        const alertKeywords = ['Erreur', 'Alerte', 'Critique', 'Échec', 'Bruteforce', 'Suspect'];
        alertKeywords.forEach(keyword => {
            const regex = new RegExp(keyword, 'gi');
            if (el.innerHTML.match(regex)) {
                el.innerHTML = el.innerHTML.replace(regex, match => 
                    `<span class="alert-text">${match}</span>`);
            }
        });
    });
}

// Format markdown content - amélioré
function formatMarkdown(text) {
    // Préformatage: nettoyage et normalisation
    text = text.replace(/\r\n/g, '\n');
    
    // Code blocks
    text = text.replace(/```([a-z]*)\n([\s\S]+?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    
    // Headers avec ids pour navigation
    text = text.replace(/^### (.*$)/gm, (match, p1) => 
        `<h3 id="${p1.toLowerCase().replace(/[^\w]+/g, '-')}">${p1}</h3>`);
    text = text.replace(/^## (.*$)/gm, (match, p1) => 
        `<h2 id="${p1.toLowerCase().replace(/[^\w]+/g, '-')}">${p1}</h2>`);
    text = text.replace(/^# (.*$)/gm, (match, p1) => 
        `<h1 id="${p1.toLowerCase().replace(/[^\w]+/g, '-')}">${p1}</h1>`);
    
    // Bold & Italic
    text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Lists
    text = text.replace(/^\s*\d+\.\s+(.*$)/gm, '<li>$1</li>');
    text = text.replace(/^\s*[-*]\s+(.*$)/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>\n)+/g, '<ul>$&</ul>');
    
    // Tables
    const tableRegex = /\n((?:\|[^\n]+\|\n)+)/g;
    const headerRowRegex = /\|(.+)\|\n\|([-:| ]+)\|\n/;
    
    text = text.replace(tableRegex, (match) => {
        // Check if it has a header row
        const headerMatch = match.match(headerRowRegex);
        let table = '<table class="markdown-table">';
        
        if (headerMatch) {
            // Add header
            const headers = headerMatch[1].split('|').map(h => h.trim()).filter(h => h);
            table += '<thead><tr>';
            headers.forEach(header => {
                table += `<th>${header}</th>`;
            });
            table += '</tr></thead>';
            
            // Remove header rows from match
            match = match.replace(headerRowRegex, '');
        }
        
        // Process data rows
        table += '<tbody>';
        match.split('\n').filter(row => row.trim().startsWith('|')).forEach(row => {
            const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
            table += '<tr>';
            cells.forEach(cell => {
                table += `<td>${cell}</td>`;
            });
            table += '</tr>';
        });
        table += '</tbody></table>';
        
        return table;
    });
    
    // Blockquotes
    text = text.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
    
    // Horizontal rules
    text = text.replace(/^---$/gm, '<hr>');
    
    // Paragraphs
    const paragraphs = text.split('\n\n');
    return paragraphs.map(p => {
        p = p.trim();
        if (p === '') return '';
        if (p.startsWith('<h') || 
            p.startsWith('<ul>') || 
            p.startsWith('<pre>') || 
            p.startsWith('<blockquote>') ||
            p.startsWith('<table>') ||
            p.startsWith('<hr>')) {
            return p;
        }
        
        // Améliorer les dates, heures, et autres données sensibles
        p = p.replace(/(\d{4}-\d{2}-\d{2})/g, '<span class="date">$1</span>');
        p = p.replace(/(Badge_[A-Za-z0-9_]+)/g, '<span class="badge-id">$1</span>');
        
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');
}

// Reset UI to initial state
function resetUI() {
    // Reset file selection
    fileInput.value = '';
    selectedFiles = [];
    updateFileList();
    
    // Reset UI elements
    
    // Hide progress info
    progressContainer.classList.add('hidden');
    
    // Show the waiting message
    resultContent.innerHTML = '<div class="waiting-message"><i class="fas fa-arrow-left"></i> Veuillez sélectionner des fichiers PDF à analyser</div>';
    
    // Hide close button and tabs
    closeAnalysisBtn.classList.add('hidden');
    resultTabs.classList.add('hidden');
    
    // Disable analyze button
    analyzeBtn.disabled = true;
    
    // Clear results
    analysisResults = {};
    
}

// API Key Management Functions
function showSettingsModal() {
    settingsModal.classList.add('active');
    // Load current API key status when opening modal
    loadApiKeyStatus();
}

function hideSettingsModal() {
    settingsModal.classList.remove('active');
}

function toggleApiKeyVisibility() {
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleApiKeyVisibilityBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        apiKeyInput.type = 'password';
        toggleApiKeyVisibilityBtn.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

function loadApiKeyStatus() {
    currentApiKeyStatus.textContent = 'Chargement...';
    
    fetch('/api/api-key', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            currentApiKeyStatus.textContent = data.masked_key;
        } else {
            currentApiKeyStatus.textContent = 'Erreur lors du chargement';
        }
    })
    .catch(error => {
        console.error('Error fetching API key status:', error);
        currentApiKeyStatus.textContent = 'Erreur de connexion';
    });
}

function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('Veuillez entrer une clé API valide');
        return;
    }
    
    saveApiKeyBtn.disabled = true;
    saveApiKeyBtn.textContent = 'Sauvegarde en cours...';
    
    fetch('/api/api-key', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ api_key: apiKey })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            currentApiKeyStatus.textContent = data.masked_key;
            alert('Clé API sauvegardée avec succès!');
            apiKeyInput.value = '';
        } else {
            alert('Erreur: ' + (data.message || 'Une erreur est survenue'));
        }
    })
    .catch(error => {
        console.error('Error saving API key:', error);
        alert('Erreur de connexion. Veuillez réessayer.');
    })
    .finally(() => {
        saveApiKeyBtn.disabled = false;
        saveApiKeyBtn.textContent = 'Sauvegarder la clé API';
    });
}

// Initialize app
function init() {
    // Event listeners for drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop area when file is dragged over
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle dropped files
    dropArea.addEventListener('drop', handleDrop, false);
    
    // Handle file input
    fileInput.addEventListener('change', handleFileInput);
    
    // Analyze button
    analyzeBtn.addEventListener('click', handleAnalyze);
    
    // Close analysis button
    closeAnalysisBtn.addEventListener('click', resetUI);
    
    // Theme toggle
    themeToggle.addEventListener('change', toggleTheme);
    
    // Settings modal
    settingsBtn.addEventListener('click', showSettingsModal);
    closeModalBtn.addEventListener('click', hideSettingsModal);
    
    // API Key management
    toggleApiKeyVisibilityBtn.addEventListener('click', toggleApiKeyVisibility);
    saveApiKeyBtn.addEventListener('click', saveApiKey);
    
    // Close modal when clicking outside of it
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            hideSettingsModal();
        }
    });
    
    // Check if user has a preferred theme
    if (localStorage.getItem('theme') === 'dark' || 
        (window.matchMedia('(prefers-color-scheme: dark)').matches && !localStorage.getItem('theme'))) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.checked = true;
    }
    
    // Initialize with waiting message
    resetUI();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
