import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { apiRequest } from './api';

export async function registerEmployeePushNotifications(accountId: string, locationId: string) {
  if (!Capacitor.isNativePlatform()) return { native: false, permission: 'web' as const };

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt') permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return { native: true, permission: 'denied' as const };

  await PushNotifications.removeAllListeners();
  await PushNotifications.addListener('registration', token => {
    void apiRequest(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}/labor/notifications/register`, {
      method: 'POST',
      body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform(), app: 'ZestEmployee' }),
    });
  });
  await PushNotifications.addListener('registrationError', error => console.error('ZestEmployee push registration failed', error));
  await PushNotifications.register();
  return { native: true, permission: 'granted' as const };
}
