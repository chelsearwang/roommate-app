// Testing via web preview on this same computer, "localhost" works fine
// Testing on phone later requires switching to computer's local network IP instead
const API_BASE_URL = 'http://localhost:3000';

export async function apiRequest(path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, cache: 'no-store' });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}