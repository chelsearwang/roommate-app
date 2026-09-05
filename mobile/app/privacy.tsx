import { ScrollView, Text, StyleSheet } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors } from '@/constants/colors';

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader eyebrow="LEGAL" title="Privacy Policy" icon="shield-checkmark-outline" />

      <Text style={styles.updated}>Last updated: 09/04/2026</Text>

      <Text style={styles.heading}>Information We Collect</Text>
      <Text style={styles.body}>
        Account information, via Google or Apple Sign-In: your name, your email address, and a unique identifier tied to your account (used only to recognize you on future sign-ins — we never see or store your password).{'\n\n'}
        Content you create while using the app: chores you create (names, schedules, assignment history), announcements you post, expenses you log, and your household's name and invite code.
      </Text>

      <Text style={styles.heading}>How We Use Your Information</Text>
      <Text style={styles.body}>
        Solely to operate the app's core features: identifying you when you sign in, displaying your household's shared chores/expenses/announcements to the members of that household, and sending you in-app notifications about household activity.{'\n\n'}
        We do not sell your data. We do not use your data for advertising. We do not use any third-party analytics or tracking services.
      </Text>

      <Text style={styles.heading}>Who Can See Your Information</Text>
      <Text style={styles.body}>
        Information you create is visible only to the members of your specific household — never to the public, and never to members of a different household.
      </Text>

      <Text style={styles.heading}>Data Storage</Text>
      <Text style={styles.body}>
        Your data is stored using Neon (a managed PostgreSQL database provider) and processed by our backend, hosted on Render.
      </Text>

      <Text style={styles.heading}>Data Deletion</Text>
      <Text style={styles.body}>
        You may delete your account at any time from within the app, permanently removing your personal information — this cannot be undone. You may also delete an entire household, which permanently removes all its chores, expenses, and announcements for every member.
      </Text>

      <Text style={styles.heading}>Children's Privacy</Text>
      <Text style={styles.body}>
        This app is not directed at, and is not knowingly used by, children under the age of 13.
      </Text>

      <Text style={styles.heading}>Contact Us</Text>
      <Text style={styles.body}>
        Questions about this policy or your data: [EMAIL]
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingBottom: 60 },
  updated: { fontSize: 12, color: colors.text, opacity: 0.5, marginBottom: 20 },
  heading: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 20, marginBottom: 8 },
  body: { fontSize: 14, color: colors.text, opacity: 0.8, lineHeight: 21 },
});