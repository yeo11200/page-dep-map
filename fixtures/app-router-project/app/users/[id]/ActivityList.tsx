interface ActivityListProps {
  userId: string;
}

export function ActivityList({ userId }: ActivityListProps) {
  return (
    <ul>
      <li>Activity for {userId}</li>
    </ul>
  );
}
