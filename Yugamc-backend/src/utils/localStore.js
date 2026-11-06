const fs = require('fs');
const path = require('path');

const leadsFilePath = path.resolve(__dirname, '../../leads.json');

const readLocalData = () => {
  try {
    if (fs.existsSync(leadsFilePath)) {
      const raw = fs.readFileSync(leadsFilePath, 'utf8');
      return JSON.parse(raw || '[]');
    }
  } catch (err) {
    console.error('[localStore] Error reading local data:', err.message);
  }
  return [];
};

const saveLocalLead = (item) => {
  try {
    const list = readLocalData();
    list.unshift(item);
    fs.writeFileSync(leadsFilePath, JSON.stringify(list, null, 2), 'utf8');
    console.log(`[localStore] Saved ${item.type || 'lead'} locally to leads.json (ID: ${item._id || item.id})`);
  } catch (err) {
    console.error('[localStore] Error saving locally:', err.message);
  }
};

const getLocalLeads = (filterType) => {
  const all = readLocalData();
  if (!filterType) return all;
  return all.filter((i) => i.type === filterType);
};

module.exports = {
  saveLocalLead,
  getLocalLeads,
  leadsFilePath,
};

