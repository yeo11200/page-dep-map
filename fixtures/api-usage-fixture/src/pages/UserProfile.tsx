import { useEffect, useState } from 'react';
import { userApi } from '../lib/api';

// Direct fetch — high confidence
async function loadActivity(userId: string) {
  const res = await fetch(`/api/v1/users/${userId}/activity`);
  return res.json();
}

export function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<unknown>(null);

  useEffect(() => {
    // wrapped client — should resolve via 1-hop to GET /api/v1/users/:id
    userApi.getById(userId).then((r) => setUser(r.data));
    loadActivity(userId);
  }, [userId]);

  return <pre>{JSON.stringify(user, null, 2)}</pre>;
}
