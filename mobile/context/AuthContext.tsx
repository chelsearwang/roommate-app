import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '../utils/api';
import { Platform } from 'react-native';

import { GoogleSignin } from '@react-native-google-signin/google-signin';

if (Platform.OS !== 'web') {
  GoogleSignin.configure({
    webClientId: '400883289925-r5bkta8ed5ad48jbuu347u2i33urrhp0.apps.googleusercontent.com',
    iosClientId: '400883289925-f6b3mgu4q7a3che8ar64p5t0rivmhp6c.apps.googleusercontent.com',
  });
}

type User = {
  id: string;
  name: string;
  xp: number;
  avatarLevel: number;
  householdId: string | null;
};

type AuthContextType = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (name: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStoredAuth() {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        const storedUser = await AsyncStorage.getItem('user');
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadStoredAuth();
  }, []);

  async function login(name: string) {
    const data = await apiRequest('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    await AsyncStorage.setItem('token', data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }

  async function loginWithGoogleIdToken(idToken: string) {
    const data = await apiRequest('/auth/google/mobile', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    await AsyncStorage.setItem('token', data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }

  async function loginWithGoogle() {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    const idToken = response.data?.idToken;
    if (!idToken) throw new Error('No ID token returned from Google');
    await loginWithGoogleIdToken(idToken);
  }

  async function logout() {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }

  async function refreshUser() {
    if (!token) return;
    const data = await apiRequest('/me', {}, token);
    setUser(data.user);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    }

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout, refreshUser, loginWithGoogle, loginWithGoogleIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}