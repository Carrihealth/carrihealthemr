import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('carri_token');
    if (!savedToken) {
      setLoading(false);
      return;
    }
    setToken(savedToken);
    api.get('/auth/me')
      .then((res) => setUser(res.data.data))
      .catch(() => {
        localStorage.clear();
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password, hospital_code) {
    const res = await api.post('/auth/login', { email, password, hospital_code });
    const { token: jwt, user: userData, hospital } = res.data;
    localStorage.setItem('carri_token', jwt);
    setToken(jwt);
    setUser({ ...userData, hospital });
    return res.data;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Proceed regardless
    }
    localStorage.clear();
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
