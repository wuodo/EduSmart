import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { admissionNumber: string } }
) {
  try {
    let { admissionNumber } = params;
    if (!admissionNumber) {
      return NextResponse.json(
        { message: 'Admission number is required' },
        { status: 400 }
      );
    }
    // Normalize admission number
    admissionNumber = admissionNumber.trim().replace(/[\u200B-\u200D\uFEFF]/g, '').toUpperCase();
    // Convert underscores back to forward slashes for backend request
    const originalAdmissionNumber = admissionNumber.replace(/_/g, '/');
    console.log('Normalized admission number:', admissionNumber);
    console.log('Original admission number:', originalAdmissionNumber);

    const response = await fetch(
      `http://localhost:5000/api/students/${originalAdmissionNumber}/dashboard`,
      {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { 
          message: data.message || 'Failed to fetch dashboard data',
          details: data.details
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in dashboard API route:', error);
    return NextResponse.json(
      { 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 