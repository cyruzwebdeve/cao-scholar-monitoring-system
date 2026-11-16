const prisma = require('../config/prisma');
const { loadAcademicYearReport } = require('../services/academicYearReport');

const getLifecycleReport = async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    return res.json(await loadAcademicYearReport(prisma, req.query.schoolYear));
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error('Error fetching academic-year report:', error);
    return res.status(500).json({ message: 'Server error fetching academic-year report.' });
  }
};

module.exports = { getLifecycleReport };
