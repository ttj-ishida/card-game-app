import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Card Game App</Text>
      <Text style={styles.subtitle}>M0 development shell</Text>
      <Link href="/catalog" asChild>
        <Pressable accessibilityRole="button" style={styles.button}>
          <Text style={styles.buttonText}>Open catalog</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    color: '#111827',
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: '#475569',
    fontSize: 16,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#166534',
    borderRadius: 8,
    marginTop: 24,
    minWidth: 180,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
