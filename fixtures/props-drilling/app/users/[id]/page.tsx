import { useEffect, useState } from 'react';

interface UserPageProps {
  userId: string;
  onNavigate: () => void;
}

export default function UserPage({ userId, onNavigate }: UserPageProps) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`).then(r => r.json()).then(setUser);
  }, [userId]);

  return (
    <div>
      <h1>User Detail</h1>
      <button onClick={onNavigate}>Back</button>
    </div>
  );
}
