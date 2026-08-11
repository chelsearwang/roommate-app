import { Pressable, Text, StyleSheet } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { colors, radius, shadow } from '../constants/colors';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

const WEB_CLIENT_ID = '400883289925-r5bkta8ed5ad48jbuu347u2i33urrhp0.apps.googleusercontent.com';

type Props = { onError: (message: string) => void };

export function GoogleWebSignInButton({ onError }: Props) {
  const redirectUri = AuthSession.makeRedirectUri();

  const request = AuthSession.useAuthRequest(
    {
      clientId: WEB_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.IdToken,
      usePKCE: false,
      extraParams: { nonce: Math.random().toString(36).slice(2) },
    },
    discovery
  )[0];

  return (
    <Pressable
      disabled={!request?.url}
      onPress={() => { if (request?.url) window.location.href = request.url; }}
      style={styles.button}
    >
      <Text style={styles.buttonText}>Sign in with Google</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.coral, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginBottom: 12, ...shadow },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});

/*
import { useEffect } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { colors, radius, shadow } from '../constants/colors';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

const WEB_CLIENT_ID = '400883289925-r5bkta8ed5ad48jbuu347u2i33urrhp0.apps.googleusercontent.com'

type Props = { onIdToken: (idToken: string) => void; onError: (message: string) => void };

export function GoogleWebSignInButton({ onIdToken, onError }: Props) {
  const redirectUri = AuthSession.makeRedirectUri();

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
        clientId: WEB_CLIENT_ID,
        scopes: ['openid', 'profile', 'email'],
        redirectUri,
        responseType: AuthSession.ResponseType.IdToken,
        usePKCE: false,
        extraParams: { nonce: Math.random().toString(36).slice(2) },
    },
    discovery
    );

  useEffect(() => {
    if (response?.type === 'success' && response.params.id_token) {
      onIdToken(response.params.id_token);
    } else if (response?.type === 'error') {
      onError('Google sign-in failed. Please try again.');
    }
  }, [response]);

  return (
    <Pressable disabled={!request} onPress={() => promptAsync()} style={styles.button}>
      <Text style={styles.buttonText}>Sign in with Google</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.coral, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginBottom: 12, ...shadow },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
*/