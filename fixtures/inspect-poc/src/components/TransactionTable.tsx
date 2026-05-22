import { Card } from './Card';
import { TableRow } from './TableRow';

export function TransactionTable() {
  return (
    <Card>
      <h2>최근 거래</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ textAlign: 'left', padding: '6px 4px' }}>일시</th>
            <th style={{ textAlign: 'left', padding: '6px 4px' }}>자산</th>
            <th style={{ textAlign: 'right', padding: '6px 4px' }}>수량</th>
          </tr>
        </thead>
        <tbody>
          <TableRow time="2026-05-21 09:12" asset="BTC" amount="0.452" />
          <TableRow time="2026-05-21 08:01" asset="ETH" amount="3.250" />
          <TableRow time="2026-05-20 18:44" asset="SOL" amount="120.000" />
        </tbody>
      </table>
    </Card>
  );
}
