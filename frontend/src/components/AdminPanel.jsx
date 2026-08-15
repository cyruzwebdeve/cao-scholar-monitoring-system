import { useState } from 'react';
import { API_BASE, authHeaders } from '../services/api';

function AdminPanel({ token, user }) {
  const [message, setMessage] = useState('');
  const [batchAmount, setBatchAmount] = useState('');
  const [releaseId, setReleaseId] = useState('');

  const roleMessage =
    user?.role !== 'BillingPayrollAdmin' && user?.role !== 'SuperAdmin'
      ? 'Admin actions are limited to SuperAdmin and BillingPayrollAdmin roles.'
      : '';

  if (!token) {
    return null;
  }

  return (
    <div className="dashboard-card">
      <h2>Admin Actions</h2>
      <p>{message || roleMessage || 'Use these actions when you are logged in as an authorized admin.'}</p>
      {user?.role === 'BillingPayrollAdmin' && (
        <>
          <form
            className="admin-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setMessage('');
              try {
                const response = await fetch(`${API_BASE}/payroll/billing-batch`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders(token),
                  },
                  body: JSON.stringify({ totalAmount: Number(batchAmount) }),
                });
                const body = await response.json();
                if (!response.ok) {
                  setMessage(body.message || 'Batch creation failed.');
                  return;
                }
                setMessage('Payroll batch created successfully.');
              } catch {
                setMessage('Unable to connect to backend.');
              }
            }}
          >
            <label htmlFor="batch-amount">Batch total amount</label>
            <input
              id="batch-amount"
              type="number"
              value={batchAmount}
              onChange={(e) => setBatchAmount(e.target.value)}
              min="0"
              step="0.01"
            />
            <button type="submit">Create Payroll Batch</button>
          </form>

          <form
            className="admin-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setMessage('');
              try {
                const response = await fetch(`${API_BASE}/payroll/billing-batch/${releaseId}/release`, {
                  method: 'PUT',
                  headers: authHeaders(token),
                });
                const body = await response.json();
                if (!response.ok) {
                  setMessage(body.message || 'Release failed.');
                  return;
                }
                setMessage('Payroll batch released successfully.');
              } catch {
                setMessage('Unable to connect to backend.');
              }
            }}
          >
            <label htmlFor="release-id">Release batch ID</label>
            <input
              id="release-id"
              type="number"
              value={releaseId}
              onChange={(e) => setReleaseId(e.target.value)}
            />
            <button type="submit">Release Payroll Batch</button>
          </form>
        </>
      )}
    </div>
  );
}

export default AdminPanel;
