import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import MyEventsScreen from '../screens/MyEventsScreen';
import RoomsScreen from '../screens/RoomsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import ChatScreen from '../screens/ChatScreen';
import OrganizerScreen from '../screens/OrganizerScreen';
import ManageEventScreen from '../screens/ManageEventScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const HEADER_DARK = { backgroundColor: '#0f0f0f' };
const HEADER_CHAT = { backgroundColor: '#111' };

function TabIcon({ name, focused }) {
  const icons = { Home: '🎉', MyEvents: '📋', Rooms: '💬', Organizer: '🛡️', Profile: '👤' };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>{icons[name]}</Text>;
}

function MainTabs() {
  const { profile } = useAuth();
  const isOrganizer = profile?.role === 'admin' || profile?.role === 'sub_admin';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#111', borderTopColor: '#1a1a1a', paddingBottom: 8, height: 70 },
        tabBarActiveTintColor: '#6c47ff',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Events', tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} /> }}
      />
      <Tab.Screen
        name="MyEvents"
        component={MyEventsScreen}
        options={{ tabBarLabel: 'My Events', tabBarIcon: ({ focused }) => <TabIcon name="MyEvents" focused={focused} /> }}
      />
      <Tab.Screen
        name="Rooms"
        component={RoomsScreen}
        options={{ tabBarLabel: 'Rooms', tabBarIcon: ({ focused }) => <TabIcon name="Rooms" focused={focused} /> }}
      />
      {isOrganizer && (
        <Tab.Screen
          name="Organizer"
          component={OrganizerScreen}
          options={{ tabBarLabel: 'Organizer', tabBarIcon: ({ focused }) => <TabIcon name="Organizer" focused={focused} /> }}
        />
      )}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: ({ focused }) => <TabIcon name="Profile" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { session, loading } = useAuth();

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="EventDetail"
              component={EventDetailScreen}
              options={{ headerShown: true, headerTitle: 'Event', headerStyle: HEADER_DARK, headerTintColor: '#fff' }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{ headerShown: true, headerTitle: 'Chat', headerStyle: HEADER_CHAT, headerTintColor: '#fff' }}
            />
            <Stack.Screen
              name="ManageEvent"
              component={ManageEventScreen}
              options={{ headerShown: true, headerTitle: 'Manage Event', headerStyle: HEADER_DARK, headerTintColor: '#fff' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
