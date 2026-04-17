const memories = new Map();

module.exports = {
  get(projectId) {
    return memories.get(projectId) || { shortTerm: [], longTerm: [] };
  },
  update(projectId, patch) {
    const current = memories.get(projectId) || { shortTerm: [], longTerm: [] };
    const updated = { ...current, ...patch };
    memories.set(projectId, updated);
    return updated;
  },
};
