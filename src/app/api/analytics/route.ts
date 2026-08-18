import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    dailyTotals: [],
    summary: { avgCalories: 0, avgProtein: 0, avgCarbs: 0, avgFat: 0, daysTracked: 0, totalDays: 7 },
    message: 'Analytics are calculated client-side from IndexedDB'
  });
}
