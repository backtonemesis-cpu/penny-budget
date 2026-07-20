import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './mobile-navigation.css';

function resetHorizontalPosition() {
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
}

resetHorizontalPosition();
globalThis.addEventListener('pageshow', resetHorizontalPosition);
globalThis.addEventListener('orientationchange', resetHorizontalPosition);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
