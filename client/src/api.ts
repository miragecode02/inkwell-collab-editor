const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export interface User {
  id: string;
  email: string;
  displayName: string;
  color: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function signup(email: string, password: string, displayName: string) {
  const r = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'signup failed');
  return r.json() as Promise<{ token: string; user: User }>;
}

export async function login(email: string, password: string) {
  const r = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'login failed');
  return r.json() as Promise<{ token: string; user: User }>;
}

export async function listDocuments() {
  const r = await fetch(`${API_BASE}/documents`, { headers: authHeaders() });
  if (!r.ok) throw new Error('failed to list documents');
  return r.json();
}

export async function renameDocument(id: string, title: string) {
  const r = await fetch(`${API_BASE}/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ title }),
  });
  if (!r.ok) throw new Error('failed to rename document');
  return r.json();
}

export async function createDocument(title: string) {
  const r = await fetch(`${API_BASE}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ title }),
  });
  if (!r.ok) throw new Error('failed to create document');
  return r.json();
}

export async function fetchDocument(id: string) {
  const r = await fetch(`${API_BASE}/documents/${id}`, { headers: authHeaders() });
  if (!r.ok) throw new Error('document not found');
  return r.json() as Promise<{ id: string; title: string; owner_id: string }>;
}

export { API_BASE };