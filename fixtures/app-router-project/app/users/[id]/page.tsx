import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { ActivityList } from './ActivityList';

interface UserDetailPageProps {
  userId: string;
  showActivity?: boolean;
}

export default function UserDetailPage({ userId, showActivity = true }: UserDetailPageProps) {
  const [tab, setTab] = useState('profile');

  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetch(`/api/users/${userId}`).then(r => r.json()),
  });

  useEffect(() => {
    document.title = user?.name ?? 'User';
  }, [user]);

  if (!user) return <p>Loading...</p>;

  return (
    <div>
      <UserAvatar src={user.avatar} />
      <h1>{user.name}</h1>
      {showActivity && tab === 'activity' ? (
        <ActivityList userId={userId} />
      ) : (
        <p>{user.bio}</p>
      )}
      <button onClick={() => setTab(tab === 'profile' ? 'activity' : 'profile')}>
        Toggle
      </button>
    </div>
  );
}
