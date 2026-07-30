import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors, radius, shadow } from '@/constants/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.sage,
        tabBarInactiveTintColor: colors.ink,
        tabBarStyle: {
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: 20,
          height: 78,
          paddingTop: 10,
          paddingBottom: 14,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderTopWidth: 0,
          ...shadow,
        },
        tabBarItemStyle: { justifyContent: 'center', alignItems: 'center' },
        tabBarIconStyle: { marginBottom: 0 },
        tabBarLabelStyle: { fontSize: 11, marginTop: 2, marginBottom: 0, lineHeight: 14 },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} /> }} />
      <Tabs.Screen name="chores" options={{ title: 'Chores', tabBarIcon: ({ color }) => <IconSymbol size={28} name="checkmark.circle.fill" color={color} /> }} />
      <Tabs.Screen name="announcements" options={{ title: 'Announcements', tabBarIcon: ({ color }) => <IconSymbol size={28} name="megaphone.fill" color={color} /> }} />
      <Tabs.Screen name="expenses" options={{ title: 'Expenses', tabBarIcon: ({ color }) => <IconSymbol size={28} name="dollarsign.circle.fill" color={color} /> }} />
    </Tabs>
  );
}