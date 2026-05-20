import { UserCard } from './UserCard';

interface UserProfileProps {
  userId: string;
  userName: string;
  userEmail: string;
}

export function UserProfile({ userId, userName, userEmail }: UserProfileProps) {
  return (
    <div>
      <h2>Profile</h2>
      <UserCard userId={userId} userName={userName} userEmail={userEmail} />
    </div>
  );
}
