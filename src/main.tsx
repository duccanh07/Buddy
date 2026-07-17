import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';

// Add window-type class to body for CSS scoping (pet vs settings overflow rules)
const windowParam = new URLSearchParams(window.location.search).get('window') ?? 'pet';
document.body.classList.add(`window-${windowParam}`);

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
