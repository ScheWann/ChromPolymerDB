const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Proxy API requests to backend
app.use('/api', createProxyMiddleware({
    target: 'http://backend:5001',
    changeOrigin: true,
    logLevel: 'info'
}));

// Serve static files from build directory
app.use(express.static(path.join(__dirname, 'build')));

// Handle React router - return index.html for non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Frontend server running on port ${PORT}`);
    console.log(`Proxying /api requests to http://backend:5001`);
}); 