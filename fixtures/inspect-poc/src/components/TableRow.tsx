interface TableRowProps {
  time: string;
  asset: string;
  amount: string;
}

export function TableRow({ time, asset, amount }: TableRowProps) {
  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '6px 4px', color: '#475569' }}>{time}</td>
      <td style={{ padding: '6px 4px' }}><span className="pill">{asset}</span></td>
      <td style={{ padding: '6px 4px', textAlign: 'right' }}>{amount}</td>
    </tr>
  );
}
