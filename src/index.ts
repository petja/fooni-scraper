/**
 * Welcome to Cloudflare Workers! This is your first scheduled worker.
 *
 * - Run `wrangler dev --local` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/cdn-cgi/mf/scheduled"` to trigger the scheduled event
 * - Go back to the console to see what your worker has logged
 * - Update the Cron trigger in wrangler.toml (see https://developers.cloudflare.com/workers/wrangler/configuration/#triggers)
 * - Run `wrangler publish --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/runtime-apis/scheduled-event/
 */

import {
  retrieveReservationStats,
  retrieveSessionId as retrieveShopSessionId,
} from './helpers/stats'
import {
  listVideos,
  retrieveSessionId as retrieveMediaSessionId,
} from './helpers/video'

export interface Env {
  FOONI_SCRAPER: KVNamespace
  MEDIA_FOONI_LOGIN_TOKEN: string
  SHOP_FOONI_EMAIL: string
  SHOP_FOONI_PASSWORD: string
}

async function fetch(req: Request, env: Env, ctx: ExecutionContext) {
  const videos = await env.FOONI_SCRAPER.get<
    { downloadUrl: string; posterUrl: string }[]
  >('latest_video', 'json')

  const reservationStats = await env.FOONI_SCRAPER.get<{ totalTime: number }>(
    'reservation_stats',
    'json'
  )

  if (!videos) {
    throw new Error('Cannot find videos')
  } else if (!reservationStats) {
    throw new Error('Cannot find reservation stats')
  }

  const latestVideo = videos[0] ?? null

  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET')

  return new Response(
    JSON.stringify({
      latestVideo,
      reservationStats,
    }),
    {
      headers,
    }
  )
}

async function scheduled(
  controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  let shopSessionId = await env.FOONI_SCRAPER.get('session_id:shop')
  let mediaSessionId = await env.FOONI_SCRAPER.get('session_id:media')

  if (!shopSessionId) {
    shopSessionId = await retrieveShopSessionId(
      env.SHOP_FOONI_EMAIL,
      env.SHOP_FOONI_PASSWORD
    )

    await env.FOONI_SCRAPER.put('session_id:shop', shopSessionId, {
      expirationTtl: 600,
    })
  }

  if (!mediaSessionId) {
    mediaSessionId = await retrieveMediaSessionId(env.MEDIA_FOONI_LOGIN_TOKEN)

    await env.FOONI_SCRAPER.put('session_id:media', mediaSessionId, {
      expirationTtl: 600,
    })
  }

  const reservationStats = await retrieveReservationStats(shopSessionId)

  await env.FOONI_SCRAPER.put(
    'reservation_stats',
    JSON.stringify(reservationStats)
  )

  const videos = await listVideos(mediaSessionId)

  await env.FOONI_SCRAPER.put('latest_video', JSON.stringify(videos))
}

export default {
  fetch,
  scheduled,
}
