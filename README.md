# File Tree Explorer

A Node.js web application that provides a visual file tree interface for managing folders and markdown documents. Users can create, view, edit, and organize files through a clean web interface, with all operations reflected in the actual file system.

## Features

- **Visual File Tree**: Browse files and folders in an intuitive tree structure
- **Create Folders**: Add new folders to organize your content
- **Create Documents**: Create new markdown documents with a built-in editor
- **Edit Files**: In-browser editing with real-time preview for markdown files
- **File Management**: Delete files and folders with context menu
- **Responsive Design**: Works on desktop and mobile devices
- **Real File System**: All operations create actual files and folders on the server

## Tech Stack

- **Backend**: Node.js with Express.js
- **Frontend**: Vanilla HTML, CSS, and JavaScript
- **File Format**: Markdown (.md) files
- **Styling**: CSS3 with Font Awesome icons

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation

1. Navigate to the project directory:
   ```bash
   cd file-tree-explorer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   
   Or for production:
   ```bash
   npm start
   ```

4. Open your browser and go to:
   ```
   http://localhost:3000
   ```

## Usage

### Creating Folders
1. Click the "New Folder" button in the toolbar
2. Enter a folder name in the modal
3. Click "Create" to add the folder to the current location

### Creating Documents
1. Click the "New Document" button in the toolbar
2. Enter a document name (`.md` extension will be added automatically)
3. Click "Create" to create the document with default content

### Editing Files
1. Click on any file in the tree to view its content
2. Click the "Edit" button to switch to edit mode
3. Make your changes in the text editor
4. Click "Save" to save changes or "Cancel" to discard

### Deleting Items
1. Right-click on any file or folder in the tree
2. Confirm the deletion in the popup dialog

## File Structure

```
file-tree-explorer/
├── server.js              # Main Express server
├── package.json           # Project dependencies and scripts
├── public/                # Frontend static files
│   ├── index.html         # Main HTML page
│   ├── styles.css         # CSS styling
│   └── script.js          # Frontend JavaScript
├── documents/             # User-created files and folders
└── README.md             # This file
```

## API Endpoints

- `GET /api/tree` - Get the file tree structure
- `POST /api/folder` - Create a new folder
- `POST /api/file` - Create a new file
- `GET /api/file/*` - Read file content
- `PUT /api/file/*` - Update file content
- `DELETE /api/item/*` - Delete file or folder

## Security Notes

- File operations are restricted to the `documents/` directory
- Path traversal attacks are prevented by path validation
- No file upload functionality prevents malicious file uploads

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License - See package.json for details