import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Theme colours (see index.css). Recharts needs real values, not CSS classes.
const BRAND = '#004643';
const GRID = '#e4efeb';
const AXIS = '#56696a';
const WEAK = '#e16162';

function ScoreTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const a = payload[0].payload;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-ink">
        {a.percent}% · {a.score}/{a.total}
      </p>
      <p className="text-muted">
        {a.quizTopic || 'All topics'} · {new Date(a.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}

// Quiz score (%) for each attempt in order, with the 60% "weak" line.
export default function ScoreChart({ attempts, weakPercent }) {
  const data = attempts.map((a, i) => ({ ...a, n: i + 1 }));

  return (
    <div>
      <div className="h-56" role="img" aria-label={`Quiz scores over ${attempts.length} attempts, latest ${attempts.at(-1)?.percent}%`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="n"
              tick={{ fill: AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              label={{ value: 'Attempt', position: 'insideBottomRight', offset: -2, fill: AXIS, fontSize: 11 }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine
              y={weakPercent}
              stroke={WEAK}
              strokeDasharray="4 4"
              label={{ value: `Weak below ${weakPercent}%`, position: 'insideTopLeft', fill: AXIS, fontSize: 11 }}
            />
            <Tooltip content={<ScoreTooltip />} cursor={{ stroke: AXIS, strokeDasharray: '2 2' }} />
            <Line
              type="monotone"
              dataKey="percent"
              stroke={BRAND}
              strokeWidth={2}
              dot={{ r: 4, fill: BRAND, stroke: '#fffffe', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: BRAND, stroke: '#fffffe', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs text-brand">View as table</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th className="py-1 font-medium">#</th>
              <th className="py-1 font-medium">Quiz</th>
              <th className="py-1 font-medium">Date</th>
              <th className="py-1 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id} className="border-t border-line">
                <td className="py-1">{a.n}</td>
                <td className="py-1">{a.quizTopic || 'All topics'}</td>
                <td className="py-1">{new Date(a.createdAt).toLocaleDateString()}</td>
                <td className="py-1 text-right">
                  {a.percent}% ({a.score}/{a.total})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
