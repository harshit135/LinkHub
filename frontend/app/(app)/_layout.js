import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logout } from '../../src/api/auth';
import { getRefreshToken, clearTokens } from '../../src/storage/tokens';

const TABS = [
  { name: 'home',    label: 'Dashboard', icon: 'grid',          iconOff: 'grid-outline' },
  { name: 'create',  label: 'Create',    icon: 'add-circle',    iconOff: 'add-circle-outline' },
  { name: 'profile', label: 'Profile',   icon: 'person-circle', iconOff: 'person-circle-outline' },
];

function TabBar({ state, navigation }) {
  const [signingOut, setSigningOut] = useState(false);
  const insets = useSafeAreaInsets();
  const currentName = state.routes[state.index]?.name;

  async function handleLogout() {
    setSigningOut(true);
    try {
      const rt = await getRefreshToken();
      if (rt) await logout(rt);
    } catch { /* best-effort */ }
    await clearTokens();
    router.replace('/(auth)/login');
  }

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TABS.map((tab) => {
        const isFocused = currentName === tab.name;
        const color = isFocused ? '#4F46E5' : '#9CA3AF';
        const route = state.routes.find((r) => r.name === tab.name);

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => {
              if (!route) return;
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate({ name: tab.name, merge: true });
              }
            }}
          >
            <Ionicons name={isFocused ? tab.icon : tab.iconOff} size={23} color={color} />
            <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}

      <View style={styles.barDivider} />

      <TouchableOpacity
        style={styles.tabItem}
        activeOpacity={0.7}
        onPress={handleLogout}
        disabled={signingOut}
      >
        {signingOut ? (
          <ActivityIndicator size="small" color="#EF4444" />
        ) : (
          <Ionicons name="log-out-outline" size={23} color="#EF4444" />
        )}
        <Text style={[styles.tabLabel, styles.tabLabelLogout]}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AppLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  tabLabelLogout: {
    color: '#EF4444',
  },
  barDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
});
