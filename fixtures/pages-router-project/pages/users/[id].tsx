import { useQuery, useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { EditForm } from '@/components/ui/EditForm';
import { formatDate } from '@/utils/format';

interface UserDetailProps {
  id: string;
  editable?: boolean;
}

export default function UserDetail({ id, editable = false }: UserDetailProps) {
  const auth = useAuthStore((s) => s.user);
  const [isEditing, setIsEditing] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['user', id],
    queryFn: () => fetch(`/api/users/${id}`).then(r => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => fetch(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then(r => r.json()),
  });

  useEffect(() => {
    document.title = user?.name ?? 'User Detail';
  }, [user]);

  const formattedJoinDate = user ? formatDate(user.joinedAt) : '';

  if (!user) return <p>Loading...</p>;

  return (
    <div>
      <UserAvatar src={user.avatar} />
      <h1>{user.name}</h1>
      <p>Joined: {formattedJoinDate}</p>
      {auth && editable ? (
        isEditing ? (
          <EditForm
            user={user}
            onSave={(data) => updateMutation.mutate(data)}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <button onClick={() => setIsEditing(true)}>Edit</button>
        )
      ) : (
        <p>Read only</p>
      )}
    </div>
  );
}
