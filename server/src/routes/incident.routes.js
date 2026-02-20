const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incident.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

// GET /api/incidents - Get all incidents
router.get('/', authMiddleware, roleMiddleware('admin', 'security_guard'), incidentController.getAll);

// GET /api/incidents/open - Get open incidents
router.get('/open', authMiddleware, roleMiddleware('admin', 'security_guard'), incidentController.getOpen);

// GET /api/incidents/:id - Get incident by ID
router.get('/:id', authMiddleware, roleMiddleware('admin', 'security_guard'), incidentController.getById);

// POST /api/incidents - Report new incident
router.post('/', authMiddleware, roleMiddleware('admin', 'security_guard'), incidentController.create);

// PUT /api/incidents/:id - Update incident
router.put('/:id', authMiddleware, roleMiddleware('admin', 'security_guard'), incidentController.update);

// POST /api/incidents/:id/resolve - Resolve incident
router.post('/:id/resolve', authMiddleware, roleMiddleware('admin', 'security_guard'), incidentController.resolve);

module.exports = router;
