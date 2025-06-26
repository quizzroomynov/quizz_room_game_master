const API_BASE = 'http://localhost:3000'; 

export async function fetchStatus() {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error('Erreur fetch status');
  return res.json();
}

export async function triggerBuzzer(userId: string) {
  const res = await fetch(`${API_BASE}/buzzer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error('Erreur déclenchement buzzer');
  return res.json();
}
