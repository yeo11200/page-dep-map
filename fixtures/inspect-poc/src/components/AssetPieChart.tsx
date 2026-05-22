import { Card } from './Card';

export function AssetPieChart() {
  return (
    <Card>
      <h2>자산 비율</h2>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            background:
              'conic-gradient(#3b82f6 0 40%, #10b981 40% 70%, #f59e0b 70% 90%, #ef4444 90% 100%)',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <span><span className="pill" style={{ background: '#dbeafe', color: '#1e40af' }}>BTC</span> 40%</span>
          <span><span className="pill" style={{ background: '#d1fae5', color: '#065f46' }}>ETH</span> 30%</span>
          <span><span className="pill" style={{ background: '#fef3c7', color: '#92400e' }}>SOL</span> 20%</span>
          <span><span className="pill" style={{ background: '#fee2e2', color: '#991b1b' }}>POL</span> 10%</span>
        </div>
      </div>
    </Card>
  );
}
