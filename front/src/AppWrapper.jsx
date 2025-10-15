import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import App from './app.jsx';

export default function AppWrapper() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}