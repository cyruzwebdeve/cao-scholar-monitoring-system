const normalizeActorType = (user) => {
  if (!user) return null;
  if (['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin', 'Moderator'].includes(user.role)) return 'admin';
  return user.role === 'Scholar' ? 'scholar' : 'applicant';
};

const createActivityData = ({ user, action, description, targetTable = null, targetId = null, ipAddress = null }) => {
  const numericTargetId = targetId === null || targetId === undefined || targetId === ''
    ? null
    : Number(targetId);
  return {
    actor_type: normalizeActorType(user),
    actor_id: user.id,
    action: String(action || '').slice(0, 100),
    target_table: targetTable ? String(targetTable).slice(0, 100) : null,
    target_id: Number.isInteger(numericTargetId) ? numericTargetId : null,
    description: description ? String(description).slice(0, 1000) : null,
    ip_address: ipAddress ? String(ipAddress).slice(0, 45) : null,
  };
};

const recordActivity = async (client, details) => {
  if (!details.user || !details.action) return null;
  return client.activity_logs.create({ data: createActivityData(details) });
};

const recordActivitySafely = async (client, details) => {
  try {
    return await recordActivity(client, details);
  } catch (error) {
    console.error('Activity log write failed.', {
      action: details.action,
      code: error.code || 'ACTIVITY_LOG_ERROR',
    });
    return null;
  }
};

const recordSuccessfulLogin = async (client, accountUser, { ipAddress = null } = {}) => {
  const timestamp = new Date();
  const accountUpdate = accountUser.accountType === 'admin'
    ? client.admins.update({
      where: { id: accountUser.account.id },
      data: { last_login_at: timestamp },
    })
    : client.control_accounts.update({
      where: { id: accountUser.account.id },
      data: { last_login_at: timestamp },
    });
  const activity = client.activity_logs.create({
    data: createActivityData({
      user: accountUser,
      action: 'USER_LOGIN',
      description: `${accountUser.role} signed in successfully.`,
      targetTable: accountUser.accountType === 'admin' ? 'admins' : 'control_accounts',
      targetId: accountUser.account.id,
      ipAddress,
    }),
  });

  await client.$transaction([accountUpdate, activity]);
  return timestamp;
};

module.exports = {
  createActivityData,
  normalizeActorType,
  recordActivity,
  recordActivitySafely,
  recordSuccessfulLogin,
};
