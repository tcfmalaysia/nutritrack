import { NextRequest, NextResponse } from 'next/server';

export async function DELETE() {
  return NextResponse.json({ message: 'Use client-side storage' });
}

export async function PATCH() {
  return NextResponse.json({ message: 'Use client-side storage' });
}
