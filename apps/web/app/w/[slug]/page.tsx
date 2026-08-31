import { WallScreen } from '@/components/wall/wall-screen'

export const metadata = { title: 'Photo wall' }

/**
 * The venue screen. Server does nothing: the client polls the feed, so a
 * transient server hiccup can never blank an already-running wall.
 */
export default async function WallPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <WallScreen slug={slug} />
}
