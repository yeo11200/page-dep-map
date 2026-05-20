import { UserProfile } from './UserProfile';

interface HomePageProps {
  userId: string;
  userName: string;
  userEmail: string;
  theme: string;
}

export default function HomePage({ userId, userName, userEmail, theme }: HomePageProps) {
  console.log('Rendering with theme:', theme);

  return (
    <div>
      <h1>Home</h1>
      <UserProfile userId={userId} userName={userName} userEmail={userEmail} />
    </div>
  );
}
