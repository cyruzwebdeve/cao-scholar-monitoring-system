const prisma = require('../config/prisma');
const { loadConfiguration, validateConfiguration } = require('../services/onlineExamConfiguration');

const createOnlineExamConfigurationController = (client = prisma) => ({
  get: async (req, res) => {
    res.set('Cache-Control', 'no-store, private');
    try { return res.json({ configuration: await loadConfiguration(client) }); }
    catch { return res.status(500).json({ message: 'Unable to load online questions. Check that the question-configuration migration has been applied.' }); }
  },
  save: async (req, res) => {
    res.set('Cache-Control', 'no-store, private');
    let data;
    try { data = validateConfiguration(req.body); }
    catch (error) { return res.status(400).json({ message: error.message }); }
    try {
      const current = await loadConfiguration(client);
      if (current.id !== data.previous_id) return res.status(409).json({ message: 'Another staff member saved a newer version. Reload before saving.' });
      const saved = await client.online_exam_configurations.create({ data: { ...data, created_by: req.user.id } });
      res.locals.auditTargetId = saved.id;
      return res.status(201).json({ message: 'Online questions saved as a new version. Open examinations retain their original marking key.', configuration: await loadConfiguration(client, saved.id) });
    } catch (error) {
      if (error.code === 'P2002') return res.status(409).json({ message: 'Another staff member saved a newer version. Reload before saving.' });
      return res.status(500).json({ message: 'Unable to save online questions.' });
    }
  },
});

module.exports = { createOnlineExamConfigurationController, onlineExamConfigurationController: createOnlineExamConfigurationController() };
