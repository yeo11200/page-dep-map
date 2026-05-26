import useSWR from 'swr';
import { ofetch } from 'ofetch';

const fetcher = (url: string) => ofetch(url);

// useSWR + ofetch — high confidence
export function Feed() {
  const { data } = useSWR('/api/v1/feed', fetcher);
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
