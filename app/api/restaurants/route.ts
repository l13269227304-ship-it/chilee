import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lng = searchParams.get('lng'), lat = searchParams.get('lat'), radius = searchParams.get('radius') || '1000'
  if (!lng || !lat) return NextResponse.json({ status: '0' })
  const url = `https://restapi.amap.com/v3/place/around?key=${process.env.AMAP_KEY}&location=${lng},${lat}&radius=${radius}&types=050000&offset=50&page=1`
  const data = await fetch(url).then(r => r.json())
  return NextResponse.json(data)
}
