// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const simpleGit = require('simple-git');

// Environment variable validation configuration for Japanese and Latin lists
const ENV_VALIDATION_RULES = {
  // Latin character lists validation
  LATIN_LIST_1: { min: 10, max: 100, exact: null, range: [10, 100] },
  LATIN_LIST_2: { min: 10, max: 100, exact: null, range: [10, 100] },
  LATIN_LIST_3: { min: 10, max: 100, exact: null, range: [10, 100] },
  
  // Japanese character lists validation  
  JAPANESE_LIST_1: { min: 20, max: 500, exact: null, range: [20, 500] },
  JAPANESE_LIST_2: { min: 20, max: 200, exact: null, range: [20, 200] },
  JAPANESE_LIST_3: { min: 10, max: 200, exact: null, range: [10, 200] }
};

/**
 * Load and validate Japanese and Latin list environment variables for length consistency
 * @param {Object} customRules - Optional custom validation rules to override defaults
 * @returns {Object} - Validation result with status and details
 */
function loadAndCheckEnvVariables(customRules = {}) {
  const results = {
    status: 'success',
    validVariables: [],
    invalidVariables: [],
    warnings: [],
    summary: {
      total: 0,
      valid: 0,
      invalid: 0
    }
  };

  // Merge custom rules with default rules
  const rules = { ...ENV_VALIDATION_RULES, ...customRules };
  
  // Filter to only check Japanese and Latin list variables
  const targetVariables = Object.keys(rules).filter(key => 
    key.startsWith('LATIN_LIST_') || key.startsWith('JAPANESE_LIST_')
  );
  
  results.summary.total = targetVariables.length;
  
  console.log(`🔍 Validating ${targetVariables.length} Japanese and Latin list variables...`);
  
  for (const key of targetVariables) {
    const value = process.env[key];
    
    if (value === undefined || value === null) {
      results.invalidVariables.push({
        name: key,
        length: 0,
        value: 'undefined',
        errors: ['Environment variable not found'],
        rules: rules[key]
      });
      results.summary.invalid++;
      results.status = 'warning';
      console.warn(`⚠️  ENV VAR "${key}": Environment variable not found`);
      results.warnings.push(`${key}: Environment variable not found`);
      continue;
    }
    
    const validation = validateSingleEnvVar(key, value, rules);
    
    if (validation.isValid) {
      results.validVariables.push({
        name: key,
        length: value.length,
        rules: validation.appliedRules,
        preview: value.substring(0, 20) + (value.length > 20 ? '...' : '')
      });
      results.summary.valid++;
    } else {
      results.invalidVariables.push({
        name: key,
        length: value.length,
        value: value.substring(0, 20) + (value.length > 20 ? '...' : ''),
        errors: validation.errors,
        rules: validation.appliedRules
      });
      results.summary.invalid++;
      results.status = 'warning';
      
      // Log warning for each invalid variable
      console.warn(`⚠️  ENV VAR "${key}": ${validation.errors.join(', ')}`);
      results.warnings.push(`${key}: ${validation.errors.join(', ')}`);
    }
  }
  
  // Log summary
  console.log(`✅ Japanese/Latin list validation complete: ${results.summary.valid} valid, ${results.summary.invalid} invalid`);
  
  if (results.warnings.length > 0) {
    console.warn(`📋 Japanese/Latin list validation warnings:\n${results.warnings.map(w => `   - ${w}`).join('\n')}`);
  }
  
  return results;
}

/**
 * Validate a single environment variable against rules
 * @param {string} key - Environment variable name
 * @param {string} value - Environment variable value
 * @param {Object} rules - Validation rules object
 * @returns {Object} - Validation result for this variable
 */
function validateSingleEnvVar(key, value, rules) {
  const result = {
    isValid: true,
    errors: [],
    appliedRules: null
  };
  
  // Get rules for this specific variable
  const varRules = rules[key];
  if (!varRules) {
    result.errors.push('No validation rules defined for this variable');
    result.isValid = false;
    return result;
  }
  
  result.appliedRules = varRules;
  
  const length = value ? value.length : 0;
  
  // Check exact length requirement
  if (varRules.exact !== null && varRules.exact !== undefined) {
    if (length !== varRules.exact) {
      result.isValid = false;
      result.errors.push(`length ${length} != required exact length ${varRules.exact}`);
    }
    return result; // Skip other checks if exact length is specified
  }
  
  // Check minimum length
  if (varRules.min !== null && varRules.min !== undefined && length < varRules.min) {
    result.isValid = false;
    result.errors.push(`length ${length} < minimum ${varRules.min}`);
  }
  
  // Check maximum length
  if (varRules.max !== null && varRules.max !== undefined && length > varRules.max) {
    result.isValid = false;
    result.errors.push(`length ${length} > maximum ${varRules.max}`);
  }
  
  // Check range validation (alternative to separate min/max)
  if (varRules.range && Array.isArray(varRules.range) && varRules.range.length === 2) {
    const [rangeMin, rangeMax] = varRules.range;
    if (length < rangeMin || length > rangeMax) {
      result.isValid = false;
      result.errors.push(`length ${length} outside range [${rangeMin}-${rangeMax}]`);
    }
  }
  
  return result;
}

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

// Load character lists from environment variables
const LATIN_LISTS = [
  process.env.LATIN_LIST_1 || '',
  process.env.LATIN_LIST_2 || '',
  process.env.LATIN_LIST_3 || ''
];

const JAPANESE_LISTS = [
  process.env.JAPANESE_LIST_1 || '',
  process.env.JAPANESE_LIST_2 || '',
  process.env.JAPANESE_LIST_3 || ''
];

/**
 * Encrypt a text using Latin to Japanese character mapping with the specified formula
 * @param {string} text - Text to encrypt
 * @param {number} seed - Optional seed for reproducible randomness (default: current timestamp)
 * @returns {string} - Encrypted text
 */
function encryptText(text, seed = null) {
  if (!text) return '';
  
  // Use provided seed or current timestamp for randomness
  const randomSeed = seed !== null ? seed : Date.now();
  let seedCounter = 0;
  
  // Simple seeded random function for reproducible results
  function seededRandom() {
    const x = Math.sin(randomSeed + seedCounter++) * 10000;
    return x - Math.floor(x);
  }
  
  let encrypted = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    let listNumber = -1;
    let positionInList = -1;
    
    // Find which list the character belongs to
    for (let j = 0; j < LATIN_LISTS.length; j++) {
      const pos = LATIN_LISTS[j].indexOf(char);
      if (pos !== -1) {
        listNumber = j;
        positionInList = pos;
        break;
      }
    }
    
    // If character is not in any list, keep it as is
    if (listNumber === -1) {
      encrypted += char;
      continue;
    }
    
    const latinList = LATIN_LISTS[listNumber];
    const japaneseList = JAPANESE_LISTS[listNumber];
    
    if (!japaneseList || japaneseList.length === 0) {
      encrypted += char; // Fallback to original character
      continue;
    }
    
    // Calculate ratio as specified in formula
    const ratio = japaneseList.length / latinList.length;
    
    // Apply the formula: rand(1, ratio) * position in list
    // Interpreting "rand(1, ratio)" as random between 1 and ratio
    //const randomMultiplier = 1 + Math.random() * (ratio - 1);
    //const randomMultiplier = 2;
    const randomMultiplier = parseInt(Math.random() * ((ratio + 1) - 1) + 1);
    //const targetIndex = Math.floor(randomMultiplier * (positionInList+1))-1;
    
    // Ensure index is within bounds
    const safeIndex = ((randomMultiplier - 1) * latinList.length) + positionInList;//targetIndex % japaneseList.length;
    console.log(`Encrypting char "${char}" (list ${listNumber}, pos ${positionInList}) -> safeIndex: ${safeIndex} -> "${japaneseList[safeIndex]}" ratio: ${ratio.toFixed(2)} multiplier: ${randomMultiplier.toFixed(2)}`);
    encrypted += japaneseList[safeIndex];
  }
  
  return encrypted;
}

/**
 * Decrypt Japanese text back to Latin characters
 * Note: This is approximate due to the random nature of encryption
 * @param {string} encryptedText - Text to decrypt
 * @returns {string} - Decrypted text (best effort)
 */
function decryptText(encryptedText) {
  if (!encryptedText) return '';
  
  let decrypted = '';
  
  for (let i = 0; i < encryptedText.length; i++) {
    const char = encryptedText[i];
    let found = false;
    
    // Find which Japanese list the character belongs to
    for (let listIndex = 0; listIndex < JAPANESE_LISTS.length; listIndex++) {
      const japaneseList = JAPANESE_LISTS[listIndex];
      const latinList = LATIN_LISTS[listIndex];
      
      const posInJapanese = japaneseList.indexOf(char);
      if (posInJapanese !== -1) {
        // Reverse engineer the original position
        const ratio = japaneseList.length / latinList.length;
        
        // Estimate the original position (this is approximate due to randomness)
        //const estimatedOriginalPos = Math.floor(posInJapanese / ratio);
        const safePos = posInJapanese %latinList.length;//Math.min(estimatedOriginalPos, latinList.length - 1);
        
        decrypted += latinList[safePos];
        console.log(`Decrypting char "${char}" (list ${listIndex}, pos in Japanese: ${posInJapanese}) -> safe pos: ${safePos} -> "${latinList[safePos]}" ratio: ${ratio.toFixed(2)}`);
        found = true;
        break;
      }
    }
    
    // If character not found in any Japanese list, keep as is
    if (!found) {
      decrypted += char;
    }
  }
  
  return decrypted;
}

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

// Encryption API endpoint
app.post('/api/encrypt', (req, res) => {
  try {
    const { text, seed } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required for encryption' });
    }
    
    const encrypted = encryptText(text, seed);
    
    res.json({
      original: text,
      encrypted: encrypted,
      seed: seed || 'auto-generated',
      listsUsed: {
        latin1: LATIN_LISTS[0].length,
        latin2: LATIN_LISTS[1].length, 
        latin3: LATIN_LISTS[2].length,
        japanese1: JAPANESE_LISTS[0].length,
        japanese2: JAPANESE_LISTS[1].length,
        japanese3: JAPANESE_LISTS[2].length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Decryption API endpoint
app.post('/api/decrypt', (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required for decryption' });
    }
    
    const decrypted = decryptText(text);
    
    res.json({
      encrypted: text,
      decrypted: decrypted,
      note: 'Decryption is approximate due to randomness in encryption'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint for character lists
app.get('/api/character-lists', (req, res) => {
  try {
    res.json({
      latin: {
        list1: { characters: LATIN_LISTS[0], count: LATIN_LISTS[0].length },
        list2: { characters: LATIN_LISTS[1], count: LATIN_LISTS[1].length },
        list3: { characters: LATIN_LISTS[2], count: LATIN_LISTS[2].length }
      },
      japanese: {
        list1: { characters: JAPANESE_LISTS[0], count: JAPANESE_LISTS[0].length },
        list2: { characters: JAPANESE_LISTS[1], count: JAPANESE_LISTS[1].length },
        list3: { characters: JAPANESE_LISTS[2], count: JAPANESE_LISTS[2].length }
      },
      ratios: {
        list1: JAPANESE_LISTS[0].length / LATIN_LISTS[0].length,
        list2: JAPANESE_LISTS[1].length / LATIN_LISTS[1].length,
        list3: JAPANESE_LISTS[2].length / LATIN_LISTS[2].length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to load environment variables from .env file
app.get('/api/load-env', async (req, res) => {
  try {
    const envPath = path.join(__dirname, '.env');
    
    // Check if .env file exists
    try {
      await fs.access(envPath);
    } catch (error) {
      return res.status(404).json({ 
        error: '.env file not found',
        message: 'Create a .env file in the project root with character list variables'
      });
    }

    // Read .env file
    const envContent = await fs.readFile(envPath, 'utf8');
    
    // Parse .env content to extract character lists
    const envVars = {};
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        envVars[key.trim()] = value.trim();
      }
    }

    // Extract character lists from environment variables
    const result = {
      latin: {
        list1: { 
          characters: envVars.LATIN_LIST_1 || '',
          count: (envVars.LATIN_LIST_1 || '').length
        },
        list2: { 
          characters: envVars.LATIN_LIST_2 || '',
          count: (envVars.LATIN_LIST_2 || '').length
        },
        list3: { 
          characters: envVars.LATIN_LIST_3 || '',
          count: (envVars.LATIN_LIST_3 || '').length
        }
      },
      japanese: {
        list1: {
          characters: envVars.JAPANESE_LIST_1 || '',
          count: (envVars.JAPANESE_LIST_1 || '').length
        },
        list2: {
          characters: envVars.JAPANESE_LIST_2 || '',
          count: (envVars.JAPANESE_LIST_2 || '').length
        },
        list3: {
          characters: envVars.JAPANESE_LIST_3 || '',
          count: (envVars.JAPANESE_LIST_3 || '').length
        }
      },
      ratios: {
        list1: (envVars.JAPANESE_LIST_1 || '').length / (envVars.LATIN_LIST_1 || '').length || 0,
        list2: (envVars.JAPANESE_LIST_2 || '').length / (envVars.LATIN_LIST_2 || '').length || 0,
        list3: (envVars.JAPANESE_LIST_3 || '').length / (envVars.LATIN_LIST_3 || '').length || 0
      }
    };

    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to load .env file',
      message: error.message
    });
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

// Serve encryption test page
app.get('/encrypt-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'encrypt-test.html'));
});

// Start server
async function startServer() {
  await ensureDocumentsDir();
  
  // Validate Japanese and Latin list environment variables
  console.log('\n🔧 Starting Japanese and Latin list validation...');
  const envValidation = loadAndCheckEnvVariables();
  
  if (envValidation.status === 'warning') {
    console.log(`\n⚠️  Found ${envValidation.summary.invalid} Japanese/Latin list variable(s) with issues.`);
    console.log('Server will continue running, but please review the warnings above.\n');
  } else {
    console.log(`\n✅ All ${envValidation.summary.valid} Japanese/Latin list variables passed validation.\n`);
  }
  
  app.listen(PORT, () => {
    console.log(`File Tree Explorer running at http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);