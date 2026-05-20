import { get, post } from './client';
import { getAccessToken } from '../storage/tokens';

export async function listURLs({ limit = 100, page = 1, status } = {}) {
  const token = await getAccessToken();
  const params = new URLSearchParams({ limit, page });
  if (status) params.set('status', status);
  return get(`/api/v1/urls?${params}`, token);
}

export async function topURLs({ status } = {}) {
  const token = await getAccessToken();
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const query = params.toString() ? `?${params}` : '';
  return get(`/api/v1/urls/top${query}`, token);
}

export async function shortenURL(url, shortCode) {
  const token = await getAccessToken();
  const body = { url };
  if (shortCode) body.short_code = shortCode;
  return post('/api/v1/shorten', body, token);
}
