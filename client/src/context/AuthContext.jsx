import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem('medikiosk_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiRequest('/api/auth/me');
      setUser(res.user);
      setPatient(res.patient || null);
    } catch {
      localStorage.removeItem('medikiosk_token');
      setUser(null);
      setPatient(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  async function login(email, password) {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    localStorage.setItem('medikiosk_token', res.token);
    setUser(res.user);
    setPatient(res.patient || null);
    return res;
  }

  async function register(payload) {
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: payload
    });
    localStorage.setItem('medikiosk_token', res.token);
    setUser(res.user);
    setPatient(res.patient || null);
    return res;
  }

  function logout() {
    localStorage.removeItem('medikiosk_token');
    setUser(null);
    setPatient(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        patient,
        setPatient,
        loading,
        login,
        register,
        logout,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
