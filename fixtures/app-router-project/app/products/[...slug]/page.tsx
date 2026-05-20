import { useQuery } from '@tanstack/react-query';
import { ProductCard } from '@/components/ui/ProductCard';

interface ProductPageProps {
  slug: string[];
}

export default function ProductPage({ slug }: ProductPageProps) {
  const productId = slug[slug.length - 1];

  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetch(`/api/products/${productId}`).then(r => r.json()),
  });

  if (!product) return <p>Loading...</p>;

  return (
    <div>
      <ProductCard name={product.name} price={product.price} image={product.image} />
    </div>
  );
}
