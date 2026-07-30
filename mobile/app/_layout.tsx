import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, Redirect, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { token, user, isLoading } = useAuth();
  const segments = useSegments();
  const inLoginScreen = segments[0] === 'login';
  const inHouseholdScreen = segments[0] === 'household';

  if (isLoading) {
    return null;
  }

  if (!token && !inLoginScreen) {
    return <Redirect href="/login" />;
  }

  if (token && inLoginScreen) {
    return <Redirect href="/(tabs)" />;
  }

  if (token && user && !user.householdId && !inHouseholdScreen) {
    return <Redirect href="/household" />;
  }

  if (token && user?.householdId && inHouseholdScreen) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="household" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RootLayoutNav />
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}