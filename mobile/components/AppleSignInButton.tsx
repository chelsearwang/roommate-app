import * as AppleAuthentication from 'expo-apple-authentication';
import { StyleSheet } from 'react-native';

type Props = {
  onIdentityToken: (identityToken: string, fullName: { givenName?: string | null; familyName?: string | null } | null) => void;
  onError: (message: string) => void;
};

export function AppleSignInButton({ onIdentityToken, onError }: Props) {
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={12}
      style={styles.button}
      onPress={async () => {
        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });
          if (credential.identityToken) {
            onIdentityToken(credential.identityToken, credential.fullName);
          } else {
            onError('Apple did not return a valid identity token.');
          }
        } catch (e: any) {
          if (e.code !== 'ERR_CANCELED') {
            onError('Apple sign-in failed. Please try again.');
          }
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  button: { width: '100%', height: 50, marginBottom: 12 },
});