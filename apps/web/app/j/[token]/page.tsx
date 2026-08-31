import { GuestApp } from '@/components/wall/guest-app'

export const metadata = { title: 'Share your photos' }

/**
 * The page behind the printed QR. Deliberately does no server work: the
 * client joins with the token, so this route stays static-fast even when
 * two hundred phones open it in the same minute.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <GuestApp token={token} />
}
