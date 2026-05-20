import { post } from './client';

export function login(email, password) {
  return post('/api/v1/auth/login', { email, password });
}

export function register(email, password) {
  return post('/api/v1/auth/register', { email, password });
}

export function logout(refreshToken) {
  return post('/api/v1/auth/logout', { refresh_token: refreshToken });
}
