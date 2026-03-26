const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const simpleGit = require('simple-git');

const app = express();
const PORT = process.env.PORT || 3020;

// Middlewares
app.use(express.json());
app.use(express.static('public'));
app.use(cors());

// Base directory for file operations
const BASE_DIR = path.join(__dirname, 'documents');

// Initialize git for the repository
const git = simpleGit(__dirname);

// Helper function to commit and push changes
async function commitAndPush(message) {
  try {
    // Check if this is a git repository
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      console.log('Not a git repository. Skipping git operations.');
      return;
    }

    // Add all changes
    await git.add('.');
    
    // Check if there are any changes to commit
    const status = await git.status();
    if (status.files.length === 0) {
      console.log('No changes to commit');
      return;
    }

    // Commit changes
    await git.commit(message);
    
    // Push changes
    await git.push();
    console.log(`✓ Committed and pushed: ${message}`);
  } catch (error) {
    console.error('Git operation failed:', error.message);
    // Don't throw error to avoid breaking file operations
  }
}

// Ensure documents directory exists
async function ensureDocumentsDir() {
  try {
    await fs.access(BASE_DIR);
  } catch {
    await fs.mkdir(BASE_DIR, { recursive: true });
  }
}

// Helper function to get full path
function getFullPath(relativePath) {
  const fullPath = path.join(BASE_DIR, relativePath || '');
  // Ensure path is within BASE_DIR for security
  if (!fullPath.startsWith(BASE_DIR)) {
    throw new Error('Invalid path');
  }
  return fullPath;
}

// Get file tree structure
async function getFileTree(dirPath = BASE_DIR, basePath = '') {
  const tree = [];
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const relativePath = path.join(basePath, item.name).replace(/\\/g, '/');
      const itemPath = path.join(dirPath, item.name);
      
      if (item.isDirectory()) {
        const children = await getFileTree(itemPath, relativePath);
        tree.push({
          name: item.name,
          path: relativePath,
          type: 'folder',
          children
        });
      } else {
        tree.push({
          name: item.name,
          path: relativePath,
          type: 'file'
        });
      }
    }
  } catch (error) {
    console.error('Error reading directory:', error);
  }
  
  return tree.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'folder' ? -1 : 1;
  });
}

// Search through files and content
async function searchFiles(searchTerm, dirPath = BASE_DIR, basePath = '', results = []) {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const relativePath = path.join(basePath, item.name).replace(/\\/g, '/');
      const itemPath = path.join(dirPath, item.name);
      
      if (item.isDirectory()) {
        // Search folder name
        const nameMatches = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const pathMatches = relativePath.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (nameMatches || pathMatches) {
          results.push({
            name: item.name,
            path: relativePath,
            type: 'folder',
            matchType: 'filename',
            matchText: nameMatches ? item.name : relativePath
          });
        }
        
        // Recursively search subdirectory
        await searchFiles(searchTerm, itemPath, relativePath, results);
      } else {
        const nameMatches = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const pathMatches = relativePath.toLowerCase().includes(searchTerm.toLowerCase());
        let contentMatches = false;
        let matchedLines = [];
        
        // Only search content in text files (md, txt, js, html, css, etc.)
        const textExtensions = ['.md', '.txt', '.js', '.html', '.css', '.json', '.xml', '.yml', '.yaml'];
        const isTextFile = textExtensions.some(ext => 
          item.name.toLowerCase().endsWith(ext)
        );
        
        if (isTextFile) {
          try {
            const content = await fs.readFile(itemPath, 'utf8');
            const lines = content.split('\n');
            
            lines.forEach((line, index) => {
              if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
                contentMatches = true;
                matchedLines.push({
                  lineNumber: index + 1,
                  text: line.trim(),
                  context: lines.slice(Math.max(0, index - 1), index + 2).map(l => l.trim())
                });
              }
            });
          } catch (error) {
            // Skip files that can't be read
            console.error(`Error reading file ${itemPath}:`, error.message);
          }
        }
        
        if (nameMatches || pathMatches || contentMatches) {
          const matchType = contentMatches ? 'content' : 'filename';
          results.push({
            name: item.name,
            path: relativePath,
            type: 'file',
            matchType: matchType,
            matchText: nameMatches ? item.name : pathMatches ? relativePath : '',
            matchedLines: contentMatches ? matchedLines : [],
            contentPreview: contentMatches ? matchedLines[0]?.text : null
          });
        }
      }
    }
  } catch (error) {
    console.error('Error searching directory:', error);
  }
  
  return results;
}

// API Routes

// Get file tree
app.get('/api/tree', async (req, res) => {
  try {
    const tree = await getFileTree();
    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search files and content
app.get('/api/search', async (req, res) => {
  try {
    const { q, content } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters long' });
    }
    
    const includeContent = content === 'true' || content === '1';
    let results;
    
    if (includeContent) {
      // Search both filenames and content
      results = await searchFiles(q.trim());
    } else {
      // Search only filenames (original tree-based search)
      const tree = await getFileTree();
      results = filterTreeSearch(tree, q.trim());
    }
    
    res.json({
      searchTerm: q.trim(),
      includeContent: includeContent,
      results: results,
      totalResults: results.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function for filename-only search (for backward compatibility)
function filterTreeSearch(tree, searchTerm, results = []) {
  tree.forEach(item => {
    const nameMatches = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const pathMatches = item.path.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (nameMatches || pathMatches) {
      results.push({
        ...item,
        matchType: 'filename',
        matchText: nameMatches ? item.name : item.path
      });
    }
    
    if (item.children) {
      filterTreeSearch(item.children, searchTerm, results);
    }
  });
  
  return results;
}

// Create folder
app.post('/api/folder', async (req, res) => {
  try {
    const { path: folderPath, name } = req.body;
    const fullPath = getFullPath(path.join(folderPath || '', name));
    
    await fs.mkdir(fullPath, { recursive: true });
    
    // Commit and push changes
    const relativePath = path.join(folderPath || '', name).replace(/\\/g, '/');
    await commitAndPush(`Create folder: ${relativePath}`);
    
    res.json({ success: true, message: 'Folder created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create file
app.post('/api/file', async (req, res) => {
  try {
    const { path: filePath, name, content = '' } = req.body;
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const fullPath = getFullPath(path.join(filePath || '', fileName));
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    await fs.writeFile(fullPath, content, 'utf8');
    
    // Commit and push changes
    const relativePath = path.join(filePath || '', fileName).replace(/\\/g, '/');
    await commitAndPush(`Create file: ${relativePath}`);
    
    res.json({ success: true, message: 'File created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read file content
app.get('/api/file/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    const fullPath = getFullPath(filePath);
    
    const content = await fs.readFile(fullPath, 'utf8');
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update file content
app.put('/api/file/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    const { content } = req.body;
    const fullPath = getFullPath(filePath);
    
    await fs.writeFile(fullPath, content, 'utf8');
    
    // Commit and push changes
    await commitAndPush(`Update file: ${filePath}`);
    
    res.json({ success: true, message: 'File updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete file or folder
app.delete('/api/item/*', async (req, res) => {
  try {
    const itemPath = req.params[0];
    const fullPath = getFullPath(itemPath);
    
    const stats = await fs.stat(fullPath);
    if (stats.isDirectory()) {
      await fs.rmdir(fullPath, { recursive: true });
      await commitAndPush(`Delete folder: ${itemPath}`);
    } else {
      await fs.unlink(fullPath);
      await commitAndPush(`Delete file: ${itemPath}`);
    }
    
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function startServer() {
  await ensureDocumentsDir();
  app.listen(PORT, () => {
    console.log(`File Tree Explorer running at http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);