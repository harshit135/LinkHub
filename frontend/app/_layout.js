import { Stack } from 'expo-router';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';

const MAX_WIDTH = 480;

function WebShell({ children }) {
  const { width } = useWindowDimensions();
  const shellWidth = Math.min(width, MAX_WIDTH);

  return (
    <View style={styles.webRoot}>
      <View style={[styles.webShell, { width: shellWidth }]}>
        {children}
      </View>
    </View>
  );
}

export default function RootLayout() {
  const nav = <Stack screenOptions={{ headerShown: false }} />;

  if (Platform.OS !== 'web') return nav;

  return <WebShell>{nav}</WebShell>;
}

const styles = StyleSheet.create({
  webRoot: {
    flex: 1,
    backgroundColor: '#D1D5DB',
    alignItems: 'center',
  },
  webShell: {
    flex: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 16,
  },
});
