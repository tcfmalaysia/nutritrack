import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    goal: { calories: 2000, protein: 50, carbs: 250, fat: 65, fiber: 25 },
    message: 'Goals are stored client-side in IndexedDB'
  });
}

export async function POST() {
  return NextResponse.json({ message: 'Goals saved client-side' });
}
