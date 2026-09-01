/**
 * src/data/departments.js
 * Official PLSP Colleges and Academic Departments list
 */

export const DEPARTMENTS = [
  'College of Arts and Sciences (CAS)',
  'College of Business Administration and Management (CBAM)',
  'College of Accountancy (COA)',
  'College of Tourism and Hospitality Management (CTHM)',
  'College of Computer Studies and Technology (CCST)',
  'College of Teacher Education (Education Department)',
  'College of Physical Education, Sports and Recreation (CPESR)',
  'Public Administration Department',
];

export const DEPARTMENT_MAP = {
  'College of Arts and Sciences (CAS)': {
    code: 'CAS',
    shortName: 'CAS',
    color: '#7C3AED',
  },
  'College of Business Administration and Management (CBAM)': {
    code: 'CBAM',
    shortName: 'CBAM',
    color: '#2563EB',
  },
  'College of Accountancy (COA)': {
    code: 'COA',
    shortName: 'COA',
    color: '#059669',
  },
  'College of Tourism and Hospitality Management (CTHM)': {
    code: 'CTHM',
    shortName: 'CTHM',
    color: '#D97706',
  },
  'College of Computer Studies and Technology (CCST)': {
    code: 'CCST',
    shortName: 'CCST',
    color: '#4F46E5',
  },
  'College of Teacher Education (Education Department)': {
    code: 'CTE',
    shortName: 'Education Dept',
    color: '#DB2777',
  },
  'College of Physical Education, Sports and Recreation (CPESR)': {
    code: 'CPESR',
    shortName: 'CPESR',
    color: '#0891B2',
  },
  'Public Administration Department': {
    code: 'PAD',
    shortName: 'Public Admin',
    color: '#EA580C',
  },
};

export function getDepartmentShortName(dept) {
  if (!dept) return 'N/A';
  if (DEPARTMENT_MAP[dept]?.code) {
    return DEPARTMENT_MAP[dept].code;
  }
  const match = dept.match(/\(([^)]+)\)/);
  if (match) return match[1];
  return dept;
}

export function getDepartmentColor(dept) {
  if (!dept) return '#374151';
  if (DEPARTMENT_MAP[dept]?.color) {
    return DEPARTMENT_MAP[dept].color;
  }
  // Legacy / fallback mappings
  const fallback = {
    'Col. of Accountancy':                      '#059669',
    'Col. of Arts and Sciences':                '#7C3AED',
    'Col. of Business Administration':          '#2563EB',
    'Col. of Computing Sciences & Engineering': '#4F46E5',
    'Col. of Computing Sciences & Eng.':        '#4F46E5',
    'Col. of Engineering':                      '#DC2626',
    'Col. of Human Kinetics':                   '#0891B2',
    'Col. of Nursing & Allied Health Sciences': '#0D9488',
    'Col. of Teacher Education':                '#DB2777',
    'Col. of Tourism & Hospitality Management': '#D97706',
    'Administration':                           '#1E3A8A',
  };
  return fallback[dept] || '#4B5563';
}
