import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const adcode = req.nextUrl.searchParams.get('adcode')
  if (!adcode) return NextResponse.json({ status: '0' })
  const url = `https://restapi.amap.com/v3/weather/weatherInfo?key=${process.env.AMAP_KEY}&adcode=${adcode}&extensions=base`
  const data = await fetch(url).then(r => r.json())
  return NextResponse.json(data)
}
