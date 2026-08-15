function StatusPanel({ user, scholar }) {
  if (!user) {
    return null;
  }

  return (
    <div className="dashboard-card">
      <h2>My Account</h2>
      <p><strong>Email:</strong> {user.email}</p>
      <p><strong>Role:</strong> {user.role}</p>
      {scholar ? (
        <>
          <p><strong>Scholar status:</strong> {scholar.status}</p>
          <p><strong>Exam score:</strong> {scholar.examScore ?? 'Not set'}</p>
        </>
      ) : (
        <p>No scholar application data available yet.</p>
      )}
    </div>
  );
}

export default StatusPanel;
