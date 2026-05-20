interface UserCardProps {
  userId: string;
  userName: string;
  userEmail: string;
}

export function UserCard({ userId, userName, userEmail }: UserCardProps) {
  return (
    <div>
      <p>ID: {userId}</p>
      <p>Name: {userName}</p>
      <p>Email: {userEmail}</p>
    </div>
  );
}
