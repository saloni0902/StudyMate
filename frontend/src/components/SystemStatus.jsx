import { useEffect, useState } from 'react';
import api from '../api/client.js';

// One line showing whether the backend, database and AI service are up.
export default function SystemStatus() {
  const [health, setHealth] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .get('/health')
      .then((res) => setHealth(res.data))
      .catch(() => setFailed(true));
  }, []);

  const items = [
    ['API', failed ? 'unreachable' : health?.status],
    ['Database', health?.database],
    ['AI service', health?.aiService],
  ];

  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted">
      {items.map(([label, value]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              !value ? 'bg-line-strong' : ['ok', 'connected'].includes(value) ? 'bg-brand' : 'bg-danger'
            }`}
          />
          {label}: {value || '…'}
        </span>
      ))}
    </div>
  );
}
