import cookie from 'cookie'

const baseURL = 'https://shop.xn--fni-snaa.fi/index.php'

interface Reservation {
  id: string
  origin_minutes: `${string}'`
  coach_id: string
  timeslöt: string
}

function createHeaders(sessionId: string) {
  const headers = new Headers()
  headers.set('Content-Type', 'application/x-www-form-urlencoded')
  headers.set('Cookie', `Tunn3lShop=${sessionId}`)

  return headers
}

export async function retrieveSessionId(
  email: string,
  password: string
): Promise<string> {
  console.log('Signing in to shop.fööni.fi ...')

  const shopResponse = await fetch(baseURL, {
    redirect: 'manual',
  })

  const cookieStr = shopResponse.headers.get('set-cookie')

  if (!cookieStr) {
    throw new Error('No "set-cookie" header present on response, aborting ...')
  }

  const { Tunn3lShop: sessionId } = cookie.parse(cookieStr)

  if (!sessionId) {
    throw new Error('No "Tunn3lShop" cookie present on response, aborting ...')
  }

  const loginHeaders = createHeaders(sessionId)

  const loginResponse = await fetch(baseURL, {
    method: 'post',
    body: `ctrl=do&do=checkout_connect_user&email=${encodeURIComponent(
      email
    )}&password=${encodeURIComponent(password)}`,
    headers: loginHeaders,
    redirect: 'manual',
  })

  const loginResponseBody = await loginResponse.text()

  if (loginResponse.status !== 200) {
    throw new Error('Expected status 200 from login request')
  } else if (loginResponseBody === 'invalid') {
    throw new Error('Invalid login')
  }

  return sessionId
}

export async function retrieveReservationStats(sessionId: string) {
  const headers = createHeaders(sessionId)

  const response = await fetch(baseURL, {
    method: 'post',
    headers,
    body: `ctrl=do&do=getCustomerBookings&format=1&origin_customer=1`,
  })

  const responseBody: Reservation[] = await response.json()

  if (!Array.isArray(responseBody)) {
    throw new Error('Expected reservations request to return an array')
  }

  // VäistöCoaching
  let totalTime = 240

  const coachesMap: Record<
    string,
    { id: string; name: string; instagram?: string; minutes: number }
  > = {
    leenavaisto: {
      id: 'leenavaisto',
      name: 'Leena',
      instagram: 'leenavaisto',
      minutes: 215,
    },
    '0': {
      id: '0',
      name: 'No Coaching',
      minutes: -120,
    },
    '54': {
      id: '54',
      name: 'Taneli',
      instagram: 'jedimaisteri',
      minutes: 0,
    },
    '105': {
      id: '105',
      name: 'Antti',
      minutes: 0,
    },
    '941': {
      id: '941',
      name: 'Lassi',
      instagram: 'lassilainen',
      minutes: 0,
    },
    '1197': {
      id: '1197',
      name: 'Bergius',
      instagram: 'jerebergius',
      minutes: 0,
    },
    '42412': {
      id: '42412',
      name: 'Ferni',
      instagram: 'fernandogurdian',
      minutes: 0,
    },
    '6558': {
      id: '6558',
      name: 'Eikka',
      instagram: 'aeroeizhens',
      minutes: 0,
    },
    '42256': {
      id: '42256',
      name: 'Aaro',
      instagram: 'aarohilli',
      minutes: 50,
    },
    '48554': {
      id: '48554',
      name: 'Byman',
      instagram: 'jerebyman',
      minutes: 10,
    },
    schimmell: {
      id: 'schimmell',
      name: 'Emil Bech',
      instagram: 'schimmell',
      minutes: 15,
    },
  }

  for (const reservation of responseBody) {
    const minutes = Number(reservation.origin_minutes.slice(0, -1))
    totalTime += Math.round(minutes)

    if (!coachesMap[reservation.coach_id]) {
      coachesMap[reservation.coach_id] = {
        id: reservation.coach_id,
        name: reservation.coach_id,
        minutes: 0,
      }
    }

    coachesMap[reservation.coach_id].minutes += minutes
  }

  return {
    totalTime,
    coaches: Object.values(coachesMap).sort((a, b) => b.minutes - a.minutes),
  }
}
