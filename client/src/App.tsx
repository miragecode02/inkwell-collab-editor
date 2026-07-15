import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './components/AuthPage';
import { DocumentList } from './components/DocumentList';
import { DocumentPage } from './components/DocumentPage';
import { User } from './api';

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });

  const handleAuthed = (u: User) => {
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) return <AuthPage onAuthed={handleAuthed} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DocumentList user={user} onLogout={handleLogout} />} />
        <Route path="/doc/:docId" element={<DocumentPage user={user} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
