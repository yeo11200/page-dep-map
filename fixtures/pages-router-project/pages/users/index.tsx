import { useQuery } from '@tanstack/react-query';
import { UserTable } from '@/components/shared/UserTable';
import { SearchBar } from '@/components/ui/SearchBar';

export default function UsersPage() {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(r => r.json()),
  });

  return (
    <div>
      <h1>Users</h1>
      <SearchBar />
      {users ? <UserTable data={users} /> : <p>Loading...</p>}
    </div>
  );
}
