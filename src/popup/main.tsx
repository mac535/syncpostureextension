import React from 'react';
import ReactDOM from 'react-dom/client';
import { Popup } from './Popup';
import '../index.css';

const rootElem = document.getElementById('root');
if (rootElem) {
  ReactDOM.createRoot(rootElem).render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>
  );
}
