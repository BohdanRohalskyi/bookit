import { useSpaceStore } from '../stores/spaceStore'

export function useMyRole() {
  const role = useSpaceStore((s) => s.role)

  const isOwner = role === 'owner'
  const isAdmin = role === 'administrator' || isOwner
  const isStaff = role === 'staff'

  return { role, isOwner, isAdmin, isStaff, hasRole: role !== null }
}
