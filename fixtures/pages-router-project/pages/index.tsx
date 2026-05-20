import { useState } from 'react';
import { Hero } from '@/components/common/Hero';
import { Features } from '@/components/common/Features';

export default function Home() {
  const [showFeatures, setShowFeatures] = useState(false);

  return (
    <div>
      <Hero />
      {showFeatures && <Features />}
      <button onClick={() => setShowFeatures(!showFeatures)}>
        Toggle Features
      </button>
    </div>
  );
}
