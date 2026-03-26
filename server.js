const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3020;

// Middlewares
app.use(express.json());
app.use(express.static('public'));
app.use(cors());

// Base directory for file operations
const BASE_DIR = path.join(__dirname, 'documents');

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

// Create folder
app.post('/api/folder', async (req, res) => {
  try {
    const { path: folderPath, name } = req.body;
    const fullPath = getFullPath(path.join(folderPath || '', name));
    
    await fs.mkdir(fullPath, { recursive: true });
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
    } else {
      await fs.unlink(fullPath);
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