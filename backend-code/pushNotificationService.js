const fetch = require('node-fetch');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendPushNotification(expoPushToken, notification) {
  const { title, body, data = {} } = notification;

  if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken[')) {
    console.log('Invalid Expo push token:', expoPushToken);
    return { success: false, error: 'Invalid push token' };
  }

  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
    channelId: 'default',
  };

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (result.data?.status === 'error') {
      console.error('Push notification error:', result.data.message);
      return { success: false, error: result.data.message };
    }

    return { success: true, ticketId: result.data?.id };
  } catch (error) {
    console.error('Failed to send push notification:', error);
    return { success: false, error: error.message };
  }
}

async function sendBatchPushNotifications(notifications) {
  const messages = notifications
    .filter(n => n.token && n.token.startsWith('ExponentPushToken['))
    .map(n => ({
      to: n.token,
      sound: 'default',
      title: n.title,
      body: n.body,
      data: n.data || {},
      priority: 'high',
      channelId: 'default',
    }));

  if (messages.length === 0) {
    return { success: true, sent: 0 };
  }

  const chunks = [];
  const chunkSize = 100;
  for (let i = 0; i < messages.length; i += chunkSize) {
    chunks.push(messages.slice(i, i + chunkSize));
  }

  let totalSent = 0;
  const errors = [];

  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const result = await response.json();
      
      if (Array.isArray(result.data)) {
        result.data.forEach((item, index) => {
          if (item.status === 'ok') {
            totalSent++;
          } else {
            errors.push({ index, error: item.message });
          }
        });
      }
    } catch (error) {
      console.error('Batch push error:', error);
      errors.push({ error: error.message });
    }
  }

  return { 
    success: errors.length === 0, 
    sent: totalSent, 
    total: messages.length,
    errors 
  };
}

function createEventReminderNotification(event) {
  return {
    title: 'Event Tomorrow!',
    body: `Don't forget: "${event.title}" is happening tomorrow at ${event.time}. Time to plan your outfit!`,
    data: {
      type: 'event_reminder',
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.date,
      eventTime: event.time,
      outfitSuggestion: event.outfitSuggestion,
    },
  };
}

function createStyleRecommendationNotification(styleOfTheDay) {
  return {
    title: 'Your Style of the Day',
    body: styleOfTheDay.title || 'Check out your personalized style recommendation!',
    data: {
      type: 'style_of_the_day',
      title: styleOfTheDay.title,
      description: styleOfTheDay.description,
    },
  };
}

function createTrendAlertNotification(trend) {
  return {
    title: 'Trend Alert!',
    body: `New trend spotted: ${trend.name}. Be ahead of the curve!`,
    data: {
      type: 'trend_alert',
      trendName: trend.name,
      trendCategory: trend.category,
    },
  };
}

function createPersonalizedOfferNotification(offer) {
  return {
    title: 'Just For You',
    body: offer.description || 'We found something that matches your style!',
    data: {
      type: 'personalized_offer',
      category: offer.category,
      item: offer.item,
    },
  };
}

async function processEventReminders(pool) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  try {
    const reminders = await pool.query(`
      SELECT er.*, u.display_name, pt.token as push_token
      FROM event_reminders er
      JOIN users u ON er.user_id = u.id
      JOIN push_notification_tokens pt ON u.id = pt.user_id
      WHERE er.event_date::date = $1
        AND er.reminder_sent = false
        AND pt.is_active = true
    `, [tomorrowStr]);

    const notifications = [];
    
    for (const reminder of reminders.rows) {
      notifications.push({
        token: reminder.push_token,
        title: 'Event Tomorrow!',
        body: `"${reminder.event_title}" is happening tomorrow at ${reminder.event_time}. Time to plan your outfit!`,
        data: {
          type: 'event_reminder',
          eventId: reminder.event_id,
          eventTitle: reminder.event_title,
        },
      });
    }

    if (notifications.length > 0) {
      const result = await sendBatchPushNotifications(notifications);
      
      if (result.sent > 0) {
        const reminderIds = reminders.rows.map(r => r.id);
        await pool.query(`
          UPDATE event_reminders 
          SET reminder_sent = true, sent_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1)
        `, [reminderIds]);
      }

      return result;
    }

    return { success: true, sent: 0, message: 'No reminders to send' };
  } catch (error) {
    console.error('Process event reminders error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPushNotification,
  sendBatchPushNotifications,
  createEventReminderNotification,
  createStyleRecommendationNotification,
  createTrendAlertNotification,
  createPersonalizedOfferNotification,
  processEventReminders,
};
