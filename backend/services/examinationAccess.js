const DEFAULT_EXAMINATION_SETTINGS = Object.freeze({
  isEnabled: false,
  deliveryMode: 'paper',
});

const resolveExaminationSettings = (settings) => ({
  isEnabled: Boolean(settings?.examination_enabled),
  deliveryMode: settings?.exam_delivery_mode === 'online' ? 'online' : 'paper',
  updatedAt: settings?.updated_at || null,
});

const getExaminationSettings = async (client) => {
  const settings = await client.application_settings.findUnique({ where: { id: 1 } });
  return settings ? resolveExaminationSettings(settings) : DEFAULT_EXAMINATION_SETTINGS;
};

const isExaminationScheduleOpen = (exam, now = new Date()) => {
  if (!exam?.is_active) return false;
  const currentTime = now instanceof Date ? now : new Date(now);
  const startsAt = new Date(exam.exam_date);
  const endsAt = new Date(exam.exam_end_date || exam.exam_date);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const dateKey = (date) => {
    const parts = formatter.formatToParts(date);
    const part = (type) => parts.find((item) => item.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  };
  return !Number.isNaN(startsAt.getTime())
    && !Number.isNaN(endsAt.getTime())
    && dateKey(currentTime) >= dateKey(startsAt)
    && dateKey(currentTime) <= dateKey(endsAt);
};

const canAccessOnlineExamination = ({
  completed = false,
  settings,
  exam,
  examSlot,
  now = new Date(),
} = {}) => Boolean(
  !completed
  && settings?.isEnabled
  && settings?.deliveryMode === 'online'
  && examSlot?.appeared
  && isExaminationScheduleOpen(exam, now)
);

module.exports = {
  canAccessOnlineExamination,
  DEFAULT_EXAMINATION_SETTINGS,
  getExaminationSettings,
  isExaminationScheduleOpen,
  resolveExaminationSettings,
};
