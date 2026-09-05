const checkRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized. Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access Denied. Insufficient permissions.' });
    }

    next();
  };
};

const { hasSectionAccess } = require('../services/sectionAccess');

const checkSectionAccess = (...sections) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized. Authentication required.' });
  if (!['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin', 'Moderator'].includes(req.user.role)) return next();
  if (!sections.some((section) => hasSectionAccess(req.user, section))) {
    return res.status(403).json({ message: 'Access Denied. This section is not assigned to your staff account.' });
  }
  return next();
};

module.exports = { checkRole, checkSectionAccess };
