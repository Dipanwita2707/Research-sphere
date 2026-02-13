/**
 * Prize Controller
 * Controller for managing event prizes
 */

const prizeService = require('../services/prize.service');

/**
 * Get all prizes for an event
 */
const getPrizes = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const prizes = await prizeService.getPrizes(eventId);
    res.json(prizes);
  } catch (error) {
    console.error('Error getting prizes:', error);
    res.status(500).json({ message: error.message || 'Failed to get prizes' });
  }
};

/**
 * Get a specific prize
 */
const getPrizeById = async (req, res) => {
  try {
    const { prizeId } = req.params;
    const prize = await prizeService.getPrizeById(prizeId);
    if (!prize) {
      return res.status(404).json({ message: 'Prize not found' });
    }
    res.json(prize);
  } catch (error) {
    console.error('Error getting prize:', error);
    res.status(500).json({ message: error.message || 'Failed to get prize' });
  }
};

/**
 * Create a new prize
 */
const createPrize = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const userId = req.user.id;
    const prize = await prizeService.createPrize(eventId, req.body, userId);
    res.status(201).json(prize);
  } catch (error) {
    console.error('Error creating prize:', error);
    res.status(400).json({ message: error.message || 'Failed to create prize' });
  }
};

/**
 * Update a prize
 */
const updatePrize = async (req, res) => {
  try {
    const { prizeId } = req.params;
    const userId = req.user.id;
    const prize = await prizeService.updatePrize(prizeId, req.body, userId);
    res.json(prize);
  } catch (error) {
    console.error('Error updating prize:', error);
    res.status(400).json({ message: error.message || 'Failed to update prize' });
  }
};

/**
 * Delete a prize
 */
const deletePrize = async (req, res) => {
  try {
    const { prizeId } = req.params;
    const userId = req.user.id;
    await prizeService.deletePrize(prizeId, userId);
    res.json({ message: 'Prize deleted successfully' });
  } catch (error) {
    console.error('Error deleting prize:', error);
    res.status(400).json({ message: error.message || 'Failed to delete prize' });
  }
};

/**
 * Reorder prizes
 */
const reorderPrizes = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { prizeOrders } = req.body;
    const userId = req.user.id;
    const prizes = await prizeService.reorderPrizes(eventId, prizeOrders, userId);
    res.json(prizes);
  } catch (error) {
    console.error('Error reordering prizes:', error);
    res.status(400).json({ message: error.message || 'Failed to reorder prizes' });
  }
};

/**
 * Bulk upsert prizes
 */
const bulkUpsertPrizes = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { prizes } = req.body;
    const userId = req.user.id;
    const result = await prizeService.bulkUpsertPrizes(eventId, prizes, userId);
    res.json(result);
  } catch (error) {
    console.error('Error bulk upserting prizes:', error);
    res.status(400).json({ message: error.message || 'Failed to save prizes' });
  }
};

/**
 * Toggle prizes enabled
 */
const togglePrizesEnabled = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { enabled } = req.body;
    const userId = req.user.id;
    const event = await prizeService.togglePrizesEnabled(eventId, enabled, userId);
    res.json(event);
  } catch (error) {
    console.error('Error toggling prizes:', error);
    res.status(400).json({ message: error.message || 'Failed to toggle prizes' });
  }
};

module.exports = {
  getPrizes,
  getPrizeById,
  createPrize,
  updatePrize,
  deletePrize,
  reorderPrizes,
  bulkUpsertPrizes,
  togglePrizesEnabled,
};
