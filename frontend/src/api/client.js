import Constants from 'expo-constants';

function getBaseUrl() {
  if (__DEV__) {
    // Reads the Expo dev-server host so physical Android devices work without hardcoding an IP
    const debuggerHost =
      Constants.expoGoConfig?.debuggerHost ??
      Constants.manifest2?.extra?.expoClient?.hostUri ??
      Constants.manifest?.debuggerHost;

    const host = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
    return `http://${host}:8080`;
  }
  return 'https://api.linkhub.app'; // TODO: set production URL
}

export const BASE_URL = getBaseUrl();

export async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong');
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function get(path, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong');
    err.status = res.status;
    throw err;
  }
  return data;
}
