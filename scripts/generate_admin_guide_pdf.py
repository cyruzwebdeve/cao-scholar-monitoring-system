import pymupdf
import os
import sys

def build_pdf():
    images_dir = os.path.abspath("docs/images/admin").replace("\\", "/")
    archive = pymupdf.Archive(images_dir)
    
    css = """
    @page {
        size: A4;
        margin: 36pt 40pt;
    }
    body {
        font-family: Helvetica, Arial, sans-serif;
        font-size: 9.5pt;
        color: #1e293b;
        line-height: 1.45;
    }
    .cover-page {
        text-align: center;
        padding-top: 40pt;
        padding-bottom: 30pt;
        page-break-after: always;
    }
    .cover-eyebrow {
        font-size: 11pt;
        font-weight: bold;
        color: #047857;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        margin-bottom: 6pt;
    }
    .cover-title {
        font-size: 24pt;
        font-weight: bold;
        color: #064e3b;
        margin: 12pt 0 6pt 0;
        line-height: 1.2;
    }
    .cover-sub {
        font-size: 13pt;
        color: #334155;
        margin-bottom: 16pt;
    }
    .cover-org {
        font-size: 11pt;
        color: #475569;
        font-weight: 500;
        margin-bottom: 24pt;
    }
    .cover-meta {
        font-size: 9.5pt;
        color: #64748b;
        margin-top: 20pt;
    }
    .scope-box {
        background-color: #fef2f2;
        border: 1.5pt solid #ef4444;
        border-radius: 6pt;
        padding: 12pt 16pt;
        text-align: left;
        margin: 24pt auto;
        max-width: 440pt;
    }
    .scope-box h3 {
        color: #991b1b;
        margin: 0 0 6pt 0;
        font-size: 11pt;
    }
    .scope-box p {
        color: #7f1d1d;
        font-size: 9pt;
        margin: 4pt 0;
        line-height: 1.4;
    }
    .page-break {
        page-break-after: always;
    }
    .page-break-before {
        page-break-before: always;
    }
    h1 {
        font-size: 15pt;
        color: #065f46;
        border-bottom: 1.5pt solid #10b981;
        padding-bottom: 4pt;
        margin-top: 14pt;
        margin-bottom: 8pt;
    }
    h2 {
        font-size: 12pt;
        color: #047857;
        margin-top: 14pt;
        margin-bottom: 6pt;
    }
    h3 {
        font-size: 10.5pt;
        color: #0f172a;
        margin-top: 10pt;
        margin-bottom: 4pt;
    }
    p {
        margin: 5pt 0;
    }
    ul, ol {
        margin: 4pt 0 8pt 16pt;
        padding: 0;
    }
    li {
        margin-bottom: 3pt;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        margin: 10pt 0;
        font-size: 8.5pt;
    }
    th, td {
        border: 0.5pt solid #cbd5e1;
        padding: 5pt 7pt;
        text-align: left;
    }
    th {
        background-color: #f1f5f9;
        color: #0f172a;
        font-weight: bold;
    }
    tr:nth-child(even) {
        background-color: #f8fafc;
    }
    .note-box {
        background-color: #f0fdf4;
        border-left: 3pt solid #10b981;
        padding: 8pt 10pt;
        margin: 8pt 0;
        font-size: 9pt;
        color: #064e3b;
    }
    .warn-box {
        background-color: #fffbeb;
        border-left: 3pt solid #f59e0b;
        padding: 8pt 10pt;
        margin: 8pt 0;
        font-size: 9pt;
        color: #78350f;
    }
    .figure-container {
        border: 1pt solid #cbd5e1;
        border-radius: 5pt;
        background-color: #ffffff;
        padding: 8pt;
        margin: 14pt 0 16pt 0;
        page-break-inside: avoid;
    }
    .figure-header {
        background-color: #065f46;
        color: #ffffff;
        padding: 4pt 8pt;
        font-size: 9pt;
        font-weight: bold;
        border-radius: 3pt 3pt 0 0;
        margin: -8pt -8pt 8pt -8pt;
    }
    .figure-img-wrapper {
        text-align: center;
        background-color: #f8fafc;
        border: 0.5pt solid #e2e8f0;
        padding: 4pt;
        border-radius: 3pt;
    }
    .figure-container {
        border: 1pt solid #cbd5e1;
        border-radius: 5pt;
        background-color: #ffffff;
        padding: 6pt;
        margin: 8pt 0 10pt 0;
        page-break-inside: avoid;
    }
    .figure-img-wrapper img {
        height: 165pt;
        max-width: 480pt;
        display: block;
        margin: 0 auto;
    }
    .figure-caption {
        padding: 8pt 4pt 4pt 4pt;
        font-size: 8.5pt;
        color: #334155;
        line-height: 1.4;
    }
    .callout-list {
        background-color: #f8fafc;
        border: 0.5pt solid #e2e8f0;
        border-radius: 3pt;
        padding: 6pt 10pt;
        margin-top: 6pt;
        font-size: 8.5pt;
    }
    .callout-list strong {
        color: #065f46;
    }
    .action-tip {
        margin-top: 6pt;
        font-size: 8.5pt;
        color: #0f172a;
        background-color: #f0fdf4;
        border-left: 2pt solid #059669;
        padding: 4pt 8pt;
    }
    .toc-item {
        margin: 4pt 0;
        font-size: 9pt;
    }
    .formula-box {
        background-color: #f1f5f9;
        border: 1pt solid #94a3b8;
        padding: 8pt 12pt;
        margin: 8pt 0;
        font-family: monospace;
        font-size: 9pt;
        color: #0f172a;
        border-radius: 4pt;
    }
    """

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8">
    <style>{css}</style>
    </head>
    <body>

    <div class="cover-page">
        <div class="cover-eyebrow">Province of Camarines Norte · Community Affairs Office</div>
        <div class="cover-title">PGCEAP SCHOLARSHIP MANAGEMENT SYSTEM</div>
        <div class="cover-sub">Comprehensive Administrator Guide & Operational Reference Manual</div>
        <div class="cover-org">Provincial Government College Educational Assistance Program</div>
        
        <div class="scope-box">
            <h3>LEGAL & OPERATIONAL SCOPE BOUNDARY NOTICE</h3>
            <p><strong>Strict CAO Processing Boundary:</strong> The official scholarship workflow ends upon CAO generation of the official <strong>Payroll List</strong> or <strong>Billing Certification List</strong>.</p>
            <p><strong>Exclusions:</strong> The system does NOT release monetary funds, disburse cash/checks, process payment claiming, or conduct financial audits of released funds. Activity Logs are operational system logs, not monetary disbursement audits.</p>
            <p><strong>Approved Exception:</strong> Payout Schedules provide informational timing and venues; staff-recorded attendance and Scholar-owned "Received Payout" self-reported acknowledgements are strictly separate from official financial disbursement.</p>
        </div>

        <div class="cover-meta">
            Document Version: <strong>2026.1</strong> | Applicable: Academic Year 2026–2027 onwards<br>
            Authorized Audience: Super Administrators, Regular Administrators, Billing/Payroll Administrators<br>
            Verified against live deployment: <code>https://cnpgceap-sms.com/dashboard</code>
        </div>
    </div>

    <h1>1. System Introduction & Governance Boundary</h1>
    <p>The <strong>PGCEAP Scholarship Management System</strong> provides authorized personnel of the Community Affairs Office (CAO) with a secure, centralized console to manage scholarship intake, evaluate applicant qualifications, supervise examinations, verify submitted academic requirements, and generate official billing and payroll batches.</p>
    
    <h2>1.1 User Roles & Permission Matrix</h2>
    <table>
        <tr>
            <th>Functional Area</th>
            <th>Regular Admin</th>
            <th>Billing / Payroll Admin</th>
            <th>Super Administrator</th>
        </tr>
        <tr>
            <td><strong>Dashboard Overview</strong></td>
            <td>View Telemetry</td>
            <td>View Telemetry</td>
            <td>Full Telemetry & Activity</td>
        </tr>
        <tr>
            <td><strong>Applicants & Scorecards</strong></td>
            <td>View / Filter</td>
            <td>View / Filter</td>
            <td>Full Access & Overrides</td>
        </tr>
        <tr>
            <td><strong>Schedules & Exam Venues</strong></td>
            <td>View / Roster</td>
            <td>View / Roster</td>
            <td>Configure & Activate Venues</td>
        </tr>
        <tr>
            <td><strong>Results & Passer Lists</strong></td>
            <td>Score Entry</td>
            <td>Score Entry</td>
            <td>Publish & Lock Passer Lists</td>
        </tr>
        <tr>
            <td><strong>Document Reviews Queue</strong></td>
            <td>View Only</td>
            <td>Approve / Reject / Bulk</td>
            <td>Approve / Reject / Bulk</td>
        </tr>
        <tr>
            <td><strong>Scholars Directory & Drawer</strong></td>
            <td>View / Filter</td>
            <td>Intake & Session Prep</td>
            <td>Full Management</td>
        </tr>
        <tr>
            <td><strong>Prepare Scholars (Batch Grants)</strong></td>
            <td>View Only</td>
            <td>Enter Tuition & Save</td>
            <td>Full Preparation Access</td>
        </tr>
        <tr>
            <td><strong>Billing Queue & Word Export</strong></td>
            <td>View Only</td>
            <td>Generate Batch & Word</td>
            <td>Generate Batch & Word</td>
        </tr>
        <tr>
            <td><strong>Payroll Lists & Excel Export</strong></td>
            <td>View Only</td>
            <td>Generate Batch & Excel</td>
            <td>Generate Batch & Excel</td>
        </tr>
        <tr>
            <td><strong>Payout Schedules & Attendance</strong></td>
            <td>Record Attendance</td>
            <td>Publish & Attendance</td>
            <td>Full Access</td>
        </tr>
        <tr>
            <td><strong>Staff & Permissions</strong></td>
            <td>Denied</td>
            <td>Denied</td>
            <td>Full Staff Management</td>
        </tr>
        <tr>
            <td><strong>System Settings & Periods</strong></td>
            <td>View Only</td>
            <td>View Only</td>
            <td>Full System Configuration</td>
        </tr>
    </table>

    <div class="page-break"></div>

    <h1>2. Dashboard Overview & Operational Telemetry</h1>
    <p>Upon logging in at <code>https://cnpgceap-sms.com/login</code>, administrators are directed to the main <strong>Dashboard Overview</strong>. This workspace provides high-level metrics, active submission alerts, and real-time activity streams.</p>

    <div class="figure-container">
        <div class="figure-header">FIGURE 2.1: LIVE PROGRAM OPERATIONS DASHBOARD OVERVIEW</div>
        <div class="figure-img-wrapper">
            <img src="dashboard-overview.png" />
        </div>
        <div class="figure-caption">
            <strong>Screen Overview:</strong> The primary landing console for authenticated administrators, showing live telemetry cards, recent online applications, and operational activity streams.
            <div class="callout-list">
                <strong>STEP-BY-STEP DIRECTIONS & WORKFLOW:</strong><br>
                • <strong>Direction 1 (Sidebar Navigation):</strong> Use the left rail to switch between all 11 administrative workspaces (Applicants, Staff, Scholars, Document Reviews, Billing, Payroll, Settings, etc.).<br>
                • <strong>Direction 2 (Check Telemetry):</strong> Review active scholar enrollment counts and ensure the green <em>Live data</em> polling indicator is active.<br>
                • <strong>Direction 3 (Monitor Inbound Submissions):</strong> Inspect newly arrived applicant profiles (e.g. Bansho, Zoro, Cabanes) and their current submission statuses.<br>
                • <strong>Direction 4 (Quick Action Link):</strong> Click the <strong>"View applicants"</strong> shortcut to jump directly to the master applicant screening table.<br>
                • <strong>Direction 5 (Verify Activity Stream):</strong> Audit the real-time activity log for recent administrative sign-ins (<code>USER_LOGIN</code>) and scholar metadata updates.
            </div>
            <div class="action-tip">
                <strong>Administrator Routine:</strong> Start each business day by verifying Direction 2 (Telemetry) and Direction 3 (Inbound Submissions) to plan exam scheduling sessions.
            </div>
        </div>
    </div>

    <div class="page-break"></div>

    <h1>3. Applicants & Examination Management</h1>
    <p>Located under <strong>Applicants</strong> in the sidebar, this workspace coordinates applicant screening, eligibility scorecards, examination venues, and passer lists across four tabs: <em>Applicants</em>, <em>Potential Scholars</em>, <em>Schedules & Assignments</em>, and <em>Results</em>.</p>

    <div class="figure-container">
        <div class="figure-header">FIGURE 3.1: APPLICANTS DIRECTORY & MULTI-PARAMETER FILTER WORKSPACE</div>
        <div class="figure-img-wrapper">
            <img src="applicants-workspace.png" />
        </div>
        <div class="figure-caption">
            <strong>Screen Overview:</strong> The central intake workspace displaying the complete applicant roster with multi-parameter filtering, metric summaries, and individual application drawer access.
            <div class="callout-list">
                <strong>STEP-BY-STEP DIRECTIONS & WORKFLOW:</strong><br>
                • <strong>Direction 1 (Select Tab):</strong> Switch between <em>Applicants</em> (roster), <em>Potential Scholars</em> (passers), <em>Schedules & Assignments</em> (venues), and <em>Results</em> (scoring).<br>
                • <strong>Direction 2 (Review Metrics):</strong> Monitor overall progress across Total Applicants, Scheduled for Exam, Exam Completed, and Passed.<br>
                • <strong>Direction 3 (Apply Filters):</strong> Filter applicants by Municipality (all 12 LGUs), Barangay, Academic Year, and declared Priority Criteria (Honors, ALS, PWD, Solo Parent, IP).<br>
                • <strong>Direction 4 (Inspect Roster):</strong> Browse matching applicant rows showing name, control number, email, and registration timestamps.<br>
                • <strong>Direction 5 (Open Scorecard):</strong> Click the <strong>"View"</strong> button on any row to open the 100-Point Explainable Recommendation Scorecard.
            </div>
            <div class="action-tip">
                <strong>Scorecard Direction:</strong> Inspect contributing factors on the scorecard. If manual acceptance is warranted contrary to recommendation, check <em>Override recommendation</em> and enter a required written justification.
            </div>
        </div>
    </div>

    <h2>3.1 Examination Scheduling & Activation</h2>
    <p>Under <strong>Schedules & Assignments</strong>, each municipality has a dedicated scheduling card. Staff set the venue name, delivery mode (<em>Paper and Pen</em> vs. <em>Online Examination</em>), date range, and reporting time in Philippine Standard Time (PST / UTC+8). Clicking <strong>"Activate"</strong> makes the schedule visible to applicants in that municipality.</p>

    <h2>3.2 Results & Passer List Publication</h2>
    <p>Under <strong>Results</strong>, staff enter scores for paper examinations or review automated scores for online exams. Once score thresholds are confirmed, click <strong>"Publish Passer List"</strong> to release outcomes to applicants, then click <strong>"Lock Passer List"</strong> to freeze records against tampering.</p>

    <div class="page-break"></div>

    <h1>4. Document Reviews & Verification Queue</h1>
    <p>Located under <strong>Document Reviews</strong> in the sidebar, this queue provides a protected environment to inspect submitted proofs and requirements without exposing cloud storage locations.</p>

    <div class="figure-container">
        <div class="figure-header">FIGURE 4.1: SCHOLAR-GROUPED DOCUMENT REVIEW QUEUE & PREVIEW MODAL</div>
        <div class="figure-img-wrapper">
            <img src="document-reviews.png" />
        </div>
        <div class="figure-caption">
            <strong>Screen Overview:</strong> The verification workstation showing the grouped review queue, summary metrics, and the secure document preview modal with approval/rejection controls.
            <div class="callout-list">
                <strong>STEP-BY-STEP DIRECTIONS & WORKFLOW:</strong><br>
                • <strong>Direction 1 (Examine Document):</strong> Inspect the submitted PDF or image in the secure, high-contrast document preview pane (zoom, pan, multi-page).<br>
                • <strong>Direction 2 (Check Metadata):</strong> Confirm file name, upload date/time, and applicant municipality on the right-hand panel.<br>
                • <strong>Direction 3 (Evaluate Checklist):</strong> Verify the submission against displayed institutional standards (registrar dry seal, passing GPA, enrolled unit count).<br>
                • <strong>Direction 4 (Reject & Note):</strong> If deficient, click <strong>"Reject document"</strong> and enter a mandatory, clear correction note.<br>
                • <strong>Direction 5 (Approve Requirement):</strong> If valid, click <strong>"Approve document"</strong> to confirm the requirement and advance scholar readiness.
            </div>
            <div class="action-tip">
                <strong>Bulk Approval Rule:</strong> You may use <em>"Approve all pending requirements"</em> for routine continuing submissions. <strong>Priority Proofs</strong> (PWD, Solo Parent, IP, Honors) must be verified individually via Directions 1–5.
            </div>
        </div>
    </div>

    <h1>5. Scholars Management & Lifecycle Tracking</h1>
    <p>Located under <strong>Scholars</strong> in the sidebar, this module tracks active scholars throughout their college degree. It contains three main sections:</p>
    <ul>
        <li><strong>Scholar Directory:</strong> Master directory searchable by name, scholar ID, or school, with year-level filters (<em>1st Year to 5th Year</em>) and CSV exports.</li>
        <li><strong>Continuing Requirements:</strong> Allows administrators to select an active Academic Period and toggle submission access <strong>Open</strong> or <strong>Closed</strong>.</li>
        <li><strong>Graduates & Latin Honors:</strong> Tracks degree completion, diplomas, and official recognition for <em>Summa Cum Laude, Magna Cum Laude, and Cum Laude</em> recipients.</li>
    </ul>

    <div class="page-break"></div>

    <h1>6. Billing Workspace (Private-School Grant Certification)</h1>
    <p>Located under <strong>Billing</strong> in the sidebar, this workspace manages tuition assistance verification and official list generation for Private-School Scholars.</p>

    <div class="formula-box">
        PRIVATE GRANT FORMULA:<br>
        • Total Grant Cap = PHP 5,000.00 (Fixed per semester)<br>
        • Tuition Fee Assistance = Verified from official school receipt (PHP 0.00 to PHP 5,000.00)<br>
        • Living Allowance = PHP 5,000.00 - Tuition Fee Assistance (Auto-computed)
    </div>

    <div class="figure-container">
        <div class="figure-header">FIGURE 6.1: BILLING QUEUE & DUAL-LIST TRANSFER WORKSPACE</div>
        <div class="figure-img-wrapper">
            <img src="billing-management.png" />
        </div>
        <div class="figure-caption">
            <strong>Screen Overview:</strong> The operational Billing workspace showing the dual-list transfer interface, active processing period selector, summary statistics, and list generation actions.
            <div class="callout-list">
                <strong>STEP-BY-STEP DIRECTIONS & WORKFLOW:</strong><br>
                • <strong>Direction 1 (Period & Subtabs):</strong> Select the active Academic Period (e.g. 1st Semester Primary) and open <em>Prepare Scholars</em> first to save tuition fee breakdowns.<br>
                • <strong>Direction 2 (Select Source Scholars):</strong> In the left box (<em>List of Scholars</em>), review private scholars whose grants are prepared and ready.<br>
                • <strong>Direction 3 (Transfer Records):</strong> Click the center arrow buttons (<code>Move selected</code> or <code>Move all eligible</code>) to move scholars into the queue.<br>
                • <strong>Direction 4 (Review Staged Queue):</strong> In the right box (<em>For Billing</em>), verify the final batch membership and grant allocations.<br>
                • <strong>Direction 5 (Generate Certification):</strong> Click <strong>"Generate certification list"</strong> to commit the batch, assign reference numbers, and download the official Word (<code>.docx</code>) certification document.
            </div>
            <div class="action-tip">
                <strong>Sequential Prerequisite:</strong> Never skip <strong>Prepare Scholars</strong>. Tuition Fee Assistance must be saved from official receipts before list generation.
            </div>
        </div>
    </div>

    <div class="page-break"></div>

    <h1>7. Payroll Workspace (Public & Remaining Private Scholars)</h1>
    <p>Located under <strong>Payroll</strong> in the sidebar, this workspace processes Public-School Scholars (who receive direct fixed living assistance) and late-submitting remaining Private Scholars.</p>

    <div class="figure-container">
        <div class="figure-header">FIGURE 7.1: PAYROLL QUEUE & LIST GENERATION WORKSPACE</div>
        <div class="figure-img-wrapper">
            <img src="payroll-management.png" />
        </div>
        <div class="figure-caption">
            <strong>Screen Overview:</strong> The operational Payroll workspace displaying unprocessed scholars, filtering tools, Word/Excel generation buttons, and Payout Schedule access.
            <div class="callout-list">
                <strong>STEP-BY-STEP DIRECTIONS & WORKFLOW:</strong><br>
                • <strong>Direction 1 (Confirm Workspace):</strong> Ensure the <em>Payroll lists</em> tab is active and the correct academic period is selected.<br>
                • <strong>Direction 2 (Filter Unprocessed):</strong> Set the Payroll List filter to <strong>"Not included yet"</strong> to isolate eligible scholars.<br>
                • <strong>Direction 3 (Check Roster):</strong> Select public scholars (or remaining private scholars via <em>Send to Payroll</em>) to include in the batch.<br>
                • <strong>Direction 4 (Generate Payroll List):</strong> Click <strong>"Generate payroll list"</strong> to finalize the batch, assigning reference numbers and downloading Word and formatted Excel (<code>.xlsx</code>) files.<br>
                • <strong>Direction 5 (Publish Payout Schedule):</strong> Switch to the <strong>"Payout schedules"</strong> tab to set dates and venues for this finalized batch.
            </div>
            <div class="action-tip">
                <strong>Excel Default:</strong> In generated Excel files, unassigned tuition/allowance breakdowns automatically default to numeric <code>0.00</code> while preserving the full stipend amount.
            </div>
        </div>
    </div>

    <h2>7.1 Payout Schedules & Attendance Administration</h2>
    <p>Under <strong>Payroll → Payout schedules</strong>, staff can publish informational payout announcements for any finalized Payroll batch. Staff select the batch, specify the Philippine Standard Time window and physical venue, and click <strong>"Publish Schedule"</strong> to send automated Gmail alerts to recipients.</p>
    <p><strong>Attendance vs. Receipt:</strong> On the scheduled day, staff open <em>Attendance & status</em> to mark physical presence (<em>Not marked, Present, Absent</em>). Scholars voluntarily log in to their portal to submit a self-reported <em>"Received Payout"</em> confirmation. Staff cannot force or confirm receipt for a scholar.</p>

    <div class="page-break"></div>

    <h1>8. Staff Administration & Granular Permissions</h1>
    <p>Located under <strong>Staff</strong> in the sidebar *(Super Administrator Only)*, this workspace controls staff accounts across three system roles:</p>
    <ul>
        <li><code>SuperAdmin</code>: Unrestricted access to all configuration, catalog, staff, logs, and workflow tools.</li>
        <li><code>RegularAdmin</code>: Routine application review, examination scheduling, and scholar monitoring.</li>
        <li><code>BillingPayrollAdmin</code>: Document verification, batch grant preparation, and billing/payroll list generation.</li>
    </ul>
    <p><strong>Granular Section Permissions:</strong> Super Administrators can restrict individual staff accounts to specific sidebar modules (e.g. restricting an officer to <em>Document Reviews</em> only). The system strictly prohibits deleting or deactivating the last active SuperAdmin account.</p>

    <h1>9. System Settings & Configuration</h1>
    <p>Located under <strong>Settings</strong> in the sidebar *(Super Administrator Only)*, this area manages global system parameters across six tabs:</p>

    <div class="figure-container">
        <div class="figure-header">FIGURE 9.1: APPLICATION FORM ACCESS & SCHEDULED AVAILABILITY CONTROLS</div>
        <div class="figure-img-wrapper">
            <img src="settings-workspace.png" />
        </div>
        <div class="figure-caption">
            <strong>Screen Overview:</strong> The administrative configuration stage for controlling public scholarship application submission access and automated scheduling windows.
            <div class="callout-list">
                <strong>STEP-BY-STEP DIRECTIONS & WORKFLOW:</strong><br>
                • <strong>Direction 1 (Settings Navigation):</strong> Switch between tabs (<em>Applications</em>, <em>Academic Year</em>, <em>Requirements</em>, <em>Examination</em>, <em>School Catalog</em>, <em>System Health</em>).<br>
                • <strong>Direction 2 (Immediate Toggle):</strong> Switch the radio toggle between <code>Enabled</code> (open immediately) and <code>Disabled</code> (close immediately).<br>
                • <strong>Direction 3 (Schedule Time Window):</strong> Set optional <em>Opens on</em> and <em>Closes on</em> timestamps in Philippine Standard Time (UTC+8).<br>
                • <strong>Direction 4 (Commit Settings):</strong> Click <strong>"Save application setting"</strong> to enforce the schedule across the public portal.<br>
                • <strong>Direction 5 (School Catalog Routing):</strong> Open the <strong>School Catalog</strong> tab to configure institutions as Public or Private (controlling Billing vs. Payroll routing).
            </div>
            <div class="action-tip">
                <strong>Routing Integrity:</strong> Never change a school's classification during an active batch cycle, as it drives downstream Billing vs. Payroll eligibility.
            </div>
        </div>
    </div>

    <div class="page-break"></div>

    <h1>10. Activity Logs, Announcements & Reports</h1>
    <ul>
        <li><strong>Activity Logs:</strong> Real-time immutable audit trail recording sign-ins, record edits, document decisions, and batch generations. <em>(Operational logs; not monetary audits).</em></li>
        <li><strong>Announcements Management:</strong> Publish public advisories or portal notices with rich text and banner image attachments.</li>
        <li><strong>Reports & Analytics:</strong> Executive summaries covering demographic distribution, retention rates, and approved payroll amounts. Supports formula-injection-safe XLSX exports.</li>
    </ul>

    <h1>11. Administrator Troubleshooting & Safety Checklist</h1>
    <table>
        <tr>
            <th>Scenario / Error Message</th>
            <th>Underlying Cause</th>
            <th>Recommended Action</th>
        </tr>
        <tr>
            <td><strong>Private scholar cannot be added to Billing</strong></td>
            <td>School is classified as Public in catalog.</td>
            <td>Check School Catalog. Public scholars must be processed in Payroll.</td>
        </tr>
        <tr>
            <td><strong>"Set tuition before billing" error</strong></td>
            <td>Grant breakdown has not been saved.</td>
            <td>Open <em>Billing → Prepare Scholars</em>, enter tuition assistance from receipt, and click <em>Save ready rows</em>.</td>
        </tr>
        <tr>
            <td><strong>"Already listed in period" error</strong></td>
            <td>Scholar was included in an earlier batch this term.</td>
            <td>Scholars can only be listed once per academic period. Check Billing/Payroll history.</td>
        </tr>
        <tr>
            <td><strong>"Send to Payroll" button is missing</strong></td>
            <td>No regular Billing batch generated yet for period.</td>
            <td>Generate the initial regular Billing batch first; "Send to Payroll" is for subsequent remaining scholars.</td>
        </tr>
        <tr>
            <td><strong>Cannot mark payout attendance</strong></td>
            <td>Scheduled start time has not arrived.</td>
            <td>Attendance recording unlocks strictly upon arrival of the scheduled start date and time.</td>
        </tr>
        <tr>
            <td><strong>Scholar cannot confirm receipt</strong></td>
            <td>Schedule not started or cancelled.</td>
            <td>Confirm schedule is published and current. Scholar confirmation is self-reported and voluntary.</td>
        </tr>
    </table>

    <div style="text-align: center; margin-top: 30pt; font-size: 8.5pt; color: #64748b; border-top: 0.5pt solid #cbd5e1; padding-top: 10pt;">
        Provincial Government College Educational Assistance Program (PGCEAP)<br>
        Community Affairs Office (CAO), Province of Camarines Norte · Official System Documentation
    </div>

    </body>
    </html>
    """

    raw_pdf = "docs/raw_guide.pdf"
    out_pdf = "docs/PGCEAP_Administrator_Guide.pdf"
    if os.path.exists(raw_pdf):
        try: os.remove(raw_pdf)
        except: pass
    if os.path.exists(out_pdf):
        try: os.remove(out_pdf)
        except: pass

    writer = pymupdf.DocumentWriter(raw_pdf)
    story = pymupdf.Story(html, archive=archive)
    
    # A4 printable rectangle: 595 x 842. Margins: 36 top, 40 left, 555 right, 806 bottom
    rect = pymupdf.Rect(40, 36, 555, 806)
    more = 1
    page_count = 0
    while more:
        page_count += 1
        device = writer.begin_page(pymupdf.Rect(0, 0, 595, 842))
        more, _ = story.place(rect)
        story.draw(device)
        writer.end_page()
    writer.close()

    # Now let's open raw_pdf with pymupdf and add professional running headers and footers (page numbers)
    doc = pymupdf.open(raw_pdf)
    total_pages = len(doc)
    
    for i, page in enumerate(doc):
        if i == 0:
            continue # Skip cover page
        # Running header
        header_text = "PGCEAP Scholarship Management System · Administrator Guide"
        page.insert_text(pymupdf.Point(40, 26), header_text, fontsize=8, color=(0.4, 0.45, 0.5))
        page.draw_line(pymupdf.Point(40, 30), pymupdf.Point(555, 30), color=(0.8, 0.85, 0.9), width=0.5)
        
        # Running footer
        footer_text = f"Page {i+1} of {total_pages}"
        office_text = "Community Affairs Office · Province of Camarines Norte"
        page.draw_line(pymupdf.Point(40, 814), pymupdf.Point(555, 814), color=(0.8, 0.85, 0.9), width=0.5)
        page.insert_text(pymupdf.Point(40, 826), office_text, fontsize=8, color=(0.4, 0.45, 0.5))
        page.insert_text(pymupdf.Point(505, 826), footer_text, fontsize=8, color=(0.4, 0.45, 0.5))

    doc.save(out_pdf, deflate=True)
    doc.close()
    if os.path.exists(raw_pdf):
        try: os.remove(raw_pdf)
        except: pass
    
    print(f"Successfully generated {out_pdf} ({total_pages} pages).")
    
    # Also copy to output/ and artifact directory for easy download and access
    import shutil
    os.makedirs("output", exist_ok=True)
    shutil.copy(out_pdf, "output/PGCEAP_Administrator_Guide.pdf")
    artifact_dest = "C:/Users/Daniela Ann/.gemini/antigravity/brain/e2c6050c-cb10-466b-bd08-b2b504b88f1e/PGCEAP_Administrator_Guide.pdf"
    shutil.copy(out_pdf, artifact_dest)
    print("Copied PDF to output/ and artifact directory.")

if __name__ == "__main__":
    build_pdf()
