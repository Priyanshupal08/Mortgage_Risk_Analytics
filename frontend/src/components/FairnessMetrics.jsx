import React, { useEffect, useState } from 'react';
import { api } from '../api';
import Card from './ui/Card';

const FairnessMetrics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFairness = async () => {
      try {
        const res = await api.fairnessMetrics();
        setData(res);
      } catch (err) {
        console.error("Failed to fetch fairness metrics", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFairness();
  }, []);

  if (loading) return <div className="animate-pulse h-48 bg-white/5 rounded-2xl"></div>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
      <Card elevated>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-amber-400">⚖️</span> Approval by Age Band
        </h3>
        <div className="space-y-4">
          {data.by_age.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">{item.age_band}</span>
                <span className="mono text-white">{(item.approval_rate * 100).toFixed(1)}% ({item.approved}/{item.total})</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500/60" 
                  style={{ width: `${item.approval_rate * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card elevated>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-amber-400">🌍</span> Approval by Region
        </h3>
        <div className="space-y-4">
          {data.by_region.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">{item.region}</span>
                <span className="mono text-white">{(item.approval_rate * 100).toFixed(1)}% ({item.approved}/{item.total})</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500/60" 
                  style={{ width: `${item.approval_rate * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default FairnessMetrics;
