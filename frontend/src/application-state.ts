export type ApplicationPanelState =
  | { kind: 'approved'; roleId: string }
  | { kind: 'pending'; roleId: string }
  | { kind: 'none' };

type ApplicationLike = {
  applicantId: string;
  roleId: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  createdAt?: string;
};

/** Pick the effective application after a user has withdrawn or reapplied. */
export function getApplicationPanelState(applications: ApplicationLike[], applicantId: string): ApplicationPanelState {
  const mine = applications
    .filter((application) => application.applicantId === applicantId)
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''));
  const approved = mine.find((application) => application.status === 'approved');
  if (approved) return { kind: 'approved', roleId: approved.roleId };
  const pending = mine.find((application) => application.status === 'pending');
  if (pending) return { kind: 'pending', roleId: pending.roleId };
  return { kind: 'none' };
}
