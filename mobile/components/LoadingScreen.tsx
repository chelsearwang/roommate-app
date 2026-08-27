import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

export function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.blue} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: 16 },
  message: { fontSize: 14, color: colors.text, opacity: 0.6 },
});