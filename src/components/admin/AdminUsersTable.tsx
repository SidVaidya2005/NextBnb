import {
  TABLE,
  TABLE_CELL,
  TABLE_CELL_NUMERIC,
  TABLE_CELL_PRIMARY,
  TABLE_HEAD_CELL,
  TABLE_SCROLL,
} from '@/components/admin/adminTableStyles'
import { cn } from '@/lib/utils'
import type { AdminUser } from '@/lib/queries/admin'

type Props = { users: AdminUser[] }

/**
 * Every account, read-only.
 *
 * **Read-only is a schema fact, not a scope decision** — the same shape F14 found
 * for host reservations. `0003` revokes UPDATE on `profiles` from `authenticated`
 * and re-grants only `full_name`/`avatar_url`, and revokes DELETE outright. So
 * there is no path to promote, demote or remove a user through the app whatever
 * this component rendered; role editing and user deletion would each need a
 * migration, not a button.
 *
 * The email column is the only thing here that RLS cannot reach — `profiles` has
 * no email column precisely because it is publicly readable — so it arrives via
 * the `admin_list_users()` definer function. Everything else on the row is an
 * ordinary read an admin already satisfies.
 */
export function AdminUsersTable({ users }: Props) {
  return (
    <div className={TABLE_SCROLL}>
      <table className={TABLE}>
        <caption className="sr-only">
          All accounts, with their listing and booking counts
        </caption>
        <thead>
          <tr>
            <th scope="col" className={TABLE_HEAD_CELL}>
              Name
            </th>
            <th scope="col" className={TABLE_HEAD_CELL}>
              Email
            </th>
            <th scope="col" className={TABLE_HEAD_CELL}>
              Joined
            </th>
            <th scope="col" className={TABLE_HEAD_CELL}>
              Listings
            </th>
            <th scope="col" className={TABLE_HEAD_CELL}>
              Bookings
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <th scope="row" className={cn(TABLE_CELL, TABLE_CELL_PRIMARY)}>
                {user.name}
              </th>
              <td className={TABLE_CELL}>
                {/* An admin whose own definer read failed still gets the row —
                    the missing address is stated rather than left blank, so it
                    does not read as "this user has no email". */}
                {user.email ?? <span className="text-muted">Unavailable</span>}
              </td>
              <td className={cn(TABLE_CELL, TABLE_CELL_NUMERIC)}>
                {user.joined ?? '—'}
              </td>
              <td className={cn(TABLE_CELL, TABLE_CELL_NUMERIC)}>{user.listingCount}</td>
              <td className={cn(TABLE_CELL, TABLE_CELL_NUMERIC)}>{user.bookingCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
