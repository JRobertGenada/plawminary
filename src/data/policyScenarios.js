/**
 * policyScenarios.js
 * Structured scenario data for all 20 PLSP ordinances.
 *
 * Each object maps to a row in the `policy_scenarios` table:
 *   policy_id  — FK to ordinances.id
 *   scenario   — natural-language student situation phrase
 *   keywords   — short trigger words
 *   synonyms   — related/alternate terms
 *
 * Multiple scenarios per policy are supported (same policy_id, different scenario).
 */

export const POLICY_SCENARIOS = [

  // ── 1. Prescribed Student Uniform Policy ──────────────────────────────────
  {
    policy_id: 1,
    scenario: 'I was not wearing my uniform and was stopped at the gate',
    keywords: ['uniform', 'dress code', 'gate', 'clothing', 'attire'],
    synonyms: ['outfit', 'prescribed uniform', 'civilian clothes'],
  },
  {
    policy_id: 1,
    scenario: 'Can I wear civilian clothes to school on Saturday?',
    keywords: ['civilian', 'Saturday', 'clothing', 'shorts', 'slippers'],
    synonyms: ['casual wear', 'non-uniform day', 'mufti'],
  },
  {
    policy_id: 1,
    scenario: 'I got a violation notice for wearing inappropriate clothes on campus',
    keywords: ['violation', 'inappropriate clothing', 'dress', 'uniform'],
    synonyms: ['attire violation', 'dress code violation', 'reprimand'],
  },

  // ── 2. Academic Integrity & Anti-Cheating Policy ─────────────────────────
  {
    policy_id: 2,
    scenario: 'I was accused of cheating during the exam',
    keywords: ['cheating', 'exam', 'accused', 'dishonesty', 'integrity'],
    synonyms: ['academic dishonesty', 'copying', 'cheat sheet'],
  },
  {
    policy_id: 2,
    scenario: 'My professor said I plagiarized my research paper',
    keywords: ['plagiarism', 'research', 'copied', 'paper', 'professor'],
    synonyms: ['copy-paste', 'intellectual theft', 'plagiarized work'],
  },
  {
    policy_id: 2,
    scenario: 'Someone submitted my work as their own without my permission',
    keywords: ['plagiarism', 'stolen work', 'submitted', 'unauthorized'],
    synonyms: ['academic theft', 'credit stealing', 'ghostwriting'],
  },

  // ── 3. Student ID Wearing & Identification Policy ─────────────────────────
  {
    policy_id: 3,
    scenario: 'I forgot my student ID at home and the guard would not let me in',
    keywords: ['student ID', 'forgot', 'gate', 'guard', 'ID'],
    synonyms: ['identification card', 'SIC', 'gate pass'],
  },
  {
    policy_id: 3,
    scenario: 'My student ID was lost or stolen',
    keywords: ['lost ID', 'stolen ID', 'replacement', 'affidavit', 'ID'],
    synonyms: ['missing ID', 'ID replacement', 'lost identification'],
  },
  {
    policy_id: 3,
    scenario: 'Someone borrowed my ID and got me in trouble',
    keywords: ['borrowed ID', 'lend ID', 'misuse', 'misrepresentation'],
    synonyms: ['ID lending', 'identity fraud', 'ID sharing violation'],
  },

  // ── 4. Classroom Conduct & Decorum Policy ────────────────────────────────
  {
    policy_id: 4,
    scenario: 'I arrived late and was marked absent by my professor',
    keywords: ['late', 'tardy', 'absent', 'arrival', 'mark'],
    synonyms: ['tardiness', 'late arrival', 'attendance record'],
  },
  {
    policy_id: 4,
    scenario: 'My professor kicked me out of class for using my phone',
    keywords: ['phone', 'removed', 'class', 'disruption', 'device'],
    synonyms: ['mobile phone', 'expelled from class', 'class removal'],
  },
  {
    policy_id: 4,
    scenario: 'A classmate kept disturbing the class and the teacher did nothing',
    keywords: ['disruptive', 'classmate', 'disturbance', 'conduct', 'classroom'],
    synonyms: ['disruptive behavior', 'class disruption', 'unruly student'],
  },

  // ── 5. Campus Discipline & Misconduct Guidelines ──────────────────────────
  {
    policy_id: 5,
    scenario: 'Someone keeps threatening and insulting me on campus',
    keywords: ['threat', 'insult', 'bully', 'misconduct', 'harassment'],
    synonyms: ['intimidation', 'verbal abuse', 'bullying', 'threatening'],
  },
  {
    policy_id: 5,
    scenario: 'I was involved in a fight with another student',
    keywords: ['fight', 'assault', 'physical', 'altercation', 'discipline'],
    synonyms: ['physical altercation', 'brawl', 'physical assault', 'violence'],
  },
  {
    policy_id: 5,
    scenario: 'I received a disciplinary notice and want to know what happens next',
    keywords: ['disciplinary', 'notice', 'sanction', 'hearing', 'procedure'],
    synonyms: ['disciplinary proceedings', 'due process', 'student hearing'],
  },
  {
    policy_id: 5,
    scenario: 'A student vandalized school property and I want to report it',
    keywords: ['vandalism', 'property', 'damage', 'report', 'misconduct'],
    synonyms: ['destruction of property', 'graffiti', 'school property damage'],
  },

  // ── 6. Student Rights & Responsibilities Charter ─────────────────────────
  {
    policy_id: 6,
    scenario: 'I feel my rights as a student were violated by a faculty member',
    keywords: ['rights', 'violated', 'faculty', 'grievance', 'due process'],
    synonyms: ['student rights violation', 'unfair treatment', 'rights infringement'],
  },
  {
    policy_id: 6,
    scenario: 'I want to formally complain about unfair treatment from a teacher',
    keywords: ['complaint', 'unfair', 'teacher', 'grievance', 'formal'],
    synonyms: ['formal complaint', 'appeal', 'grievance procedure', 'student complaint'],
  },

  // ── 7. Campus Safety & Security Policy ────────────────────────────────────
  {
    policy_id: 7,
    scenario: 'I found a suspicious person or object on campus',
    keywords: ['suspicious', 'security', 'campus', 'report', 'safety'],
    synonyms: ['security threat', 'unidentified person', 'suspicious activity'],
  },
  {
    policy_id: 7,
    scenario: 'A student was caught bringing a weapon to school',
    keywords: ['weapon', 'prohibited', 'campus', 'security', 'dangerous'],
    synonyms: ['bladed weapon', 'firearm', 'prohibited item', 'dangerous object'],
  },
  {
    policy_id: 7,
    scenario: 'Someone was caught with drugs or alcohol inside the campus',
    keywords: ['drugs', 'alcohol', 'prohibited', 'substances', 'campus'],
    synonyms: ['illegal drugs', 'alcoholic beverage', 'controlled substance', 'intoxicated'],
  },

  // ── 8. Library Use & Resource Policy ──────────────────────────────────────
  {
    policy_id: 8,
    scenario: 'I have an overdue library book and want to know the fines',
    keywords: ['overdue', 'library', 'fine', 'book', 'late return'],
    synonyms: ['library fine', 'overdue fee', 'late book return'],
  },
  {
    policy_id: 8,
    scenario: 'I lost a library book and need to replace it',
    keywords: ['lost', 'library', 'book', 'replace', 'replacement cost'],
    synonyms: ['lost book', 'damaged book', 'library replacement'],
  },

  // ── 9. Attendance Policy ───────────────────────────────────────────────────
  {
    policy_id: 9,
    scenario: 'I missed too many classes and am worried I will be dropped from the subject',
    keywords: ['absences', 'dropped', 'subject', '20%', 'attendance'],
    synonyms: ['excessive absences', 'forced drop', 'auto-drop', 'attendance limit'],
  },
  {
    policy_id: 9,
    scenario: 'I was sick and missed classes. Do I need an excuse letter?',
    keywords: ['sick', 'absent', 'excuse letter', 'illness', 'OSAS'],
    synonyms: ['medical excuse', 'sick leave', 'absence excuse', 'medical certificate'],
  },
  {
    policy_id: 9,
    scenario: 'How many times can I be late before it counts as an absence?',
    keywords: ['late', 'tardiness', 'absence', 'count', 'attendance'],
    synonyms: ['tardy', 'three tardiness', 'tardiness equivalent', 'late policy'],
  },

  // ── 10. Grading System & Grade Equivalency ────────────────────────────────
  {
    policy_id: 10,
    scenario: 'I think I was given the wrong grade and want to appeal it',
    keywords: ['wrong grade', 'appeal', 'grade change', 'error', 'marks'],
    synonyms: ['grade appeal', 'grade rectification', 'incorrect grade'],
  },
  {
    policy_id: 10,
    scenario: 'I failed a subject and want to know what happens to my record',
    keywords: ['failed', '5.00', 'failure', 'grade', 'subject'],
    synonyms: ['failing grade', 'grade of 5', 'failed subject', 'academic failure'],
  },
  {
    policy_id: 10,
    scenario: 'Can I retake an exam to improve my passing grade?',
    keywords: ['retake', 'exam', 'improve', 'grade', 'reexamination'],
    synonyms: ['re-examination', 'grade improvement', 'remedial exam'],
  },

  // ── 11. Incomplete (INC) Grade Policy ────────────────────────────────────
  {
    policy_id: 11,
    scenario: 'I missed the final exam because I was in the hospital',
    keywords: ['final exam', 'missed', 'sick', 'hospital', 'INC', 'incomplete'],
    synonyms: ['incomplete grade', 'INC grade', 'missed finals', 'medical excuse for exam'],
  },
  {
    policy_id: 11,
    scenario: 'My INC grade was automatically converted to 5.00',
    keywords: ['INC', 'converted', '5.00', 'one year', 'incomplete', 'automatic'],
    synonyms: ['incomplete deadline', 'INC expiry', 'automatic failure', 'removal deadline'],
  },
  {
    policy_id: 11,
    scenario: 'How do I complete my incomplete grade from last semester?',
    keywords: ['complete', 'INC', 'completion form', 'instructor', 'registrar'],
    synonyms: ['INC removal', 'remove incomplete', 'completion exam', 'INC completion'],
  },

  // ── 12. Dropping of Subjects Policy ──────────────────────────────────────
  {
    policy_id: 12,
    scenario: 'I want to drop a subject before the midterms',
    keywords: ['drop', 'subject', 'midterm', 'DRP', 'withdrawal'],
    synonyms: ['dropping a subject', 'withdraw from class', 'official drop'],
  },
  {
    policy_id: 12,
    scenario: 'I stopped attending a subject but did not officially drop it',
    keywords: ['stopped attending', 'UW', 'unauthorized withdrawal', '5.00', 'drop'],
    synonyms: ['unauthorized drop', 'ghost drop', 'UW grade', 'failed due to no drop'],
  },

  // ── 13. Leave of Absence (LOA) Policy ─────────────────────────────────────
  {
    policy_id: 13,
    scenario: 'I need to take a semester off from school for personal reasons',
    keywords: ['leave of absence', 'LOA', 'semester off', 'personal', 'break'],
    synonyms: ['study leave', 'academic leave', 'take a break', 'suspend studies'],
  },
  {
    policy_id: 13,
    scenario: 'I was out of school for over a year without filing an LOA',
    keywords: ['AWOL', 'absent without leave', 'LOA', 'readmission', 'probation'],
    synonyms: ['unofficial leave', 'unauthorized absence', 'probationary readmission'],
  },

  // ── 14. Shifting of Course Policy ────────────────────────────────────────
  {
    policy_id: 14,
    scenario: 'I want to shift to a different course or program',
    keywords: ['shift', 'course', 'program', 'change', 'transfer', 'new course'],
    synonyms: ['course shifting', 'change of program', 'transfer to another course'],
  },
  {
    policy_id: 14,
    scenario: 'My Dean told me I am not suited for my current course',
    keywords: ['shift', 'Dean', 'academically fitted', 'course change', 'guidance'],
    synonyms: ['academic mismatch', 'not fitted', 'recommended to shift'],
  },

  // ── 15. Graduation Requirements ──────────────────────────────────────────
  {
    policy_id: 15,
    scenario: 'I want to know what I need to do to graduate this year',
    keywords: ['graduation', 'requirements', 'clearance', 'residency', 'degree'],
    synonyms: ['graduate', 'graduation application', 'finish degree', 'complete program'],
  },
  {
    policy_id: 15,
    scenario: 'I transferred from another school. Am I eligible to graduate here?',
    keywords: ['transferee', 'graduation', 'residency', '30 units', 'eligibility'],
    synonyms: ['transfer student graduation', 'residency requirement', 'unit requirement'],
  },

  // ── 16. Academic Honors & Latin Honors Policy ────────────────────────────
  {
    policy_id: 16,
    scenario: 'I want to qualify for cum laude or latin honors when I graduate',
    keywords: ['cum laude', 'honors', 'GWA', 'graduation honors', 'latin honors'],
    synonyms: ['summa cum laude', 'magna cum laude', 'graduation with honors', 'academic distinction'],
  },
  {
    policy_id: 16,
    scenario: 'I got a DRP last semester. Does it disqualify me from honors?',
    keywords: ['DRP', 'honors', 'disqualify', 'dropped', 'latin honors'],
    synonyms: ['dropped subject honors', 'INC honors', 'lost honors eligibility'],
  },
  {
    policy_id: 16,
    scenario: 'How do I qualify for the Deans List this semester?',
    keywords: ['Deans List', 'GWA', 'tuition discount', 'no INC', 'regular load'],
    synonyms: ['deans lister', 'tuition fee discount', 'academic excellence'],
  },

  // ── 17. Refund of Tuition Fees Policy ────────────────────────────────────
  {
    policy_id: 17,
    scenario: 'I paid tuition but I need to withdraw from school. Can I get a refund?',
    keywords: ['refund', 'tuition', 'withdrawal', 'withdraw', 'money back'],
    synonyms: ['tuition refund', 'fee refund', 'money refund', 'withdraw enrollment'],
  },
  {
    policy_id: 17,
    scenario: 'My family member died and I cannot continue school. What happens to my fees?',
    keywords: ['death', 'disability', 'refund', 'tuition', 'withdraw', 'fees'],
    synonyms: ['death refund', 'compassionate refund', 'full refund death', 'family emergency withdrawal'],
  },

  // ── 18. Anti-Sexual Harassment Policy ────────────────────────────────────
  {
    policy_id: 18,
    scenario: 'A teacher or staff member made inappropriate sexual remarks toward me',
    keywords: ['sexual harassment', 'inappropriate', 'teacher', 'faculty', 'remarks'],
    synonyms: ['sexual misconduct', 'inappropriate conduct', 'RA 7877', 'sexual abuse'],
  },
  {
    policy_id: 18,
    scenario: 'A classmate is sending me sexual messages or touching me without consent',
    keywords: ['sexual', 'harassment', 'classmate', 'touching', 'messages', 'consent'],
    synonyms: ['unwanted touching', 'sexual advances', 'sexual messages', 'non-consensual'],
  },
  {
    policy_id: 18,
    scenario: 'Someone is sending me sexist jokes and I feel uncomfortable',
    keywords: ['sexist', 'jokes', 'uncomfortable', 'harassment', 'offensive'],
    synonyms: ['sexist behavior', 'sexual innuendo', 'offensive jokes', 'light sexual harassment'],
  },
  {
    policy_id: 18,
    scenario: 'How do I report sexual harassment to the school?',
    keywords: ['report', 'sexual harassment', 'CODI', 'complaint', 'formal'],
    synonyms: ['file harassment complaint', 'harassment report', 'CODI report', 'formal complaint harassment'],
  },

  // ── 19. NSTP & Physical Education Requirements ────────────────────────────
  {
    policy_id: 19,
    scenario: 'I cannot enroll in third year because I have not completed PE or NSTP',
    keywords: ['NSTP', 'PE', 'third year', 'incomplete', 'requirement'],
    synonyms: ['physical education requirement', 'NSTP requirement', 'blocked enrollment'],
  },
  {
    policy_id: 19,
    scenario: 'My religion does not allow me to participate in PE or NSTP activities',
    keywords: ['religion', 'PE', 'NSTP', 'exemption', 'alternative'],
    synonyms: ['religious exemption', 'alternative task', 'religious belief NSTP'],
  },

  // ── 20. Student Data Privacy & Data Protection Policy ────────────────────
  {
    policy_id: 20,
    scenario: 'Someone is requesting my school records without my permission',
    keywords: ['records', 'data', 'privacy', 'unauthorized', 'release'],
    synonyms: ['student records privacy', 'data protection', 'unauthorized data access'],
  },
  {
    policy_id: 20,
    scenario: 'I want to know how to authorize someone to get my documents for me',
    keywords: ['authorization', 'documents', 'representative', 'letter', 'records'],
    synonyms: ['authorization letter', 'document pickup', 'authorize representative', 'in absentia'],
  },
];
