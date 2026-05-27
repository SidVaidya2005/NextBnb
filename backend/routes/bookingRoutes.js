const express = require('express');
const bookingController = require('../controllers/bookingController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, bookingController.index);
router.post('/', requireAuth, bookingController.create);
router.get('/:id', requireAuth, bookingController.show);
router.put('/:id', requireAuth, bookingController.update);
router.delete('/:id', requireAuth, bookingController.remove);

module.exports = router;
