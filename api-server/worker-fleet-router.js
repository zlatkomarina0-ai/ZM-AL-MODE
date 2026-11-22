'use strict';

/**
 * Optional Express router adapter for WorkerFleet.
 *
 * Mount only behind real authentication. The caller must provide an auth
 * middleware that sets req.workerIdentity = { workerId, chiefId, scopes }.
 * The in-memory fleet is NOT suitable for multi-instance production use.
 */
function createWorkerFleetRouter({ express, fleet, authenticateWorker }) {
  if (!express || typeof express.Router !== 'function') {
    throw new TypeError('An Express-compatible module is required');
  }
  if (!fleet) throw new TypeError('A WorkerFleet instance is required');
  if (typeof authenticateWorker !== 'function') {
    throw new TypeError('authenticateWorker middleware is required');
  }

  const router = express.Router();
  router.use(authenticateWorker);

  router.use((req, res, next) => {
    const identity = req.workerIdentity;
    if (!identity || !identity.workerId || !identity.chiefId) {
      return res.status(401).json({ error: 'Authenticated worker identity required' });
    }
    return next();
  });

  router.post('/heartbeat', (req, res) => {
    try {
      const identity = req.workerIdentity;
      const worker = fleet.heartbeat(identity.workerId);
      if (worker.chiefId !== identity.chiefId) return res.status(403).json({ error: 'Chief scope mismatch' });
      return res.json({ worker });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  router.post('/claim', (req, res) => {
    try {
      const identity = req.workerIdentity;
      const worker = fleet.listWorkers(identity.chiefId).find((item) => item.workerId === identity.workerId);
      if (!worker) return res.status(403).json({ error: 'Worker is not registered under this Chief' });
      return res.json({ task: fleet.claimNext(identity.workerId) });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  router.post('/reports/:taskId', (req, res) => {
    try {
      const identity = req.workerIdentity;
      const task = fleet.taskStatus(req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      if (task.chiefId !== identity.chiefId) return res.status(403).json({ error: 'Chief scope mismatch' });
      const outcome = fleet.completeTask({
        workerId: identity.workerId,
        taskId: req.params.taskId,
        result: req.body?.result,
        status: req.body?.status || 'completed',
      });
      return res.status(201).json(outcome);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  return router;
}

module.exports = { createWorkerFleetRouter };
