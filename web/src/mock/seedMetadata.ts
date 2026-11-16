import type { CredentialMetadata } from '../lib/types';

const base = { issuerName: 'Example Institute', documentUri: '', grade: 'Distinction' };
export const SEED_METADATA: Record<string, CredentialMetadata> = {
  'mock://seed-1': { ...base, name: 'Certificate of Completion', description: 'Full-stack web development, 12 weeks', recipientName: 'A. Perera', course: 'Full-Stack Web Development', issuedDate: '2026-10-14', documentSha256: ('0x' + 'ab'.repeat(32)) as `0x${string}` },
  'mock://seed-2': { ...base, name: 'Internship Letter', description: 'Backend internship', recipientName: 'A. Perera', course: 'Backend Internship', grade: 'Merit', issuedDate: '2026-10-24', documentSha256: ('0x' + 'cd'.repeat(32)) as `0x${string}` },
  'mock://seed-3': { ...base, name: 'Cloud Fundamentals', description: '1-year certificate', recipientName: 'A. Perera', course: 'Cloud Fundamentals', grade: 'Pass', issuedDate: '2025-10-09', documentSha256: ('0x' + 'ef'.repeat(32)) as `0x${string}` },
  'mock://seed-4': { ...base, issuerName: 'Old Training Co', name: 'Workshop Attendance', description: 'Docker workshop', recipientName: 'A. Perera', course: 'Docker 101', grade: '', issuedDate: '2026-08-15', documentSha256: ('0x' + '12'.repeat(32)) as `0x${string}` },
};
