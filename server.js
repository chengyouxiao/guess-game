// Minimal Express server to serve the static site on Azure App Service (Linux)
// Uses PORT provided by the environment (App Service), defaults to 8080 locally.

const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// Serve static assets from the repo root
app.use(express.static(path.join(__dirname), {
  index: 'index.html',
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    // Basic hardening headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  }
}));

// Fallback to index.html for unknown routes (useful if we add more pages later)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

module.exports = app;
