import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as authApi from '../api/auth.js';
import { errorMessage, setUnauthorizedHandler, tokenStore } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // True until we know whether the saved token is still valid.
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));
  // Shown on the login page after an automatic logout.
  const [notice, setNotice] = useState('');

  const logout = useCallback((reason = '') => {
    tokenStore.clear();
    setUser(null);
    // Keep a notice already set by the 401 handler when called without a reason.
    if (typeof reason === 'string' && reason) setNotice(reason);
  }, []);

  // Set when the saved login couldn't be checked because the server is down.
  const [connectionError, setConnectionError] = useState('');

  // Check the saved login. Only a 401 (login rejected) logs out; if the server
  // can't be reached the login is kept and a "retry" screen is shown instead.
  const checkSession = useCallback(() => {
    if (!tokenStore.get()) return;
    setLoading(true);
    setConnectionError('');
    authApi
      .getMe()
      .then(setUser)
      .catch((err) => {
        if (err.response?.status === 401) logout();
        else setConnectionError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [logout]);

  useEffect(() => {
    setUnauthorizedHandler((message) => logout(message || 'Your session ended. Please log in again.'));
    checkSession();
  }, [logout, checkSession]);

  const startSession = ({ token, user: loggedIn }) => {
    tokenStore.set(token);
    setNotice('');
    setUser(loggedIn);
  };

  const login = async (email, password) => startSession(await authApi.login({ email, password }));
  const register = async (name, email, password) => startSession(await authApi.register({ name, email, password }));

  return (
    <AuthContext.Provider value={{ user, loading, notice, connectionError, checkSession, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
