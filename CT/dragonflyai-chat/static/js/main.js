// DOM Elements
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const analyzeBtn = document.getElementById('analyze-btn');
const instructionInput = document.getElementById('instruction');
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

// State
let selectedFiles = [];
let currentPreviewFile = null;
let currentPreviewPage = 1;
let analysisResults = {};
let activeTabId = null;
let eventSource = null;


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

// Format file size for display
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

// Remove a file from the list
function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
    
    // Update analyze button state
    analyzeBtn.disabled = selectedFiles.length === 0;
}


// Handle analyze button click
async function handleAnalyze() {
    if (selectedFiles.length === 0) return;
    
    // Close any ongoing streams
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    
    // Reset results
    analysisResults = {};
    
    // Show progress container
    progressContainer.classList.remove('hidden');
    resetProgress();
    setProgressStage('upload', 'active');
    
    // Get the instruction text
    const instruction = instructionInput.value.trim();
    
    // Process one file at a time
    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Update progress
        setProgressStage('upload', 'active');
        progressDetail.textContent = `Traitement de ${file.name} (${i+1}/${selectedFiles.length})...`;
        
        // Create FormData
        const formData = new FormData();
        formData.append('pdf', file);
        if (instruction) {
            formData.append('instruction', instruction);
        }
        
        try {
            // Upload file
            setProgressDetail(`Envoi de ${file.name}...`);
            
            // Extraction phase
            setProgressStage('extract', 'active');
            setProgressStage('upload', 'complete');
            setProgressDetail(`Extraction du texte de ${file.name}...`);
            
            // Analysis phase
            setProgressStage('analyze', 'active');
            setProgressStage('extract', 'complete');
            setProgressDetail(`Analyse de ${file.name} par l'IA...`);
            
            // Décider si on utilise le streaming ou l'API standard
            if (useStreaming(file)) {
                // Streaming API
                await handleStreamingAnalysis(file, formData, i);
            } else {
                // Standard API
                await handleStandardAnalysis(file, formData, i);
            }
            
        } catch (error) {
            console.error('Error:', error);
            setProgressStage('analyze', 'error');
            setProgressDetail(`Erreur: ${error.message}`);
            
            // Still show any successful results
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
    resultContainer.classList.remove('hidden');
    
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
    // Show result container
    resultContainer.classList.remove('hidden');
    
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

// Display a single result
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
    } else {
        // Display raw JSON if format is unexpected
        resultContent.innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
        console.error('Unexpected response format:', result);
    }
}

// Format markdown content
function formatMarkdown(text) {
    // This is a more comprehensive markdown formatter
    
    // Code blocks
    text = text.replace(/```([a-z]*)\n([\s\S]+?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    
    // Headers
    text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
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
    // This is a simplified table parser
    const tableRegex = /\n((?:\|[^\n]+\|\n)+)/g;
    const headerRowRegex = /\|(.+)\|\n\|([-:| ]+)\|\n/;
    
    text = text.replace(tableRegex, (match) => {
        // Check if it has a header row
        const headerMatch = match.match(headerRowRegex);
        let table = '<table>';
        
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
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');
}

// Reset UI to initial state
function resetUI() {
    // Reset file selection
    fileInput.value = '';
    selectedFiles = [];
    updateFileList();
    
    // Reset instruction
    instructionInput.value = '';
    
    // Reset preview variables (element no longer exists)
    currentPreviewFile = null;
    
    // Hide progress and results
    progressContainer.classList.add('hidden');
    resultContainer.classList.add('hidden');
    
    // Disable analyze button
    analyzeBtn.disabled = true;
    
    // Clear results
    analysisResults = {};
    
    // Close any ongoing streams
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
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
    
    // Check if user has a preferred theme
    if (localStorage.getItem('theme') === 'dark' || 
        (window.matchMedia('(prefers-color-scheme: dark)').matches && !localStorage.getItem('theme'))) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.checked = true;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
