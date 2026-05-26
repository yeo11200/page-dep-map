import { userApi } from '../lib/api';
import { UserCard } from '../components/UserCard';

// Hot endpoint coverage — userApi.getById is also called from UserProfile,
// UserCard, and below.  Detector should aggregate all four call sites
// under GET /api/v1/users/:id.
export function Admin() {
  return (
    <div>
      <button onClick={() => userApi.list()}>refresh</button>
      <UserCard userId="1" />
      <UserCard userId="2" />
      <button onClick={() => userApi.getById('42')}>load 42</button>
    </div>
  );
}
