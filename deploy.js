// Simple deployment script to bundle everything into a single HTML file
const fs = require('fs');
const path = require('path');

// Read the main component file
const componentCode = fs.readFileSync(path.join(__dirname, 'MySQLTerminalSimulator.jsx'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// Extract just the component code (without imports)
const componentCodeOnly = componentCode
  .replace(/import.*from.*react.*;/g, '')
  .replace(/import.*from.*framer-motion.*;/g, '')
  .replace(/import.*from.*lucide-react.*;/g, '');

// Create a bundled HTML file
const bundledHtml = indexHtml.replace(
  '<script type="module" src="/main.jsx"></script>',
  `<script type="module">
    import React from 'https://esm.sh/react@18.2.0';
    import ReactDOM from 'https://esm.sh/react-dom@18.2.0/client';
    import { motion } from 'https://esm.sh/framer-motion@10.16.4';
    import { Play, Trash2, Upload, Download, Info, Database, ChevronRight, Eraser } from 'https://esm.sh/lucide-react@0.292.0';

    // Component code
    ${componentCodeOnly}
    
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(MySQLTerminalSimulator));
  </script>`
);

// Write the bundled HTML file
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), bundledHtml);
console.log('Deployment bundle created at dist/index.html');