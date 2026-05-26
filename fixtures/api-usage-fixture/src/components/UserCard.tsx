import { useEffect, useState } from 'react';
import { userApi } from '../lib/api';

// Shared component reused on Admin page — counts as another call site
// of GET /api/v1/users/:id, attributed to its enclosing page when the
// analyzer walks the component tree.
export function UserCard({ userId }: { userId: string }) {
  const [user, setUser] = useState<unknown>(null);
  useEffect(() => {
    userApi.getById(userId).then((r) => setUser(r.data));
  }, [userId]);
  return <div>{JSON.stringify(user)}</div>;
}
