import { NextRequest, NextResponse } from 'next/server';

// All data is now stored client-side in IndexedDB
// These API routes are kept for backward compatibility but return a redirect message

export async function GET(req: NextRequest) {
  return NextResponse.json({
    meals: [],
    message: 'Data is stored locally on your device via IndexedDB'
  });
}

export async function POST(req: NextRequest) {
  return NextResponse.json({
    error: 'Data is stored locally on your device. Use the app UI to save meals.',
    message: 'Client-side storage is active'
  });
}
