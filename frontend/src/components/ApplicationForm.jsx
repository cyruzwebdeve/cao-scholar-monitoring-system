import { useEffect, useMemo, useState } from 'react';
import { CircleCheckBig, Info, UsersRound } from 'lucide-react';
import { API_BASE, authHeaders } from '../services/api';
import municipalitiesData from '../../../municipality.json';
import barangaysData from '../../../brgy.json';
import schoolsListData from '../../../schools_list.json';

const municipalityOptions = municipalitiesData.map((item) => ({
  value: item.code,
  label: item.name,
}));

const municipalityNameByCode = Object.fromEntries(
  municipalitiesData.map((item) => [item.code, item.name]),
);

const barangayNameByCode = Object.fromEntries(
  barangaysData.map((item) => [item.code, item.name]),
);

const schoolOptions = schoolsListData.schools.map((school) => ({
  value: school,
  label: school,
}));

const yearLevels = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate'];
const sexOptions = ['Male', 'Female', 'Prefer not to say'];
const civilStatuses = ['Single', 'Married', 'Separated', 'Widowed'];
const incomeOptions = [
  'Below ₱50,000', '₱50,000 - ₱100,000', '₱100,001 - ₱150,000',
  '₱150,001 - ₱200,000', 'Above ₱200,000',
];
const countOptions = ['0', '1', '2', '3', '4', '5+'];
const priorityCriteria = [
  { label: 'Graduated Valedictorian or with Highest Honors', key: 'graduatedHonors', proofKey: 'priority_graduated_honors' },
  { label: 'Champion / 1st Placer in an Academic Contest', key: 'championContest', proofKey: 'priority_champion_contest' },
  { label: 'ALS (Alternative Learning System) Passer', key: 'alsPasser', proofKey: 'priority_als_passer' },
  { label: 'Person with Disability (PWD)', key: 'pwd', proofKey: 'priority_pwd' },
  { label: 'Child of a Person with Disability', key: 'childOfPwd', proofKey: 'priority_child_of_pwd' },
  { label: 'Solo Parent', key: 'soloParent', proofKey: 'priority_solo_parent' },
  { label: 'Member of Indigenous Group', key: 'indigenousGroup', proofKey: 'priority_indigenous_group' },
];

const createEmptyFormState = () => ({
  firstName: '', middleName: '', familyName: '', nameExtension: '', email: '', mobile: '', birthday: '', birthplace: '', sex: '', civilStatus: '',
  houseNumber: '', municipality: '', barangay: '', school: '', course: '', incomingYearLevel: '',
  fatherName: '', fatherOccupation: '', motherName: '', motherOccupation: '', guardianName: '', guardianOccupation: '',
  familyIncome: '', gwa: '', brothersCount: '0', sistersCount: '0', graduatedHonors: 'No', championContest: 'No', alsPasser: 'No', pwd: 'No', childOfPwd: 'No', soloParent: 'No', indigenousGroup: 'No', siblingRuleAccepted: false,
});

const validateName = (value) => /^[A-ZÑ\s.'-]+$/.test(value.trim());
const validateMobile = (value) => /^\d{1,11}$/.test(value.trim());
const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const validateDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());

function FieldLabel({ children, required = false }) {
  return (
    <span className="label">
      {children}
      {required && <span className="required-indicator">*</span>}
    </span>
  );
}

function ApplicationForm({ token, user, onCreated, onGoToLogin, step: externalStep, setStep: externalSetStep }) {
  const [internalStep, setInternalStep] = useState(0);
  const step = typeof externalStep === 'number' ? externalStep : internalStep;
  const setStep = externalSetStep || setInternalStep;

  const [formState, setFormState] = useState(() => ({ ...createEmptyFormState(), email: user?.email || '' }));

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [completed, setCompleted] = useState(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [accountCredentials, setAccountCredentials] = useState(null);
  const [redirectSeconds, setRedirectSeconds] = useState(30);
  const [priorityProof, setPriorityProof] = useState({ proofKey: '', fileName: '', fileData: '' });
  const [draftHydrated, setDraftHydrated] = useState(false);
  const draftStorageKey = 'scholarship-application-draft';

  // Draft restoration intentionally hydrates React state from localStorage once.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      if (sessionStorage.getItem('application-submitted') === 'true') {
        sessionStorage.removeItem('application-submitted');
        localStorage.removeItem(draftStorageKey);
        setDraftHydrated(true);
        return;
      }
      const savedDraft = JSON.parse(localStorage.getItem(draftStorageKey) || 'null');
      if (savedDraft) {
        if (savedDraft.formState) {
          const savedFormState = savedDraft.formState;
          setFormState((previous) => ({
            ...previous,
            ...savedFormState,
            graduatedHonors: savedFormState.graduatedHonors || 'No',
            championContest: savedFormState.championContest || 'No',
            alsPasser: savedFormState.alsPasser || 'No',
            pwd: savedFormState.pwd || 'No',
            childOfPwd: savedFormState.childOfPwd || 'No',
            soloParent: savedFormState.soloParent || 'No',
            indigenousGroup: savedFormState.indigenousGroup || 'No',
          }));
        }
        if (Array.isArray(savedDraft.completed)) setCompleted(new Set(savedDraft.completed));
        if (typeof savedDraft.step === 'number') setStep(savedDraft.step);
      }
    } catch {
      localStorage.removeItem(draftStorageKey);
    } finally {
      setDraftHydrated(true);
    }
  }, [draftStorageKey, setStep]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!draftHydrated || submitted) return;
    localStorage.setItem(draftStorageKey, JSON.stringify({
      formState,
      completed: [...completed],
      step,
    }));
  }, [draftStorageKey, formState, completed, step, submitted, draftHydrated]);

  useEffect(() => {
    if (!submitted) return undefined;
    const interval = window.setInterval(() => {
      setRedirectSeconds((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(interval);
          onGoToLogin?.();
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [submitted, onGoToLogin]);

  const stepTitles = ['Personal Information', 'Address & Academic Information', 'Family & Eligibility Information'];
  const barangayOptions = useMemo(
    () => barangaysData.filter((item) => item.municipalityCode === formState.municipality),
    [formState.municipality],
  );

  const handleChange = (key, value) => {
    let parsedValue = value;

    if (['firstName', 'middleName', 'familyName', 'nameExtension', 'birthplace', 'fatherName', 'motherName', 'guardianName'].includes(key)) {
      parsedValue = value.toUpperCase();
    }

    if (key === 'mobile') {
      parsedValue = value.replace(/\D/g, '').slice(0, 11);
    }

    if (key === 'municipality') {
      setFormState((prev) => ({ ...prev, municipality: parsedValue, barangay: '' }));
      setFieldErrors((prev) => ({ ...prev, municipality: '', barangay: '' }));
      return;
    }

    setFormState((prev) => ({ ...prev, [key]: parsedValue }));
    setFieldErrors((prev) => ({ ...prev, [key]: '' }));
    const criterion = priorityCriteria.find((item) => item.key === key);
    if (criterion && parsedValue === 'Yes') setPriorityProof((current) => current.proofKey ? current : { ...current, proofKey: criterion.proofKey });
    if (criterion && parsedValue === 'No') setPriorityProof((current) => current.proofKey === criterion.proofKey ? { proofKey: '', fileName: '', fileData: '' } : current);
  };

  const handlePriorityProof = (file) => {
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setFieldErrors((current) => ({ ...current, priorityProof: 'Use a PDF, JPG, or PNG file.' }));
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setFieldErrors((current) => ({ ...current, priorityProof: 'The proof must be smaller than 6 MB.' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPriorityProof((current) => ({ ...current, fileName: file.name, fileData: String(reader.result || '') }));
      setFieldErrors((current) => ({ ...current, priorityProof: '' }));
    };
    reader.readAsDataURL(file);
  };

  const validateCurrentStep = () => {
    const errors = {};
    const required = {
      0: ['firstName', 'familyName', 'email', 'mobile', 'birthday', 'birthplace', 'sex', 'civilStatus'],
      1: ['houseNumber', 'municipality', 'barangay', 'incomingYearLevel', 'school', 'course'],
      2: ['fatherName', 'fatherOccupation', 'motherName', 'motherOccupation', 'familyIncome', 'gwa', 'brothersCount', 'sistersCount', 'graduatedHonors', 'championContest', 'alsPasser', 'pwd', 'childOfPwd', 'soloParent', 'indigenousGroup', 'siblingRuleAccepted'],
    };

    const keys = required[step] || [];
    keys.forEach((key) => {
      const value = formState[key];
      if (!value || (typeof value === 'string' && !value.trim())) {
        errors[key] = 'This field is required.';
      }
    });

    if (!formState.firstName || !validateName(formState.firstName)) {
      errors.firstName = 'Use uppercase letters only.';
    }
    if (formState.middleName && !validateName(formState.middleName)) {
      errors.middleName = 'Use uppercase letters only.';
    }
    if (!formState.familyName || !validateName(formState.familyName)) {
      errors.familyName = 'Use uppercase letters only.';
    }
    if (formState.nameExtension && !validateName(formState.nameExtension)) {
      errors.nameExtension = 'Use uppercase letters only.';
    }
    if (formState.email && !validateEmail(formState.email)) {
      errors.email = 'Enter a valid email address.';
    }
    if (formState.mobile && !validateMobile(formState.mobile)) {
      errors.mobile = 'Enter up to 11 digits.';
    }
    if (formState.birthday && !validateDate(formState.birthday)) {
      errors.birthday = 'Use YYYY-MM-DD.';
    }
    const gwaValue = Number(formState.gwa);
    const isPercentageGwa = gwaValue >= 0 && gwaValue <= 100;
    const isCollegeGwa = gwaValue >= 1 && gwaValue <= 5;
    if (formState.gwa && (!Number.isFinite(gwaValue) || (!isPercentageGwa && !isCollegeGwa))) {
      errors.gwa = 'Enter a percentage (0-100) or college grade (1.00-5.00).';
    }
    const selectedPriority = priorityCriteria.filter(({ key }) => formState[key] === 'Yes');
    if (step === 2 && selectedPriority.length && (!priorityProof.proofKey || !priorityProof.fileData)) {
      errors.priorityProof = 'Upload proof for one selected eligibility criterion.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError('Please correct the highlighted fields before continuing.');
      const firstInvalidField = Object.keys(errors)[0];
      requestAnimationFrame(() => {
        document.querySelector(`[name="${firstInvalidField}"]`)?.focus();
      });
      return false;
    }

    setError('');
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setCompleted(prev => new Set([...prev, step]));
    if (step < stepTitles.length - 1) {
      setStep(step + 1);
    } else {
      handleSubmit(new Event('submit'));
    }
  };

  const handleBack = () => {
    setError('');
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateCurrentStep()) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    const personalInfo = {
      identity: {
        firstName: formState.firstName,
        middleName: formState.middleName,
        familyName: formState.familyName,
        nameExtension: formState.nameExtension,
        email: user?.email || formState.email,
        mobile: formState.mobile,
        birthday: formState.birthday,
        birthplace: formState.birthplace,
        sex: formState.sex,
        civilStatus: formState.civilStatus,
      },
      address: {
        houseNumber: formState.houseNumber,
        municipality: municipalityNameByCode[formState.municipality] || formState.municipality,
        barangay: barangayNameByCode[formState.barangay] || formState.barangay,
      },
      schoolPlan: {
        school: formState.school,
        course: formState.course,
        incomingYearLevel: formState.incomingYearLevel,
      },
      family: {
        fatherName: formState.fatherName,
        fatherOccupation: formState.fatherOccupation,
        motherName: formState.motherName,
        motherOccupation: formState.motherOccupation,
        guardianName: formState.guardianName,
        guardianOccupation: formState.guardianOccupation,
        familyIncome: formState.familyIncome,
        gwa: formState.gwa,
        brothersCount: formState.brothersCount,
        sistersCount: formState.sistersCount,
      },
      eligibility: {
        graduatedHonors: formState.graduatedHonors,
        championContest: formState.championContest,
        alsPasser: formState.alsPasser,
        pwd: formState.pwd,
        childOfPwd: formState.childOfPwd,
        soloParent: formState.soloParent,
        indigenousGroup: formState.indigenousGroup,
        siblingRuleAccepted: formState.siblingRuleAccepted,
      },
    };

    const generatedTemporaryPassword = !user
      ? `Scholar@${Math.random().toString(36).slice(2, 10)}`
      : null;

    try {
      const bodyPayload = { personalInfo, initialDocs: priorityProof.fileData ? { priorityProof } : {} };
      if (!user) {
        bodyPayload.email = formState.email;
        bodyPayload.password = generatedTemporaryPassword;
      }

      const response = await fetch(`${API_BASE}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify(bodyPayload),
      });

      const body = await response.json();
      if (!response.ok) {
        setError(body.message || 'Application submission failed.');
        return;
      }
      setAccountCredentials(body.applicant ? {
        ...body.applicant,
        temporaryPassword: body.applicant.temporaryPassword || generatedTemporaryPassword,
      } : null);
      setFormState(createEmptyFormState());
      setPriorityProof({ proofKey: '', fileName: '', fileData: '' });
      setCompleted(new Set());
      setStep(0);
      localStorage.removeItem(draftStorageKey);
      sessionStorage.setItem('application-submitted', 'true');
      setRedirectSeconds(30);
      setSuccess('Application submitted successfully.');
      setSubmitted(true);
      onCreated(body.scholar);
    } catch {
      setError('Unable to connect to backend.');
    } finally {
      setSubmitting(false);
    }
  };

  const stepContent = useMemo(() => {
    switch (step) {
      case 0:
        return (
          <div className="form-fields">
            <div className="section-title">PERSONAL INFORMATION</div>
            <div className="form-row form-row-triple">
              <label className="form-group">
                <FieldLabel required>FIRST NAME</FieldLabel>
                <input type="text" value={formState.firstName} onChange={(e) => handleChange('firstName', e.target.value)} placeholder="e.g. Maria" />
                {fieldErrors.firstName && <span className="error">{fieldErrors.firstName}</span>}
              </label>
              <label className="form-group">
                <FieldLabel>MIDDLE NAME</FieldLabel>
                <input type="text" value={formState.middleName} onChange={(e) => handleChange('middleName', e.target.value)} placeholder="e.g. Santos" />
              </label>
              <label className="form-group">
                <FieldLabel required>FAMILY NAME</FieldLabel>
                <input type="text" value={formState.familyName} onChange={(e) => handleChange('familyName', e.target.value)} placeholder="e.g. Dela Cruz" />
                {fieldErrors.familyName && <span className="error">{fieldErrors.familyName}</span>}
              </label>
            </div>

            <div className="form-row form-row-wide">
              <label className="form-group form-group-narrow">
                <FieldLabel>NAME EXTENSION</FieldLabel>
                <input type="text" value={formState.nameExtension} onChange={(e) => handleChange('nameExtension', e.target.value)} placeholder="None" />
              </label>
              <label className="form-group">
                <FieldLabel required>EMAIL ADDRESS</FieldLabel>
                <input type="email" value={formState.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="e.g. maria@email.com" disabled={Boolean(user)} />
                {fieldErrors.email && <span className="error">{fieldErrors.email}</span>}
              </label>
            </div>

            <div className="form-row">
              <label className="form-group">
                <FieldLabel required>MOBILE NUMBER</FieldLabel>
                <input type="tel" value={formState.mobile} onChange={(e) => handleChange('mobile', e.target.value)} placeholder="e.g. 09XX XXX XXXX" />
                {fieldErrors.mobile && <span className="error">{fieldErrors.mobile}</span>}
              </label>
              <label className="form-group">
                <FieldLabel required>BIRTHDAY</FieldLabel>
                <input type="date" value={formState.birthday} onChange={(e) => handleChange('birthday', e.target.value)} />
                {fieldErrors.birthday && <span className="error">{fieldErrors.birthday}</span>}
              </label>
            </div>

            <div className="form-row">
              <label className="form-group">
                <FieldLabel required>BIRTHPLACE</FieldLabel>
                <input type="text" value={formState.birthplace} onChange={(e) => handleChange('birthplace', e.target.value)} placeholder="e.g. Daet City, Daet" />
              </label>
              <label className="form-group">
                <FieldLabel required>SEX</FieldLabel>
                <select value={formState.sex} onChange={(e) => handleChange('sex', e.target.value)}>
                  <option value="">Select</option>
                  {sexOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>

            <div className="form-row form-row-single">
              <label className="form-group form-group-narrow">
                <FieldLabel required>CIVIL STATUS</FieldLabel>
                <select value={formState.civilStatus} onChange={(e) => handleChange('civilStatus', e.target.value)}>
                  <option value="">Select</option>
                  {civilStatuses.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="form-fields">
            <div className="section-title">HOME ADDRESS</div>

            <div className="form-row form-row-full">
              <label className="form-group">
                <FieldLabel required>HOUSE NUMBER / STREET / PUROK</FieldLabel>
                <input type="text" value={formState.houseNumber} onChange={(e) => handleChange('houseNumber', e.target.value)} placeholder="e.g. 123 Mabini St., Purok 4" />
              </label>
            </div>

            <div className="form-row">
              <label className="form-group">
                <FieldLabel required>MUNICIPALITY / CITY</FieldLabel>
                <select value={formState.municipality} onChange={(e) => handleChange('municipality', e.target.value)}>
                  <option value="">Select municipality</option>
                  {municipalityOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="form-group">
                <FieldLabel required>BARANGAY</FieldLabel>
                <select
                  value={formState.barangay}
                  onChange={(e) => handleChange('barangay', e.target.value)}
                  disabled={!formState.municipality}
                >
                  <option value="">{formState.municipality ? 'Select barangay' : 'Select municipality first'}</option>
                  {barangayOptions.map((option) => (
                    <option key={option.code} value={option.code}>{option.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="section-title section-title-spaced">ACADEMIC INFORMATION</div>

            <div className="form-row">
              <label className="form-group">
                <FieldLabel required>INCOMING YEAR LEVEL</FieldLabel>
                <select value={formState.incomingYearLevel} onChange={(e) => handleChange('incomingYearLevel', e.target.value)}>
                  <option value="">Select year level</option>
                  {yearLevels.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="form-group">
                <FieldLabel required>SCHOOL</FieldLabel>
                <select value={formState.school} onChange={(e) => handleChange('school', e.target.value)}>
                  <option value="">Select school</option>
                  {schoolOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-row form-row-full">
              <label className="form-group">
                <FieldLabel required>COURSE / PROGRAM</FieldLabel>
                <input type="text" value={formState.course} onChange={(e) => handleChange('course', e.target.value)} placeholder="e.g. Bachelor of Science in Nursing" />
              </label>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="form-fields">
            <div className="section-title">PARENTS & GUARDIAN</div>

            <div className="form-row">
              <label className="form-group">
                <FieldLabel required>FATHER'S FULL NAME</FieldLabel>
                <input type="text" value={formState.fatherName} onChange={(e) => handleChange('fatherName', e.target.value)} placeholder="e.g. Juan Dela Cruz" />
                {fieldErrors.fatherName && <span className="error">{fieldErrors.fatherName}</span>}
              </label>
              <label className="form-group">
                <FieldLabel required>FATHER'S OCCUPATION</FieldLabel>
                <input type="text" value={formState.fatherOccupation} onChange={(e) => handleChange('fatherOccupation', e.target.value)} placeholder="e.g. Farmer" />
              </label>
            </div>

            <div className="form-row">
              <label className="form-group">
                <FieldLabel required>MOTHER'S FULL NAME</FieldLabel>
                <input type="text" value={formState.motherName} onChange={(e) => handleChange('motherName', e.target.value)} placeholder="e.g. Maria Santos Dela Cruz" />
                {fieldErrors.motherName && <span className="error">{fieldErrors.motherName}</span>}
              </label>
              <label className="form-group">
                <FieldLabel required>MOTHER'S OCCUPATION</FieldLabel>
                <input type="text" value={formState.motherOccupation} onChange={(e) => handleChange('motherOccupation', e.target.value)} placeholder="e.g. Housewife" />
              </label>
            </div>

            <div className="form-row">
              <label className="form-group">
                <FieldLabel required>PARENT / GUARDIAN FULL NAME</FieldLabel>
                <input type="text" value={formState.guardianName} onChange={(e) => handleChange('guardianName', e.target.value)} placeholder="If different from parents" />
              </label>
              <label className="form-group">
                <FieldLabel required>GUARDIAN'S OCCUPATION</FieldLabel>
                <input type="text" value={formState.guardianOccupation} onChange={(e) => handleChange('guardianOccupation', e.target.value)} placeholder="e.g. Vendor" />
              </label>
            </div>

            <div className="section-title section-title-spaced">FINANCIAL & ACADEMIC STANDING</div>

            <div className="form-row form-row-financial">
              <label className="form-group form-group-wide">
                <FieldLabel required>ANNUAL FAMILY INCOME</FieldLabel>
                <select value={formState.familyIncome} onChange={(e) => handleChange('familyIncome', e.target.value)}>
                  <option value="">Select Range</option>
                  {incomeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="form-group form-group-small">
                <FieldLabel required>GWA (LAST SEM.)</FieldLabel>
                <input type="text" value={formState.gwa} onChange={(e) => handleChange('gwa', e.target.value)} placeholder="e.g. 92 or 1.50" />
                {fieldErrors.gwa && <span className="error">{fieldErrors.gwa}</span>}
              </label>
              <label className="form-group form-group-tiny">
                <FieldLabel>BROTHERS</FieldLabel>
                <select value={formState.brothersCount} onChange={(e) => handleChange('brothersCount', e.target.value)}>
                  <option value="">0</option>
                  {countOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="form-group form-group-tiny">
                <FieldLabel>SISTERS</FieldLabel>
                <select value={formState.sistersCount} onChange={(e) => handleChange('sistersCount', e.target.value)}>
                  <option value="">0</option>
                  {countOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>

            <div className="section-title section-title-spaced">ELIGIBILITY CRITERIA</div>
            <p className="eligibility-note">Check all that apply to you. These may affect your scholarship eligibility or priority.</p>

            <div className="sibling-rule-notice" role="note">
              <Info size={18} aria-hidden="true" />
              <div><strong>One scholar per family</strong><span>Only one sibling from the same family may apply for or hold this scholarship at a time.</span></div>
            </div>

            <div className="eligibility-grid">
              {priorityCriteria.map((item) => (
                <label key={item.key} className="eligibility-item">
                  <input
                    type="checkbox"
                    checked={formState[item.key] === 'Yes'}
                    onChange={(e) => handleChange(item.key, e.target.checked ? 'Yes' : 'No')}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            {priorityCriteria.some(({ key }) => formState[key] === 'Yes') && (
              <section className="priority-proof-upload">
                <div><strong>Supporting proof required</strong><span>An approved proof automatically qualifies the applicant as a scholar and bypasses the examination.</span></div>
                <label>
                  <span>Criterion shown by this proof</span>
                  <select name="priorityProofCriterion" value={priorityProof.proofKey} onChange={(event) => setPriorityProof((current) => ({ ...current, proofKey: event.target.value }))}>
                    {priorityCriteria.filter(({ key }) => formState[key] === 'Yes').map((item) => <option key={item.proofKey} value={item.proofKey}>{item.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Proof document or valid ID</span>
                  <input name="priorityProof" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => handlePriorityProof(event.target.files?.[0])} />
                  <small>{priorityProof.fileName || 'PDF, JPG, or PNG; maximum 6 MB.'}</small>
                </label>
                {fieldErrors.priorityProof && <span className="sibling-rule-error">{fieldErrors.priorityProof}</span>}
              </section>
            )}

            <label className={`sibling-rule-confirmation ${fieldErrors.siblingRuleAccepted ? 'has-error' : ''}`}>
              <input
                name="siblingRuleAccepted"
                type="checkbox"
                checked={formState.siblingRuleAccepted}
                onChange={(event) => handleChange('siblingRuleAccepted', event.target.checked)}
              />
              <span>I confirm that none of my siblings has an active PGCEAP application or scholarship.</span>
            </label>
            {fieldErrors.siblingRuleAccepted && <span className="sibling-rule-error">You must confirm this eligibility rule before submitting.</span>}
          </div>
        );

      default:
        return null;
    }
  }, [step, formState, fieldErrors, user, barangayOptions, priorityProof.fileName, priorityProof.proofKey]);

  if (submitted) {
    return (
      <div className="submitted-overlay">
        <div className="submitted-card">
          <div className="submitted-icon" aria-hidden="true">
            <CircleCheckBig />
          </div>
          <h2>Application Submitted</h2>
          <p className="submitted-message">Your scholarship application has been received. Save the account details below so you can track its progress.</p>
          {accountCredentials && (
            <section className="submission-account" aria-labelledby="submission-account-title">
              <div className="submission-account-heading">
                <span>Applicant account</span>
                <strong id="submission-account-title">Your login details</strong>
              </div>
              <dl className="submission-account-list">
                <div>
                  <dt>Control number</dt>
                  <dd>{accountCredentials.controlNumber}</dd>
                </div>
                <div>
                  <dt>Email address</dt>
                  <dd>{accountCredentials.email}</dd>
                </div>
                {accountCredentials.temporaryPassword && (
                  <div>
                    <dt>Temporary password</dt>
                    <dd>{accountCredentials.temporaryPassword}</dd>
                  </div>
                )}
              </dl>
              <p className="submission-account-note">Keep these details private. You will need them to sign in to the applicant portal.</p>
            </section>
          )}
          <button
            className="btn-submit"
            onClick={onGoToLogin}
          >
            Go to Login
          </button>
          <p className="redirect-countdown" aria-live="polite">Redirecting to login in {redirectSeconds} seconds...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="form-container">
      <aside className="form-sidebar">
        <p className="sidebar-title">FORM SECTIONS</p>
        <div className="steps-list">
          {stepTitles.map((title, index) => (
            <div
              key={index}
              className={`step-button ${index === step ? 'active' : ''} ${completed.has(index) ? 'done' : ''}`}
            >
              <span className="step-number">{index + 1}</span>
              <span className="step-text">{title}</span>
            </div>
          ))}
        </div>
        <div className="progress-box">
          <div className="progress-box-header">
            <p className="progress-label">Progress</p>
            <p className="progress-value">{completed.size} / {stepTitles.length}</p>
          </div>
          <div className="progress-track" aria-hidden="true">
            <div
              className="progress-track-fill"
              style={{ width: `${(completed.size / stepTitles.length) * 100}%` }}
            />
          </div>
          <p className="progress-helper">Start filling out the form below.</p>
        </div>
        <div className="warning-box sidebar-warning">
          <span className="warning-icon" aria-hidden="true">
            <Info />
          </span>
          <p>Fields marked with <strong>*</strong> are required. Ensure all information is accurate before submitting.</p>
        </div>
      </aside>

      <main className="form-main">
        <section className="form-card">
          <div className="form-card-header">
            <div className="form-card-icon" aria-hidden="true">
              <UsersRound />
            </div>
            <div>
              <p className="section-number">SECTION {step + 1} OF {stepTitles.length}</p>
              <h2>{stepTitles[step]}</h2>
            </div>
          </div>

          <div className="form-card-divider" />

          <form onSubmit={handleSubmit} className="form-card-body">
            {stepContent}

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleBack}
                disabled={step === 0 || submitting}
              >
                Previous
              </button>

              <div className="form-step-indicator" aria-hidden="true">
                {stepTitles.map((_, index) => (
                  <span key={index} className={index === step ? 'form-step-indicator-active' : ''} />
                ))}
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={handleNext}
                disabled={submitting}
              >
                {submitting && step === stepTitles.length - 1
                  ? 'Saving...'
                  : step === stepTitles.length - 1
                    ? 'Save & Continue'
                    : 'Continue'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

export default ApplicationForm;
