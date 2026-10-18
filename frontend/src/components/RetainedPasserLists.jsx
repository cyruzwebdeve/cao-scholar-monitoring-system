import { ChevronDown, LockKeyhole } from 'lucide-react';

export default function RetainedPasserLists({ lists, ready, busy, onPostDraft }) {
  return <section className="passer-retained-panel" aria-labelledby="passer-retained-title">
    <header><div><h3 id="passer-retained-title">Retained lists</h3><p>Review saved drafts and posted lists.</p></div><span className="passer-list-count">{lists.length}</span></header>
    <div className="passer-retained-records">{lists.length ? lists.map(list => <details key={list.id} className="passer-retained-record">
      <summary><span className="passer-retained-summary"><strong>#{list.id} · {list.title}</strong><span className="passer-retained-meta"><span className={`passer-list-status ${list.status === 'posted' ? 'posted' : 'draft'}`}>{list.status === 'posted' ? 'Posted · Locked' : 'Saved draft'}</span><span>{list.members.length} passers</span></span></span><ChevronDown size={16} className="passer-list-chevron" aria-hidden="true" /></summary>
      <div className="passer-retained-body"><p>{list.posted_at ? `Posted ${new Date(list.posted_at).toLocaleString()}` : `Saved ${new Date(list.created_at).toLocaleString()}`}</p>
        {list.supersedes_id && <p className="passer-revision-note">Revision of #{list.supersedes_id}: {list.revision_reason}</p>}
        <ul>{list.members.map(member => <li key={member.id}><span>{member.snapshot.name}</span><strong>Score {member.snapshot.score}</strong></li>)}</ul>
        {list.status === 'draft' && <button type="button" className="passer-primary-action" disabled={busy} onClick={() => onPostDraft(list.id)}><LockKeyhole size={14} aria-hidden="true" />Post &amp; lock saved draft</button>}
      </div>
    </details>) : <p className="passer-empty">{ready ? 'No saved lists yet. Your drafts and posted lists will appear here.' : 'Loading saved lists...'}</p>}</div>
  </section>;
}
