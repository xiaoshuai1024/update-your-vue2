import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.join(path.dirname(__filename), '..');
const distDir = path.join(projectRoot, 'dist');

function addJsExtension(content, filePath) {
  const fileDir = path.dirname(filePath);
  
  return content.replace(/(from ["'])(\.\.?\/[^'"]+)(["'])/g, (match, prefix, importPath, suffix) => {
    if (importPath.endsWith('.js')) return match;
    
    let resolvedPath;
    const importFullPath = path.resolve(fileDir, importPath);
    
    if (fs.existsSync(importFullPath) && fs.statSync(importFullPath).isDirectory()) {
      resolvedPath = path.join(importFullPath, 'index.js');
    } else {
      resolvedPath = importFullPath + '.js';
    }
    
    let relativePath = path.relative(fileDir, resolvedPath).replace(/\\/g, '/');
    
    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath;
    }
    
    return prefix + relativePath + suffix;
  });
}

function processFile(filePath) {
  if (!filePath.endsWith('.js')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  const newContent = addJsExtension(content, filePath);
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log('Fixed:', filePath);
  }
}

function walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else {
      processFile(fullPath);
    }
  }
}

walkDir(distDir);
console.log('Done!');
