const prisma = require('../config/prisma');

const serializeNotification = (notification) => ({
  id: notification.id,
  type: notification.notification_type,
  title: notification.title,
  message: notification.message,
  reference: notification.reference,
  amount: notification.amount === null ? null : Number(notification.amount),
  isRead: notification.is_read,
  readAt: notification.read_at,
  createdAt: notification.created_at,
  academicPeriodId: notification.academic_period_id,
});

const getMyNotifications = async (req, res) => {
  try {
    const notifications = await prisma.scholar_notifications.findMany({
      where: { applicant_id: req.user.id },
      orderBy: { created_at: 'desc' },
      take: 25,
    });
    return res.json({
      notifications: notifications.map(serializeNotification),
      unreadCount: notifications.filter(({ is_read }) => !is_read).length,
    });
  } catch (error) {
    console.error('Error fetching scholar notifications:', error);
    return res.status(500).json({ message: 'Server error fetching notifications.' });
  }
};

const markMyNotificationRead = async (req, res) => {
  try {
    const notificationId = Number(req.params.id);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({ message: 'A valid notification is required.' });
    }
    const notification = await prisma.scholar_notifications.findFirst({
      where: { id: notificationId, applicant_id: req.user.id },
    });
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    const updated = notification.is_read
      ? notification
      : await prisma.scholar_notifications.update({
        where: { id: notification.id },
        data: { is_read: true, read_at: new Date() },
      });
    return res.json({ notification: serializeNotification(updated) });
  } catch (error) {
    console.error('Error updating scholar notification:', error);
    return res.status(500).json({ message: 'Server error updating the notification.' });
  }
};

module.exports = { getMyNotifications, markMyNotificationRead };
