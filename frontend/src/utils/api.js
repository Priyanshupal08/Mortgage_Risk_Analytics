import { fetchApi } from '../api';

export const getModelComparison = () => fetchApi('/api/models/comparison');
export const compareAllModels = (data) => fetchApi('/api/analyze/compare', { method: 'POST', body: JSON.stringify(data) });
export const switchModel = (modelName) => fetchApi(`/api/models/switch/${modelName}`, { method: 'POST' });
export const analyzeLoan = (data, persist = true) => fetchApi(`/analyze${persist ? '' : '?persist=false'}`, { method: 'POST', body: JSON.stringify(data) });
