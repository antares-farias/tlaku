class FileTreeExplorer {
    constructor() {
        this.currentPath = '';
        this.currentFile = null;
        this.isEditing = false;
        this.originalContent = '';
        this.collapsedFolders = new Set(); // Track collapsed folders
        
        // Initialize theme
        this.initTheme();
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadFileTree();
    }

    bindEvents() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Toolbar buttons
        document.getElementById('createFolderBtn').addEventListener('click', () => {
            this.showCreateModal('folder');
        });
        
        document.getElementById('createFileBtn').addEventListener('click', () => {
            this.showCreateModal('file');
        });
        
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadFileTree();
        });

        // File viewer actions
        document.getElementById('editBtn').addEventListener('click', () => {
            this.enterEditMode();
        });
        
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveFile();
        });
        
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.cancelEdit();
        });

        // Markdown formatting buttons
        document.querySelector('#markdownToolbar').addEventListener('click', (e) => {
            if (e.target.closest('.format-btn')) {
                const action = e.target.closest('.format-btn').dataset.action;
                this.insertMarkdown(action);
            }
        });

        // Keyboard shortcuts for editing
        document.getElementById('fileEditor').addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'b':
                        e.preventDefault();
                        this.insertMarkdown('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.insertMarkdown('italic');
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveFile();
                        break;
                }
            }
        });

        // Modal events
        document.getElementById('modalClose').addEventListener('click', () => {
            this.hideModal();
        });
        
        document.getElementById('modalCancel').addEventListener('click', () => {
            this.hideModal();
        });
        
        document.getElementById('modalCreate').addEventListener('click', () => {
            this.createItem();
        });
        
        // Modal keyboard events
        document.getElementById('itemName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createItem();
            }
        });

        // Close modal when clicking outside
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.hideModal();
            }
        });
    }

    async loadFileTree() {
        try {
            this.showLoading(true);
            const response = await fetch('/api/tree');
            const tree = await response.json();
            this.renderFileTree(tree);
        } catch (error) {
            this.showError('Failed to load file tree: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    // Theme management methods
    initTheme() {
        const savedTheme = localStorage.getItem('file-tree-theme') || 'light';
        this.setTheme(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('file-tree-theme', theme);
        
        // Update theme toggle button icon
        const themeToggle = document.getElementById('themeToggle');
        const icon = themeToggle.querySelector('i');
        
        if (theme === 'dark') {
            icon.className = 'fas fa-sun';
            themeToggle.title = 'Switch to Light Theme';
        } else {
            icon.className = 'fas fa-moon';
            themeToggle.title = 'Switch to Dark Theme';
        }
    }

    renderFileTree(tree, container = null, level = 0) {
        if (!container) {
            container = document.getElementById('fileTree');
            container.innerHTML = '';
        }

        tree.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = `tree-item ${item.type}`;
            itemElement.style.paddingLeft = `${level * 1}rem`;
            
            let itemHTML = '';
            
            if (item.type === 'folder') {
                // Add expand/collapse icon for folders
                const isCollapsed = this.collapsedFolders.has(item.path);
                const expandIcon = isCollapsed ? 
                    '<i class="fas fa-chevron-right"></i>' : 
                    '<i class="fas fa-chevron-down"></i>';
                
                itemHTML = `
                    <span class="expand-icon ${isCollapsed ? '' : 'expanded'}" data-path="${item.path}">
                        ${expandIcon}
                    </span>
                    <i class="fas fa-folder folder-icon"></i>
                    <span class="folder-name">${item.name}</span>
                `;
            } else {
                itemHTML = `
                    <span style="width: 20px;"></span>
                    <i class="fas fa-file-alt"></i>
                    <span>${item.name}</span>
                `;
            }
            
            itemElement.innerHTML = itemHTML;
            
            // Add click event for item selection
            itemElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectItem(item, itemElement);
            });

            // Add context menu for delete
            itemElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showContextMenu(e, item);
            });
            
            // Add expand/collapse functionality for folders
            if (item.type === 'folder') {
                const expandIcon = itemElement.querySelector('.expand-icon');
                expandIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleFolder(item.path, itemElement);
                });
            }

            container.appendChild(itemElement);

            // Render children if folder is not collapsed
            if (item.children && item.children.length > 0) {
                const childrenContainer = document.createElement('div');
                const isCollapsed = this.collapsedFolders.has(item.path);
                childrenContainer.className = `tree-children ${isCollapsed ? 'collapsed' : ''}`;
                container.appendChild(childrenContainer);
                
                if (!isCollapsed) {
                    this.renderFileTree(item.children, childrenContainer, level + 1);
                }
            }
        });
    }

    selectItem(item, element) {
        // Remove previous selection
        document.querySelectorAll('.tree-item.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Add selection to current item
        element.classList.add('selected');
        
        if (item.type === 'folder') {
            this.currentPath = item.path;
            this.hideFileViewer();
        } else {
            this.currentFile = item;
            this.loadFile(item.path);
        }
    }

    toggleFolder(folderPath, itemElement) {
        const isCurrentlyCollapsed = this.collapsedFolders.has(folderPath);
        const expandIcon = itemElement.querySelector('.expand-icon');
        const childrenContainer = itemElement.nextElementSibling;
        
        if (isCurrentlyCollapsed) {
            // Expand the folder
            this.collapsedFolders.delete(folderPath);
            expandIcon.classList.add('expanded');
            expandIcon.innerHTML = '<i class="fas fa-chevron-down"></i>';
            
            if (childrenContainer && childrenContainer.classList.contains('tree-children')) {
                childrenContainer.classList.remove('collapsed');
                
                // Re-render children if they haven't been rendered yet
                if (childrenContainer.children.length === 0) {
                    this.renderChildrenForFolder(folderPath, childrenContainer);
                }
            }
        } else {
            // Collapse the folder
            this.collapsedFolders.add(folderPath);
            expandIcon.classList.remove('expanded');
            expandIcon.innerHTML = '<i class="fas fa-chevron-right"></i>';
            
            if (childrenContainer && childrenContainer.classList.contains('tree-children')) {
                childrenContainer.classList.add('collapsed');
            }
        }
    }

    async renderChildrenForFolder(folderPath, container) {
        try {
            const response = await fetch('/api/tree');
            const tree = await response.json();
            
            // Find the folder in the tree and render its children
            const folder = this.findFolderInTree(tree, folderPath);
            if (folder && folder.children) {
                const level = (folderPath.split('/').length - 1) + 1;
                this.renderFileTree(folder.children, container, level);
            }
        } catch (error) {
            console.error('Failed to load folder contents:', error);
        }
    }

    findFolderInTree(tree, targetPath) {
        for (const item of tree) {
            if (item.path === targetPath) {
                return item;
            }
            if (item.children) {
                const found = this.findFolderInTree(item.children, targetPath);
                if (found) return found;
            }
        }
        return null;
    }

    async loadFile(filePath) {
        try {
            this.showLoading(true);
            const response = await fetch(`/api/file/${filePath}`);
            const data = await response.json();
            
            if (response.ok) {
                this.showFileContent(filePath, data.content);
            } else {
                this.showError('Failed to load file: ' + data.error);
            }
        } catch (error) {
            this.showError('Failed to load file: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    showFileContent(filePath, content) {
        this.originalContent = content;
        
        // Show file viewer
        document.getElementById('welcomeMessage').classList.add('hidden');
        document.getElementById('fileViewer').classList.remove('hidden');
        
        // Set file name
        document.getElementById('fileName').textContent = filePath;
        
        // Render markdown content
        const fileContent = document.getElementById('fileContent');
        if (filePath.endsWith('.md')) {
            fileContent.innerHTML = this.parseMarkdown(content);
        } else {
            fileContent.innerHTML = `<pre><code>${this.escapeHtml(content)}</code></pre>`;
        }
        
        // Set up editor
        document.getElementById('fileEditor').value = content;
        
        // Reset edit mode
        this.exitEditMode();
    }

    parseMarkdown(text) {
        // Simple markdown parser - in a real app, you'd use a library like 'marked'
        let html = text
            .replace(/^\# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^\## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^\### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^\#### (.*$)/gm, '<h4>$1</h4>')
            .replace(/^\##### (.*$)/gm, '<h5>$1</h5>')
            .replace(/^\###### (.*$)/gm, '<h6>$1</h6>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/^\> (.*$)/gm, '<blockquote>$1</blockquote>')
            .replace(/^\- (.*$)/gm, '<ul><li>$1</li></ul>')
            .replace(/^\d+\. (.*$)/gm, '<ol><li>$1</li></ol>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        return `<p>${html}</p>`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    enterEditMode() {
        this.isEditing = true;
        document.getElementById('fileContent').classList.add('hidden');
        document.getElementById('fileEditor').classList.remove('hidden');
        document.getElementById('editBtn').classList.add('hidden');
        document.getElementById('saveBtn').classList.remove('hidden');
        document.getElementById('cancelBtn').classList.remove('hidden');
        
        // Show markdown toolbar if editing a markdown file
        if (this.currentFile && this.currentFile.path.endsWith('.md')) {
            document.getElementById('markdownToolbar').classList.remove('hidden');
        }
        
        document.getElementById('fileEditor').focus();
    }

    exitEditMode() {
        this.isEditing = false;
        document.getElementById('fileContent').classList.remove('hidden');
        document.getElementById('fileEditor').classList.add('hidden');
        document.getElementById('editBtn').classList.remove('hidden');
        document.getElementById('saveBtn').classList.add('hidden');
        document.getElementById('cancelBtn').classList.add('hidden');
        
        // Hide markdown toolbar
        document.getElementById('markdownToolbar').classList.add('hidden');
    }

    cancelEdit() {
        document.getElementById('fileEditor').value = this.originalContent;
        this.exitEditMode();
    }

    async saveFile() {
        if (!this.currentFile) return;
        
        try {
            this.showLoading(true);
            const content = document.getElementById('fileEditor').value;
            
            const response = await fetch(`/api/file/${this.currentFile.path}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.originalContent = content;
                this.showFileContent(this.currentFile.path, content);
                this.showSuccess('File saved successfully');
            } else {
                this.showError('Failed to save file: ' + data.error);
            }
        } catch (error) {
            this.showError('Failed to save file: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    showCreateModal(type) {
        document.getElementById('modalTitle').textContent = 
            type === 'folder' ? 'Create New Folder' : 'Create New Document';
        document.getElementById('itemName').placeholder = 
            type === 'folder' ? 'Enter folder name...' : 'Enter document name...';
        document.getElementById('currentPath').textContent = this.currentPath || '/';
        document.getElementById('itemName').value = '';
        
        document.getElementById('modal').classList.remove('hidden');
        document.getElementById('modal').dataset.type = type;
        document.getElementById('itemName').focus();
    }

    hideModal() {
        document.getElementById('modal').classList.add('hidden');
    }

    async createItem() {
        const type = document.getElementById('modal').dataset.type;
        const name = document.getElementById('itemName').value.trim();
        
        if (!name) {
            this.showError('Please enter a name');
            return;
        }
        
        try {
            this.showLoading(true);
            
            const endpoint = type === 'folder' ? '/api/folder' : '/api/file';
            const body = {
                path: this.currentPath,
                name: name,
                content: type === 'file' ? '# ' + name + '\n\nWrite your content here...' : undefined
            };
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.hideModal();
                this.loadFileTree();
                this.showSuccess(data.message);
            } else {
                this.showError('Failed to create item: ' + data.error);
            }
        } catch (error) {
            this.showError('Failed to create item: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    showContextMenu(event, item) {
        // Simple delete confirmation for now
        if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
            this.deleteItem(item);
        }
    }

    async deleteItem(item) {
        try {
            this.showLoading(true);
            
            const response = await fetch(`/api/item/${item.path}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.loadFileTree();
                this.hideFileViewer();
                this.showSuccess(data.message);
            } else {
                this.showError('Failed to delete item: ' + data.error);
            }
        } catch (error) {
            this.showError('Failed to delete item: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    hideFileViewer() {
        document.getElementById('fileViewer').classList.add('hidden');
        document.getElementById('welcomeMessage').classList.remove('hidden');
        document.getElementById('markdownToolbar').classList.add('hidden');
        this.currentFile = null;
    }

    insertMarkdown(action) {
        const editor = document.getElementById('fileEditor');
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        const beforeText = editor.value.substring(0, start);
        const afterText = editor.value.substring(end);
        
        let newText = '';
        let newCursorPos = start;
        
        switch (action) {
            case 'bold':
                newText = `**${selectedText || 'bold text'}**`;
                newCursorPos = selectedText ? end + 4 : start + 2;
                break;
                
            case 'italic':
                newText = `*${selectedText || 'italic text'}*`;
                newCursorPos = selectedText ? end + 2 : start + 1;
                break;
                
            case 'strikethrough':
                newText = `~~${selectedText || 'strikethrough text'}~~`;
                newCursorPos = selectedText ? end + 4 : start + 2;
                break;
                
            case 'h1':
                newText = `# ${selectedText || 'Header 1'}`;
                newCursorPos = selectedText ? end + 2 : start + 2;
                break;
                
            case 'h2':
                newText = `## ${selectedText || 'Header 2'}`;
                newCursorPos = selectedText ? end + 3 : start + 3;
                break;
                
            case 'h3':
                newText = `### ${selectedText || 'Header 3'}`;
                newCursorPos = selectedText ? end + 4 : start + 4;
                break;
                
            case 'list':
                const listText = selectedText || 'List item';
                newText = `- ${listText}`;
                newCursorPos = selectedText ? end + 2 : start + 2;
                break;
                
            case 'orderedList':
                const orderedText = selectedText || 'List item';
                newText = `1. ${orderedText}`;
                newCursorPos = selectedText ? end + 3 : start + 3;
                break;
                
            case 'quote':
                newText = `> ${selectedText || 'Quote'}`;
                newCursorPos = selectedText ? end + 2 : start + 2;
                break;
                
            case 'link':
                const linkText = selectedText || 'link text';
                newText = `[${linkText}](url)`;
                newCursorPos = selectedText ? end + 3 : start + linkText.length + 3;
                break;
                
            case 'image':
                const altText = selectedText || 'alt text';
                newText = `![${altText}](image-url)`;
                newCursorPos = selectedText ? end + 4 : start + altText.length + 4;
                break;
                
            case 'code':
                newText = `\`${selectedText || 'code'}\``;
                newCursorPos = selectedText ? end + 2 : start + 1;
                break;
                
            case 'codeBlock':
                newText = `\`\`\`\n${selectedText || 'code'}\n\`\`\``;
                newCursorPos = selectedText ? end + 8 : start + 4;
                break;
                
            default:
                return;
        }
        
        editor.value = beforeText + newText + afterText;
        editor.focus();
        editor.setSelectionRange(newCursorPos, newCursorPos);
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    showError(message) {
        // Simple error notification - in a real app, you'd use a proper notification system
        alert('Error: ' + message);
    }

    showSuccess(message) {
        // Simple success notification - in a real app, you'd use a proper notification system
        alert('Success: ' + message);
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new FileTreeExplorer();
});