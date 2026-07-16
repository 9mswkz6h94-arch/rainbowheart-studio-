import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const isStickTest =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('stick-test');

if (isStickTest) {
  import('./dev/StickTest').then(({ default: StickTest }) => {
    ReactDOM.createRoot(rootElement).render(<StickTest />);
  });
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
}
