import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider, useApp } from '../src/ctx';
import { SplashView } from '../src/SplashView';

const WELCOME_KEY = 'app.welcomed.v2';

function Gate({ children }: { children: React.ReactNode }) {
  const { ready, userId } = useApp();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.getItem(WELCOME_KEY).then((v) => {
      const isWelcome = segments[0] === 'welcome';
      if ((v !== '1' || !userId) && !isWelcome) {
        router.replace('/welcome');
      }
    });
  }, [ready, segments, router, userId]);

  if (!ready) return <SplashView />;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Gate>
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="routine/[id]" />
            <Stack.Screen name="sos" options={{ gestureEnabled: false }} />
            <Stack.Screen name="gate" options={{ presentation: 'modal' }} />
            <Stack.Screen name="pair" options={{ presentation: 'modal' }} />
            <Stack.Screen name="admin" />
          </Stack>
        </Gate>
      </AppProvider>
    </SafeAreaProvider>
  );
}
