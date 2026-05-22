import { Card } from './Card';

export function AssetSummary() {
  return (
    <Card>
      <h2>기간별 자산</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          <tr><td>비트코인</td><td style={{ textAlign: 'right' }}>2,222,000 BTC</td></tr>
          <tr><td>이더리움</td><td style={{ textAlign: 'right' }}>6,820,310 ETH</td></tr>
          <tr><td>솔라나</td><td style={{ textAlign: 'right' }}>2,101,000 SOL</td></tr>
        </tbody>
      </table>
    </Card>
  );
}
