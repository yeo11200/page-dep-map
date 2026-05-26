import { Hero } from '@/components/Hero';
import { Features } from '@/components/Features';
import { ApiImpactDemo } from '@/components/ApiImpactDemo';
import { InspectDemo } from '@/components/InspectDemo';
import { InstallSection } from '@/components/InstallSection';
import { Footer } from '@/components/Footer';

export default function Page() {
  return (
    <main className="relative">
      <Hero />
      <Features />
      <ApiImpactDemo />
      <InspectDemo />
      <InstallSection />
      <Footer />
    </main>
  );
}
