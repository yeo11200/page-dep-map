import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

// react-query with literal URL — high confidence
export function Orders() {
  const list = useQuery({
    queryKey: ['orders'],
    queryFn: () => axios.get('/api/v1/orders').then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (payload: { sku: string }) =>
      axios.post('/api/v1/orders', payload),
  });

  return (
    <div>
      <button onClick={() => create.mutate({ sku: 'A1' })}>create</button>
      <pre>{JSON.stringify(list.data, null, 2)}</pre>
    </div>
  );
}
