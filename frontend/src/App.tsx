import React, { useState } from 'react';
import { WebSocketProvider } from './context/WebScoketContext';
import Login from './components/Login';
import MainLayout from './components/MainLayout';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  React.useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = (newToken: string) => {
    setToken(newToken);
    setIsLoggedIn(true);
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <WebSocketProvider>
      <MainLayout />
    </WebSocketProvider>
  );
};

export default App;