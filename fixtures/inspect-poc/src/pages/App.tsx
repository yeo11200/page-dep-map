import { AssetPieChart } from '../components/AssetPieChart';
import { AssetSummary } from '../components/AssetSummary';
import { TransactionTable } from '../components/TransactionTable';

export function App() {
  return (
    <main className="container">
      <h1>Inspect PoC Dashboard</h1>
      <div className="grid">
        <AssetPieChart />
        <AssetSummary />
      </div>
      <TransactionTable />
    </main>
  );
}
