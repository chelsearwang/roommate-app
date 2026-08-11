import { useState } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { CozyButton } from '../components/CozyButton';
import { colors, radius } from '../constants/colors';
import { Platform } from 'react-native';
import { GoogleWebSignInButton } from '@/components/GoogleWebSignInButton';

export default function LoginScreen() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { login, loginWithGoogle, loginWithGoogleIdToken } = useAuth();

  async function handleLogin() {
    setError('');
    try {
      await login(name);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleGoogleLogin() {
    setError('');
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Household Platform</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        placeholderTextColor="#999"
        value={name}
        onChangeText={setName}
      />
      <CozyButton title="Log in" onPress={handleLogin} />
      {Platform.OS === 'web' ? (
        /*
        <GoogleWebSignInButton
          onIdToken={async (idToken) => {
            try { await loginWithGoogleIdToken(idToken); } catch (err: any) { setError(err.message); }
          }}
          onError={setError}
        />
        */
       <GoogleWebSignInButton onError={setError} />
      ) : (
        <CozyButton title="Sign in with Google" variant="secondary" onPress={handleGoogleLogin} />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  error: { color: '#B5544A', marginTop: 12, textAlign: 'center' },
});