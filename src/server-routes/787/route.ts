import { NextResponse } from 'next/server'

export async function GET() {
  // Server-side redirect to the requested YouTube URL
  return NextResponse.redirect('https://youtu.be/watch?v=qNw8ejrI0nM')
}
